import React, { useState, useEffect, useRef, useContext } from "react";
import { GHOST_BOSS } from 'Game/DataClasses/GhostBoss';
import { AQUARIUM_FLOOD } from 'Game/DataClasses/AquariumFlood';
import { GIANT_KAIJU } from 'Game/DataClasses/GiantKaiju';
import { Credits, CREDITS_TIMING } from './Credits';
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { useSnapshot } from "valtio";
import { GlobalSettingsContext } from "Home";
import { GameBoard } from "./GameBoard/GameBoard";
import { CRT } from "Components/CrtPower";
import { BezelButton, KaijuCounter, FULL_WINDOW, loadPlayWindow, ObjectiveTicker, PlayWindow, PORTRAIT_WINDOW, savePlayWindow } from "./GameBoard/PlayWindow";
import { UI } from "./UI/UI";
import { RadioCall } from "./RadioCall";
import { IrradiationVat } from "./IrradiationVat";
import { RecruitCalls } from "./RecruitCalls";
import { AvatarChoice } from "./AvatarChoice";
import { ControlsOverlay } from "./UI/ControlsOverlay";
import { NpcModelDriver } from "Game/DataClasses/npcBrain/npcModel";
import { getIsClickThrough, setIsClickThrough, setIsDialogueLog } from "Game/DataClasses/DialogueLog";
import { getIsSpacing, setIsSpacing } from "Game/DataClasses/SpacingTest";
import { CONTROL_MARKERS } from "./GameBoard/Pieces/GameBoardPieceComponent";
import { BREAK_TOTAL_MS, DialogueLogPanel } from "./DialogueLogPanel";
import { ChoiceButton } from "./GameBoard/GameBoard";
import { DEFAULT_AGGRESSION } from "Game/DataClasses/npcBrain/brain";
import { getKaijuSpeedMode, KaijuSpeedMode, setKaijuSpeedMode } from "../DataClasses/KaijuSpeedTest";
import { getAvatarColor, saveAvatarColor, saveTeamAvatars, unlockEverything, unlockRecruitSkill, unlockSkill, unlockTool } from "../DataClasses/Avatars";
import { AbilityPicker, FLY_OFF, LAB_LIGHTS_DELAY_MS, MINI_TIMING, PlayConsole, SideMonitor } from "./AbilityPicker";
import { holdTamagotchi } from "./Tamagotchi";
import { FOCUS_MOVE, getFocusTransform, MonitorLabBackdrop } from "./MonitorLabBackdrop";
import { getHasBooted, MonitorBoot } from "./MonitorBoot";
import { ROOM_HANDOFF, RoomBackdrop } from "Components/RoomScene";
import { ZOOM_BACK } from "Components/ZoomThrough";
import { HudExplosions } from "./UI/Hud/HudExplosions";
import { useKeyPress } from "Utils/utils";
import { ABILITY_KEY_CODES, GAME_TICK, PIECES_INFO, TILE_STATUSES_AND_ABILITY_DATA } from "Utils/gameState";
import { FullscreenPage } from "Components/FullscreenPage.jsx";
import { GameManager, GameResult } from '../DataClasses/GameManager';
import { getActiveHotspots } from "./GameBoard/SceneElements";
import { getIsDetourLevel } from "../DataClasses/Objectives";
import { getIsFirstPlay, markPlaythroughStarted } from "../DataClasses/Avatars";
import { addUnlock, clearRecruitChoices, getBattlegroundUnlockId, getRecruitChoices, getUnlocks, getWonBattlegrounds, resetUnlocks, saveRecruitChoice } from '../DataClasses/Unlocks';

// the map walks show the battlegrounds already won on, from whatever was saved
updateMapWalkSites(getWonBattlegrounds());
import { CAMPAIGN_SECTIONS, getIsLastSection, getRecommendedPowers } from '../DataClasses/Campaign';
import { GameLoop } from '../DataClasses/GameLoop';
import { applyLevelFile, LAB_TALK_PHASE, LEVEL_FILES, LEVELS, PENINSULA, SPARRING, updateMapWalkSites } from '../DataClasses/Levels/levels';
import { TileEditor } from './Levels/TileEditor';
import { gameUiStore, publishGameUi, resetGameUi } from '../DataClasses/gameUiStore';

const GameArea = styled.div`
  position: relative;
  width: 100dvw;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0c0e;
`;

/*
  The Kaiju-Vision monitor is a thing in the world (Jamie, 2026-11-14): from the landing, the view shifts right onto
  it (the frame slides in from the right) while it is still dead; then it switches on. After the credits it
  switches off, a beat dead, then the view shifts right again, back to the landing (the frame slides off left).
*/
const MONITOR_SHIFT = { ms: 950, deadBeatMs: 350, endDeadMs: 700 };

// with nothing beside it (no HUDs, no side screen, no dialogue panel), the monitor stands in the middle of the frame;
// when something comes in beside it, it eases aside (Jamie, UI epic)
const CENTER_AFTER_MS = 1500;
const getCenteredWindow = window => {
  const width = window.right - window.left;
  const left = (1 - width) / 2;
  return { ...window, left, right: left + width };
};

// into the game from the picker (Jamie: no clouds): the monitor's screen fades to black, then the new scene up from it
const SCREEN_FADE = { ms: 550 };
// Leave's pull back (Jamie): how far and how long, and when the screen clicks off in it
const PULL_BACK = { scale: 0.82, ms: 1150, offAtMs: 450 };
const screenToBlack = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const screenFromBlack = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;
const ScreenBlack = styled.div<{ $isIn?: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 2147482970; /* over the picture, under the glass and casing */
  pointer-events: none;
  background: black;
  ${props => props.$isIn
    ? css`animation: ${screenFromBlack} ${SCREEN_FADE.ms}ms ease-in both;`
    : css`animation: ${screenToBlack} ${SCREEN_FADE.ms}ms ease-out both;`}
`;

const fadeUp = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const shiftIn = keyframes`
  from { transform: translateX(105%); }
  to { transform: translateX(0); }
`;

const shiftOut = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-105%); }
`;

// everything in the game sits in this box, and scales with it
const GameFrame = styled.div<{ $shift?: 'in' | 'out' | 'fade' }>`
  position: relative;
  aspect-ratio: 16 / 9;
  min-width: 0;
  width: 100%;
  max-width: calc(100dvh * 16 / 9);
  max-height: 100dvh;
  overflow: hidden;
  container-type: inline-size;
  background: transparent; /* (the room shows round the monitor: Jamie) */
  transition: transform 0.9s ease-in, opacity 0.9s ease-in;
  ${props => props.$shift == 'fade' && css`animation: ${fadeUp} 700ms ease-out both;`}
  ${props => props.$shift == 'in' && css`animation: ${shiftIn} ${MONITOR_SHIFT.ms}ms cubic-bezier(0.2, 0.7, 0.3, 1) both;`}
  ${props => props.$shift == 'out' && css`animation: ${shiftOut} ${MONITOR_SHIFT.ms}ms ease-in forwards;`}
  @media (orientation: portrait) {
    aspect-ratio: auto;
    height: 100dvh;
    max-width: none;
  }
`;

// dev only, and beside the game rather than over it
// (pinned over the room at the left, on top: under the room's picture it was hidden in every scene. Jamie, playtest 28)
const PhaseToggles = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  z-index: 2147483645;
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  font-size: 10px;
  text-align: left;
  color: #dfe;
  background: #16181c;
`;

// moves on from a walking scene, until scenes have their own triggers
const ContinueButton = styled.button`
  position: absolute;
  bottom: 2cqw;
  right: 2cqw;
  z-index: 2147483646;
  padding: 0.6cqw 1.4cqw;
  font-family: gameboy;
  font-size: 1.3cqw;
  cursor: pointer;
`;

const cardFade = keyframes`
  0% { opacity: 0; }
  8%, 80% { opacity: 1; }
  100% { opacity: 0; }
`;

// notices sit a quarter of the way down: high enough to clear the titles in the middle, low enough to be seen
const NOTICE_TOP = "25%";

const UNLOCK_CARD_MS = 5000; // as long as its fade (cardFade)

/*
  A notice that goes after 'ms' of play (Jamie, playtest 20): paused, it hides and its clock stops; unpaused, it shows
  again and its clock goes on, however many pauses. its animation holds where it was too (getPausedNoticeStyle).
*/
const usePausableNotice = (notice, setNotice, ms, isPaused) => {
  const leftMs = useRef(0);
  const key = notice ? notice.key : undefined;
  useEffect(() => { leftMs.current = ms; }, [key]);
  useEffect(() => {
    if (key === undefined || isPaused) return;
    const startedAt = Date.now();
    const timeout = setTimeout(() => setNotice(undefined), Math.max(leftMs.current, 0));
    return () => {
      clearTimeout(timeout);
      leftMs.current -= Date.now() - startedAt;
    };
  }, [key, isPaused]);
};
const getPausedNoticeStyle = isPaused => isPaused ? { visibility: "hidden" as const, animationPlayState: "paused" } : undefined;

// a notice that comes and goes on its own, in the style of the speech bubbles
const UnlockCard = styled.div`
  position: absolute;
  top: ${NOTICE_TOP};
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 1cqw;
  padding: 0.7cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.3cqw;
  white-space: nowrap;
  pointer-events: none;
  color: #101018;
  background: #fbfbf0;
  border: 0.3cqw solid #101018;
  box-shadow: 0.35cqw 0.35cqw 0 rgba(0, 0, 0, 0.5);
  animation: ${cardFade} 5s linear forwards;
`;

// a power's unlock card shows its tile, as it looks on the board: a hex in the power's color with its icon
const PowerTile = styled.div`
  flex-shrink: 0;
  width: 3.4cqw;
  height: 3cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  font-size: 1.5cqw;
  color: #fbfbf0;
  text-shadow: 0 0 0.3cqw rgba(0, 0, 0, 0.8);
`;

const getPowerLook = element => TILE_STATUSES_AND_ABILITY_DATA.find(data => data.element == element);

const UnlockPortrait = styled.img`
  width: 3cqw;
  height: 4cqw;
  object-fit: cover;
  object-position: 50% 0;
  image-rendering: pixelated;
`;

// in the play window, sized from it
const EndScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3cqw;
  container-type: inline-size;
`;

const titleArrive = keyframes`
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
`;

// (larger, and on two lines where it breaks well: Jamie, playtest 27)
const EndTitle = styled.div`
  font-family: gameboy;
  font-size: min(7.4cqw, 6.1vw);
  line-height: 1.15;
  white-space: pre-line;
  translate: 0 -4.5cqw; /* (a little higher: Jamie, playtest 28. 'translate', so its arrival's transform still runs) */
  text-transform: uppercase;
  text-align: center;
  color: #ff2a4d;
  -webkit-text-stroke: 0.12cqw #ffb3c4;
  /* a deep block shadow down and to the left, stepped like an extrusion, with a black edge: it reads on bright scenes and dark */
  text-shadow:
    0 0 0.6cqw #ff5c8a,
    -0.12cqw 0.12cqw 0 #8a0020, -0.24cqw 0.24cqw 0 #6e0019, -0.36cqw 0.36cqw 0 #520012, -0.48cqw 0.48cqw 0 #3a000c,
    -0.6cqw 0.6cqw 0 #22000a, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 2.5cqw #ff0040;
  animation: ${titleArrive} 1.4s ease-out both;
`;

// a title of more than one word on two lines, split where the two are most even ("Kaiju" over "Terminated")
const breakTitle = (title: string) => {
  const words = String(title).split(" ");
  if (words.length < 2) return title;
  let best = 1;
  words.forEach((_, k) => {
    if (k == 0) return;
    const gap = (split: number) => Math.abs(words.slice(0, split).join(" ").length - words.slice(split).join(" ").length);
    if (gap(k) < gap(best)) best = k;
  });
  return `${words.slice(0, best).join(" ")}
${words.slice(best).join(" ")}`;
};

// on the button Enter (and 1) presses: "[ENTER]" in yellow (Jamie, playtest 24). gameboy has no brackets: a monospace's
const EnterHint = styled.span`
  margin-left: 0.8em;
  color: #ffd84a;
  text-shadow: 0 0 0.3em rgba(255, 216, 74, 0.6);
`;
const HintBracket = styled.span`
  font-family: "Courier New", Courier, monospace;
  font-weight: bold;
  font-size: 1.4em; /* (as big as the landing's: Jamie, playtest 25) */
  line-height: 0;
`;
const EnterKeyHint = () => <EnterHint><HintBracket>[</HintBracket>ENTER<HintBracket>]</HintBracket></EnterHint>;

const EndButtons = styled.div`
  display: flex;
  gap: 1cqw;
`;

const EndButton = styled.button`
  padding: 0.7em 1.6em;
  font-family: gameboy;
  font-size: min(2cqw, 1.4vw);
  cursor: pointer;
  color: #fbfbf0;
  background: #5c0013;
  border: 0.2cqw solid #ff5c8a;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// several notices at once, one above the other
// notices stack at the screen's right, one after another, like a project tracker's updates
const CardStack = styled.div`
  position: absolute;
  right: 4cqw;
  bottom: 5cqw;
  max-width: 72%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.8cqw;
`;

// an unlock's card: at the top right of the screen (Jamie)
// a new objective's title: in the screen's upper part, a while, then gone
const OBJECTIVE_NOTICE_MS = 2600;
const noticeInOut = keyframes`
  0% { opacity: 0; transform: translateX(-50%) scale(1.6); }
  12% { opacity: 1; transform: translateX(-50%) scale(1); }
  80% { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.96); }
`;
const ObjectiveNotice = styled.div`
  position: absolute;
  top: 22%;
  left: 50%;
  width: 88%; /* inside the screen: a long one wraps (Jamie) */
  z-index: 2147483600;
  pointer-events: none;
  font-family: gameboy;
  font-size: min(3.6cqw, 3vw);
  line-height: 1.25;
  text-transform: uppercase;
  text-align: center;
  white-space: normal;
  color: #4dff6a;
  /* a black outline all round, then the stepped block shadow: readable on the bright scenes too (the Street) */
  -webkit-text-stroke: 0.14cqw black;
  paint-order: stroke fill;
  text-shadow:
    0.18cqw 0 0 black, -0.18cqw 0 0 black, 0 0.18cqw 0 black, 0 -0.18cqw 0 black,
    -0.24cqw 0.24cqw 0 #005a15, -0.36cqw 0.36cqw 0 #004410, -0.48cqw 0.48cqw 0 #00300b,
    -0.6cqw 0.6cqw 0 #001f07, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 1.6cqw rgba(0, 255, 64, 0.6);
  animation: ${noticeInOut} ${OBJECTIVE_NOTICE_MS}ms ease-out both;
`;

// health won sparring: the same title, in red, a little lower (an objective may show with it)
const RewardNotice = styled(ObjectiveNotice)`
  top: 38%;
  color: #ff5c6c;
  text-shadow:
    0.18cqw 0 0 black, -0.18cqw 0 0 black, 0 0.18cqw 0 black, 0 -0.18cqw 0 black,
    -0.12cqw 0.12cqw 0 #8a0020, -0.24cqw 0.24cqw 0 #6e0019, -0.36cqw 0.36cqw 0 #520012, -0.48cqw 0.48cqw 0 #3a000c,
    -0.6cqw 0.6cqw 0 #22000a, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 2.5cqw #ff0040;
`;

// playing on as an ally (the take-over dev option): the objective's title, in blue
const TakeOverNotice = styled(ObjectiveNotice)`
  top: 38%;
  color: #6fd0ff;
  text-shadow:
    0.18cqw 0 0 black, -0.18cqw 0 0 black, 0 0.18cqw 0 black, 0 -0.18cqw 0 black,
    -0.24cqw 0.24cqw 0 #0a4a7a, -0.36cqw 0.36cqw 0 #083a60, -0.48cqw 0.48cqw 0 #062a46,
    -0.6cqw 0.6cqw 0 #041c30, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 1.6cqw rgba(64, 180, 255, 0.6);
`;

// the first fight's swirl into the Street (A2): the city at the Peninsula's north end, and the times
const CITY_SPOT = { x: 210, y: 70 };
const SWIRL = { panMs: 1100, swirlMs: 1300 };

const UnlockStack = styled(CardStack)`
  top: 3cqw;
  bottom: auto;
  z-index: 2147483646;
`;

const toastIn = keyframes`
  from { opacity: 0; transform: translateX(30%); }
  to { opacity: 1; transform: translateX(0); }
`;

const Toast = styled.div`
  display: flex;
  align-items: center;
  gap: 1cqw;
  max-width: 100%;
  padding: 0.7cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.1cqw;
  line-height: 1.4;
  color: #101018;
  background: #fbfbf0;
  border: 0.25cqw solid #101018;
  box-shadow: 0.35cqw 0.35cqw 0 rgba(0, 0, 0, 0.5);
  animation: ${toastIn} 0.45s ease-out both;
`;

const FadeToBlack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  animation: ${fadeIn} 0.9s ease-in both;
`;

// leaving a scene with HUDs up: this long for them to fly off before the next scene (playtest 26)
const SIDE_EXIT_MS = 900;

/*
  The avatar select's Lab, its lights coming on (Jamie, playtests 29-31): after a pause in the dark, a row of ceiling
  tubes flicker to life one after another, left to right, as the current runs down the circuit: each blinks, stutters,
  catches, and throws a pool of light down the scene; the dark lifts a step as each one catches, and the avatars,
  black silhouettes at first, come up with it.
*/
// (more dramatic: Jamie, playtest 31: longer flickers, and each blink floods the room before it drops back to dark)
const LAB_TUBES = { count: 4, stepMs: 600, flickerMs: 1800, darkest: 0.95, flash: 0.6 };
// a tube's blinks (shares of its flicker), and where it catches for good: the room's dark follows them
const TUBE_BLINKS = [[0.10, 0.14], [0.28, 0.31], [0.34, 0.36], [0.50, 0.63]];
const TUBE_CATCH = 0.66;
const LAB_LIGHTS_TOTAL_MS = LAB_TUBES.stepMs * (LAB_TUBES.count - 1) + LAB_TUBES.flickerMs;
const tubeFlicker = keyframes`
  0%, 9% { opacity: 0; }
  10% { opacity: 0.8; }
  14%, 27% { opacity: 0; }
  28% { opacity: 1; }
  31% { opacity: 0.1; }
  34% { opacity: 0.9; }
  36%, 49% { opacity: 0.15; }
  50% { opacity: 1; }
  63% { opacity: 1; }
  64% { opacity: 0.4; }
  66%, 100% { opacity: 1; }
`;
// the dark over the scene, worked out from the tubes: a step lighter as each catches, and flooded light on each blink
const getRoomDark = ms => {
  let caught = 0;
  let isFlashing = false;
  for (let k = 0; k < LAB_TUBES.count; k++) {
    const share = (ms - k * LAB_TUBES.stepMs) / LAB_TUBES.flickerMs;
    if (share >= TUBE_CATCH) caught += 1;
    else if (TUBE_BLINKS.some(([from, to]) => share >= from && share < to)) isFlashing = true;
  }
  const level = LAB_TUBES.darkest * (1 - caught / LAB_TUBES.count);
  return Math.max(0, isFlashing ? level - LAB_TUBES.flash : level);
};
const ROOM_DARK_STOPS = (() => {
  const times = new Set([0, LAB_LIGHTS_TOTAL_MS]);
  for (let k = 0; k < LAB_TUBES.count; k++) {
    const start = k * LAB_TUBES.stepMs;
    [...TUBE_BLINKS.flat(), TUBE_CATCH].forEach(share => times.add(Math.round(start + share * LAB_TUBES.flickerMs)));
  }
  return [...times].sort((a, b) => a - b).map(ms => `${((ms / LAB_LIGHTS_TOTAL_MS) * 100).toFixed(2)}% { opacity: ${getRoomDark(ms).toFixed(3)}; }`).join(" ");
})();
const labDark = keyframes`${ROOM_DARK_STOPS}`;
const LabDark = styled.div`
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  background: black;
  animation: ${labDark} ${LAB_LIGHTS_TOTAL_MS}ms steps(1, end) ${LAB_LIGHTS_DELAY_MS}ms both;
`;
// a tube on the ceiling, and its pool of light down the scene
const LabTube = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 41;
  pointer-events: none;
  mix-blend-mode: screen;
  background:
    linear-gradient(to bottom, rgba(240, 255, 255, 1) 0 0.5cqw, rgba(200, 245, 255, 0.5) 0.5cqw 0.8cqw, transparent 0.8cqw) center top / 72% 100% no-repeat,
    radial-gradient(ellipse 65% 90% at 50% 0%, rgba(200, 245, 255, 0.5), rgba(160, 225, 255, 0.18) 45%, transparent 78%);
  animation: ${tubeFlicker} ${LAB_TUBES.flickerMs}ms steps(1, end) both;
`;
const LabLightsOn = () => (
  <>
    <LabDark />
    {[...Array(LAB_TUBES.count).keys()].map(k => (
      <LabTube key={k} style={{ left: `${(k * 100) / LAB_TUBES.count}%`, width: `${100 / LAB_TUBES.count}%`, animationDelay: `${LAB_LIGHTS_DELAY_MS + k * LAB_TUBES.stepMs}ms` }} />
    ))}
  </>
);
// the avatars: black silhouettes in the dark, brought up with the lights
const avatarsLit = keyframes`
  0% { filter: brightness(0); }
  40% { filter: brightness(0.15); }
  70% { filter: brightness(0.5); }
  100% { filter: brightness(1); }
`;
const AvatarsInTheDark = styled.div`
  animation: ${avatarsLit} ${LAB_LIGHTS_TOTAL_MS}ms steps(4, end) ${LAB_LIGHTS_DELAY_MS}ms both;
`;

// between scenes. the clouds pass over these.
const SCENE_FADE = {
  outMs: 450,
  blackMs: 250, // the screen stays black this long before the new scene comes up
  inMs: 800
};

const SceneCover = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: black;
`;

/*
  The fades between scenes are on the monitor's screen only (Jamie, playtest 25: the whole page went black, the room
  with it). This holds them over the screen wherever it is (it moves), each frame; with no monitor about, the page.
*/
const OnMonitor = ({ zIndex = 2147483646, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frameId;
    const place = () => {
      const element = ref.current;
      const screen = document.querySelector("[data-play-screen]");
      if (element) {
        const box = screen ? screen.getBoundingClientRect() : undefined;
        element.style.left = box ? `${box.left}px` : "0";
        element.style.top = box ? `${box.top}px` : "0";
        element.style.width = box ? `${box.width}px` : "100vw";
        element.style.height = box ? `${box.height}px` : "100vh";
        element.style.borderRadius = box ? getComputedStyle(screen).borderRadius : "0";
      }
      frameId = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frameId);
  }, []);
  return <div ref={ref} style={{ position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh", zIndex, pointerEvents: "none", overflow: "hidden" }}>{children}</div>;
};

const fadeOutOfBlack = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const SceneFadeOut = styled(SceneCover)`
  animation: ${fadeIn} ${SCENE_FADE.outMs}ms ease-in both;
`;

const SceneFadeIn = styled(SceneCover)`
  animation: ${fadeOutOfBlack} ${SCENE_FADE.inMs}ms ease-out ${SCENE_FADE.blackMs}ms both;
`;

const WIPE_MS = 1800;

// black rises up from the bottom edge, holds, and carries on up to show the next shot.
// the band is 260% of the screen's height, with 40% of it black, or 104% of the screen.
const blackWipe = keyframes`
  from { transform: translateY(38.5%); }
  40%, 60% { transform: translateY(-30.8%); }
  to { transform: translateY(-100%); }
`;

// the screen's edge holds still while the scene slides inside it, so the slide never passes over the monitor's border
const SlideClip = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 1.8cqw;
`;

// how long the Lab scene takes to slide away to one of its screens
const LAB_SLIDE_MS = 900;

const SlideAway = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  transition: transform 0.9s ease-in, opacity 0.9s ease-in;
`;

// keeps the wipe on the monitor's screen
const ScreenClip = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482996;
  overflow: hidden;
  pointer-events: none;
`;

const BlackWipe = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 260%;
  z-index: 2147483647;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  animation: ${blackWipe} ${WIPE_MS}ms ease-in-out both;
`;

const DevShowButton = styled.button`
  position: fixed;
  left: 6px;
  bottom: 6px;
  z-index: 2147483647;
  padding: 2px 6px;
  font-size: 10px;
  opacity: 0.35;
  &:hover {
    opacity: 1;
  }
`;

const LevelPicker = styled.select`
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 2147483647;
`;

export const FloatingEffect = styled.div<{ styles?: string; duration?: string }>`

  ${props => !!props.styles && props.styles}

  animation: float-animation ${props => !!props.duration ? props.duration : "4"}s ease-in-out infinite;

@keyframes float-animation {
  0%, 100% {
    transform: translateY(0);
  }
  12.5% {
    transform: translateY(-2px);
  }
  25% {
    transform: translateY(-5px);
  }
  37.5% {
    transform: translateY(-3px);
  }
  50% {
    transform: translateY(-6px);
  }
  62.5% {
    transform: translateY(-4px);
  }
  75% {
    transform: translateY(-5px);
  }
  87.5% {
    transform: translateY(-2px);
  }
}`;

const MATCH_END_DELAY_MS = 700;
const TRAINING_WIN_HOLD_MS = 2500; // a training won: the last blow's ragdoll in slow motion a while before the walk (Jamie, playtest 19)
const SCENE_SLIDE_MS = 900;

// a rising pair of notes, for finding something
const playUnlockDing = () => {
  try {
    const audio = new AudioContext();
    [[880, 0], [1320, 0.12]].forEach(([frequency, startSeconds]) => {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      tone.type = "square";
      volume.gain.setValueAtTime(0.08, audio.currentTime + startSeconds);
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + startSeconds + 0.35);
      tone.connect(volume).connect(audio.destination);
      tone.start(audio.currentTime + startSeconds);
      tone.stop(audio.currentTime + startSeconds + 0.35);
    });
  } catch { /* (no sound) */ }
};

const RECRUIT_TIMING = {
  titleMs: 2800, // how long the title and slow motion last before the choice
  confirmMs: 5000, // the choice locks in and the screen washes over in its color, held, then fades to black
  cardMs: 6300 // the unlock cards come in over 1.3 s, then hold 5 s to be read
};

const RECRUIT_CARDS = {
  punk: { avatar: 'punk', label: 'Punk Guy' },
  black_female: { avatar: 'black_female', label: 'Ghost Girl' },
  mermaid: { avatar: 'mermaid', label: 'Aquarium Worker' }
};

// after the last win's title holds a while, the credits roll over it
const FinaleCredits = ({ title, onDone }) => {
  const [isRolling, setIsRolling] = useState(false);
  useEffect(() => {
    const roll = setTimeout(() => setIsRolling(true), CREDITS_TIMING.titleMs);
    return () => clearTimeout(roll);
  }, []);
  return isRolling ? createPortal(<Credits onDone={onDone} />, document.querySelector("[data-play-screen]") || document.body) : <EndTitle>{title}</EndTitle>;
};

// 'handleShiftHome': back to the landing with the view's shift, not the clouds (the end of the game)
export const Game = ({ handleClickHome, triggerTransition, handleShiftHome = undefined, handleZoomHome = undefined }) => {
  const { selectedAvatar, setSelectedAvatar, selectedTeammate, setSelectedTeammate, selectedDifficulty, settingsManager } = useContext(GlobalSettingsContext);
  const { objectiveText, isObjectiveKaijuCount, objectiveCount } = useSnapshot(gameUiStore);
  const { takeOverCount, takeOverText } = useSnapshot(gameUiStore);
  const { isPaused, winner, isPlayerDead, players, recruits, kaijuKillCount, kaijuToWin, activePhases, isWideShot, isCutscene, unlockMessage, unlockImage, speech, recruitScene, dialogueLog, isDialogueWaiting, isTalking, isRecruitTalkDone, speakingPieceIndex, isHudsKept, isBalloonScene } = useSnapshot(gameUiStore);
  const [isRadioAlarm, setIsRadioAlarm] = useState(false); // the radio call has told of Kaiju coming: the siren glows
  const recruitChoiceFrom = useRef(undefined); // where the pressed Recruit or Terminate button was, for its word to fly from
  const [isClickThrough, setClickThrough] = useState(getIsClickThrough); // a playtest: each line in the log waits for a key or a click
  const [spacing, setSpacing] = useState(() => ({ walking: getIsSpacing("walking"), battle: getIsSpacing("battle") })); // a playtest: NPCs don't bunch up
  const toggleSpacing = kind => {
    setIsSpacing(kind, !spacing[kind]);
    setSpacing({ ...spacing, [kind]: !spacing[kind] });
  };

  const startingLevelId = new URLSearchParams(window.location.search).get('level');
  const [levelId, setLevelId] = useState(startingLevelId || PENINSULA.id);
  const [campaignIndex, setCampaignIndex] = useState(startingLevelId ? null : 0); // null: playing one level on its own
  useEffect(() => setIsRadioAlarm(false), [campaignIndex]);
  const level = LEVELS[levelId] || PENINSULA;
  const togglePhase = id => {
    gameManager.current.togglePhase(id);
    publishGameUi(gameManager.current.getUiState());
  };

  const gameManager = useRef<any>(null);
  // dev only: the game manager on the window, for scripted checks (calling recruits, hurting pieces); not in the built game
  if (import.meta.env.DEV) (window as any).__kaiju = { gameManager };
  const gameLoop = useRef<GameLoop | null>(null);

  const [isTeammate, setIsTeammate] = useState(true);
  const [isShowingControls, setIsShowingControls] = useState(false);
  const isPausedForControls = useRef(false);
  const [kaijuSpeedMode, setKaijuSpeedModeState] = useState(getKaijuSpeedMode); // dev playtest
  const [isChoosingAvatar, setIsChoosingAvatar] = useState(!startingLevelId); // a new campaign starts with the guy or the girl
  // the monitor: dead as the view shifts onto it from the landing, then switched on; switched off after the credits
  const [isMonitorOn, setIsMonitorOn] = useState(!!startingLevelId);
  // (from the landing's zoom, the room's already there: the monitor fades up in its spot, it doesn't slide in. Jamie)
  const [monitorShift, setMonitorShift] = useState<'in' | 'out' | 'fade' | undefined>(startingLevelId ? undefined : ROOM_HANDOFF.view ? 'fade' : 'in');
  useEffect(() => {
    if (startingLevelId) return;
    const on = setTimeout(() => setIsMonitorOn(true), MONITOR_SHIFT.ms + MONITOR_SHIFT.deadBeatMs);
    const settled = setTimeout(() => setMonitorShift(undefined), MONITOR_SHIFT.ms);
    return () => { clearTimeout(on); clearTimeout(settled); };
  }, []);
  // the end's bookend: switched off, dead a beat, then the shift back to the landing
  // (Jamie, playtest 34: after the credits, the monitor off, a beat, then the zoom back out through the window to the
  // landing, as Quit does; it slid off sideways before)
  const endWithMonitorOff = () => {
    setIsMonitorOn(false);
    setTimeout(() => leaveByZoom(), CRT.offMs + MONITOR_SHIFT.endDeadMs);
  };
  // dev (Jamie, 2026-11-14): the power picker right after the avatar select, even on a first play, to see it
  // a first play goes from the avatar choice straight into the game: the power picker isn't shown on the way (Jamie, playtest 18)
  const [isSkippingPicker, setIsSkippingPicker] = useState(false);
  const isPickingPowersInLab = useRef(false);
  const [isLabPicker, setIsLabPicker] = useState(false);
  const [isLogClosing, setIsLogClosing] = useState(false); // the HUDs wait for the log to come apart
  const [isLogBuilt, setIsLogBuilt] = useState(false); // a speaker shakes only once their words are in the log // the picker was opened from the Lab's tanks: it goes back there
  const [isWholeScene, setIsWholeScene] = useState(false);
  const [isMouseLook, setIsMouseLook] = useState(true);
  const [isEnemyZoom, setIsEnemyZoom] = useState(true);
  const [isTeamColors, setIsTeamColors] = useState(true); // a playtest: statuses in their side's color
  // who is recruited this playthrough (Jamie: React state, not saved). The dev panel switches each on or off.
  const [recruitedAvatars, setRecruitedAvatars] = useState<Array<string>>([]);
  const toggleRecruited = avatar => setRecruitedAvatars(list => list.includes(avatar) ? list.filter(id => id != avatar) : [...list, avatar]);
  // the bystanders terminated this playthrough (their battlegrounds offer sparring), and the health won sparring
  const [terminatedAvatars, setTerminatedAvatars] = useState<Array<string>>([]);
  const [trainingPoints, setTrainingPoints] = useState({ player: 0, teammate: 0 }); // health won sparring, each their own (F7)
  const [sparredLevelIds, setSparredLevelIds] = useState<Array<string>>([]); // the battlegrounds sparred in (F5)
  const trainingOutcome = useRef(undefined); // a training fight just won: the battleground, back from it, speaks of it
  const pendingRewardText = useRef(undefined); // its card: shown once back in the battleground
  const [isSwirling, setIsSwirling] = useState(false); // the Peninsula's first fight swirls away into the Street (A2)
  const isHealthRewardDue = useRef(false); // won sparring: the next match (the walk, after) shows it
  // 'power': a power won (its element): shown as its card, with its tile, as Terminate's is (Jamie, playtest 18)
  const [rewardNotice, setRewardNotice] = useState<{ key: number; text: string; power?: string } | undefined>(undefined);
  const rewardText = useRef(undefined); // the reward's title, due once the walk's opening shot is over
  const [sparringTweak, setSparringTweak] = useState({ ...SPARRING }); // the dev panel's copy of SPARRING, to show its values
  const [isAutoRecruits, setIsAutoRecruits] = useState(true); // dev toggle (Jamie): every recruit in every fight, and walking with the team; no call buttons
  // dev toggles (Jamie, playtest 18), on for now: the player down, they play on as the next of the team; a recruit who dies
  // in a fight is gone for good (no HUD, not in the next fight)
  const [isTakeOverOnDeath, setIsTakeOverOnDeath] = useState(true);
  const [isPermadeath, setIsPermadeath] = useState(true);
  // dev (Jamie, playtest 19, to pick one): the marker on the one the player plays as
  const [controlMarker, setControlMarker] = useState("outline"); // the outline by default (Jamie, playtest 22)
  const [fallenRecruits, setFallenRecruits] = useState<Array<string>>([]);
  const [isTrainedNpcs, setIsTrainedNpcs] = useState(false); // off by default (Jamie, 2026-11-06). NPCs play by the trained model in public/models in fights with no Kaiju; against a Kaiju they hand back to the rules
  const [isDevHidden, setIsDevHidden] = useState(false); // the dev tools tucked away, to see the game as it will ship
  const [npcAggression, setNpcAggression] = useState(DEFAULT_AGGRESSION); // the trained NPCs', 0 careful to 1 reckless
  // the ghost boss's ring, tuned in the dev panel: its size, and the ghosts in each phase's ring (the next ring uses them)
  const [ghostRadiusRows, setGhostRadiusRows] = useState(GHOST_BOSS.ringRadiusRows);
  const [ghostRings, setGhostRings] = useState(GHOST_BOSS.rings.join(', '));
  // the Aquarium's flood, tuned in the dev panel (the next flood uses them)
  const [floodSeconds, setFloodSeconds] = useState(AQUARIUM_FLOOD.floodMs / 1000);
  const [floodStyle, setFloodStyle] = useState(AQUARIUM_FLOOD.flowStyle);
  // the final battle's giant: how fast it marches (the map's size is GIANT_KAIJU.mapScale, set when the game loads)
  const [giantMarch, setGiantMarch] = useState(GIANT_KAIJU.marchRowsPerSecond);
  const npcAggressionRef = useRef(npcAggression);
  npcAggressionRef.current = npcAggression;
  const [isMonitorAlways, setIsMonitorAlways] = useState(true); // a playtest: the TV never opens up, and wide shots play inside it
  const [isAdjustingWindow, setIsAdjustingWindow] = useState(false);
  const [playWindow, setPlayWindow] = useState(() => loadPlayWindow()); // the saved shape, in production too
  const updatePlayWindow = next => {
    setPlayWindow(next);
    savePlayWindow(next);
  };
  const [isEditingTiles, setIsEditingTiles] = useState(false);
  const [matchCount, setMatchCount] = useState(0); // the board starts fresh with each match
  const [pickedAbilities, setPickedAbilities] = useState([]);
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  // the picker: the monitor stays in the middle while its things fade in, then eases aside as the mini-monitor flies in
  const [isPickerAside, setIsPickerAside] = useState(false);
  // into the game: the monitor's screen goes to black, and the new scene comes up from it
  const [screenFade, setScreenFade] = useState<'out' | 'in' | undefined>(undefined);
  const [hoveredAvatar, setHoveredAvatar] = useState<string | undefined>(undefined);
  const [handOverAvatar, setHandOverAvatar] = useState<string | undefined>(undefined);
  // a scene come up on the monitor's own screen doesn't fade the whole page too (it'd black out the casing): the scenes
  // first shown in the screen fade's moments are left without it, for good
  const sceneFadeSkips = useRef({ until: 0, keys: new Set<string>(), seen: new Set<string>() });
  const getIsSceneFadeSkipped = (key: string) => {
    const skips = sceneFadeSkips.current;
    if (!skips.seen.has(key)) {
      skips.seen.add(key);
      if (Date.now() < skips.until) skips.keys.add(key);
    }
    return skips.keys.has(key);
  };
  // the console's coming (Jamie): the monitor eases aside for it, from the avatar select on
  const [isConsoleIn, setIsConsoleIn] = useState(false);
  // the monitor's first boot (logo, the game's load, its start screen): the side units wait for it (Jamie, playtest 29)
  const [isBooted, setIsBooted] = useState(getHasBooted());
  useEffect(() => {
    if (!isMonitorOn || isConsoleIn || isPlayingGame || !isBooted) return;
    const aside = setTimeout(() => setIsConsoleIn(true), MINI_TIMING.consoleDelayMs);
    return () => clearTimeout(aside);
  }, [isMonitorOn, isPlayingGame, isBooted]); // (isBooted too: the boot's end never eased the monitor aside. Jamie, playtest 29)
  // the side monitor and the console: switched off (Back from the avatar select), flying off (Play!: Jamie)
  const [isSideOff, setIsSideOff] = useState(false);
  const [isFlyingOff, setIsFlyingOff] = useState(false);
  useEffect(() => {
    setIsSideOff(false);
    setIsFlyingOff(false);
  }, [isPlayingGame, isMonitorOn]);
  /*
    Leave (and Back from the avatar select), Jamie: the view starts pulling back from the monitor with its picture still
    on, the screen clicks off as an old TV does, then the way back to the landing carries on from there (ZoomThrough).
  */
  const [pullOrigin, setPullOrigin] = useState<string | undefined>(undefined);
  const leaveByZoom = () => {
    if (!handleZoomHome) {
      handleClickHome();
      return;
    }
    if (pullOrigin) return;
    // every side element goes as the zoom back starts (Jamie, playtest 26): HUDs, dialogue panel, side monitor, console
    setIsSideLeaving(true);
    setIsFlyingOff(true);
    const casing = document.querySelector("[data-tv-casing]");
    const box = casing && casing.getBoundingClientRect();
    ROOM_HANDOFF.isFrozen = true;
    setPullOrigin(box ? `${box.left + box.width / 2}px ${box.top + box.height / 2}px` : "50% 50%");
    setTimeout(() => setIsMonitorOn(false), PULL_BACK.offAtMs);
    setTimeout(() => {
      const room = document.querySelector("[data-room-box]");
      if (room) {
        const view = room.getBoundingClientRect();
        ZOOM_BACK.fromView = { left: view.left, top: view.top, width: view.width };
      }
      ROOM_HANDOFF.isFrozen = false;
      handleZoomHome();
    }, PULL_BACK.offAtMs + CRT.offMs);
  };
  const pullStyle = pullOrigin ? { transform: `scale(${PULL_BACK.scale})`, transformOrigin: pullOrigin, transition: `transform ${PULL_BACK.ms}ms ease-in` } : undefined;
  // the tamagotchi waits while the Controls card is up
  useEffect(() => holdTamagotchi(isShowingControls), [isShowingControls]);
  // where the picker came from, for its Back (Jamie): the avatar select, back there; else home
  const [pickerFrom, setPickerFrom] = useState<'avatar' | 'home'>('home');
  useEffect(() => {
    if (isChoosingAvatar || isPlayingGame) {
      setIsPickerAside(false);
      return;
    }
    const aside = setTimeout(() => setIsPickerAside(true), MINI_TIMING.flyDelayMs);
    return () => clearTimeout(aside);
  }, [isChoosingAvatar, isPlayingGame]);
  useEffect(() => { if (isPlayingGame) setIsSkippingPicker(false); }, [isPlayingGame]);
  const [fullScreenPageData, setFullScreenPageData] = useState(undefined);
  const [radioLines, setRadioLines] = useState(undefined);
  const [matchEnd, setMatchEnd] = useState(undefined); // the title over the board once a match is decided
  const [recruitChoice, setRecruitChoice] = useState(undefined);
  const [leavingFor, setLeavingFor] = useState(undefined); // the Lab screen the scene is sliding away for
  const [isSlidingBack, setIsSlidingBack] = useState(false); // coming back from it: the slide in reverse
  const [isResumingRadio, setIsResumingRadio] = useState(false);
  const [isRadioPaused, setIsRadioPaused] = useState(false); // the radar call paused from the bezel (Jamie, playtest 23)
  useEffect(() => setIsRadioPaused(false), [radioLines]);
  const isOnLabDetour = useRef(false); // the Lab, or a battleground visited again, off a map walk
  const detourSpot = useRef(undefined); // where that site is on the map: the walk carries on from beside it
  const [labScreen, setLabScreen] = useState(undefined); // 'colors'
  const [labCover, setLabCover] = useState(undefined); // 'in' or 'out': the Lab screen's fade from or to black
  const [fadeCards, setFadeCards] = useState(undefined); // the screen is fading to black, and these are the unlocks shown on it
  const [isFadingOut, setIsFadingOut] = useState(false);
  // leaving the scene (or the game, by Leave): the HUDs and the dialogue panel go
  const [isSideLeaving, setIsSideLeaving] = useState(false);
  const hudsShowingRef = useRef(false);
  const [isWiping, setIsWiping] = useState(false);
  const isLeavingScene = useRef(false);

  const endMatch = () => {
    if (gameLoop.current) gameLoop.current.stop();
    gameLoop.current = null;
    gameManager.current = null;
    isLeavingScene.current = false;
    setIsFadingOut(false);
    setIsSideLeaving(false);
    setIsWiping(false);
  };

  // the next scene only ever comes up out of a black screen
  // (and everything beside the monitor goes first: the HUDs fly off, the dialogue panel comes apart, and the scene waits
  // for them. Jamie, playtest 26: after every battle)
  const fadeOutThen = callback => {
    if (isLeavingScene.current) return;
    isLeavingScene.current = true;
    setIsFadingOut(true);
    const isAsideUp = hudsShowingRef.current;
    setIsSideLeaving(true);
    setTimeout(callback, isAsideUp ? Math.max(SCENE_FADE.outMs, SIDE_EXIT_MS) : SCENE_FADE.outMs);
  };


  // the game stops when the player leaves the page
  useEffect(() => endMatch, []);

  // a clicked button lets go of the focus, so Enter or Space can't press it again in the middle of play
  useEffect(() => {
    const letGo = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button, select, input");
      if (button) setTimeout(() => (button as HTMLElement).blur(), 0);
    };
    document.addEventListener("click", letGo, true);
    return () => document.removeEventListener("click", letGo, true);
  }, []);

  // 'isSolo': without the teammate, whatever the settings (a recruit's training, one on one)
  const startMatch = (matchLevel = level, hasArrival = false, killsToWin = undefined, { returnSpot = undefined, isRetry = false, isSolo = false } = {}) => {
    settingsManager.updatePlayerAvatar(selectedAvatar);
    settingsManager.setTeammateAvatar(selectedTeammate);
    settingsManager.setDifficulty(selectedDifficulty);
    settingsManager.setIsTeammate(isTeammate && !isSolo);

    setIsDialogueLog(isMonitorAlways); // in the monitor, conversations go to the log beside it
    const gm = new GameManager({ level: matchLevel, settingsManager, hasArrival, killsToWin, returnSpot, isRetry, autoRecruits: isAutoRecruits ? getCallableRecruits() : [], recruits: getCallableRecruits(), carriedObjective: lastObjective.current, terminated: terminatedAvatars, fallen: isPermadeath ? fallenRecruits : [], trainingPoints, healthReward: isHealthRewardDue.current, trainingOutcome: trainingOutcome.current, sparredHere: sparredLevelIds.includes(matchLevel.id), isRevisit: matchLevel.id == 'labIntro' && labVisits.current > 0 && !returnSpot, isTakeOverOnDeath });
    if (matchLevel.id == 'labIntro' && !returnSpot) labVisits.current += 1;
    isHealthRewardDue.current = false;
    trainingOutcome.current = undefined;
    rewardText.current = pendingRewardText.current;
    pendingRewardText.current = undefined;
    gm.initGame();
    gameManager.current = gm;
    if (import.meta.env.DEV) (window as any).__kaijuGame = gm; // dev only: a handle for scripted browser checks
    resetGameUi();
    publishGameUi(gm.getUiState());

    gameLoop.current = new GameLoop({
      steps: [
        { everyMs: GAME_TICK.pieceMs, run: () => gm.stepPieces() },
        { everyMs: GAME_TICK.tileMs, run: () => gm.stepTiles() }
      ],
      maxCatchUpMs: GAME_TICK.maxCatchUpMs,
      onAdvanced: () => {
        gm.notifyBoard();
        publishGameUi(gm.getUiState());
      }
    });
    gameLoop.current.start();
    isLeavingScene.current = false;
    setIsFadingOut(false);
    setIsSideLeaving(false);
    if (matchLevel.id == 'labIntro') unlockTool('abilityEditor');
    setIsEditingTiles(false);
    setMatchCount(count => count + 1);
    setFullScreenPageData(undefined);
    setRadioLines(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
  };

  // dev testing: changes level, and a match in progress restarts on it with the same powers
  const switchLevel = id => {
    setCampaignIndex(null);
    setLevelId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('level', id);
    window.history.replaceState({}, "Kaiju City", url);
    if (gameManager.current) {
      endMatch();
      startMatch(LEVELS[id]);
    }
  };

  const setIsEditing = isEditing => {
    gameManager.current.setIsEditingTiles(isEditing);
    publishGameUi(gameManager.current.getUiState());
    setIsEditingTiles(isEditing);
  };

  const playSavedLevel = file => {
    applyLevelFile(file);
    endMatch();
    startMatch(LEVELS[file.id]);
  };

  const cycleLevel = step => {
    const ids = Object.keys(LEVELS);
    switchLevel(ids[(ids.indexOf(level.id) + step + ids.length) % ids.length]);
  };

  useEffect(() => {
    if (unlockMessage) playUnlockDing();
  }, [unlockMessage]);

  // a walking scene's hotspots: their number keys click them (Jamie). in the middle of a scene's talk (the Lab Agent's
  // welcome), the key cuts the talk short and goes to that option (Jamie, playtest 24): the numbers are the hotspots
  // showing now, so 2 is "What is this?" with the Agent there and his nervous answer not yet given, else the color vat
  const hotspotKeyCode = useRef(undefined); // that key's own release: not also a press of the log's Continue (1)
  useEffect(() => {
    if (!level.isWalkingLevel) return;
    const onKey = event => {
      const match = /^(Digit|Numpad)([1-9])$/.exec(event.code);
      if (!match || event.repeat || isCutscene || recruitScene || labScreen || isPaused) return;
      const hotspot = getActiveHotspots(level, activePhases)[Number(match[2]) - 1];
      if (!hotspot) return;
      if ((isTalking || isDialogueWaiting) && gameManager.current) gameManager.current.skipSceneTalks();
      event.preventDefault();
      hotspotKeyCode.current = event.code;
      openLabScreen(hotspot.action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // a new objective: its title on the screen a while (Jamie: in the style of "Kaiju Terminated", in green)
  const [objectiveNotice, setObjectiveNotice] = useState<{ key: number; text: string } | undefined>(undefined);
  // the player down, they play on as an ally (dev option): its notice, in blue (Jamie, playtest 19)
  const [takeOverNotice, setTakeOverNotice] = useState<{ key: number; text: string } | undefined>(undefined);
  useEffect(() => {
    if (!takeOverCount) return;
    setTakeOverNotice({ key: takeOverCount, text: takeOverText });
  }, [takeOverCount]);
  usePausableNotice(takeOverNotice, setTakeOverNotice, OBJECTIVE_NOTICE_MS, isPaused);

  // whenever it differs from the one just before (Jamie, playtest 21: even one seen before, as the Rooftop's second
  // "Survive the Ghosts"); not the same one again on a new level (the carried "Go to the Lab")
  const lastNoticeText = useRef("");
  useEffect(() => {
    if (!objectiveCount || !objectiveText) return;
    if (objectiveText == lastNoticeText.current) return;
    lastNoticeText.current = objectiveText;
    setObjectiveNotice({ key: objectiveCount, text: objectiveText });
  }, [objectiveCount]);
  usePausableNotice(objectiveNotice, setObjectiveNotice, OBJECTIVE_NOTICE_MS, isPaused);
  // the objective before a detour (the walking Lab off a map walk): it carries over there
  const lastObjective = useRef(null);
  useEffect(() => {
    // a training fight is a detour too: after it, the objective from before it again (Jamie, playtest 18)
    if (!getIsDetourLevel(level.id) && !level.isTraining) lastObjective.current = objectiveText ? { text: objectiveText, isKaijuCount: isObjectiveKaijuCount } : null;
  }, [objectiveText, isObjectiveKaijuCount, level.id]);

  // a training's reward plays out back in the battleground (Jamie): the card at once, and the HUDs up while they glow
  const isRewarding = players.some(({ isRewardPulse }) => isRewardPulse);
  useEffect(() => {
    if (!isPlayingGame || isCutscene || !rewardText.current) return;
    const { text, power } = rewardText.current;
    setRewardNotice({ key: Date.now(), text, power });
    rewardText.current = undefined;
  }, [isRewarding, isCutscene, matchCount, isPlayingGame]);
  // not cleared when the glow ends: the title always goes
  usePausableNotice(rewardNotice, setRewardNotice, rewardNotice && rewardNotice.power ? UNLOCK_CARD_MS : OBJECTIVE_NOTICE_MS, isPaused);

  // a new playthrough: nothing chosen in the last one carries over (Jamie): who was recruited or terminated, health won
  // times in the walking Lab this playthrough: after the first, the Agent doesn't greet the team again (Jamie, playtest 18)
  const labVisits = useRef(0);
  const startNewPlaythrough = () => {
    setRecruitedAvatars([]);
    setTerminatedAvatars([]);
    setTrainingPoints({ player: 0, teammate: 0 });
    setSparredLevelIds([]);
    setFallenRecruits([]);
    labVisits.current = 0;
    clearRecruitChoices();
  };

  // only those recruited this playthrough
  // the Hazmat Worker, once unlocked, is with the team too: he walks, fights and has his HUD like a recruit (E3, Jamie)
  const getCallableRecruits = () => (getUnlocks().includes('hazmat') && !recruitedAvatars.includes('hazmat') ? [...recruitedAvatars, 'hazmat'] : recruitedAvatars)
    .filter(avatar => !(isPermadeath && fallenRecruits.includes(avatar)));

  const levelOptions = Object.values(LEVELS).map(({ id, name }) => <option key={id} value={id}>{name}</option>);

  const resetMatch = () => {
    endMatch();
    resetGameUi();
    setPickedAbilities([]);
    setIsPlayingGame(false);
    setFullScreenPageData(undefined);
  };

  const getRadioContext = () => {
    settingsManager.initAbilityStatusData(); // the first call comes before any match has loaded the powers
    const [ability] = settingsManager.getPlayerChosenAbilities();
    return {
      powerName: ability ? ability.gameBoardPieceAbilityData.activeName : "powers",
      choices: getRecruitChoices(),
      avatar: selectedAvatar
    };
  };

  const showSection = index => {
    const { levelId: sectionLevelId, radio, kills } = CAMPAIGN_SECTIONS[index];
    endMatch();
    resetGameUi();
    setCampaignIndex(index);
    setLevelId(sectionLevelId);
    setFullScreenPageData(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setIsResumingRadio(false);
    if (radio) setRadioLines(radio(getRadioContext()));
    else startMatch(LEVELS[sectionLevelId], false, kills);
  };

  if (import.meta.env.DEV) Object.assign((window as any).__kaiju || {}, { showSection, endWithMonitorOff, openLabScreen: (screen: string) => openLabScreen(screen) }); // dev only: scripted browser checks

  // after a loss: the same fight again, without the call or the opening words a second time
  const retrySection = index => {
    const { levelId: sectionLevelId, kills } = CAMPAIGN_SECTIONS[index];
    // lost to the teammate's Kaiju (or already in that fight): again from its start, without the Kaiju or the words (Jamie)
    if (level.id == "finalTurnFight" || (gameManager.current && gameManager.current.finalTurnState == "fighting")) {
      showFinalTurnFight();
      return;
    }
    endMatch();
    resetGameUi();
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setRadioLines(undefined);
    startMatch(LEVELS[sectionLevelId], false, kills, { isRetry: true });
  };

  // the last fight, from the teammate's turn: a Retry after losing it, and the dev list's jump
  const showFinalTurnFight = () => {
    endMatch();
    resetGameUi();
    setCampaignIndex(CAMPAIGN_SECTIONS.length - 1);
    setLevelId("finalTurnFight");
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setRadioLines(undefined);
    startMatch(LEVELS.finalTurnFight, false, undefined, { isRetry: true });
  };

  // goes back through the ability picker, which returns to this section's call
  // back into the walking Lab, beside the tanks, with the talk there already had
  const returnToLab = () => {
    isPickingPowersInLab.current = false;
    const labLevel = LEVELS[level.id];
    const tank = (labLevel.sceneElements || []).find(({ action }) => action == "powers");
    const returnSpot = tank ? { x: tank.x + tank.width / 2, y: tank.y + tank.height } : undefined;
    // (the reverse of going, Jamie: the picker fades out on the monitor, and the Lab pans back in from the right)
    setScreenFade('out');
    setTimeout(() => {
      setIsLabPicker(false);
      sceneFadeSkips.current.until = Date.now() + 1500;
      setIsSlidingBack(true);
      setLeavingFor("powers");
      startMatch(labLevel, false, undefined, { returnSpot, isRetry: true });
      setIsPlayingGame(true);
      setScreenFade(undefined);
      requestAnimationFrame(() => requestAnimationFrame(() => setLeavingFor(undefined)));
      setTimeout(() => setIsSlidingBack(false), LAB_SLIDE_MS + 100);
    }, SCREEN_FADE.ms);
  };

  const handleChangePowers = lastLine => {
    setRadioLines([lastLine]);
    setIsResumingRadio(true);
    setIsPlayingGame(false);
  };

  const handleClickPlay = () => {
    if (isPickingPowersInLab.current) {
      returnToLab();
      return;
    } else if (isResumingRadio) {
      // back to the end of the call
    } else if (campaignIndex !== null) {
      showSection(campaignIndex);
    } else {
      setFullScreenPageData({
        text: ["Wild Kaiju have appeared!"],
        buttons: [{ text: "Fight!", onClick: () => startMatch() }],
        image: { src: './story_images/match_start.png', width: '535px', height: '535px' }
      });
    }
    // no clouds (Jamie): the monitor's screen fades to black, then the new scene fades in on it
    setScreenFade('out');
    setTimeout(() => {
      sceneFadeSkips.current.until = Date.now() + 1500;
      setIsPlayingGame(true);
      setScreenFade('in');
      setTimeout(() => setScreenFade(undefined), SCREEN_FADE.ms + 100);
    }, SCREEN_FADE.ms);
  };

  const getWinTitle = () => {
    if (level.rival) return "Target Subdued";
    return level.agentDrops ? "Agents Terminated" : "Kaiju Terminated";
  };

  const getMatchEnd = isWon => {
    const title = isWon ? getWinTitle() : "You Lost";
    // the end of the game: the title, then the credits, then the landing screen
    // the last fight's ends: the city saved, or (the player turned, with no teammate left to) destroyed (Jamie)
    const isDestroyed = !!gameManager.current && gameManager.current.finalTurnState == "destroyed";
    if (isWon && (level.giantKaiju || (campaignIndex !== null && getIsLastSection(campaignIndex)))) return { title: isDestroyed ? "You turned into a Kaiju and destroyed the city!" : "You saved the city!", buttons: [], isFinale: true };
    if (campaignIndex === null) {
      return { title, buttons: [{ text: "Play again", onClick: () => fadeOutThen(resetMatch) }, { text: "Quit", onClick: () => leaveByZoom() } /* (the way back out, as the bezel's Leave: Jamie) */] };
    }
    if (!isWon) {
      return { title, buttons: [{ text: "Try again", onClick: () => fadeOutThen(() => retrySection(campaignIndex)) }, { text: "Quit", onClick: () => leaveByZoom() } /* (the way back out, as the bezel's Leave: Jamie) */] };
    }
    if (getIsLastSection(campaignIndex)) {
      return { title: "You saved the city!", buttons: [{ text: "Play again", onClick: () => { setCampaignIndex(0); fadeOutThen(resetMatch); } }, { text: "Quit", onClick: () => leaveByZoom() } /* (the way back out, as the bezel's Leave: Jamie) */] };
    }
    // the first fight to the Street: in on the city, then the map swirls away (Jamie)
    if (campaignIndex === 0) return { title, buttons: [{ text: "Continue", onClick: () => swirlToSection(campaignIndex + 1) }] };
    return { title, buttons: [{ text: "Continue", onClick: () => fadeOutThen(() => showSection(campaignIndex + 1)) }] };
  };

  // the camera pans to the city at the Peninsula's north end, the map spins and blurs into the dark, and the next section
  const swirlToSection = index => {
    setMatchEnd(undefined);
    if (gameManager.current) gameManager.current.outcomeShot = { point: { ...CITY_SPOT }, zoomScale: PENINSULA.cameraZoom * 1.6, isPeninsulaSized: true, panMs: SWIRL.panMs };
    setTimeout(() => setIsSwirling(true), SWIRL.panMs);
    setTimeout(() => fadeOutThen(() => { setIsSwirling(false); showSection(index); }), SWIRL.panMs + SWIRL.swirlMs);
  };

  // from the walking Peninsula into a scene (Jamie, playtest 26: the Street's blur-rotate, every time): the map spins
  // and blurs away, then the clouds carry on into it
  const swirlThenClouds = callback => {
    // (other walking scenes, as the sewers: the monitor's own fade, no clouds: clouds are only the landing's and the
    // walking Peninsula's ways into scenes. Jamie, playtests 25 and 26: sewer 1 to 2, sewer 2 to the Lab fight)
    if (!level.isMapWalk) {
      fadeOutThen(callback);
      return;
    }
    // (the swirl spins, zooms and blurs the map away, then the monitor's own fade: no clouds, they're full-screen and
    // only the landing's now. Jamie, playtest 29)
    setIsSwirling(true);
    setTimeout(() => fadeOutThen(() => { setIsSwirling(false); callback(); }), SWIRL.swirlMs);
  };

  // a stop off a map walk: the Lab, or a battleground won on before. the walk carries on after.
  const visitSite = site => {
    const visitLevelId = site.visitLevelId || 'labIntro';
    isOnLabDetour.current = true;
    detourSpot.current = site.spot;
    setLevelId(visitLevelId);
    endMatch();
    startMatch(LEVELS[visitLevelId]);
  };

  // a recruit's training (Jamie): their battleground, one on one, for their power. back to the map walk after.
  const startTraining = trainingLevelId => {
    setLevelId(trainingLevelId);
    setMatchEnd(undefined);
    endMatch();
    startMatch(LEVELS[trainingLevelId], false, undefined, { isSolo: true });
  };

  // back from a training fight to its walking battleground (the map walk carries on after, as from any visit)
  const returnFromTraining = visitLevelId => {
    setLevelId(visitLevelId);
    setMatchEnd(undefined);
    endMatch();
    startMatch(LEVELS[visitLevelId]);
  };

  const openLabScreen = screen => {
    if (screen == "exit") {
      fadeOutThen(leaveLevel); // (no clouds: only the landing and the walking Peninsula's ways into scenes have them: Jamie)
      return;
    }
    if (screen == "agentTalk") {
      gameManager.current.startNewLog(); // a new conversation: the welcome is gone, and the Agent's face and name show again
      gameManager.current.setPhase(LAB_TALK_PHASE, true);
      return;
    }
    // the power picker, and back into the Lab with the new powers
    if (screen == "powers") {
      isPickingPowersInLab.current = true;
      // (Jamie, playtest 34: a jump between the Lab and the picker) the picker's monitor starts where the Lab's was,
      // then eases aside as its console comes, rather than appearing aside
      if (isMonitorCentered) setIsConsoleIn(false);
      setIsLabPicker(true);
      setPickedAbilities([...settingsManager.getSortedPlayerChosenAbilityElementsString()]); // the powers they have now, picked already
      // the scene slides away to the right, as if the camera turned left to the tanks, as it slides left for the color vat
      setLeavingFor(screen);
      setTimeout(() => {
        endMatch(); // the Lab starts again with the new powers
        setIsPlayingGame(false);
        setLeavingFor(undefined);
      }, LAB_SLIDE_MS);
      return;
    }
    unlockTool(screen);
    setLeavingFor(screen);
    setTimeout(() => {
      setLabScreen(screen);
      setLabCover("in");
    }, SCENE_SLIDE_MS);
  };

  // (the reverse of going, Jamie: the screen fades on the monitor, and the Lab slides back in from the side it went)
  const closeLabScreen = () => {
    setLabCover("out");
    setTimeout(() => {
      setLabScreen(undefined);
      setLabCover(undefined);
      setIsSlidingBack(true);
      setLeavingFor(undefined);
      setTimeout(() => setIsSlidingBack(false), LAB_SLIDE_MS + 100);
    }, SCENE_FADE.outMs);
  };

  const chooseTeam = (player, teammate) => {
    setSelectedAvatar(player);
    setSelectedTeammate(teammate);
    saveTeamAvatars(player, teammate);
    if (gameManager.current) gameManager.current.changeTeamAvatars(player, teammate);
  };

  const irradiate = color => {
    saveAvatarColor(selectedAvatar, color);
    gameManager.current.getPieces()[0].setColor(color);
  };

  const leaveLevel = () => {
    if (isOnLabDetour.current) {
      isOnLabDetour.current = false;
      const { levelId: mapLevelId } = CAMPAIGN_SECTIONS[campaignIndex];
      setLevelId(mapLevelId);
      endMatch();
      startMatch(LEVELS[mapLevelId], false, undefined, { returnSpot: detourSpot.current });
    } else if (campaignIndex !== null) showSection(campaignIndex + 1);
    else resetMatch();
  };

  // confirmed, then fade to black, then what the choice gave: a power, or someone to call in
  const handleChooseRecruit = choice => {
    if (recruitChoice) return;
    const { avatar, label } = RECRUIT_CARDS[level.rival.avatar];
    setRecruitChoice(choice);
    saveRecruitChoice(level.rival.avatar, choice);
    if (choice == "recruit") setRecruitedAvatars(list => list.includes(level.rival.avatar) ? list : [...list, level.rival.avatar]);
    if (choice == "terminate") setTerminatedAvatars(list => list.includes(level.rival.avatar) ? list : [...list, level.rival.avatar]);
    addUnlock(level.rival.avatar);
    // Terminate: their power is yours. Recruit: they can be called into fights, and their power stays closed.
    const skill = choice == "terminate" ? unlockRecruitSkill(level.rival.avatar) : undefined;
    const choiceLabel = skill ? `${skill.name} power unlocked!` : `${label} recruited!`;
    // the fight's battleground opens for versus, whichever way the player chose
    addUnlock(getBattlegroundUnlockId(level.id));
    updateMapWalkSites(getWonBattlegrounds());
    const portrait = `/levels/portraits/${avatar}.png`;
    // no card for the character: only the place, and what the choice gave
    const cards = [
      { label: `${level.name} Unlocked`, image: level.layers[0] && level.layers[0].src },
      // a power: its tile, in its color. a recruit: their face.
      skill ? { label: choiceLabel, power: skill.element } : { label: choiceLabel, image: portrait }
    ];
    setTimeout(() => setFadeCards(cards), RECRUIT_TIMING.confirmMs);
    setTimeout(leaveLevel, RECRUIT_TIMING.confirmMs + RECRUIT_TIMING.cardMs);
  };

  // the game holds still while the controls are up
  const openControls = () => {
    if (isShowingControls) return;
    // the radar call: it holds while they're up, as a fight does
    if (radioLines) {
      isPausedForControls.current = !isRadioPaused;
      setIsRadioPaused(true);
      setIsShowingControls(true);
      return;
    }
    // before a game (the avatar select, the picker): nothing to hold, just the card
    if (!isPlayingGame) {
      isPausedForControls.current = false;
      setIsShowingControls(true);
      return;
    }
    if (!gameManager.current) return;
    isPausedForControls.current = !isPaused && winner === null;
    if (isPausedForControls.current) {
      gameManager.current.togglePauseGame();
      publishGameUi(gameManager.current.getUiState());
    }
    setIsShowingControls(true);
  };

  const closeControls = () => {
    setIsShowingControls(false);
    if (radioLines) {
      if (isPausedForControls.current) setIsRadioPaused(false);
      isPausedForControls.current = false;
      return;
    }
    if (isPausedForControls.current && gameManager.current) {
      gameManager.current.togglePauseGame();
      publishGameUi(gameManager.current.getUiState());
    }
    isPausedForControls.current = false;
  };

  // each match gets its own driver, so a new match starts with a clean slate
  useEffect(() => {
    const gm = gameManager.current;
    if (!gm) return;
    gm.setNpcModelDriver(isTrainedNpcs ? new NpcModelDriver(gm.getTrainablePieces, () => npcAggressionRef.current) : undefined);
  }, [isTrainedNpcs, matchCount, levelId, campaignIndex]);

  // (the controls no longer pop up at the first fight: Jamie, playtest 21. an image version is on the backlog; the
  // Controls button still opens them)

  const handleClickPause = () => {
    if (isShowingControls) {
      closeControls();
      return;
    }
    if (radioLines) {
      setIsRadioPaused(paused => !paused);
      return;
    }
    if (!gameManager.current || winner !== null) return;

    gameManager.current.togglePauseGame();
    publishGameUi(gameManager.current.getUiState());
  };

  useKeyPress({ keyCodes: "Escape", keyUpCallback: handleClickPause, isCharacterDead: false });

  // the Kaiju-Vision's bezel, the same on every screen it shows (Jamie, playtest 23): Pause, Controls and Leave, and the
  // display top right. Pause is off once a fight is decided (nothing left to hold)
  const getBezelButtons = ({ isPauseOff = false, ticker }) => (
    <>
      <BezelButton title="Pause" onClick={handleClickPause} disabled={isPauseOff}>Pause</BezelButton>
      <BezelButton title="How to play" onClick={openControls}>Controls</BezelButton>
      <BezelButton title="Goodbye!" onClick={() => leaveByZoom()}>Quit</BezelButton>
      {ticker}
    </>
  );

  // a cutscene's line waiting in the log moves on with any key. Enter does it through its Continue bar, below; Escape pauses.
  useEffect(() => {
    const handleKeyDown = ({ code, repeat }) => {
      const gm = gameManager.current;
      // (1 is handled with the number keys, below: it pressed twice before)
      if (repeat || !gm || !gm.cutscene || ["Enter", "NumpadEnter", "Escape", "Digit1", "Numpad1"].includes(code)) return;
      if (!gm.getIsDialogueWaiting()) return;
      // through the log's Continue bar where it shows: a line still typing finishes first (Jamie, playtest 19)
      const button = document.querySelector<HTMLElement>("[data-log-continue]");
      if (button) button.click();
      else gm.advanceDialogue();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Enter presses whatever moves things on: a Continue button, the radio's next line, or a cutscene's next line
  useKeyPress({
    keyCodes: ["Enter", "NumpadEnter"],
    keyUpCallback: () => {
      const button = document.querySelector<HTMLElement>('[data-choice-key="1"]') || document.querySelector<HTMLElement>("[data-enter]");
      if (button) button.click();
      else if (gameManager.current) gameManager.current.advanceDialogue();
    },
    isCharacterDead: false
  });

  // 1, 2...: the number keys press the buttons showing them, wherever there is a choice or a Continue.
  // powers are off whenever these show, so the keys never do both
  useKeyPress({
    keyCodes: [1, 2, 3, 4].flatMap(n => [`Digit${n}`, `Numpad${n}`]),
    keyUpCallback: code => {
      if (hotspotKeyCode.current == code) {
        hotspotKeyCode.current = undefined;
        return;
      }
      const button = document.querySelector<HTMLElement>(`[data-choice-key="${code.slice(-1)}"]`);
      if (button) button.click();
      else if (code.endsWith("1") && gameManager.current && gameManager.current.cutscene) gameManager.current.advanceDialogue(); // 1 moves a scene on, as Enter does
    },
    isCharacterDead: false
  });

  // F2 hides the dev tools, or brings them back
  useKeyPress({
    keyCodes: ["F2"],
    keyDownCallback: () => setIsDevHidden(isHidden => !isHidden),
    isCharacterDead: !import.meta.env.DEV
  });

  useKeyPress({
    keyCodes: ["BracketLeft", "BracketRight"],
    keyDownCallback: code => cycleLevel(code == "BracketRight" ? 1 : -1),
    isCharacterDead: !import.meta.env.DEV
  });

  useKeyPress({
    keyCodes: ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
    keyDownCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().addKey(code),
    keyUpCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().removeKey(code),
    isCharacterDead: isPaused || isPlayerDead
  });

  useKeyPress({
    keyCodes: ABILITY_KEY_CODES,
    keyDownCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().usePlayerAbility(code, gameManager.current.getAccTime()),
    isCharacterDead: isPaused || level.isWalkingLevel
  });

  useEffect(() => {
    if (winner === null || !isPlayingGame) return;
    const isWon = winner === GameResult.PlayerWon;
    if (isWon && level.skillOnLeave) unlockSkill(level.skillOnLeave); // the Street's Teleport
    // the training points left: lost when hit, for good (F7)
    const pointsLeft = gameManager.current ? gameManager.current.getTrainingPoints() : trainingPoints;
    setTrainingPoints(pointsLeft);
    // recruits who died in this fight are gone for good (the permadeath dev option). Only in a fight won (Jamie,
    // playtest 33: a fight lost is fought again, and the retry's outcome is the one that counts; the wipe's dead were
    // kept before, so all were gone by the final fight though all lived through the retry)
    const fallen = isWon && isPermadeath && gameManager.current ? gameManager.current.getFallenRecruits() : [];
    if (fallen.length) setFallenRecruits(list => [...list, ...fallen.filter(avatar => !list.includes(avatar))]);
    if (level.isWalkingLevel && isWon && gameManager.current && gameManager.current.isTrainingChosen) {
      const trainingLevelId = gameManager.current.trainingLevelId || level.training.levelId;
      swirlThenClouds(() => startTraining(trainingLevelId));
      return;
    }
    // the training's end (Jamie): won, the recruit's power (or, sparring, a training point each for the player and the
    // teammate), and back to the walking battleground, its card shown there; lost, another go, or back to the battleground
    if (level.isTraining) {
      const isSparring = !!level.rival.isSparring;
      const skill = isWon && !isSparring ? unlockRecruitSkill(level.rival.avatar) : undefined;
      const visitLevelId = level.visitLevelId;
      const backToBattleground = () => fadeOutThen(() => returnFromTraining(visitLevelId));
      if (isWon) {
        if (isSparring) {
          const gain = point => Math.min(point + SPARRING.bonusPerWin, SPARRING.maxPoints);
          setTrainingPoints({ player: gain(pointsLeft.player), teammate: gain(pointsLeft.teammate) });
          setSparredLevelIds(ids => ids.includes(visitLevelId) ? ids : [...ids, visitLevelId]);
          isHealthRewardDue.current = true;
        }
        trainingOutcome.current = { isSparring, avatar: level.rival.avatar };
        pendingRewardText.current = isSparring ? { text: "Gained +1 temporary health point" } : skill ? { text: `${skill.name} power unlocked!`, power: skill.element } : undefined;
        const timeout = setTimeout(backToBattleground, TRAINING_WIN_HOLD_MS);
        return () => clearTimeout(timeout);
      }
      const timeout = setTimeout(() => setMatchEnd({ title: "You Lost", buttons: [
        { text: "Try again", onClick: () => fadeOutThen(() => startTraining(level.id)) },
        { text: "Leave", onClick: backToBattleground }
      ] }), MATCH_END_DELAY_MS);
      return () => clearTimeout(timeout);
    }
    if (level.isWalkingLevel && isWon) {
      const site = gameManager.current && gameManager.current.reachedSite;
      swirlThenClouds(site && site.isDetour ? () => visitSite(site) : leaveLevel);
      return;
    }
    if (isWon && level.agentDrops) unlockRecruitSkill("agent");
    if (isWon && campaignIndex !== null && getIsLastSection(campaignIndex)) addUnlock("agent");
    const titleTimeoutRef = setTimeout(() => setMatchEnd(getMatchEnd(isWon)), MATCH_END_DELAY_MS);
    if (!isWon || !level.rival) return () => clearTimeout(titleTimeoutRef);

    // black rises over the fight. the scene is set while it is dark, with everyone and the camera already in place.
    const wipeTimeoutRef = setTimeout(() => setIsWiping(true), MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs);
    const sceneTimeoutRef = setTimeout(() => {
      setMatchEnd(undefined);
      gameManager.current.startRecruitScene();
      publishGameUi(gameManager.current.getUiState());
    }, MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs + WIPE_MS / 2);
    const wipeEndRef = setTimeout(() => setIsWiping(false), MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs + WIPE_MS);
    return () => {
      [titleTimeoutRef, wipeTimeoutRef, sceneTimeoutRef, wipeEndRef].forEach(clearTimeout);
    };
  }, [winner, isPlayingGame, campaignIndex]);

  const isWindowOpen = !isMonitorAlways && (isWideShot || (level.isWalkingLevel && !level.isMapWalk));

  const sceneFades = isPlayingGame && createPortal(
    <>
      {!getIsSceneFadeSkipped(radioLines ? `radio ${campaignIndex}` : `match ${matchCount}`) && <OnMonitor key={radioLines ? `radio ${campaignIndex}` : `match ${matchCount}`}><SceneFadeIn /></OnMonitor>}
      {isFadingOut && <OnMonitor><SceneFadeOut /></OnMonitor>}
      {labCover == "in" && <OnMonitor zIndex={2147483647}><SceneFadeIn /></OnMonitor>}
      {labCover == "out" && <OnMonitor zIndex={2147483647}><SceneFadeOut /></OnMonitor>}
    </>,
    document.body
  );

  // hidden dev tools leave one small button in the corner to bring them back
  const devShowButton = import.meta.env.DEV && isDevHidden && (
    <DevShowButton onClick={() => setIsDevHidden(false)} title="Show dev options (F2)">dev</DevShowButton>
  );

  // what stands beside the monitor in a game: the HUDs, the dialogue panel, the Lab's color vat
  const isHudsShowing = !isEditingTiles && !isLogClosing && !isSideLeaving && (!level.isWalkingLevel || isRewarding) && (!isCutscene || isHudsKept) && !recruitScene && !(matchEnd && matchEnd.isFinale);
  hudsShowingRef.current = isHudsShowing;
  const isLogShowing = !isSideLeaving && labScreen != "colors" && ((isCutscene && !isBalloonScene) || !!recruitScene || isTalking);
  /*
    The monitor in the middle when nothing is beside it (Jamie, playtest 33, a rule for every screen: e.g. after the
    Peninsula fight, the HUDs gone, it centers; the dialogue panel coming, it eases aside again). Not for a hand-off:
    one side thing going and another coming right after (the panel out, the HUDs in) keeps it aside, so it centers
    only once nothing has been beside it for CENTER_AFTER_MS (long enough for the HUDs to fly off, too). Anything
    coming, it goes aside at once. (Playtest 27 had it hold its place always: it shifted at every gap.)
  */
  // (the panel only when it is drawn: it has lines, or is still coming apart. A shouted line is a balloon, no panel)
  const isSideContent = isHudsShowing || (isLogShowing && dialogueLog.length > 0) || isLogClosing || labScreen == "colors";
  const [isMonitorCentered, setIsMonitorCentered] = useState(false);
  // a game starting (from the picker, where the monitor stood aside): it starts aside too, and centers later if
  // nothing comes beside it, rather than jumping to the middle (Jamie, playtest 34)
  useEffect(() => { if (!isPlayingGame) setIsMonitorCentered(false); }, [isPlayingGame]);
  useEffect(() => {
    if (isSideContent) {
      setIsMonitorCentered(false);
      return;
    }
    const timeout = setTimeout(() => setIsMonitorCentered(true), CENTER_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [isSideContent]);
  const gameWindow = isMonitorCentered && !isAdjustingWindow ? getCenteredWindow(playWindow) : playWindow;

  // the screens before a game (the avatar select and the power picker) are on the Kaiju-Vision monitor (Jamie, 2026-11-14),
  // one and the same monitor through both (its bezel buttons, display and light as in a game: Jamie), with the
  // Play!/Back console beside it from the avatar select on
  const isPreGame = !isPlayingGame && (isChoosingAvatar || !isSkippingPicker);
  const preGameWindow = isConsoleIn ? playWindow : getCenteredWindow(playWindow);
  const [isBackFromPicker, setIsBackFromPicker] = useState(false);
  const goBackFromPicker = isLabPicker ? returnToLab : pickerFrom == 'avatar' ? () => {
    // (the avatar select comes up still zoomed in on the chosen one, where the picker's avatar and name were, then the
    // camera pulls back out with everything on it: Jamie)
    setHandOverAvatar(selectedAvatar);
    setHoveredAvatar(undefined);
    setIsBackFromPicker(true); // (no arcs round its directive again: Jamie, playtest 34)
    setIsChoosingAvatar(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setHandOverAvatar(undefined)));
  } : () => leaveByZoom();
  // Play! (Jamie): the side monitor and the console fly off right, ripping their wires out, gone before the first
  // scene; the screen's fade to black runs as they go. (From the Lab, straight back.)
  const playFromConsole = () => {
    if (isFlyingOff) return;
    // (back to the Lab too: the side units fly off first. Jamie, playtest 26)
    if (isLabPicker) {
      flyOffThen(handleClickPlay);
      return;
    }
    setIsFlyingOff(true);
    setTimeout(handleClickPlay, Math.max(0, FLY_OFF.ms - SCREEN_FADE.ms + 100));
  };
  // the side units fly off, then 'callback' (the picker's own buttons too)
  const flyOffThen = callback => {
    if (isFlyingOff) return;
    setIsFlyingOff(true);
    setTimeout(callback, Math.max(0, FLY_OFF.ms - SCREEN_FADE.ms + 100));
  };
  const preGameMonitor = (
    <GameArea style={pullStyle}>
      <RoomBackdrop />
          <HudExplosions />
      <GameFrame data-game-frame $shift={monitorShift == 'in' || monitorShift == 'fade' ? monitorShift : undefined}>
        <PlayWindow playWindow={preGameWindow} setPlayWindow={updatePlayWindow} isAdjusting={false} isOpen={false} isPoweredOn={isMonitorOn} isClipped hasGlare buttons={getBezelButtons({
          isPauseOff: true, // nothing to pause yet
          ticker: <ObjectiveTicker text="" isKaijuCount={false} count={0} toWin={0} />
        })}>
          {isMonitorOn && !isBooted && <MonitorBoot onDone={() => setIsBooted(true)} />}
          {/* the Lab behind them, darkened, lit round the avatars (Jamie) */}
          <MonitorLabBackdrop mode={isChoosingAvatar ? "choice" : "picker"} hovered={hoveredAvatar} focus={isChoosingAvatar ? handOverAvatar : selectedAvatar} />
          {isChoosingAvatar ? (
            <AvatarsInTheDark style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transition: FOCUS_MOVE, transform: getFocusTransform(handOverAvatar), ...(isBooted && !isBackFromPicker ? {} : { animation: "none" }) }}>
            <AvatarChoice isReady={isMonitorOn} isArcs={!isBackFromPicker} onHover={setHoveredAvatar} onHandOver={setHandOverAvatar} onChoose={(player, teammate) => {
              // a first play skips the power picker: Discharge, Wildfire and Dispel to start (Jamie); every replay after it shows it
              const isFirstPlay = getIsFirstPlay();
              markPlaythroughStarted();
              chooseTeam(player, teammate);
              startNewPlaythrough();
              // (Jamie, playtest 34: the first play shows the picker too, nothing picked; "Recommended" on the
              // first fight's powers. It skipped it before, with Discharge, Wildfire and Dispel set)
              if (isFirstPlay) {
                settingsManager.setSortedPlayerChosenAbilityElementsString([]);
                setPickedAbilities([]);
              }
              setPickerFrom('avatar');
              setIsChoosingAvatar(false); // the picker comes up on the same monitor
            }} />
            </AvatarsInTheDark>
          ) : (
            <AbilityPicker
              key="picker"
              handleClickHome={handleClickHome}
              pickedAbilities={pickedAbilities}
              setPickedAbilities={setPickedAbilities}
              handleClickPlay={playFromConsole}
              playLabel={isLabPicker ? "Back to Lab" : undefined}
              onBack={isLabPicker ? () => flyOffThen(returnToLab) : undefined}
              isTeammate={isTeammate}
              setIsTeammate={setIsTeammate}
              recommended={getRecommendedPowers(isLabPicker ? campaignIndex : 0)}
            />
          )}
          {/* the chosen one's name and number on the picker: the avatar select's own, where the camera left them (Jamie) */}
          {!isChoosingAvatar && selectedAvatar && (
            <div style={{ position: "absolute", inset: 0, transformOrigin: "0 0", transform: getFocusTransform(selectedAvatar), pointerEvents: "none", zIndex: 7 }}>
              <AvatarChoice nameOnly={selectedAvatar} isReady={false} />
            </div>
          )}
          {/* some bubbles over the avatars, in step with the backdrop (Jamie) */}
          <MonitorLabBackdrop layer="front" mode={isChoosingAvatar ? "choice" : "picker"} focus={isChoosingAvatar ? handOverAvatar : selectedAvatar} />
          {/* (not again when back from the picker: the lights are on already, Jamie, playtest 34) */}
          {isChoosingAvatar && isBooted && !isBackFromPicker && <LabLightsOn />}
          {screenFade == 'out' && <ScreenBlack />}
        </PlayWindow>
        {isMonitorOn && isBooted && (
          <>
            {/* from the avatar select on, flying in with the console (Jamie) */}
            <SideMonitor isPickerShowing={!isChoosingAvatar} isPoweredOff={isSideOff} isLeaving={isFlyingOff} bioOf={hoveredAvatar || handOverAvatar} /* (the Agent's question unless a tank is hovered; once one's chosen, its file stays: Jamie, playtests 27 and 29) */ />
            <PlayConsole
              isReady={!isChoosingAvatar && pickedAbilities.length == 3}
              playLabel={isLabPicker ? "Back to Lab" : "Play"} /* (no "!": Jamie, playtest 28) */
              onPlay={playFromConsole}
              onBack={isChoosingAvatar ? () => {} : isLabPicker ? undefined : goBackFromPicker}
              isBackDisabled={isChoosingAvatar} /* (shown but dead on the avatar select: Quit is the way out. Jamie, playtest 34) */
              isLeaving={isFlyingOff}
            />
          </>
        )}
        {isShowingControls && <ControlsOverlay onClose={closeControls} />}
      </GameFrame>
    </GameArea>
  );

  const screen = (
    isPreGame ?
      <>
      {import.meta.env.DEV && !isDevHidden && !isChoosingAvatar && (
        <LevelPicker value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
          {levelOptions}
        </LevelPicker>
      )}
      {preGameMonitor}
      </>
    : !isPlayingGame ? null
      : radioLines ?
        <GameArea style={pullStyle}>
          <RoomBackdrop />
          <HudExplosions />
          <GameFrame data-game-frame>
            {/* the alarm only when the call sends the team into a Kaiju fight */}
            {/* aside, for the call's dialogue panel beside it (Jamie: the panel moves the monitor too) */}
            <PlayWindow playWindow={playWindow} setPlayWindow={updatePlayWindow} isAdjusting={false} isOpen={false} isSiren={isRadioAlarm} buttons={getBezelButtons({
              // blank through the call (Jamie, playtest 24): the Kaiju count only once the fight's "Defeat the Kaiju" has shown
              ticker: <ObjectiveTicker text="" isKaijuCount={false} count={0} toWin={0} />
            })}>
              {screenFade == 'in' && <ScreenBlack $isIn />}
              <RadioCall
                isPaused={isRadioPaused}
                key={campaignIndex}
                lines={radioLines}
                playerAvatar={selectedAvatar}
                teammateAvatar={selectedTeammate}
                isResuming={isResumingRadio}
                onGo={() => {
                  const { levelId: sectionLevelId, hasArrival, kills } = CAMPAIGN_SECTIONS[campaignIndex];
                  // a hard cut on the monitor (Jamie): no fade, the room around it unchanged
                  sceneFadeSkips.current.until = Date.now() + 1500;
                  startMatch(LEVELS[sectionLevelId], hasArrival, kills);
                }}
                onChangePowers={handleChangePowers}
                onAlarm={() => setIsRadioAlarm(true)}
                kaijuCount={CAMPAIGN_SECTIONS[campaignIndex].kills || 0}
              />
            </PlayWindow>
            {isShowingControls && <ControlsOverlay onClose={closeControls} />}
          </GameFrame>
        </GameArea>
      : fullScreenPageData ?
        <FullscreenPage
          text={fullScreenPageData.text}
          buttons={fullScreenPageData.buttons}
          image={fullScreenPageData.image}
        />
        : !gameManager.current ? null : (<GameArea style={pullStyle}>
          <RoomBackdrop />
          <HudExplosions />
          {import.meta.env.DEV && !isDevHidden && (
            <PhaseToggles>
              <button onClick={() => setIsDevHidden(true)}>Hide dev options (F2)</button>
              <a href="/dialogue" target="_blank" rel="noreferrer" style={{ color: "#6dffa0" }}>Dialogue viewer</a>
              <a href="/classes" target="_blank" rel="noreferrer" style={{ color: "#6dffa0" }}>Class review</a>
              <select aria-label="Level" value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
                {levelOptions}
              </select>
              <select aria-label="Section" value={level.id == "finalTurnFight" ? "finalTurn" : campaignIndex ?? ""} onChange={e => {
                // dev: "Credits" plays the ending from "You saved the city!"; the teammate's fight on its own (Jamie)
                if (e.target.value == "credits") setMatchEnd({ title: "You saved the city!", buttons: [], isFinale: true });
                else if (e.target.value == "finalTurn") showFinalTurnFight();
                else showSection(Number(e.target.value));
                e.target.blur();
              }}>
                {campaignIndex === null && <option value="">Campaign section</option>}
                {CAMPAIGN_SECTIONS.map(({ label }, index) => <option key={label} value={index}>{index + 1}. {label}</option>)}
                <option value="finalTurn">{CAMPAIGN_SECTIONS.length + 1}. Final battle: the teammate</option>
                <option value="credits">{CAMPAIGN_SECTIONS.length + 2}. Credits</option>
              </select>
              {campaignIndex !== null && !getIsLastSection(campaignIndex) && <button onClick={() => showSection(campaignIndex + 1)}>Skip section</button>}
              {level.phases.map(({ id, label }) => (
                <label key={id}>
                  <input type="checkbox" checked={activePhases.includes(id)} onChange={() => togglePhase(id)} /> {label}
                </label>
              ))}
              {level.giantKaiju && (
                <>
                  <button onClick={() => gameManager.current.devDrainGiant()}>Drain the giant</button>
                  <label>
                    <input type="range" min={0.1} max={2} step={0.05} value={giantMarch} onChange={event => {
                      const speed = Number(event.target.value);
                      setGiantMarch(speed);
                      GIANT_KAIJU.marchRowsPerSecond = speed;
                    }} />
                    {' '}March {giantMarch.toFixed(2)} rows/s
                  </label>
                </>
              )}
              {level.aquariumFlood && (
                <>
                  <button onClick={() => gameManager.current.devDownRival()}>Mermaid to zero</button>
                  <label>
                    Flood{' '}
                    <input aria-label="Flood seconds" type="number" min={5} max={180} style={{ width: 52 }} value={floodSeconds} onChange={event => {
                      const seconds = Number(event.target.value);
                      setFloodSeconds(seconds);
                      if (seconds > 0) AQUARIUM_FLOOD.floodMs = seconds * 1000;
                    }} /> s
                  </label>
                  <select aria-label="Water style" value={floodStyle} onChange={event => {
                    const style = event.target.value as 'flow' | 'bounce';
                    setFloodStyle(style);
                    AQUARIUM_FLOOD.flowStyle = style;
                    event.target.blur();
                  }}>
                    <option value="flow">Water flows</option>
                    <option value="bounce">Water bounces</option>
                  </select>
                </>
              )}
              {level.ghostBoss && (
                <>
                  <button onClick={() => gameManager.current.devDownRival()}>Ghost Girl to zero</button>
                  <label>
                    <input type="range" min={1.5} max={7} step={0.1} value={ghostRadiusRows} onChange={event => {
                      const rows = Number(event.target.value);
                      setGhostRadiusRows(rows);
                      GHOST_BOSS.ringRadiusRows = rows;
                    }} />
                    {' '}Ghost ring {ghostRadiusRows.toFixed(1)} rows
                  </label>
                  <label>
                    Ghosts per ring{' '}
                    <input aria-label="Ghosts per ring" style={{ width: 70 }} value={ghostRings} onChange={event => {
                      setGhostRings(event.target.value);
                      const counts = event.target.value.split(',').map(count => Math.round(Number(count))).filter(count => count > 0);
                      if (counts.length) GHOST_BOSS.rings = counts;
                    }} />
                  </label>
                </>
              )}
              <label>
                <input type="checkbox" checked={isWholeScene} onChange={() => setIsWholeScene(!isWholeScene)} /> Whole scene
              </label>
              <label>
                <input type="checkbox" checked={isMouseLook} onChange={() => setIsMouseLook(!isMouseLook)} /> Mouse look
              </label>
              <label>
                <input type="checkbox" checked={isEnemyZoom} onChange={() => setIsEnemyZoom(!isEnemyZoom)} /> Enemy zoom
              </label>
              <label>
                <input type="checkbox" checked={isTeamColors} onChange={() => setIsTeamColors(!isTeamColors)} /> Team colors
              </label>
              <label>
                <input type="checkbox" checked={isTrainedNpcs} onChange={() => setIsTrainedNpcs(!isTrainedNpcs)} /> Trained NPCs
              </label>
              <label>
                <input type="checkbox" checked={isAutoRecruits} onChange={() => setIsAutoRecruits(!isAutoRecruits)} /> Recruits auto-summoned
              </label>
              <label>
                <input type="checkbox" checked={isTakeOverOnDeath} onChange={() => setIsTakeOverOnDeath(!isTakeOverOnDeath)} /> Take over on death
              </label>
              <label>
                Marker <select value={controlMarker} onChange={e => { setControlMarker(e.target.value); e.target.blur(); }}>
                  {CONTROL_MARKERS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </label>
              <label>
                <input type="checkbox" checked={isPermadeath} onChange={() => setIsPermadeath(!isPermadeath)} /> Recruit permadeath{fallenRecruits.length ? ` (gone: ${fallenRecruits.length})` : ""}
              </label>
              {/* dev: sparring's health (Jamie: to tweak): per win, the cap, and how much has been won this playthrough */}
              <label>
                Spar +health/win <input type="number" min={0} max={10} style={{ width: "3.5em" }} value={sparringTweak.bonusPerWin} onChange={e => { SPARRING.bonusPerWin = Number(e.target.value); setSparringTweak({ ...SPARRING }); }} />
              </label>
              <label>
                Max health <input type="number" min={1} max={99} style={{ width: "3.5em" }} value={sparringTweak.maxPlayerLives} onChange={e => { SPARRING.maxPlayerLives = Number(e.target.value); setSparringTweak({ ...SPARRING }); }} />
              </label>
              <label>
                Points: player <input type="number" min={0} max={99} style={{ width: "3.5em" }} value={trainingPoints.player} onChange={e => setTrainingPoints(points => ({ ...points, player: Number(e.target.value) }))} />
                {" "}teammate <input type="number" min={0} max={99} style={{ width: "3.5em" }} value={trainingPoints.teammate} onChange={e => setTrainingPoints(points => ({ ...points, teammate: Number(e.target.value) }))} />
              </label>
              {/* dev: who is recruited, this playthrough (from the next match on) */}
              {[["punk", "Punk Guy"], ["black_female", "Ghost Girl"], ["mermaid", "Aquarium Worker"]].map(([avatar, name]) => (
                <label key={avatar}>
                  <input type="checkbox" checked={recruitedAvatars.includes(avatar)} onChange={() => toggleRecruited(avatar)} /> Recruit: {name}
                </label>
              ))}
              {isTrainedNpcs && (
                <label>
                  <input type="range" min={0} max={1} step={0.05} value={npcAggression} onChange={event => setNpcAggression(Number(event.target.value))} />
                  {' '}Aggression {npcAggression.toFixed(2)}
                </label>
              )}
              <label>
                <input type="checkbox" checked={isMonitorAlways} onChange={() => setIsMonitorAlways(!isMonitorAlways)} /> Monitor always
              </label>
              <label>
                <input type="checkbox" checked={isClickThrough} onChange={() => { setIsClickThrough(!isClickThrough); setClickThrough(!isClickThrough); }} /> Click through
              </label>
              <label>
                <input type="checkbox" checked={spacing.walking} onChange={() => toggleSpacing("walking")} /> Spacing: walking
              </label>
              <label>
                <input type="checkbox" checked={spacing.battle} onChange={() => toggleSpacing("battle")} /> Spacing: battle
              </label>
              <label>
                <input type="checkbox" checked={isAdjustingWindow} onChange={() => setIsAdjustingWindow(!isAdjustingWindow)} /> Adjust window
              </label>
              {isAdjustingWindow && <button onClick={() => updatePlayWindow(PORTRAIT_WINDOW)}>Portrait window</button>}
              {isAdjustingWindow && <button onClick={() => updatePlayWindow(FULL_WINDOW)}>Full window</button>}
              {LEVEL_FILES[level.id] && (
                <label>
                  <input type="checkbox" checked={isEditingTiles} onChange={() => setIsEditing(!isEditingTiles)} /> Edit tiles
                </label>
              )}
              <button onClick={() => { resetUnlocks(); updateMapWalkSites([]); }}>Reset unlocks</button>
              <button onClick={() => { unlockEverything(['rapidTransit', 'rooftop', 'aquarium']); updateMapWalkSites(getWonBattlegrounds()); setRecruitedAvatars(["punk", "black_female", "mermaid"]); }}>Unlock everything</button>
              <select aria-label="Kaiju speed" value={kaijuSpeedMode} onChange={e => { const mode = e.target.value as KaijuSpeedMode; setKaijuSpeedMode(mode); setKaijuSpeedModeState(mode); e.target.blur(); }}>
                <option value="rampage">Kaiju: fast after fire</option>
                <option value="windUp">Kaiju: fast while glowing</option>
                <option value="off">Kaiju: steady speed</option>
              </select>
              {isEditingTiles && (
                <TileEditor
                  key={`${level.id} ${matchCount}`}
                  levelId={level.id}
                  playWindow={playWindow}
                  onSaved={playSavedLevel}
                  onCancel={() => setIsEditing(false)}
                />
              )}
            </PhaseToggles>
          )}
          <GameFrame data-game-frame $shift={monitorShift == 'out' ? 'out' : undefined}>
            <PlayWindow isPoweredOn={isMonitorOn} playWindow={gameWindow} setPlayWindow={updatePlayWindow} isAdjusting={isAdjustingWindow} isOpen={isWindowOpen} isCut={!!recruitScene} isSiren={!!level.kaijuEntry && winner === null && !isPaused} buttons={!isEditingTiles && getBezelButtons({
              isPauseOff: winner !== null,
              // the objective's display: always there (Jamie), running the objective, or the Kaiju count
              ticker: !isWindowOpen && <ObjectiveTicker text={objectiveText || ""} isKaijuCount={isObjectiveKaijuCount} count={kaijuKillCount} toWin={kaijuToWin} />
            })}>
              {/* for a Lab screen, the scene slides away inside the monitor, and the screen takes its place there */}
              <SlideClip><SlideAway style={leavingFor
                ? { transform: `translateX(${leavingFor == "colors" ? -45 : 45}%)`, opacity: 0, transition: isSlidingBack ? "none" : undefined }
                : isSlidingBack ? { transition: `transform ${LAB_SLIDE_MS}ms ease-out, opacity ${LAB_SLIDE_MS}ms ease-out` } : undefined}>
              <GameBoard
                isCurtained={!!matchEnd && !!matchEnd.isFinale}
                key={`${level.id} ${matchCount}`}
                choiceFromRef={recruitChoiceFrom}
                // a line in the log: they shake once it shows there. a balloon (a shout across the street) shows at once
                speakingPieceIndex={isMonitorAlways && !isLogBuilt && !(speech && speech.isShout) ? undefined : speakingPieceIndex}
                // how long their line is: their shake lasts in step with it (B1)
                speakingLineLength={((speech && speech.text) || (dialogueLog.length ? dialogueLog[dialogueLog.length - 1].text : "") || "").length}
                isSwirling={isSwirling}
                isWindowOpen={isWindowOpen}
                isPaused={isPaused}
                gameManager={gameManager.current}
                level={level}
                activePhases={activePhases as Array<string>}
                isWholeScene={isWholeScene}
                playWindow={playWindow}
                isShowingWindowSize={isAdjustingWindow}
                isEditingTiles={isEditingTiles}
                isMouseLook={isMouseLook}
                isEnemyZoom={isEnemyZoom}
                isTeamColors={isTeamColors}
                controlMarker={controlMarker}
                isSlowMotion={winner !== null && !level.isWalkingLevel}
                speech={speech}
                recruitScene={recruitScene}
                recruitChoice={recruitChoice}
                onChooseRecruit={handleChooseRecruit}
                onHotspot={openLabScreen}
              />
              </SlideAway></SlideClip>
              {matchEnd && (
                <EndScreen>
                  {matchEnd.isFinale ? <FinaleCredits title={matchEnd.title} onDone={endWithMonitorOff} /> : <EndTitle>{breakTitle(matchEnd.title)}</EndTitle>}
                  {(!level.rival || level.isTraining || winner !== GameResult.PlayerWon) && <EndButtons>{matchEnd.buttons.map(({ text, onClick }, index) => <EndButton key={text} data-enter={index == 0 ? "" : undefined} data-choice-key={index == 0 ? 1 : undefined} onClick={onClick}>{text}{index == 0 && <EnterKeyHint />}</EndButton>)}</EndButtons>}
                </EndScreen>
              )}
              {isWiping && <ScreenClip><BlackWipe /></ScreenClip>}
              {screenFade == 'in' && <ScreenBlack $isIn />}
              {/* inside the Kaiju-Vision screen itself (Jamie), not over the casing */}
              {objectiveNotice && createPortal(<ObjectiveNotice key={objectiveNotice.key} style={getPausedNoticeStyle(isPaused)}>{objectiveNotice.text}</ObjectiveNotice>, document.querySelector("[data-play-screen]") || document.body)}
              {takeOverNotice && createPortal(<TakeOverNotice key={takeOverNotice.key} style={getPausedNoticeStyle(isPaused)}>{takeOverNotice.text}</TakeOverNotice>, document.querySelector("[data-play-screen]") || document.body)}
              {rewardNotice && !rewardNotice.power && createPortal(<RewardNotice key={rewardNotice.key} style={getPausedNoticeStyle(isPaused)}>{rewardNotice.text}</RewardNotice>, document.querySelector("[data-play-screen]") || document.body)}
              {rewardNotice && rewardNotice.power && (() => {
                const look = getPowerLook(rewardNotice.power);
                return <UnlockCard key={rewardNotice.key} style={getPausedNoticeStyle(isPaused)}>{look && <PowerTile style={{ background: look.color }}><i className={`fa ${look.activeIcon}`} /></PowerTile>}{rewardNotice.text}</UnlockCard>;
              })()}
              {unlockMessage && <UnlockStack><UnlockCard style={{ position: "static", transform: "none" }}><UnlockPortrait src={unlockImage} />{unlockMessage}</UnlockCard></UnlockStack>}
              {fadeCards && <FadeToBlack><CardStack>{fadeCards.map(({ label, image, power }, index) => (
                <Toast key={label} style={{ animationDelay: `${0.4 + index * 0.45}s` }}>
                  {power ? (() => {
                    const look = getPowerLook(power);
                    return look ? <PowerTile style={{ background: look.color }}><i className={`fa ${look.activeIcon}`} /></PowerTile> : null;
                  })() : image && <UnlockPortrait src={image} />}
                  {label}
                </Toast>
              ))}</CardStack></FadeToBlack>}
              {campaignIndex !== null && level.isWalkingLevel && !level.sites && !level.exit && !level.walkIn && !isEditingTiles && (
                <ContinueButton data-enter data-choice-key={1} onClick={() => showSection(campaignIndex + 1)}>Continue<EnterKeyHint /></ContinueButton>
              )}
              {!isAutoRecruits && !level.isWalkingLevel && !isEditingTiles && !recruitScene && winner === null && !matchEnd && getCallableRecruits().length > 0 && (
                <RecruitCalls key={matchCount} recruits={getCallableRecruits()} onCall={avatar => !!gameManager.current && gameManager.current.callRecruit(avatar)} isDisabled={isPaused} />
              )}
            </PlayWindow>
            {labScreen == "colors" && <IrradiationVat avatar={selectedAvatar} startColor={getAvatarColor(selectedAvatar) || PIECES_INFO[selectedAvatar].color} onIrradiate={irradiate} onClose={closeLabScreen} />}
            {isShowingControls && <ControlsOverlay onClose={closeControls} />}
            <DialogueLogPanel
              footer={recruitScene && isMonitorAlways && isRecruitTalkDone && (
                <>
                  {["recruit", "terminate"].map(choice => (
                    <ChoiceButton key={choice} choice={choice} recruitChoice={recruitChoice} onChooseRecruit={(chosen, box) => { recruitChoiceFrom.current = box; handleChooseRecruit(chosen); }} />
                  ))}
                </>
              )}
              entries={dialogueLog}
              isWaiting={isDialogueWaiting}
              isVisible={isLogShowing} // paused, it stays as it was (Jamie)
              onContinue={() => gameManager.current && gameManager.current.advanceDialogue()}
              onBuilt={setIsLogBuilt}
              onClosing={isClosing => {
                setIsLogClosing(isClosing);
                // a fight waits for the log to finish coming apart before it starts
                if (isClosing && gameManager.current && !level.isWalkingLevel) gameManager.current.holdFor(BREAK_TOTAL_MS);
              }}
            />
            {!isEditingTiles && !isLogClosing && <UI
              players={players}
              recruits={recruits}
              kaijuKillCount={kaijuKillCount}
              kaijuKilledToWin={kaijuToWin}
              isKaijuLevel={!!level.kaijuEntry}
              isCountOnBezel={!isWindowOpen}
              isShowingHuds={isHudsShowing}
              isShowingTopBar={!isCutscene && !recruitScene}
              isPaused={isPaused}
            />}
          </GameFrame>
        </GameArea>)
  );

  return <>{screen}{sceneFades}{devShowButton}</>;
};
