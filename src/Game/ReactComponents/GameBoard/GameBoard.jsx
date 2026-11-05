import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styled, { css, keyframes } from "styled-components";
import { DeadPlayer } from "./Pieces/DeadPlayerPiece";
import { ExplodingKaiju } from "./Pieces/ExplodingKaijuPiece";
import { PauseModal } from "./PauseModal";
import { getIsDialogueLog } from "Game/DataClasses/DialogueLog";
import { GameBoardPieceComponent } from 'Game/ReactComponents/GameBoard/Pieces/GameBoardPieceComponent'
import { getSpeechScreenBox, PagedSpeechBalloon, SpeechBalloon } from 'Game/ReactComponents/GameBoard/SceneElements';
import { TileCanvas } from 'Game/ReactComponents/GameBoard/Tile/TileCanvas';
import { SceneElements } from 'Game/ReactComponents/GameBoard/SceneElements';
import { CHARACTER_FEET, CHARACTER_HEIGHT_PX, EXIT_OPEN_PHASE, getSortZIndex, getTileTone } from 'Game/DataClasses/Levels/levels';
import { WakeCanvas } from 'Game/ReactComponents/GameBoard/WakeCanvas';
import { Camera, CAMERA, getCloseZoom, getFitZoom, WIDE_SHOT } from 'Game/DataClasses/Camera';
import { CUTSCENE } from 'Game/DataClasses/GameManager';
import { SpeechBubbleScale } from 'Game/ReactComponents/GameBoard/recruitLook';
import { getHexRadius } from 'Game/DataClasses/GameBoard/hexGrid';
import { startRagdoll } from 'Game/DataClasses/Ragdoll';

// a body lying at rest where its feet were: on its side, still
const getRestingBody = ({ x, y }, pieceScale, rowPx) => ({
  ...startRagdoll({ x: x - CHARACTER_FEET.x * pieceScale - CHARACTER_FEET.leftShift, y: y - CHARACTER_FEET.y * pieceScale }, { x: 0, y: 0 }, rowPx),
  vx: 0, vy: 0, vHeight: 0, spin: 0, angle: 90, isResting: true
});

const Board = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: default;
  touch-action: manipulation;
`;

// a train rattling through. sized a little over the view, so its edges never show.
const trainRumble = keyframes`
  0%, 100% { transform: scale(1.012) translate(0.12%, 0.18%); }
  14% { transform: scale(1.012) translate(-0.16%, -0.1%); }
  29% { transform: scale(1.012) translate(0.1%, -0.2%); }
  43% { transform: scale(1.012) translate(-0.1%, 0.2%); }
  57% { transform: scale(1.012) translate(0.18%, 0.06%); }
  71% { transform: scale(1.012) translate(-0.18%, 0.12%); }
  86% { transform: scale(1.012) translate(0.06%, -0.16%); }
`;

const SceneShake = styled.div`
  position: absolute;
  inset: 0;
  ${props => props.$isShaking && css`animation: ${trainRumble} 0.32s linear infinite;`}
`;

// the level. the camera moves and scales this.
const World = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  transition: transform ${CAMERA.panTransitionMs}ms linear;
`;

const WorldContent = styled.div`
  position: absolute;
`;

const LevelLayer = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  transition: opacity 2s;
`;

// points at an enemy outside of the view, like a compass needle. bigger means closer.
const CARET_LOOK = {
  rim: "#f6efd9",
  rimWidth: 6, // in the caret's own 100 x 100 drawing
  centerLineWidth: 4,
  shadeOpacity: 0.35 // one half of the needle is darker, as on a compass rose
};

const EdgeCaret = styled.svg`
  position: absolute;
  z-index: 2147483000;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(0 0 2px black);
`;

// what a caret points at, shown at its base: a map site's icon, or a hologram window on an enemy coming in
const CARET_INFO = {
  iconHeight: 2.6, // a site icon, in caret sizes
  windowWidth: 7.2, // a hologram window, in caret sizes
  windowHeight: 8.4,
  inset: 1.3, // how far in from the caret, past it, in caret sizes
  nearTiles: 12, // an incoming enemy this close gets a window even with others on the board: about as far as the tiles show
  maxWindows: 2,
  green: "#6dffa0"
};

// the Subway's warning: while its lights flash and both are out of shot, two comic-book panels at the top show them
const TRAIN_LOOK = {
  phase: "trainLights",
  trainPhase: "train",
  sheetFrames: 3, // off, then the two flashing frames
  flashSeconds: 1 // both frames, at the lights' own 2 frames a second
};

const lightFlash = keyframes`
  from { background-position: 50% 0; }
  to { background-position: 150% 0; }
`;

const LightInsets = styled.div`
  position: absolute;
  top: 2cqw;
  left: 0;
  right: 0;
  z-index: 2147483002;
  display: flex;
  justify-content: space-between;
  padding: 0 4cqw;
  pointer-events: none;
`;

// a panel cut from a comic: thick black edge, a white border, tilted a little, with halftone dots behind the light
const LightInset = styled.div`
  width: 7cqw;
  height: 9cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(255, 60, 60, 0.35) 1px, transparent 1.5px) 0 0 / 0.6cqw 0.6cqw, #1a0d10;
  border: 0.35cqw solid white;
  outline: 0.25cqw solid black;
  box-shadow: 0.5cqw 0.5cqw 0 black;
  transform: rotate(var(--tilt));
  animation: ${keyframes`from { transform: rotate(var(--tilt)) scale(0.4); opacity: 0; } to { transform: rotate(var(--tilt)) scale(1); opacity: 1; }`} 0.25s ease-out both;
`;

const LightSprite = styled.div`
  width: 4.4cqw;
  height: 8.6cqw;
  background-size: ${TRAIN_LOOK.sheetFrames * 100}% 100%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 0.8cqw #ff3030);
  animation: ${lightFlash} ${TRAIN_LOOK.flashSeconds}s steps(2) infinite;
`;

const trainTitleIn = keyframes`
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const trainTitlePulse = keyframes`
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
`;

// styled like the fight's end title, in purple with acid green-yellow
const TrainTitle = styled.div`
  position: absolute;
  top: 14cqw;
  left: 0;
  right: 0;
  z-index: 2147483003;
  text-align: center;
  pointer-events: none;
  font-family: gameboy;
  font-size: 2.5cqw;
  white-space: nowrap;
  text-transform: uppercase;
  color: #a03cff;
  -webkit-text-stroke: 0.12cqw #d8ff3a;
  text-shadow:
    0 0 0.6cqw #c8ff2a,
    -0.12cqw 0.12cqw 0 #5a14a0, -0.24cqw 0.24cqw 0 #4a1088, -0.36cqw 0.36cqw 0 #3a0c6e, -0.48cqw 0.48cqw 0 #2a0852,
    -0.6cqw 0.6cqw 0 #1a0436, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 2.5cqw #b6ff00;
  animation: ${trainTitleIn} 0.5s ease-out both, ${trainTitlePulse} 0.5s ease-in-out 0.5s infinite;
`;

const CaretIcon = styled.img`
  position: absolute;
  z-index: 2147483001;
  pointer-events: none;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px black) drop-shadow(0 0 6px var(--glow));
  translate: -50% -50%;
`;

const hologramFlicker = keyframes`
  0%, 100% { opacity: 0.92; }
  8% { opacity: 0.7; }
  9% { opacity: 0.95; }
  41% { opacity: 0.88; }
  42% { opacity: 0.6; }
  44% { opacity: 0.93; }
`;

// a hologram of whoever the caret points at, like a holochess piece: their sprite alone, glowing green,
// see-through, flickering, with a scan line rolling slowly down it. no box: it takes up no more of the screen than they do.
const hologramRoll = keyframes`
  from { top: -15%; }
  to { top: 105%; }
`;

const CaretWindow = styled.div`
  position: absolute;
  z-index: 2147483001;
  pointer-events: none;
  translate: -50% -50%;
  animation: ${hologramFlicker} 2.7s steps(1) infinite;
  /* the sprite in green light: tinted, brightened, glowing at its edges */
  filter: grayscale(1) sepia(1) hue-rotate(85deg) saturate(3.2) brightness(1.35) drop-shadow(0 0 4px ${CARET_INFO.green}) drop-shadow(0 0 10px rgba(109, 255, 160, 0.6));
  opacity: 0.82;
  /* fine scan lines across it, only where it is */
  -webkit-mask-image: repeating-linear-gradient(to bottom, black 0 2px, rgba(0, 0, 0, 0.55) 2px 3px);
  mask-image: repeating-linear-gradient(to bottom, black 0 2px, rgba(0, 0, 0, 0.55) 2px 3px);
  &::after {
    content: "";
    position: absolute;
    left: 15%;
    right: 15%;
    height: 12%;
    background: linear-gradient(to bottom, transparent, rgba(200, 255, 220, 0.55), transparent);
    mix-blend-mode: screen;
    animation: ${hologramRoll} 2.4s linear infinite;
  }
`;

// the play window's size, while it is being adjusted
const WindowSize = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1cqw;
  transform: translateX(-50%);
  z-index: 2147483001;
  padding: 0.3cqw 0.8cqw;
  border-radius: 0.4cqw;
  font-size: 1.2cqw;
  white-space: nowrap;
  pointer-events: none;
  color: #ffd24a;
  background: rgba(0, 0, 0, 0.75);
`;

const CHARM_COLOR = "#ff7ad9";
const RECRUIT_BODY_SIZE = 70; // at a 'pieceScale' of 1: the body then lies about as long as a character stands tall
const RECRUIT_LOOK_LEAN = 0.08; // how far the choice's camera leans with the mouse

// a shot with words in it keeps the whole balloon and the spot in view
const SHOT_FIT = {
  margin: 0.06, // room kept around them, as a fraction of the view
  feetRoomPx: 40, // the spot is usually someone's feet: a little floor under them too
  zoomStep: 0.94, // it pulls out this much at a time until everything fits
  maxSteps: 30
};
const RECRUIT_PROMPT_SHIFT = 130; // to the right of the player, clear of the teammate's words

const WinDimmer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.62);
  transition: opacity 1s;
`;

// lying where they fell
const RecruitBody = styled.img`
  position: absolute;
  z-index: 19000;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const RecruitPrompt = styled.div`
  position: absolute;
  z-index: 2147482500;
  display: flex;
  gap: 16px;
  transform-origin: 50% 100%;
`;

// the choice locks in: both buttons go, the chosen word flies to the middle and grows,
// the screen washes over in its color, and the word finishes itself in milk white
const RECRUIT_LOOK = {
  recruit: { button: "#2f7d57", wash: "rgba(38, 120, 52, 0.88)", suffix: "ED" }, // leaf green
  terminate: { button: "#a01230", wash: "rgba(120, 0, 12, 0.88)", suffix: "D" }, // blood red
  milk: "#f6f1e1",
  fadeMs: 250,
  flyMs: 900,
  washMs: 1200,
  suffixDelayMs: 1000,
  wordPx: 96, // the word's size in the middle of the screen, at most
  letterWidth: 1 // a letter's width in the pixel font, as a share of its size
};

const RecruitButton = styled.button`
  padding: 12px 22px;
  font-family: gameboy;
  font-size: 22px;
  cursor: pointer;
  color: #fbfbf0;
  background: ${props => RECRUIT_LOOK[props.$choice].button};
  border: 4px solid #101018;
  box-shadow: 0 4px 0 #101018;
  opacity: ${props => props.$isGone ? 0 : 1};
  pointer-events: ${props => props.$isGone ? "none" : "auto"};
  transition: opacity ${RECRUIT_LOOK.fadeMs}ms;
  &:hover {
    filter: brightness(1.3);
  }
`;

const washIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const ChoiceWash = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482400;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: ${washIn} ${RECRUIT_LOOK.washMs}ms ease-in both;
`;

// from where the button was to the middle, growing as it goes
const wordFly = keyframes`
  from { transform: translate(var(--from-x), var(--from-y)) scale(var(--from-scale)); color: #fbfbf0; }
  to { transform: translate(0, 0) scale(1); color: ${RECRUIT_LOOK.milk}; }
`;

const ChoiceWord = styled.div`
  position: absolute;
  z-index: 2147482450;
  left: 50%;
  top: 50%;
  margin: 0;
  font-family: gameboy;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 6px 0 #101018;
  translate: -50% -50%;
  animation: ${wordFly} ${RECRUIT_LOOK.flyMs}ms cubic-bezier(0.3, 0, 0.2, 1) both;
`;

const suffixArrive = keyframes`
  from { opacity: 0; transform: scale(1.8); }
  to { opacity: 1; transform: scale(1); }
`;

const ChoiceSuffix = styled.span`
  display: inline-block;
  animation: ${suffixArrive} 0.3s ease-out ${RECRUIT_LOOK.suffixDelayMs}ms both;
`;

const CHOICE_WORDS = { recruit: "Recruit", terminate: "Terminate" };

export const ChoiceButton = ({ choice, recruitChoice, onChooseRecruit }) => (
  <RecruitButton $choice={choice} $isGone={!!recruitChoice} onClick={event => onChooseRecruit(choice, event.currentTarget.getBoundingClientRect())}>
    {CHOICE_WORDS[choice]}
  </RecruitButton>
);

// the choice's last word needs energy: RECRUITED dances over green warp lines streaming upward;
// TERMINATED lurches from corner to corner, bursting bigger or smaller each time it lands, over a blood bag's rising air bubbles
const CHOICE_FX = {
  warpLines: 26,
  bubbles: 22,
  hopEverySeconds: 1.4, // RECRUITED's letters hop as a wave through the word this often (SpellCraft's "You Won", sped up)
  hopSeconds: 0.9,
  hopStagger: 0.07,
  lurchSeconds: 3.6 // TERMINATED's trip round its stops
};

const warpStreak = keyframes`
  from { transform: translateY(110%); opacity: 0; }
  15% { opacity: 1; }
  to { transform: translateY(-130%); opacity: 0; }
`;

const WarpLine = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.25%;
  background: linear-gradient(to top, transparent, rgba(160, 255, 170, 0.9) 45%, rgba(220, 255, 220, 1) 50%, transparent 70%);
  filter: drop-shadow(0 0 4px #6dff8a);
  animation: ${warpStreak} var(--seconds) linear var(--delay) infinite;
`;

const bubbleRise = keyframes`
  from { transform: translate(0, 0); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: translate(var(--sway), -55cqh); }
  to { transform: translate(calc(var(--sway) * -0.6), -115cqh); opacity: 0.8; }
`;

// an air bubble in the bag: clear, with a soft dark rim and a glint
const Bubble = styled.span`
  position: absolute;
  bottom: -12%;
  width: var(--size);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid rgba(20, 0, 4, 0.55);
  background: radial-gradient(circle at 32% 30%, rgba(255, 210, 215, 0.45) 0 12%, rgba(255, 160, 170, 0.08) 13% 60%, rgba(60, 0, 8, 0.12));
  animation: ${bubbleRise} var(--seconds) ease-in var(--delay) infinite;
`;

const EffectLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482420;
  overflow: hidden;
  pointer-events: none;
  container-type: size;
`;

const letterHop = keyframes`
  0%, ${(100 - CHOICE_FX.hopSeconds / CHOICE_FX.hopEverySeconds * 100).toFixed(1)}% { transform: translate(0, 0) scale(1, 1); }
  ${(100 - CHOICE_FX.hopSeconds / CHOICE_FX.hopEverySeconds * 74).toFixed(1)}% { transform: translate(0.05em, -0.32em) scale(0.92, 1.1); }
  ${(100 - CHOICE_FX.hopSeconds / CHOICE_FX.hopEverySeconds * 50).toFixed(1)}% { transform: translate(-0.02em, 0.08em) scale(1.1, 0.9); }
  ${(100 - CHOICE_FX.hopSeconds / CHOICE_FX.hopEverySeconds * 30).toFixed(1)}% { transform: translate(0.01em, -0.08em) scale(0.97, 1.03); }
  100% { transform: translate(0, 0) scale(1, 1); }
`;

const HopLetter = styled.span`
  display: inline-block;
  transform-origin: 50% 85%;
  white-space: pre;
  animation: ${letterHop} ${CHOICE_FX.hopEverySeconds}s ease-in-out var(--delay) infinite;
`;

// round its stops, uneven: in from the middle, to the top left, the top right, the bottom right, and round again
const lurch = keyframes`
  0% { transform: translate(0, 0); }
  18%, 30% { transform: translate(-26cqw, -22cqh); }
  48%, 60% { transform: translate(21cqw, -27cqh); }
  78%, 90% { transform: translate(17cqw, 24cqh); }
  100% { transform: translate(0, 0); }
`;

// its size bursts as it lands at each stop, and holds till the next
const burst = keyframes`
  0%, 17% { transform: scale(1); }
  20% { transform: scale(1.55); }
  23%, 47% { transform: scale(1.3); }
  50% { transform: scale(0.55); }
  53%, 77% { transform: scale(0.72); }
  80% { transform: scale(1.45); }
  83%, 100% { transform: scale(1.15); }
`;

const Lurch = styled.div`
  animation: ${lurch} ${CHOICE_FX.lurchSeconds}s cubic-bezier(0.7, 0, 0.3, 1) ${RECRUIT_LOOK.flyMs}ms infinite;
`;

const Burst = styled.div`
  animation: ${burst} ${CHOICE_FX.lurchSeconds}s linear ${RECRUIT_LOOK.flyMs}ms infinite;
`;

// fixed once, so the streaks and bubbles don't jump about between renders
const WARP_LINES = Array.from({ length: CHOICE_FX.warpLines }, (_, k) => ({ left: `${(k * 37) % 100}%`, seconds: `${0.45 + ((k * 13) % 7) * 0.08}s`, delay: `${-((k * 29) % 11) * 0.1}s` }));
const BUBBLES = Array.from({ length: CHOICE_FX.bubbles }, (_, k) => ({
  left: `${(k * 41) % 96}%`, size: `${2 + ((k * 7) % 6)}cqw`, seconds: `${3 + ((k * 11) % 5) * 0.6}s`, delay: `${-((k * 17) % 9) * 0.45}s`, sway: `${((k % 5) - 2) * 1.5}cqw`
}));

// 'from': where the pressed button was on the page, so the word starts there
const ChoiceConfirm = ({ choice, from, board }) => {
  const boardBox = board.getBoundingClientRect();
  const fromX = from ? from.left + from.width / 2 - (boardBox.left + boardBox.width / 2) : 0;
  const fromY = from ? from.top + from.height / 2 - (boardBox.top + boardBox.height / 2) : 0;
  // as big as it was made, unless the word with its ending would not fit across the screen
  const word = CHOICE_WORDS[choice] + RECRUIT_LOOK[choice].suffix;
  const wordPx = Math.min(RECRUIT_LOOK.wordPx, (boardBox.width * 0.9) / (word.length * RECRUIT_LOOK.letterWidth));
  // TERMINATED grows past its fitted size at its stops: it starts smaller, so it stays on the screen
  const sizePx = choice == "terminate" ? wordPx * 0.62 : wordPx;
  const fromScale = from ? Math.min(from.height / (sizePx * 1.6), 1) : 0.3;
  const letters = (CHOICE_WORDS[choice].toUpperCase() + RECRUIT_LOOK[choice].suffix).split("");
  const base = CHOICE_WORDS[choice].length;
  return (
    <>
      <ChoiceWash style={{ background: RECRUIT_LOOK[choice].wash }} />
      <EffectLayer>
        {choice == "recruit"
          ? WARP_LINES.map(({ left, seconds, delay }, k) => <WarpLine key={k} style={{ left, "--seconds": seconds, "--delay": delay }} />)
          : BUBBLES.map(({ left, size, seconds, delay, sway }, k) => <Bubble key={k} style={{ left, "--size": size, "--seconds": seconds, "--delay": delay, "--sway": sway }} />)}
      </EffectLayer>
      <EffectLayer style={{ zIndex: 2147482450 }}>
        <ChoiceWord style={{ fontSize: `${sizePx}px`, "--from-x": `${fromX}px`, "--from-y": `${fromY}px`, "--from-scale": fromScale }}>
          {choice == "recruit" ? letters.map((letter, k) => {
            const hop = <HopLetter key={k} style={{ "--delay": `${RECRUIT_LOOK.flyMs / 1000 + k * CHOICE_FX.hopStagger}s` }}>{letter}</HopLetter>;
            return k < base ? hop : <ChoiceSuffix key={k}>{hop}</ChoiceSuffix>;
          }) : (
            <Lurch><Burst>{CHOICE_WORDS[choice].toUpperCase()}<ChoiceSuffix>{RECRUIT_LOOK[choice].suffix}</ChoiceSuffix></Burst></Lurch>
          )}
        </ChoiceWord>
      </EffectLayer>
    </>
  );
};

const getIsEnemyInPlay = (player, piece) => piece.getTeamIndex() != player.getTeamIndex() && !piece.isDead && piece.isOnTiles;

const getClosestEnemy = (player, pieces) => {
  const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
  return pieces
    .filter(piece => getIsEnemyInPlay(player, piece))
    .reduce((closest, piece) => !closest || getDistance(piece) < getDistance(closest) ? piece : closest, undefined);
};

// the enemy zoom keeps to one enemy: another must be clearly closer, for a while, before the camera turns to them
const ENEMY_FOCUS = {
  closerBy: 0.3, // the new enemy is this much closer, as a share of the current one's distance
  holdMs: 800 // and stays that way this long
};

const makeEnemyFocus = () => {
  let current;
  let challenger;
  let challengerSinceMs = 0;
  return (player, pieces, nowMs) => {
    const closest = getClosestEnemy(player, pieces);
    if (!current || !getIsEnemyInPlay(player, current) || !closest) {
      current = closest;
      challenger = undefined;
      return current;
    }
    const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
    const isClearlyCloser = closest != current && getDistance(closest) < getDistance(current) * (1 - ENEMY_FOCUS.closerBy);
    if (!isClearlyCloser) {
      challenger = undefined;
    } else if (closest != challenger) {
      challenger = closest;
      challengerSinceMs = nowMs;
    } else if (nowMs - challengerSinceMs >= ENEMY_FOCUS.holdMs) {
      current = closest;
      challenger = undefined;
    }
    return current;
  };
};


// the Agent's ray: a flickering beam from him to each of the team
const rayFlicker = keyframes`
  0%, 100% { opacity: 0.95; }
  30% { opacity: 0.55; }
  60% { opacity: 1; }
`;

const RayBeams = styled.svg`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2147481000;
  overflow: visible;
  pointer-events: none;
  animation: ${rayFlicker} 0.18s steps(2) infinite;
`;

const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];

const getIsTouchScreen = () => window.matchMedia("(pointer: coarse)").matches;

export const GameBoard = ({ speakingPieceIndex = undefined, choiceFromRef = undefined, isWindowOpen = true, isPaused, gameManager, level, activePhases, isWholeScene, playWindow, isShowingWindowSize, isEditingTiles, isMouseLook, isEnemyZoom, isSlowMotion, isTeamColors, speech, recruitScene, recruitChoice, onChooseRecruit, onHotspot }) => {
  // redraws the pieces when the game updates. the tiles draw themselves.
  useSyncExternalStore(gameManager.subscribeToBoard, gameManager.getBoardRevision);
  const pieces = gameManager.getPieces();

  const boardRef = useRef(null);
  const ownChoiceFrom = useRef(undefined); // where the pressed Recruit or Terminate button was
  const choiceFrom = choiceFromRef || ownChoiceFrom; // with the log, the buttons are on it, and the game says where
  const chooseRecruit = (choice, buttonBox) => {
    if (recruitChoice) return;
    choiceFrom.current = buttonBox;
    onChooseRecruit(choice);
  };
  const worldRef = useRef(null);
  const mouseAim = useRef({ x: 0, y: 0 }); // where the mouse is in the view: -1 to 1, with 0 in the middle
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const isFrameMeasured = frame.width > 1;
  const { grid, world, contentOffset, pieceScale } = level;
  const getWorldLocation = ({ x, y }) => ({ x: x + contentOffset.x, y: y + contentOffset.y });

  useLayoutEffect(() => {
    const gameFrame = boardRef.current.closest("[data-game-frame]");
    const measure = () => setFrame({ width: gameFrame.clientWidth, height: gameFrame.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(gameFrame);
    return () => observer.disconnect();
  }, []);

  // the cameras work from the frame, which holds still while the window opens for a wide shot
  const worldSizes = { worldWidth: world.width, worldHeight: world.height };
  const windowWidth = frame.width * (playWindow.right - playWindow.left);
  const windowHeight = frame.height * (playWindow.bottom - playWindow.top);

  const closeCamera = useMemo(() => {
    const sizes = { ...worldSizes, viewWidth: windowWidth, viewHeight: windowHeight };
    return new Camera({
      ...sizes,
      // zoomed for the whole frame: a smaller window shows less of the level, with tiles at the same size
      zoom: isWholeScene ? getFitZoom(sizes) : getCloseZoom({
        ...worldSizes,
        viewWidth: frame.width,
        viewHeight: frame.height,
        hexWidthPx: getHexRadius(grid) * 2,
        cameraZoom: level.cameraZoom,
        isTouch: getIsTouchScreen()
      })
    });
  }, [level, frame, isWholeScene, playWindow]);

  // the window opens up to the whole frame for wide shots, unless the monitor always stays: then every shot is framed inside it
  const shotView = isWindowOpen ? { viewWidth: frame.width, viewHeight: frame.height } : { viewWidth: windowWidth, viewHeight: windowHeight };

  const wideCamera = useMemo(() => {
    const sizes = { ...worldSizes, ...shotView };
    const camera = new Camera({ ...sizes, zoom: getFitZoom(sizes) });
    camera.centerOn({ x: world.width / 2, y: world.height / 2 });
    return camera;
  }, [level, frame, isWindowOpen, playWindow]);

  // in the monitor, a walking scene fills the screen and follows the player: seen whole, a wide scene is a thin strip.
  // its first shot (and any wide shot) still shows the whole scene.
  const coverCamera = useMemo(() => {
    const sizes = { ...worldSizes, ...shotView };
    return new Camera({ ...sizes, zoom: Math.max(shotView.viewWidth / world.width, shotView.viewHeight / world.height) });
  }, [level, frame, isWindowOpen, playWindow]);
  const getIsCoverScene = () => level.isWalkingLevel && !level.isMapWalk && !isWindowOpen && !gameManager.getIsWideShot();

  // walking scenes are made to be seen whole, unless the monitor always stays
  const getIsWholeLevelInView = () => (level.isWalkingLevel && !level.isMapWalk && isWindowOpen) || gameManager.getIsWideShot();
  const isWideShot = getIsWholeLevelInView();
  const camera = isWideShot ? wideCamera : closeCamera;

  // the camera for a cutscene's shot: it looks at a spot, and can lean with the mouse
  const fullFrameSizes = { worldWidth: world.width, worldHeight: world.height, ...shotView };
  // with words on screen, the shot looks between the spot and the balloon, and pulls out until both fit
  const speechRef = useRef(speech);
  speechRef.current = speech; // the camera's loop is set up once, and reads the words from here
  const getShotFraming = ({ point, zoomScale, isCover }) => {
    const fitZoom = getFitZoom(fullFrameSizes);
    const coverZoom = Math.max(shotView.viewWidth / world.width, shotView.viewHeight / world.height);
    let zoom = (isCover ? coverZoom : fitZoom) * zoomScale;
    const speech = speechRef.current;
    if (!speech || speech.isLogged) return { zoom, center: point }; // words in the log take no room in the shot
    const box = getSpeechScreenBox(speech, SpeechBubbleScale);
    const usedWidth = shotView.viewWidth * (1 - SHOT_FIT.margin * 2);
    const usedHeight = shotView.viewHeight * (1 - SHOT_FIT.margin * 2);
    let center = point;
    for (let step = 0; step < SHOT_FIT.maxSteps; step += 1) {
      const left = Math.min(point.x, speech.x + box.left / zoom);
      const right = Math.max(point.x, speech.x + box.right / zoom);
      const top = Math.min(point.y, speech.y + box.top / zoom);
      const bottom = Math.max(point.y + SHOT_FIT.feetRoomPx, speech.y + box.bottom / zoom);
      center = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const isFitting = (right - left) * zoom <= usedWidth && (bottom - top) * zoom <= usedHeight;
      if (isFitting || zoom <= fitZoom) break;
      zoom = Math.max(zoom * SHOT_FIT.zoomStep, fitZoom);
    }
    return { zoom, center };
  };

  const getShotCamera = shot => {
    const { zoom, center } = getShotFraming(shot);
    const shotCamera = new Camera({ ...fullFrameSizes, zoom });
    const lean = shot.isFollowingMouse ? shotView.viewWidth / shotCamera.zoom * RECRUIT_LOOK_LEAN : 0;
    shotCamera.centerOn({ x: center.x + mouseAim.current.x * lean, y: center.y + mouseAim.current.y * lean });
    return shotCamera;
  };

  useEffect(() => {
    let wasWideShot = getIsWholeLevelInView();
    let lastShot = undefined;
    let pullEndMs = 0;
    let pullMs = WIDE_SHOT.pullMs;
    let pullEase = "ease-in-out";
    let isCutting = false; // the camera is already there when the shot starts
    const pickEnemy = makeEnemyFocus();
    const moveCamera = () => {
      const player = gameManager.getFocusPiece();
      if (!player || !worldRef.current) return;
      const shot = gameManager.getCameraShot();
      const isWide = getIsWholeLevelInView();
      const nowMs = performance.now();
      if (isWide != wasWideShot || shot != lastShot) {
        if (lastShot && !shot) closeCamera.centerOn(getWorldLocation(player.charLocation));
        wasWideShot = isWide;
        lastShot = shot;
        pullMs = shot && shot.panMs || WIDE_SHOT.pullMs;
        pullEase = shot && shot.ease || "ease-in-out";
        pullEndMs = shot && shot.isCut ? 0 : nowMs + pullMs;
        isCutting = !!shot && !!shot.isCut;
      }
      const isFollowingMouse = !!shot && shot.isFollowingMouse && nowMs >= pullEndMs;
      worldRef.current.style.transition = isCutting ? "none" : isFollowingMouse ? `transform ${CAMERA.panTransitionMs}ms linear` : nowMs < pullEndMs ? `transform ${pullMs}ms ${pullEase}` : "";
      isCutting = false;
      if (shot && !shot.isWide) {
        worldRef.current.style.transform = getShotCamera(shot).getTransform();
        return;
      }
      if (getIsCoverScene()) {
        // the view slides across the scene as the player does: at its left edge, the scene's left edge shows, and so on,
        // so whatever is at the sides (the Lab's tanks and their labels) comes into view as the player heads that way
        const viewWidth = shotView.viewWidth / coverCamera.zoom;
        const viewHeight = shotView.viewHeight / coverCamera.zoom;
        const { x, y } = getWorldLocation(player.charLocation);
        const across = (value, size, view) => view / 2 + Math.min(Math.max(value / size, 0), 1) * (size - view);
        coverCamera.centerOn({ x: across(x, world.width, viewWidth), y: across(y, world.height, viewHeight) });
        worldRef.current.style.transform = coverCamera.getTransform();
        return;
      }
      if (!isWide) {
        // the keys are in charge when the mouse's hover is hidden
        const isLooking = isMouseLook && !!gameManager.getHoveredTileIndex();
        const closestEnemy = isEnemyZoom ? pickEnemy(player, gameManager.getPieces(), nowMs) : undefined;
        closeCamera.lookToward(
          getWorldLocation(player.charLocation),
          isLooking ? mouseAim.current : { x: 0, y: 0 },
          closestEnemy ? getWorldLocation(closestEnemy.charLocation) : undefined
        );
      }
      worldRef.current.style.transform = (isWide ? wideCamera : closeCamera).getTransform();
    };
    closeCamera.centerOn(getWorldLocation(gameManager.getFocusPiece().charLocation));
    coverCamera.centerOn(getWorldLocation(gameManager.getFocusPiece().charLocation));
    moveCamera();
    return gameManager.subscribeToBoard(moveCamera);
  }, [gameManager, closeCamera, wideCamera, coverCamera, isMouseLook, isEnemyZoom]);

  // everything animated plays in slow motion once the match is won
  // once a fight is over, the game eases into slow motion: the animations follow its speed
  const slowRate = isSlowMotion ? "outcome" : gameManager.isChaseSlowed ? CUTSCENE.chaseSlowSpeed : undefined;
  useEffect(() => {
    if (!slowRate) return;
    const getRate = () => slowRate == "outcome" ? gameManager.getTimeScale() : slowRate;
    // transitions are left alone: the camera's pull and the bodies' easing between ticks already run on game time
    const getIsTransition = animation => typeof CSSTransition != "undefined" && animation instanceof CSSTransition;
    const setRate = rate => worldRef.current && worldRef.current.getAnimations({ subtree: true }).forEach(animation => {
      if (!getIsTransition(animation)) animation.playbackRate = rate;
    });
    const interval = setInterval(() => setRate(getRate()), 100);
    setRate(getRate());
    return () => {
      clearInterval(interval);
      setRate(1);
    };
  }, [slowRate]);

  const focusPiece = pieces.length ? gameManager.getFocusPiece() : undefined;
  const siteTargets = (level.sites || []).map(({ spot, color, icon }) => ({ key: `${spot.x} ${spot.y}`, color, charLocation: spot, icon }));
  // in a walking scene that fills the monitor, a caret points the way out once it is open (Sewer 1's "Deeper")
  const isCoverScene = getIsCoverScene();
  const caretCamera = isCoverScene ? coverCamera : closeCamera;
  const exitTargets = level.exit && activePhases.includes(EXIT_OPEN_PHASE) ? [{ key: "exit", color: "white", charLocation: level.exit.spot }] : [];
  const tilePx = grid.rowStep * grid.scale;
  const caretTargets = (isWideShot || !focusPiece ? [] : (isCoverScene ? exitTargets : [
    ...pieces
      .filter(p => p.getTeamIndex() != focusPiece.getTeamIndex() && !p.isDead)
      .map(p => ({ key: p.pieceIndex, color: p.color, charLocation: p.charLocation, piece: p })),
    ...siteTargets
  ]))
    .map(target => ({
      ...target,
      caret: caretCamera.getEdgeCaret(getWorldLocation(target.charLocation), getWorldLocation(focusPiece.charLocation), tilePx),
      tiles: Math.hypot(target.charLocation.x - focusPiece.charLocation.x, target.charLocation.y - focusPiece.charLocation.y) / tilePx
    }));
  // a hologram window for an enemy off the screen: when no other is on the board in view, or when it comes in close.
  // at most two, the closest.
  // the Subway's signal lights, flashing: shown in panels when neither is in shot
  const signalLights = (level.sceneElements || []).filter(({ phase }) => phase == TRAIN_LOOK.phase);
  const isTrainWarning = activePhases.includes(TRAIN_LOOK.phase);
  const isLightsOutOfShot = isTrainWarning && !isWideShot && !!focusPiece && signalLights.length > 0 && signalLights.every(({ x, y, width, height }) =>
    !!caretCamera.getEdgeCaret(getWorldLocation({ x: x + width / 2, y: y + height / 2 }), getWorldLocation(focusPiece.charLocation), tilePx));
  const trainWarning = isTrainWarning && (
    <>
      {!activePhases.includes(TRAIN_LOOK.trainPhase) && <TrainTitle>Train incoming!</TrainTitle>}
      {isLightsOutOfShot && (
        <LightInsets>
          {signalLights.map(({ id, src }, k) => (
            <LightInset key={id} style={{ "--tilt": `${k % 2 ? 4 : -4}deg` }}>
              <LightSprite style={{ backgroundImage: `url(${src})` }} />
            </LightInset>
          ))}
        </LightInsets>
      )}
    </>
  );
  const enemiesInView = caretTargets.filter(({ piece, caret }) => piece && !caret && piece.isOnTiles);
  const windowKeys = new Set(caretTargets
    .filter(({ piece, caret, tiles }) => piece && caret && (!enemiesInView.length || tiles <= CARET_INFO.nearTiles))
    .sort((a, b) => a.tiles - b.tiles)
    .slice(0, CARET_INFO.maxWindows)
    .map(({ key }) => key));
  const getInward = ({ left, top, size, degrees }, distance) => ({
    x: left - Math.cos(degrees * Math.PI / 180) * size * distance,
    y: top - Math.sin(degrees * Math.PI / 180) * size * distance
  });
  const edgeCarets = caretTargets
    .filter(({ caret }) => !!caret)
    .map(({ key, color, icon, piece, caret }) => (
      <React.Fragment key={key}>
        {icon && (() => {
          const spot = getInward(caret, CARET_INFO.inset);
          return <CaretIcon src={`/levels/map/${icon}.png`} style={{ left: `${spot.x}px`, top: `${spot.y}px`, height: `${caret.size * CARET_INFO.iconHeight}px`, "--glow": color }} />;
        })()}
        {windowKeys.has(key) && (() => {
          const width = caret.size * CARET_INFO.windowWidth;
          const height = caret.size * CARET_INFO.windowHeight;
          const spot = getInward(caret, CARET_INFO.inset + CARET_INFO.windowWidth / 2);
          const scale = height / (CHARACTER_HEIGHT_PX * (piece.avatar == 'kaiju' ? 1.6 : 1.15));
          return (
            <CaretWindow style={{ left: `${spot.x}px`, top: `${spot.y}px`, width: `${width}px`, height: `${height}px` }}>
              <GameBoardPieceComponent
                zIndex={0}
                charLocation={{ x: width / 2 - CHARACTER_FEET.x * scale - CHARACTER_FEET.leftShift, y: height * 0.82 - CHARACTER_FEET.y * scale }}
                avatar={piece.avatar}
                color="transparent"
                isVisible
                dir={piece.dir}
                facingDir={piece.getFacingDir()}
                pieceScale={scale}
                spriteSheetSrc={piece.spriteSheetSrc}
                lives={piece.lives}
                isQuiet
              />
            </CaretWindow>
          );
        })()}
        {renderCaret(color, caret)}
      </React.Fragment>
    ));
  function renderCaret(color, { left, top, size, degrees }) {
    return (
      <EdgeCaret viewBox="0 0 100 100" style={{
        left: `${left - size / 2}px`,
        top: `${top - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${degrees}deg)`
      }}>
        <path d="M100 50 L0 10 L24 50 L0 90 Z" fill={color} />
        <path d="M100 50 L24 50 L0 90 Z" fill="black" opacity={CARET_LOOK.shadeOpacity} />
        <path d="M100 50 L0 10 L24 50 L0 90 Z" fill="none" stroke={CARET_LOOK.rim} strokeWidth={CARET_LOOK.rimWidth} strokeLinejoin="round" />
        <path d="M100 50 L24 50" stroke={CARET_LOOK.rim} strokeWidth={CARET_LOOK.centerLineWidth} />
      </EdgeCaret>
    );
  }

  // the keys move and use powers. the mouse only looks around, and clicks scene objects and buttons.
  const handleMouseMove = e => {
    if (getIsTouchScreen()) return;
    const board = boardRef.current.getBoundingClientRect();
    const getAim = (spot, start, size) => Math.max(Math.min(((spot - start) / size) * 2 - 1, 1), -1);
    mouseAim.current = { x: getAim(e.clientX, board.left, board.width), y: getAim(e.clientY, board.top, board.height) };
  };

  const handleMouseLeave = () => {
    mouseAim.current = { x: 0, y: 0 };
  };

  const mouseHandlers = useRef(null);
  mouseHandlers.current = { handleMouseMove, handleMouseLeave };

  // the mouse counts everywhere on the page, so the empty area around a small play window still aims
  const isChoosingRef = useRef(false);
  isChoosingRef.current = !!recruitScene;
  useEffect(() => {
    const move = e => {
      document.body.style.cursor = "";
      if (boardRef.current) boardRef.current.style.cursor = isChoosingRef.current ? "pointer" : "";
      mouseHandlers.current.handleMouseMove(e);
    };
    // browsers can't move the cursor, so it hides while the keys are in charge. not at the Recruit or Terminate choice: the hand stays there.
    const hideCursor = ({ code }) => {
      if (!MOVEMENT_KEYS.includes(code) || isChoosingRef.current) return;
      document.body.style.cursor = "none";
      if (boardRef.current) boardRef.current.style.cursor = "none";
    };
    const leave = () => mouseHandlers.current.handleMouseLeave();
    document.addEventListener("mousemove", move);
    document.addEventListener("keydown", hideCursor);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("keydown", hideCursor);
      document.body.style.cursor = "";
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  const piecesComponents = pieces.map(p =>
    <GameBoardPieceComponent
      key={p.pieceIndex}
      zIndex={p.introZIndex ?? p.getZIndex()}
      charLocation={p.charLocation}
      avatar={p.avatar}
      color={p.isPlain ? "transparent" : p.isCharmed ? CHARM_COLOR : p.color}
      isVisible={p.isVisible}
      isHealed={p.isHealed}
      isCharmed={p.isCharmed}
      isTeleported={p.isTeleported}
      isFalling={p.isFalling}
      dir={p.dir}
      facingDir={p.getFacingDir()}
      pieceScale={pieceScale * (p.perspectiveScale || 1)}
      spriteSheetSrc={p.spriteSheetSrc}
      lives={p.lives}
      isGoingToSpewFire={p.isGoingToSpewFire}
      isShowHealthBarOnComponent={p.isShowHealthBarOnComponent}
      isQuiet={!!recruitScene}
      isSpeaking={p.pieceIndex === speakingPieceIndex}
    />
  );

  const currentShot = gameManager.getCameraShot();
  // the zoom the balloons are drawn for: the shot's, the follow camera's in a scene that fills the monitor, or the whole scene's
  const shotZoom = currentShot && !currentShot.isWide ? getShotFraming(currentShot).zoom
    : getIsCoverScene() ? coverCamera.zoom
    : getFitZoom(fullFrameSizes) * ((recruitScene && recruitScene.shot.zoomScale) || 1);
  const overlayScale = SpeechBubbleScale / shotZoom;

  // a balloon is kept inside the scene: near an edge, it slides in (the tail still starts from the same spot on it)
  const getSpeechX = currentSpeech => {
    const box = getSpeechScreenBox(currentSpeech, overlayScale);
    const margin = world.width * 0.02;
    const pastLeft = Math.max(margin - (currentSpeech.x + box.left), 0);
    const pastRight = Math.max(currentSpeech.x + box.right - (world.width - margin), 0);
    return currentSpeech.x + pastLeft - pastRight;
  };

  const deathPiecesComponents = recruitScene ? [] : gameManager.getDeathPieces().map(death => {
    const { key, avatar, charLocation, color, zIndex, body } = death;
    return avatar == 'kaiju' ?
      <ExplodingKaiju key={key} charLocation={charLocation} color={color} zIndex={zIndex} />
      : <DeadPlayer key={key} avatar={avatar} pieceScale={pieceScale} charLocation={charLocation} body={body} spriteSheetSrc={death.spriteSheetSrc} color={color} zIndex={zIndex} />;
  });

  const foregroundLayers = level.foregroundLayers.map(({ src, x, y, width, height, sortY }) => (
    <LevelLayer
      key={src}
      src={src}
      style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, zIndex: getSortZIndex(level, sortY), opacity: isPaused ? 0 : 1 }}
    />
  ));

  const levelLayers = level.layers.map(({ src, zIndex }) => (
    <LevelLayer
      key={src}
      src={src}
      style={{ zIndex, width: `${world.width}px`, height: `${world.height}px`, opacity: isPaused ? 0 : 1 }}
    />
  ));

  return (
    <Board
      ref={boardRef}
      style={recruitScene ? { cursor: "pointer" } : undefined}>
      {isPaused && <PauseModal />}
      <SceneShake $isShaking={!isPaused && level.shakePhases.some(id => activePhases.includes(id))}>
      {/* paused: the whole scene fades, and only the word "Paused" shows */}
      <World ref={worldRef} data-game-world style={{ width: `${world.width}px`, height: `${world.height}px`, opacity: isPaused ? 0 : 1, transition: "opacity 0.3s" }}>
        {levelLayers}
        {foregroundLayers}
        <SceneElements level={level} activePhases={activePhases} isPaused={isPaused} onHotspot={onHotspot} isDialogueLog={getIsDialogueLog()} />
        {isSlowMotion && !recruitScene && <WinDimmer />}
        {recruitScene && (recruitScene.body.spriteSheetSrc ? (
          // their own sprite, lying still on their side: the same body a ragdoll comes to rest as
          <DeadPlayer
            avatar={recruitScene.body.avatar}
            pieceScale={pieceScale}
            spriteSheetSrc={recruitScene.body.spriteSheetSrc}
            color={recruitScene.body.color}
            zIndex={getSortZIndex(level, recruitScene.body.y) - 20001}
            body={getRestingBody(recruitScene.body, pieceScale, grid.rowStep * grid.scale)}
          />
        ) : <RecruitBody src={`/levels/dead/${recruitScene.body.avatar}.png`} style={{
          left: `${recruitScene.body.x}px`,
          top: `${recruitScene.body.y}px`,
          height: `${pieceScale * RECRUIT_BODY_SIZE}px`
        }} />)}
        {recruitScene && !getIsDialogueLog() && (
          <RecruitPrompt style={{ left: `${recruitScene.prompt.x}px`, top: `${recruitScene.prompt.y}px`, transform: `translate(-50%, -100%) scale(${overlayScale}) translateX(${RECRUIT_PROMPT_SHIFT}px)` }}>
            <ChoiceButton choice="recruit" recruitChoice={recruitChoice} onChooseRecruit={chooseRecruit} />
            <ChoiceButton choice="terminate" recruitChoice={recruitChoice} onChooseRecruit={chooseRecruit} />
          </RecruitPrompt>
        )}
        {gameManager.getRayBeam() && (() => {
          const { from, color, targets } = gameManager.getRayBeam();
          return (
            <RayBeams width={world.width} height={world.height}>
              {targets.map(({ x, y }, k) => (
                <g key={k}>
                  <line x1={from.x} y1={from.y} x2={x} y2={y} stroke={color} strokeWidth={18} strokeOpacity={0.35} strokeLinecap="round" />
                  <line x1={from.x} y1={from.y} x2={x} y2={y} stroke="white" strokeWidth={5} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={26} fill={color} fillOpacity={0.45} />
                </g>
              ))}
              <circle cx={from.x} cy={from.y} r={16} fill="white" />
            </RayBeams>
          );
        })()}
        {speech && !isPaused && !speech.isLogged && (speech.lines
          ? <PagedSpeechBalloon name={speech.name} lines={speech.lines} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />
          : <SpeechBalloon name={speech.name} text={speech.text} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />)}
        <WorldContent style={{ left: `${contentOffset.x}px`, top: `${contentOffset.y}px` }}>
          {/* canvases are sized from the zoom, which means nothing until the frame has been measured */}
          {isFrameMeasured && <TileCanvas gameManager={gameManager} level={level} tone={getTileTone(level, activePhases)} isVisible={!isPaused && !isEditingTiles} zoom={closeCamera.zoom} isTeamColors={isTeamColors} />}
          {isFrameMeasured && <WakeCanvas gameManager={gameManager} level={level} zoom={closeCamera.zoom} isActive={!!level.flood && activePhases.includes(level.flood.phase)} />}
          {piecesComponents}
          {deathPiecesComponents}
        </WorldContent>
      </World>
      </SceneShake>
      {recruitScene && recruitChoice && <ChoiceConfirm choice={recruitChoice} from={choiceFrom.current} board={boardRef.current} />}
      {!isPaused && edgeCarets}
      {!isPaused && trainWarning}
      {isShowingWindowSize && (
        <WindowSize>
          {Math.round((playWindow.right - playWindow.left) * 100)}% x {Math.round((playWindow.bottom - playWindow.top) * 100)}% of the frame:
          {" "}{Math.floor(windowWidth / (grid.colStep * grid.scale * closeCamera.zoom))} x {Math.floor(windowHeight / (grid.rowStep * grid.scale * closeCamera.zoom))} tiles in view
        </WindowSize>
      )}
    </Board>
  );
};
