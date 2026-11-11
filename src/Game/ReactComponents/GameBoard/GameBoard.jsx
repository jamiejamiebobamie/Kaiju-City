import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { DeadPlayer } from "./Pieces/DeadPlayerPiece";
import { ExplodingKaiju } from "./Pieces/ExplodingKaijuPiece";
import { PauseModal } from "./PauseModal";
import { getIsDialogueLog } from "Game/DataClasses/DialogueLog";
import { GameBoardPieceComponent } from 'Game/ReactComponents/GameBoard/Pieces/GameBoardPieceComponent'
import { getSpeechScreenBox, PagedSpeechBalloon, SpeechBalloon } from 'Game/ReactComponents/GameBoard/SceneElements';
import { TileCanvas } from 'Game/ReactComponents/GameBoard/Tile/TileCanvas';
import { SceneElements, getActiveHotspots } from 'Game/ReactComponents/GameBoard/SceneElements';
import { CHARACTER_FEET, CHARACTER_HEIGHT_PX, EXIT_OPEN_PHASE, getSortZIndex, getTileTone, MAP_LABEL, MAP_LABELS, PENINSULA } from 'Game/DataClasses/Levels/levels';
import { WakeCanvas } from 'Game/ReactComponents/GameBoard/WakeCanvas';
import { Camera, CAMERA, getCloseZoom, getFitZoom, WIDE_SHOT } from 'Game/DataClasses/Camera';
import { CUTSCENE } from 'Game/DataClasses/GameManager';
import { SpeechBubbleScale } from 'Game/ReactComponents/GameBoard/recruitLook';
import { getHexRadius } from 'Game/DataClasses/GameBoard/hexGrid';
import { BADGE_HEADS } from './badgeHeads';
import { PIECES_INFO } from 'Utils/gameState';
import { startRagdoll } from 'Game/DataClasses/Ragdoll';
import { GiantKaijuLayer, GiantMeters } from './GiantKaijuLayer';

// a body lying at rest where its feet were: on its side, still
const getRestingBody = ({ x, y }, pieceScale, rowPx) => ({
  ...startRagdoll({ x: x - CHARACTER_FEET.x * pieceScale - CHARACTER_FEET.leftShift, y: y - CHARACTER_FEET.y * pieceScale }, { x: 0, y: 0 }, rowPx),
  vx: 0, vy: 0, vHeight: 0, spin: 0, angle: 90, isResting: true
});

// the first fight swirling away into the Street (Jamie): the map spins, zooms and blurs into the dark
const boardSwirl = keyframes`
  from { transform: rotate(0deg) scale(1); filter: blur(0); opacity: 1; }
  to { transform: rotate(540deg) scale(2.6); filter: blur(12px); opacity: 0; }
`;

const Board = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* no pointer over the play, where nothing can be clicked (Jamie); the scene's buttons and hotspots set their own */
  cursor: none;
  touch-action: manipulation;
  & button, & [data-scene-button] { cursor: pointer; }
  ${props => props.$isSwirling && css`animation: ${boardSwirl} 1.3s ease-in forwards;`}
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

// the split screen (the ghost boss's scream): each half of the view has its own camera on one of the team
const ViewPane = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: hidden;
`;

const SplitBar = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 6px;
  margin-left: -3px;
  background: #050507;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35), 0 0 12px rgba(0, 0, 0, 0.8);
  z-index: 2147482500;
  pointer-events: none;
`;

// the ghost boss's scream: a red flash, and under it the team is somewhere else
const SCREAM_FLASH = { color: "#ff1a0d", seconds: 1.6 };
const screamFlash = keyframes`
  0% { opacity: 0; }
  22% { opacity: 1; }
  36% { opacity: 1; }
  100% { opacity: 0; }
`;
const ScreamFlash = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482995;
  border-radius: 1.8cqw;
  pointer-events: none;
  opacity: 0;
  background: ${SCREAM_FLASH.color};
  animation: ${screamFlash} ${SCREAM_FLASH.seconds}s ease-out forwards;
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

// what a caret points at, shown at its base: a map site's icon, or a badge for an enemy coming in
const CARET_INFO = {
  iconHeight: 2.6, // a site icon, in caret sizes
  badgeSize: 2.4, // an off-screen enemy's badge, across, in caret sizes
  caretBase: 0.5, // from the caret's middle to its base, in caret sizes
  badgeGap: 0.15, // between the caret's base and the badge
  badgeBodyShare: 0.55, // how much of the body shows down the badge: the head and shoulders
  badgeHeadY: 0.36, // the middle of the head, down the badge
  inset: 1.3, // how far in from the caret, past it, in caret sizes
  nearTiles: 12, // an incoming enemy this close gets a window even with others on the board: about as far as the tiles show
  maxWindows: 2,
  green: "#6dffa0"
};

// the Subway's warning: while its lights flash and both are out of shot, two comic-book panels at the top show them
const TRAIN_LOOK = {
  phase: "trainLights",
  warningPhase: "trainWarning", // the lights before the train comes, not after it has gone
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

// in a walking scene that fills the monitor, the camera leans toward what the player is nearing
const COVER_LOOK = {
  nearRows: 9.5, // it starts to lean this close: from the middle of the Lab, the side tanks start to come in
  fullShare: 0.45, // and leans all the way once this much nearer
  margin: 0.06, // of the view, kept clear around the player and the spot
  labelHalfWidthPx: 90, // a hotspot's label is about this wide either side of its middle
  edgePanStep: 0.12 // a level's 'coverPanLeftX': how far the pan to the left edge eases in (or out) each update
};

// a scene's hotspots (where their labels are) and, once open, its way out
const getCoverSights = (level, activePhases) => [
  ...(level.sceneElements || []).filter(({ type, hidePhase }) => type == 'hotspot' && !(hidePhase && activePhases.includes(hidePhase)))
    .map(({ x, y, width, labelY }) => ({ x: x + width / 2, y: labelY ?? y })),
  ...(level.exit && activePhases.includes(EXIT_OPEN_PHASE) ? [level.exit.spot] : [])
];

const CaretLabel = styled.div`
  position: absolute;
  z-index: 2147483001;
  pointer-events: none;
  font-family: gameboy;
  text-transform: uppercase;
  white-space: nowrap;
  color: #f2f6ff;
  text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black, 0 0 4px black;
`;

const CaretIcon = styled.img`
  position: absolute;
  z-index: 2147483001;
  pointer-events: none;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px black) drop-shadow(0 0 6px var(--glow));
  translate: -50% -50%;
`;

// an enemy off the screen, in a round badge docked to its caret: their head and shoulders behind green glass.
// framed like the recruit-call buttons and the map icons, so it reads as part of the screen, not a piece on the board.
const badgeFlicker = keyframes`
  0%, 100% { opacity: 1; }
  41% { opacity: 1; }
  42% { opacity: 0.75; }
  44% { opacity: 1; }
`;

const badgeScan = keyframes`
  from { background-position: 0 -40%, 0 0, 0 0; }
  to { background-position: 0 140%, 0 0, 0 0; }
`;

// it runs through its own frames as the piece moves: the same walk as on the board
const badgeFrames = keyframes`
  from { background-position-x: var(--from-x); }
  to { background-position-x: var(--to-x); }
`;

const BadgeSprite = styled.div`
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  &[data-moving] {
    animation: ${badgeFrames} 1s steps(10) infinite;
  }
`;

const CaretBadge = styled.div`
  position: absolute;
  z-index: 2147483001;
  pointer-events: none;
  translate: -50% -50%;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #0f3a22, #04140b 75%);
  border: 2px solid var(--ring);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.75), 0 0 8px var(--ring);
  animation: ${badgeFlicker} 3.1s steps(1) infinite;
  /* the glass over them: a band of light rolling down, fine scan lines, and green at the rim */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
      linear-gradient(to bottom, transparent, rgba(200, 255, 220, 0.35) 50%, transparent) 0 0 / 100% 30% no-repeat,
      repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0 1px, transparent 1px 3px),
      radial-gradient(circle, transparent 48%, rgba(109, 255, 160, 0.45) 100%);
    animation: ${badgeScan} 2.4s linear infinite;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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

// 1 Recruit, 2 Terminate: the number keys choose too (no brackets: the pixel font has none)
const CHOICE_KEYS = { recruit: 1, terminate: 2 };

export const ChoiceButton = ({ choice, recruitChoice, onChooseRecruit }) => (
  <RecruitButton data-choice-key={recruitChoice ? undefined : CHOICE_KEYS[choice]} $choice={choice} $isGone={!!recruitChoice} onClick={event => onChooseRecruit(choice, event.currentTarget.getBoundingClientRect())}>
    <span>{CHOICE_WORDS[choice]}</span><span>{CHOICE_KEYS[choice]}</span>
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
  lurchSeconds: 4.8, // TERMINATED's trip round its stops: long enough at each to read it
  // TERMINATED's stops: which way from the middle, and how big it bursts there. each stop goes only as far as the word still fits.
  // its size changes along the way with where it goes, so no part of it leaves the screen; it pops as it lands ('pop': grow or shrink)
  lurchStops: [{ x: -1, y: -0.8, scale: 1.3, pop: 1.18 }, { x: 0.8, y: -1, scale: 0.72, pop: 0.82 }, { x: 0.7, y: 0.9, scale: 1.15, pop: 1.18 }],
  burstPeak: 1.55, // the biggest it gets anywhere: 1.3 with its pop
  edgeMargin: 0.04 // kept clear at the screen's edge, of its width
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

// each letter jumps and turns a full circle on its own upright axis as it goes up and comes down, like someone spinning as they jump
const getHopAt = share => (100 - CHOICE_FX.hopSeconds / CHOICE_FX.hopEverySeconds * share).toFixed(1);
const letterHop = keyframes`
  0%, ${getHopAt(100)}% { transform: translate(0, 0) rotateY(0deg) scale(1, 1); }
  ${getHopAt(85)}% { transform: translate(0, 0.04em) rotateY(0deg) scale(1.08, 0.9); }
  ${getHopAt(62)}% { transform: translate(0, -0.38em) rotateY(180deg) scale(0.95, 1.08); }
  ${getHopAt(40)}% { transform: translate(0, -0.1em) rotateY(330deg) scale(1, 1); }
  ${getHopAt(28)}% { transform: translate(0, 0.06em) rotateY(360deg) scale(1.1, 0.9); }
  ${getHopAt(14)}% { transform: translate(0, -0.03em) rotateY(360deg) scale(0.98, 1.02); }
  100% { transform: translate(0, 0) rotateY(360deg) scale(1, 1); }
`;

const HopLetter = styled.span`
  display: inline-block;
  transform-origin: 50% 85%;
  white-space: pre;
  animation: ${letterHop} ${CHOICE_FX.hopEverySeconds}s ease-in-out var(--delay) infinite;
`;

// round its stops, uneven: in from the middle, to the top left, the top right, the bottom right, and round again.
// position and size move together, so the word is the size of where it's going as it gets there, then pops on landing.
const lurch = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  18% { transform: translate(var(--x1), var(--y1)) scale(var(--s1)); }
  20% { transform: translate(var(--x1), var(--y1)) scale(var(--p1)); }
  23%, 30% { transform: translate(var(--x1), var(--y1)) scale(var(--s1)); }
  48% { transform: translate(var(--x2), var(--y2)) scale(var(--s2)); }
  50% { transform: translate(var(--x2), var(--y2)) scale(var(--p2)); }
  53%, 60% { transform: translate(var(--x2), var(--y2)) scale(var(--s2)); }
  78% { transform: translate(var(--x3), var(--y3)) scale(var(--s3)); }
  80% { transform: translate(var(--x3), var(--y3)) scale(var(--p3)); }
  83%, 90% { transform: translate(var(--x3), var(--y3)) scale(var(--s3)); }
  100% { transform: translate(0, 0) scale(1); }
`;

const Lurch = styled.div`
  animation: ${lurch} ${CHOICE_FX.lurchSeconds}s cubic-bezier(0.7, 0, 0.3, 1) ${RECRUIT_LOOK.flyMs}ms infinite;
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
  // TERMINATED grows past its fitted size at its stops: it is sized so even its biggest burst fits across
  const sizePx = choice == "terminate" ? Math.min(wordPx, (boardBox.width * (1 - CHOICE_FX.edgeMargin * 2)) / (word.length * RECRUIT_LOOK.letterWidth * CHOICE_FX.burstPeak)) : wordPx;
  // how far each stop goes: to the edge of the screen, less the word's own size there, so all of it stays readable
  // (the biggest it gets at a stop is with its pop; on the way it is between the two stops' sizes, so it fits there too)
  const lurchSpots = Object.fromEntries(CHOICE_FX.lurchStops.flatMap(({ x, y, scale, pop }, k) => {
    const biggest = scale * Math.max(pop, 1);
    const margin = boardBox.width * CHOICE_FX.edgeMargin;
    const freeX = Math.max((boardBox.width - word.length * RECRUIT_LOOK.letterWidth * sizePx * biggest) / 2 - margin, 0);
    const freeY = Math.max((boardBox.height - sizePx * 1.3 * biggest) / 2 - margin, 0);
    return [[`--x${k + 1}`, `${x * freeX}px`], [`--y${k + 1}`, `${y * freeY}px`], [`--s${k + 1}`, scale], [`--p${k + 1}`, scale * pop]];
  }));
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
            <Lurch style={lurchSpots}>{CHOICE_WORDS[choice].toUpperCase()}<ChoiceSuffix>{RECRUIT_LOOK[choice].suffix}</ChoiceSuffix></Lurch>
          )}
        </ChoiceWord>
      </EffectLayer>
    </>
  );
};

// Sewer 2's climax (the parts' blinding light): the tiles and the people fade back into it with the parts (Jamie)
const PARTS_CLIMAX_FADE_SECONDS = 2.5;

const getIsEnemyInPlay = (player, piece) => piece.getTeamIndex() != player.getTeamIndex() && !piece.isDead && piece.isOnTiles;

/*
  What the enemy zoom can look toward, each as { key, charLocation, isChasing }: enemies on the board, and
  (GameManager.getCameraThreats) the powers chasing the player and the ghost boss's launched ghosts coming for them
  ('isChasing': these come first), and Kaiju not yet on the board but near.
*/
const getEnemyTargets = (player, gameManager) => [
  ...gameManager.getPieces()
    .filter(piece => getIsEnemyInPlay(player, piece) && !(gameManager.getIsCameraKeptOff && gameManager.getIsCameraKeptOff(player, piece)))
    .map(piece => ({ key: `piece ${piece.pieceIndex}`, charLocation: piece.charLocation })),
  ...(gameManager.getCameraThreats ? gameManager.getCameraThreats(player) : [])
];

const getClosestTarget = (player, targets) => {
  const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
  return targets.reduce((closest, target) => !closest || getDistance(target) < getDistance(closest) ? target : closest, undefined);
};

// the enemy zoom keeps to one enemy: another must be clearly closer, for a while, before the camera turns to them
const ENEMY_FOCUS = {
  closerBy: 0.3, // the new enemy is this much closer, as a share of the current one's distance
  holdMs: 800 // and stays that way this long
};

// the targets are made fresh each update: one is followed by its key.
// anything chasing the player comes first (Jamie): the camera goes to it at once, and the enemies wait until it is gone.
const makeEnemyFocus = () => {
  let currentKey;
  let challengerKey;
  let challengerSinceMs = 0;
  return (player, allTargets, nowMs) => {
    const chasing = allTargets.filter(({ isChasing }) => isChasing);
    const targets = chasing.length ? chasing : allTargets;
    const closest = getClosestTarget(player, targets);
    const current = targets.find(({ key }) => key == currentKey);
    if (!current || !closest) {
      currentKey = closest && closest.key;
      challengerKey = undefined;
      return closest;
    }
    const getDistance = ({ charLocation: { x, y } }) => Math.hypot(x - player.charLocation.x, y - player.charLocation.y);
    const isClearlyCloser = closest.key != current.key && getDistance(closest) < getDistance(current) * (1 - ENEMY_FOCUS.closerBy);
    if (!isClearlyCloser) {
      challengerKey = undefined;
    } else if (closest.key != challengerKey) {
      challengerKey = closest.key;
      challengerSinceMs = nowMs;
    } else if (nowMs - challengerSinceMs >= ENEMY_FOCUS.holdMs) {
      currentKey = closest.key;
      challengerKey = undefined;
      return closest;
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

export const GameBoard = ({ speakingLineLength = 0, isSwirling = false, speakingPieceIndex = undefined, choiceFromRef = undefined, isWindowOpen = true, isPaused, gameManager, level, activePhases, isWholeScene, playWindow, isShowingWindowSize, isEditingTiles, isMouseLook, isEnemyZoom, isSlowMotion, isTeamColors, speech, recruitScene, recruitChoice, onChooseRecruit, onHotspot }) => {
  // redraws the pieces when the game updates. the tiles draw themselves.
  useSyncExternalStore(gameManager.subscribeToBoard, gameManager.getBoardRevision);
  const pieces = gameManager.getPieces();
  // Sewer 2's climax, the parts' blinding light: the tiles and the people fade back into it (Jamie)
  const isPartsClimax = !!(level.walkIn && level.walkIn.ending && activePhases.includes(level.walkIn.ending.phase));

  const boardRef = useRef(null);
  const ownChoiceFrom = useRef(undefined); // where the pressed Recruit or Terminate button was
  const choiceFrom = choiceFromRef || ownChoiceFrom; // with the log, the buttons are on it, and the game says where
  const chooseRecruit = (choice, buttonBox) => {
    if (recruitChoice) return;
    choiceFrom.current = buttonBox;
    onChooseRecruit(choice);
  };
  const worldRef = useRef(null);
  const rightWorldRef = useRef(null); // the right half of a split screen
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
  const getShotFraming = ({ point, zoomScale, isCover, isPeninsulaSized = false, isPlayZoom = false }) => {
    // 'isPlayZoom': the zoom the fight is played at (the portal walk's pan between its two ends)
    if (isPlayZoom) return { zoom: closeCamera.zoom, center: point };
    // 'isPeninsulaSized': the zoom that makes people as big on screen as this shot would at the Peninsula
    const fitZoom = isPeninsulaSized
      ? getFitZoom({ ...shotView, worldWidth: PENINSULA.world.width, worldHeight: PENINSULA.world.height }) * PENINSULA.pieceScale / level.pieceScale
      : getFitZoom(fullFrameSizes);
    const coverZoom = Math.max(shotView.viewWidth / world.width, shotView.viewHeight / world.height);
    let zoom = (isCover ? coverZoom : fitZoom) * zoomScale;
    const speech = speechRef.current;
    // a shot on two people (the ghost boss's scream) has no words of its own to make room for
    if (!point) return { zoom, center: undefined };
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

  /*
    A shot on two people ('pair'): one shot on both if they fit at its zoom, or the view split down the middle,
    one of them in each half. 'isSeam': they are now side by side, and the halves show the two sides of one shot,
    so the bar can go and nothing moves. returns { single } or { left, right }.
  */
  const wasPairSplit = useRef(false);
  const getPairCameras = shot => {
    const [a, b] = shot.pair;
    const { zoom } = getShotFraming({ point: a, zoomScale: shot.zoomScale, isPeninsulaSized: shot.isPeninsulaSized });
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const isFitting = Math.abs(b.x - a.x) * zoom <= shotView.viewWidth * (1 - SHOT_FIT.margin * 2) && Math.abs(b.y - a.y) * zoom <= shotView.viewHeight * (1 - SHOT_FIT.margin * 2);
    const isSplit = shot.isSeam ? wasPairSplit.current : !isFitting;
    if (!shot.isSeam) wasPairSplit.current = isSplit;
    if (!isSplit) {
      const single = new Camera({ ...fullFrameSizes, zoom });
      single.centerOn(middle);
      return { single };
    }
    const half = { ...fullFrameSizes, viewWidth: shotView.viewWidth / 2, zoom };
    const left = new Camera(half);
    const right = new Camera(half);
    const quarter = shotView.viewWidth / 4 / zoom;
    left.centerOn(shot.isSeam ? { x: middle.x - quarter, y: middle.y } : a);
    right.centerOn(shot.isSeam ? { x: middle.x + quarter, y: middle.y } : b);
    return { left, right };
  };

  useEffect(() => {
    let wasWideShot = getIsWholeLevelInView();
    let lastShot = undefined;
    let pullEndMs = 0;
    let pullMs = WIDE_SHOT.pullMs;
    let pullEase = "ease-in-out";
    let isCutting = false; // the camera is already there when the shot starts
    const pickEnemy = makeEnemyFocus();
    let leftPanShare = 0; // the walking scene's pan to its left edge (level.coverPanLeftX), eased in and out
    let rightPanShare = 0; // the same to its right edge (level.coverPanRightX)
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
      if (shot && shot.pair) {
        const { single, left, right } = getPairCameras(shot);
        worldRef.current.style.transform = (single || left).getTransform();
        if (right && rightWorldRef.current) rightWorldRef.current.style.transform = right.getTransform();
        return;
      }
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
        let center = { x: across(x, world.width, viewWidth), y: across(y, world.height, viewHeight) };
        // nearing something to use (a hotspot and its label, or the open way out), the view leans toward it:
        // it looks between the two, with both on screen where they fit
        const tileRowPx = grid.rowStep * grid.scale;
        const sights = getCoverSights(level, gameManager.getActivePhases()).map(getWorldLocation);
        const nearest = sights.map(spot => ({ spot, distance: Math.hypot(spot.x - x, spot.y - y) })).sort((a, b) => a.distance - b.distance)[0];
        const nearPx = COVER_LOOK.nearRows * tileRowPx;
        if (nearest && nearest.distance < nearPx) {
          const weight = Math.min((nearPx - nearest.distance) / (nearPx * (1 - COVER_LOOK.fullShare)), 1);
          const { spot } = nearest;
          const fit = (value, a, b, view, margin) => {
            const low = Math.max(a, b) - view / 2 + margin;
            const high = Math.min(a, b) + view / 2 - margin;
            return low <= high ? Math.min(Math.max(value, low), high) : value;
          };
          const between = {
            x: fit((x + spot.x) / 2, x, spot.x, viewWidth, viewWidth * COVER_LOOK.margin + COVER_LOOK.labelHalfWidthPx),
            y: fit((y + spot.y) / 2, y - tileRowPx * 2, spot.y, viewHeight, viewHeight * COVER_LOOK.margin)
          };
          center = { x: center.x + (between.x - center.x) * weight, y: center.y + (between.y - center.y) * weight };
        }
        // past a level's 'coverPanLeftX', the view goes all the way to the scene's left edge (Jamie: the Lab's
        // "Change powers" label in view before the player has walked all the way over)
        if (level.coverPanLeftX !== undefined) {
          const isLeft = x <= level.coverPanLeftX;
          leftPanShare = Math.min(Math.max(leftPanShare + (isLeft ? 1 : -1) * COVER_LOOK.edgePanStep, 0), 1);
          const eased = leftPanShare * leftPanShare * (3 - 2 * leftPanShare);
          center = { ...center, x: center.x + (viewWidth / 2 - center.x) * eased };
        }
        // and to the right edge past 'coverPanRightX' (Jamie, playtest 18: the Lab's "Choose color" label whole)
        if (level.coverPanRightX !== undefined) {
          const isRight = x >= level.coverPanRightX;
          rightPanShare = Math.min(Math.max(rightPanShare + (isRight ? 1 : -1) * COVER_LOOK.edgePanStep, 0), 1);
          const eased = rightPanShare * rightPanShare * (3 - 2 * rightPanShare);
          center = { ...center, x: center.x + (world.width - viewWidth / 2 - center.x) * eased };
        }
        const keepIn = (value, size, view) => view >= size ? size / 2 : Math.min(Math.max(value, view / 2), size - view / 2);
        coverCamera.centerOn({ x: keepIn(center.x, world.width, viewWidth), y: keepIn(center.y, world.height, viewHeight) });
        worldRef.current.style.transform = coverCamera.getTransform();
        return;
      }
      if (!isWide) {
        // the keys are in charge when the mouse's hover is hidden
        const isLooking = isMouseLook && !!gameManager.getHoveredTileIndex();
        const closestEnemy = isEnemyZoom ? pickEnemy(player, getEnemyTargets(player, gameManager), nowMs) : undefined;
        closeCamera.lookToward(
          getWorldLocation(player.charLocation),
          isLooking ? mouseAim.current : { x: 0, y: 0 },
          closestEnemy ? getWorldLocation(closestEnemy.charLocation) : undefined,
          !!closestEnemy && !!closestEnemy.isTense // a sea creature after the player: in tighter and quicker
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
  // a battleground already won has no glow on the map, so its caret's icon has none either
  const siteTargets = (level.sites || []).map(({ spot, color, icon, visitLevelId }) => ({ key: `${spot.x} ${spot.y}`, color, charLocation: spot, icon, isGlowing: !visitLevelId }));
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
  // a badge for an enemy off the screen: when no other is on the board in view, or when it comes in close.
  // at most two, the closest.
  // the Subway's signal lights, flashing: shown in panels when neither is in shot
  const signalLights = (level.sceneElements || []).filter(({ phase }) => phase == TRAIN_LOOK.phase);
  const isTrainWarning = activePhases.includes(TRAIN_LOOK.phase);
  // the cutouts of the lights only while a train is coming, not after one has gone (the lights still flash then)
  const isLightsOutOfShot = activePhases.includes(TRAIN_LOOK.warningPhase) && !isWideShot && !!focusPiece && signalLights.length > 0 && signalLights.every(({ x, y, width, height }) =>
    !!caretCamera.getEdgeCaret(getWorldLocation({ x: x + width / 2, y: y + height / 2 }), getWorldLocation(focusPiece.charLocation), tilePx));
  const trainWarning = isTrainWarning && (
    <>
      {activePhases.includes(TRAIN_LOOK.warningPhase) && <TrainTitle>Train incoming!</TrainTitle>}
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
    .map(({ key, color, icon, piece, caret, isGlowing }) => (
      <React.Fragment key={key}>
        {icon && (() => {
          const spot = getInward(caret, CARET_INFO.inset);
          const iconHeight = caret.size * CARET_INFO.iconHeight;
          // over the icon in the screen's lower half, where a word under it would be off the screen (Jamie, playtest 18)
          const isOver = MAP_LABEL.position == "top" || spot.y > (boardRef.current ? boardRef.current.clientHeight : 0) / 2;
          return (
            <>
              <CaretIcon src={`/levels/map/${icon}.png`} style={{ left: `${spot.x}px`, top: `${spot.y}px`, height: `${iconHeight}px`, "--glow": isGlowing ? color : "transparent" }} />
              {/* its word, as on the map (MAP_LABELS) */}
              <CaretLabel style={{ left: `${spot.x}px`, top: `${spot.y + (isOver ? -1 : 1) * (iconHeight / 2 + 2)}px`, transform: `translate(-50%, ${isOver ? "-100%" : "0"})`, fontSize: `${Math.max(caret.size * 0.45, 9)}px` }}>{MAP_LABELS[icon] || icon}</CaretLabel>
            </>
          );
        })()}
        {windowKeys.has(key) && (() => {
          // docked to the caret: a hair's gap after the caret's base, then the badge
          const size = caret.size * CARET_INFO.badgeSize;
          const spot = getInward(caret, CARET_INFO.caretBase + CARET_INFO.badgeGap + CARET_INFO.badgeSize / 2);
          // the sheet itself, cropped to the head and shoulders: the head in the middle, whichever way they face (BADGE_HEADS)
          const heads = BADGE_HEADS[piece.spriteSheetSrc];
          const facing = piece.dir && piece.dir != 'idle' ? piece.dir : piece.getFacingDir();
          const head = heads && (heads.dirs[facing] || heads.dirs.down);
          return (
            <CaretBadge style={{ left: `${spot.x}px`, top: `${spot.y}px`, width: `${size}px`, height: `${size}px`, "--ring": (PIECES_INFO[piece.avatar] || {}).color || CARET_INFO.green }}>
              {head && (() => {
                const zoom = size / (heads.bodyH * CARET_INFO.badgeBodyShare);
                // the head was measured on the walk's second frame; a Kaiju's walk starts a frame earlier than a person's
                const frameW = heads.sheetW / heads.columns * zoom;
                const x = size / 2 - head.x * zoom;
                const fromX = x + (piece.avatar == 'kaiju' ? frameW : 0);
                const isMoving = !!piece.dir && piece.dir != 'idle';
                return <BadgeSprite data-moving={isMoving ? "" : undefined} style={{
                  backgroundImage: `url(${piece.spriteSheetSrc})`,
                  backgroundSize: `${heads.sheetW * zoom}px ${heads.sheetH * zoom}px`,
                  backgroundPosition: `${x}px ${size * CARET_INFO.badgeHeadY - (head.y + heads.bodyH * 0.1) * zoom}px`,
                  "--from-x": `${fromX}px`,
                  "--to-x": `${fromX - 10 * frameW}px`
                }} />;
              })()}
            </CaretBadge>
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
  // the pointer stays over the screen while paused, and in a scene with things to click (the walking Lab) (Jamie, playtest 18)
  const isCursorKept = !!isPaused || getActiveHotspots(level, activePhases).length > 0;
  const isCursorKeptRef = useRef(false);
  isCursorKeptRef.current = isCursorKept;
  const getBoardCursor = () => isChoosingRef.current ? "pointer" : isCursorKeptRef.current ? "default" : "";
  useEffect(() => {
    if (boardRef.current) boardRef.current.style.cursor = getBoardCursor();
    if (isCursorKept) document.body.style.cursor = "";
  }, [isCursorKept]);
  useEffect(() => {
    const move = e => {
      document.body.style.cursor = "";
      if (boardRef.current) boardRef.current.style.cursor = getBoardCursor();
      mouseHandlers.current.handleMouseMove(e);
    };
    // browsers can't move the cursor, so it hides while the keys are in charge. not at the Recruit or Terminate choice: the hand stays there.
    const hideCursor = ({ code }) => {
      if (!MOVEMENT_KEYS.includes(code) || isChoosingRef.current || isCursorKeptRef.current) return;
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
      lives={Math.max(p.lives + Math.min(p.livesModifier || 0, 0), 0)}
      hitLives={p.lives} // the health that hits and heals change: the numbers and the shake follow this, not a passive's // a passive that costs health (Haunt's Lichdom) shows on the bar: at none, they are down
      isGoingToSpewFire={p.isGoingToSpewFire}
      isShowHealthBarOnComponent={p.isShowHealthBarOnComponent}
      isQuiet={!!recruitScene}
      isSpeaking={p.pieceIndex === speakingPieceIndex}
      speakingLineLength={speakingLineLength}
      isGhostForm={!!p.isGhostForm}
      portalMask={p.portalMask}
      isOnBoard={p.isOnTiles !== false}
      isRewardPulse={!!p.getIsRewardPulse && p.getIsRewardPulse()}
      isFaded={isPartsClimax}
      statusEffects={p.getStatusEffects && p.isVisible && !p.isDead ? p.getStatusEffects(gameManager.gameBoardPiecesManager.getPlayerTeamIndex()) : []}
      cleanSlateCount={p.cleanSlateCount || 0}
      isPlayer={p === gameManager.gameBoardPiecesManager.getPlayerPiece()}
    />
  );

  const currentShot = gameManager.getCameraShot();
  const pairCameras = currentShot && currentShot.pair ? getPairCameras(currentShot) : undefined;
  const splitCameras = pairCameras && pairCameras.right ? pairCameras : undefined;
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
      : <DeadPlayer key={key} avatar={avatar} pieceScale={pieceScale} charLocation={charLocation} body={body} spriteSheetSrc={death.spriteSheetSrc} color={color} zIndex={zIndex} ghost={death.isGhostForm ? "ghost" : undefined} />;
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

  // the world, drawn once, or twice for a split screen: the second copy has no words or buttons on it
  const renderWorld = isMain => (
    <World ref={isMain ? worldRef : rightWorldRef} data-game-world={isMain ? "" : undefined} style={{ width: `${world.width}px`, height: `${world.height}px`, opacity: isPaused ? 0 : 1, transition: "opacity 0.3s", ...(!isMain && splitCameras ? { transform: splitCameras.right.getTransform() } : {}) }}>
        {levelLayers}
        {foregroundLayers}
        <SceneElements level={level} activePhases={activePhases} isPaused={isPaused} onHotspot={onHotspot} isDialogueLog={getIsDialogueLog()} isSettled={!isMain || !!gameManager.isRetry} />
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
            ghost={recruitScene.body.isGhostForm ? "toBody" : undefined} // her ghost blinks away, and she lies there as herself
          />
        ) : <RecruitBody src={`/levels/dead/${recruitScene.body.avatar}.png`} style={{
          left: `${recruitScene.body.x}px`,
          top: `${recruitScene.body.y}px`,
          height: `${pieceScale * RECRUIT_BODY_SIZE}px`
        }} />)}
        {isMain && recruitScene && !getIsDialogueLog() && (
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
        {isMain && speech && !isPaused && !speech.isLogged && (speech.lines
          ? <PagedSpeechBalloon name={speech.name} lines={speech.lines} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />
          : <SpeechBalloon name={speech.name} text={speech.text} x={getSpeechX(speech)} y={speech.y} isFlipped={speech.isFlipped} zIndex={2147482000} scale={overlayScale} />)}
        <WorldContent style={{ left: `${contentOffset.x}px`, top: `${contentOffset.y}px` }}>
          {/* canvases are sized from the zoom, which means nothing until the frame has been measured */}
          {isFrameMeasured && <TileCanvas gameManager={gameManager} level={level} tone={getTileTone(level, activePhases)} isVisible={!isPaused && !isEditingTiles && !isPartsClimax} fadeSeconds={isPartsClimax ? PARTS_CLIMAX_FADE_SECONDS : undefined} zoom={closeCamera.zoom} isTeamColors={isTeamColors} />}
          {isFrameMeasured && <WakeCanvas gameManager={gameManager} level={level} zoom={closeCamera.zoom} isActive={!!level.flood && activePhases.includes(level.flood.phase)} />}
          {piecesComponents}
          {deathPiecesComponents}
          <GiantKaijuLayer gameManager={gameManager} level={level} />
        </WorldContent>
      </World>
  );

  return (
    <Board
      ref={boardRef}
      $isSwirling={isSwirling}
      style={recruitScene ? { cursor: "pointer" } : undefined}>
      {isPaused && <PauseModal />}
      <SceneShake $isShaking={!isPaused && level.shakePhases.some(id => activePhases.includes(id))}>
      {/* paused: the whole scene fades, and only the word "Paused" shows */}
      <ViewPane style={{ left: 0, width: splitCameras ? "50%" : "100%" }}>
        {renderWorld(true)}
      </ViewPane>
      {splitCameras && <ViewPane style={{ left: "50%", width: "50%" }}>{renderWorld(false)}</ViewPane>}
      {splitCameras && <SplitBar />}
      </SceneShake>
      {gameManager.ghostFlashCount > 0 && createPortal(<ScreamFlash key={gameManager.ghostFlashCount} style={{ background: (level && level.rival && level.rival.screamFlashColor) || SCREAM_FLASH.color }} />, document.querySelector("[data-play-screen]") || document.body)}
      {recruitScene && recruitChoice && <ChoiceConfirm choice={recruitChoice} from={choiceFrom.current} board={boardRef.current} />}
      {!isPaused && edgeCarets}
      {!isPaused && <GiantMeters gameManager={gameManager} />}
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
