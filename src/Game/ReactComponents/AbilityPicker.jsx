import React, { useState, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { GlobalSettingsContext } from 'Home';
import { getSciFiClass, SCI_FI_CLASSES } from "../DataClasses/sciFiClasses";
import { getIsSkillOpen, OUT_OF_PLAY_POWERS } from "../DataClasses/Avatars";
import { PIECES_INFO } from "Utils/gameState";
import { getHasTamagotchiIntroduced, holdTamagotchi, markTamagotchiIntroduced, Tamagotchi } from "./Tamagotchi";
import { AvatarBio } from "./AvatarBio";
import { ClassBattle } from "./ClassBattle";
import { CrtScreen, ScaleToFit } from "Components/CrtPower";
import { CASING_SHEEN, RUBBER_BUTTON, TV_LOOK } from "./GameBoard/PlayWindow";

/*
  The ability picker (Jamie, UI epic, 2026-11-14). On black: the player's avatar on the left, and around it, like a
  halo, a pendant for every power that is open (locked ones are not shown). The pendants run from -65 degrees (low on
  the avatar's right) over the head to 245 (low on its left), 1.5 avatar-heights from the upper torso. From each, a
  circuit trace runs in and down to behind the avatar, in the style of the old circuit disc: out from the middle,
  one bend, a ring pad at the end.
  A pendant and its trace have three looks: neither picked nor hovered (dim), hovered (lit, white rim), picked (its
  color, glowing, with beads of light running down the trace to the avatar like fiber optics).
  On the right: the hovered power's active (left-aligned, on top) and passive (right-aligned, below), each with its
  icon by its title; with three picked and nothing hovered, the class, its three icons by its name; otherwise,
  "Choose 3 powers".
  Keys: the arrows move round the halo, Space or Enter picks or drops.
  Inside the Kaiju-Vision monitor (Jamie, 2026-11-14): the halo fills its screen, laid out on a 1000 x 1000 stage
  scaled to fit. The words and the Play and Back buttons are on a mini-monitor beside it, which flies in from out of
  shot, switches on, and puts out wires that slither across and plug into the big monitor.
*/
const PICK_COUNT = 3;

const STAGE = { width: 1000, height: 1000 };
const LOOK = {
  figureHeight: 400, // the avatar, head to feet (Jamie's, 2026-11-15; was 270, then 540; the halo kept its size)
  figureDrop: -50, // the avatar moved down from the halo's middle (negative: up), in stage units; the dev panel's slider
  haloRadius: { fewest: { count: 6, radius: 300 }, most: { count: 10, radius: 320 } }, // by the open powers (Jamie)
  torso: { x: 500, y: 475 }, // the upper torso: the halo's middle (all of it up, the number under the name clear of the bottom: Jamie, playtest 33; was 525)
  headDrop: 0.28, // the upper torso, down from the top of the head (of the figure's height)
  // the area below the avatar stays clear (Jamie): its legs reach down past the lowest pendants (feet at 874, the
  // lowest pendants at about 720), and no pendant, line or pad is ever under it. Keep the arc's gap at the bottom wide
  // (215 to 325 degrees) and the board's lines out of it.
  haloStartDegrees: -35, // low on the avatar's right (0 is right, counter-clockwise; was -65: Jamie, the lowest higher)
  haloEndDegrees: 215, // low on its left (was 245)
  radiusJitter: 0.1, // each pendant nearer or further than the circle, by up to this share of it (Jamie)
  pendantSize: 90,
  bendAt: 0.55, // where a trace bends, of the halo's radius from the middle
  endSpread: 0.13, // the traces' ends behind the avatar, spread across (of the figure's height)
  endDrop: 0.06, // and how far below the upper torso
  beadMs: 1700, // a bead's run from the pendant to the avatar
  colors: { trace: "#1f3a29", traceHover: "#7fae8c", stub: "#15281c", pad: "#2d5a3c" }
};
// const LOOK = {
//   figureHeight: 400, // the avatar, head to feet (Jamie's, 2026-11-15; was 270, then 540; the halo kept its size)
//   figureDrop: -50, // the avatar moved down from the halo's middle (negative: up), in stage units; the dev panel's slider
//   haloRadius: 300, // the halo, from the upper torso (was 1.5 times the avatar's height, 270)
//   torso: { x: 500, y: 450 }, // the upper torso: the halo's middle
//   headDrop: 0.28, // the upper torso, down from the top of the head (of the figure's height)
//   // the area below the avatar stays clear (Jamie): its legs reach down past the lowest pendants (feet at 874, the
//   // lowest pendants at about 720), and no pendant, line or pad is ever under it. Keep the arc's gap at the bottom wide
//   // (215 to 325 degrees) and the board's lines out of it.
//   haloStartDegrees: -35, // low on the avatar's right (0 is right, counter-clockwise; was -65: Jamie, the lowest higher)
//   haloEndDegrees: 215, // low on its left (was 245)
//   radiusJitter: 0.1, // each pendant nearer or further than the circle, by up to this share of it (Jamie)
//   pendantSize: 90,
//   bendAt: 0.55, // where a trace bends, of the halo's radius from the middle
//   endSpread: 0.13, // the traces' ends behind the avatar, spread across (of the figure's height)
//   endDrop: 0.06, // and how far below the upper torso
//   beadMs: 1700, // a bead's run from the pendant to the avatar
//   colors: { trace: "#1f3a29", traceHover: "#7fae8c", stub: "#15281c", pad: "#2d5a3c" }
// };
// the halo's radius for so many open powers: from the fewest's to the most's, in step (Jamie)
const getHaloRadiusFor = count => {
  const { fewest, most } = LOOK.haloRadius;
  const share = Math.min(1, Math.max(0, (count - fewest.count) / (most.count - fewest.count)));
  return fewest.radius + (most.radius - fewest.radius) * share;
};
// the radius now (set as the picker draws, for its open powers' count)
let HALO_RADIUS = getHaloRadiusFor(LOOK.haloRadius.fewest.count);

// where the picker's figure stands, as shares of its square stage: the avatar select slides the chosen one here, so the
// two read as one monitor (Jamie)
export const PICKER_FIGURE = {
  x: LOOK.torso.x / STAGE.width, // its middle
  get headY() { return (LOOK.torso.y - LOOK.headDrop * LOOK.figureHeight + LOOK.figureDrop) / STAGE.height; }, // the top of its head
  height: LOOK.figureHeight / STAGE.height
};

// the picker's own things fade in round the figure, which is already there (handed over from the avatar select)
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const ARRIVAL = { fadeMs: 700 };

const FadingIn = styled.div`
  position: absolute;
  inset: 0;
  animation: ${fadeIn} ${ARRIVAL.fadeMs}ms ease-out both;
`;

// the count of powers picked, "0/3" to "3/3", at the top right (Jamie)
const PickCount = styled.div`
  position: absolute;
  left: ${(40 / STAGE.width) * 100}%; /* (on the left now, as far in: Jamie, playtest 32; was on the right) */
  top: ${(36 / STAGE.height) * 100}%;
  font-family: gameboy;
  font-size: ${(44 / STAGE.height) * 100}cqh; /* (bigger: Jamie; was 26) */
  letter-spacing: ${(2 / STAGE.height) * 100}cqh;
  color: #ffd24a;
  text-shadow: 0 0 ${(8 / STAGE.height) * 100}cqh #ffb020;
  pointer-events: none;
`;

// the chosen avatar's highlight on the avatar select (its color's glow, a white edge, in the sprite's own pixels),
// kept here so the picker's avatar looks the same (Jamie)
const CHOSEN_GLOW = { colors: { guy: "#55AAff", girl: "#fa8072" }, colorPx: 8, whitePx: 3 };

// where each avatar's figure stands in its sprite sheet frame (152 x 230, measured): its middle and its head
const FRAME = { width: 152, height: 230, rows: 6, standingRow: 2 };
const FIGURES = {
  guy: { sheet: "spritesheet/player.png", middle: 81, head: 47, feet: 186 },
  girl: { sheet: "spritesheet/teammate.png", middle: 72.5, head: 49, feet: 182 }
};

// stage units to css
const pctX = x => `${(x / STAGE.width) * 100}%`;
const pctY = y => `${(y / STAGE.height) * 100}%`;
const unit = n => `${(n / STAGE.height) * 100}cqh`;

const polar = (degrees, radius) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: LOOK.torso.x + radius * Math.cos(radians), y: LOOK.torso.y - radius * Math.sin(radians) };
};

/*
  A trace from a pendant, jagged like a circuit board's (Jamie): radially in, with a sideways jog on the way, to the
  bend; then down to its end behind the avatar in a staircase of straight and 45 degree runs.
*/
const JAG = { jogPx: 16, jogAt: 0.35, steps: 3 };

// 'radius': where it starts (from the middle); 'across': where it ends behind the avatar, from -1 (left) to 1 (right);
// 'jog': which way its jog goes; 'endDrop': how far below the upper torso it ends (of the figure's height)
const getTrace = ({ degrees, radius, across, jog, endDrop = LOOK.endDrop }) => {
  const start = polar(degrees, radius);
  const bend = polar(degrees, Math.min(radius - 30, HALO_RADIUS * LOOK.bendAt));
  const end = { x: LOOK.torso.x + across * LOOK.endSpread * LOOK.figureHeight, y: LOOK.torso.y + endDrop * LOOK.figureHeight };
  // the jog: off to one side at 45 degrees, then on in, parallel
  const inward = { x: (bend.x - start.x), y: (bend.y - start.y) };
  const length = Math.hypot(inward.x, inward.y);
  const along = { x: inward.x / length, y: inward.y / length };
  const side = jog * JAG.jogPx;
  const across90 = { x: -along.y * side, y: along.x * side };
  const jogFrom = { x: start.x + inward.x * JAG.jogAt, y: start.y + inward.y * JAG.jogAt };
  const jogTo = { x: jogFrom.x + along.x * Math.abs(side) + across90.x, y: jogFrom.y + along.y * Math.abs(side) + across90.y };
  const bent = { x: bend.x + across90.x, y: bend.y + across90.y };
  const points = [start, jogFrom, jogTo, bent];
  // the staircase down: each step a straight run on the longer axis, then a 45 degree run
  const dx = end.x - bent.x;
  const dy = end.y - bent.y;
  const minor = Math.min(Math.abs(dx), Math.abs(dy));
  const major = Math.max(Math.abs(dx), Math.abs(dy)) - minor;
  const isVertical = Math.abs(dy) >= Math.abs(dx);
  let at = { ...bent };
  for (let step = 0; step < JAG.steps; step++) {
    const straight = major / JAG.steps;
    at = isVertical ? { x: at.x, y: at.y + Math.sign(dy) * straight } : { x: at.x + Math.sign(dx) * straight, y: at.y };
    points.push(at);
    const slant = minor / JAG.steps;
    at = { x: at.x + Math.sign(dx) * slant, y: at.y + Math.sign(dy) * slant };
    points.push(at);
  }
  return { start, end, d: `M ${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}` };
};

// where on the halo an angle is, as 'across' for its trace's end: the halo's right end ends on the right
const getAcross = degrees => 1 - (2 * (degrees - LOOK.haloStartDegrees)) / (LOOK.haloEndDegrees - LOOK.haloStartDegrees);

// each pendant's own distance from the middle: nearer or further than the circle, the same every time
const getPendantRadius = k => HALO_RADIUS * (1 + LOOK.radiusJitter * Math.sin(k * 2.39 + 0.7));

// the board between the pendants: dim lines from a ring pad, all the way in to behind the avatar like the pendants'
// own (Jamie), ending a little lower so they lie among them
const getStubs = angles => {
  const stubs = [];
  const gaps = angles.slice(1).map((angle, k) => [angles[k], angle]);
  gaps.forEach(([from, to], k) => [1 / 3, 2 / 3].forEach((share, j) => {
    const degrees = from + (to - from) * share;
    const radius = HALO_RADIUS * (0.78 + 0.06 * ((k * 2 + j) % 3));
    const trace = getTrace({ degrees, radius, across: getAcross(degrees) * 0.85, jog: (k + j) % 2 ? 1 : -1, endDrop: LOOK.endDrop + 0.08 });
    stubs.push({ key: `${k}-${j}`, d: trace.d, pad: trace.start, end: trace.end });
  }));
  return stubs;
};

const Stage = styled.div`
  position: relative;
  width: ${STAGE.width}px;
  height: ${STAGE.height}px;
  container-type: size;
  color: #d9dade;
`;

const Board = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
`;

const beadRun = keyframes`
  from { stroke-dashoffset: 2; }
  to { stroke-dashoffset: -100; }
`;

// a bead of light running from the pendant down to the avatar
const Bead = styled.path`
  fill: none;
  stroke: white;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 2 300;
  animation: ${beadRun} ${LOOK.beadMs}ms linear infinite;
`;

// floating in the tank (Jamie): a small, slow drift in place, kept light so the power traces still meet its middle
const floatInTank = keyframes`
  0%, 100% { transform: translate(0, 0); }
  22% { transform: translate(0.25%, -0.45%); }
  48% { transform: translate(-0.15%, -0.7%); }
  74% { transform: translate(-0.3%, -0.2%); }
`;

const Avatar = styled.div`
  position: absolute;
  animation: ${floatInTank} 7s ease-in-out infinite;
  background-repeat: no-repeat;
  background-size: auto ${FRAME.rows * 100}%;
  background-position: 0 ${(FRAME.standingRow / (FRAME.rows - 1)) * 100}%;
  image-rendering: pixelated;
  pointer-events: none;
`;

const PENDANT_LOOKS = {
  idle: css`
    border-color: #2c3a31;
    background: radial-gradient(circle at 40% 35%, #161c18, #050706 70%);
    i { opacity: 0.35; filter: saturate(0.4); }
  `,
  hovered: css`
    border-color: #e9f3ec;
    background: radial-gradient(circle at 40% 35%, #222a25, #070908 70%);
    box-shadow: 0 0 ${unit(10)} rgba(255, 255, 255, 0.35);
    transform: translate(-50%, -50%) scale(1.08);
    i { opacity: 1; }
  `
};

// a pendant: a round bezel with its power's icon, hung on its trace
// "Pick three abilities" (Jamie, playtest 32): the unpicked pendants light up one after another, from the bottom-left
// one, round clockwise
// (slower and bolder, one at a time, "doo, doo, doo": Jamie, playtest 32; was 140 ms apart, 560 ms each)
const PENDANT_FLASH = { stepMs: 800, ms: 850 };
const pendantFlashKeys = keyframes`
  0% { opacity: 0; transform: scale(0.92); }
  25% { opacity: 1; transform: scale(1.12); }
  60% { opacity: 0.85; transform: scale(1.18); }
  100% { opacity: 0; transform: scale(1.26); }
`;
const PendantFlash = styled.span`
  position: absolute;
  inset: -12%;
  border-radius: 50%;
  pointer-events: none;
  border: 0.3cqw solid ${props => props.$color};
  box-shadow: 0 0 1.6cqw ${props => props.$color}, 0 0 0.5cqw white, inset 0 0 1.2cqw ${props => props.$color}, inset 0 0 0.4cqw white;
  opacity: 0;
  animation: ${pendantFlashKeys} ${PENDANT_FLASH.ms}ms ease-out both;
`;

// its number key (Jamie, playtest 38), small, at its upper left
const PendantKey = styled.span`
  position: absolute;
  left: ${unit(-14)};
  top: ${unit(-14)};
  min-width: ${unit(30)};
  height: ${unit(30)};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: gameboy;
  font-size: ${unit(17)};
  color: ${props => props.$isPicked ? "black" : "#c8ffb8"};
  background: ${props => props.$isPicked ? props.$color : "#05070a"};
  border: ${unit(2)} solid ${props => props.$isPicked ? props.$color : "#3a6a34"};
  border-radius: ${unit(5)};
  pointer-events: none;
`;
const Pendant = styled.button`
  position: absolute;
  pointer-events: auto;
  transition: opacity 500ms, filter 500ms;
  /* (not yet: dimmed, grey, no pointer. Jamie, playtest 34) */
  ${props => props.$isOff && css`
    opacity: 0.35;
    filter: grayscale(0.85) brightness(0.8);
    cursor: default !important;
  `}
  width: ${unit(LOOK.pendantSize)};
  height: ${unit(LOOK.pendantSize)};
  padding: 0;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${unit(34)};
  border: ${unit(4)} solid;
  border-radius: 50%;
  outline: none;
  cursor: pointer;
  transition: transform 120ms, box-shadow 160ms, border-color 160ms;
  i { transition: opacity 160ms; }
  ${props => props.$isHovered ? PENDANT_LOOKS.hovered : PENDANT_LOOKS.idle}
  ${props => props.$isPicked && css`
    border-color: ${props.$color};
    background: radial-gradient(circle at 40% 35%, color-mix(in srgb, ${props.$color} 35%, black), #050706 72%);
    box-shadow: 0 0 ${unit(16)} ${props.$color}, inset 0 0 ${unit(10)} color-mix(in srgb, ${props.$color} 60%, transparent);
    i { opacity: 1; filter: brightness(1.25) drop-shadow(0 0 ${unit(4)} ${props.$color}); }
    ${props.$isHovered && css`border-color: white; box-shadow: 0 0 ${unit(22)} ${props.$color}, 0 0 ${unit(6)} white;`}
  `}
`;

/*
  The confirm burst, played once as a power is picked (Jamie: a "confirmed" effect, like spending a talent point in
  WoW): a ring of light sweeps once round the pendant's outside while rays burst out from it, turning as they go,
  and both fade.
*/
const CONFIRM_MS = 750;

const orbitOnce = keyframes`
  0% { transform: rotate(0deg) scale(0.9); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: rotate(360deg) scale(1.08); opacity: 0; }
`;

const raysBurst = keyframes`
  0% { transform: rotate(0deg) scale(0.5); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: rotate(75deg) scale(1.7); opacity: 0; }
`;

const ConfirmRays = styled.span`
  position: absolute;
  inset: -40%;
  border-radius: 50%;
  pointer-events: none;
  background: repeating-conic-gradient(from 0deg, ${props => props.$color} 0deg 5deg, transparent 5deg 22deg, white 22deg 24deg, transparent 24deg 36deg);
  -webkit-mask: radial-gradient(closest-side, transparent 38%, black 50%, transparent 100%);
  mask: radial-gradient(closest-side, transparent 38%, black 50%, transparent 100%);
  animation: ${raysBurst} ${CONFIRM_MS}ms ease-out forwards;
  filter: blur(${unit(0.6)});
`;

// the ring of light that sweeps once round the pendant (in the burst above)
const Orbit = styled.span`
  position: absolute;
  inset: -22%;
  border-radius: 50%;
  pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0deg 220deg, ${props => props.$color} 310deg, white 345deg, transparent 360deg);
  -webkit-mask: radial-gradient(closest-side, transparent 74%, black 80%, black 88%, transparent 100%);
  mask: radial-gradient(closest-side, transparent 74%, black 80%, black 88%, transparent 100%);
  animation: ${orbitOnce} ${CONFIRM_MS}ms cubic-bezier(0.25, 0.6, 0.35, 1) forwards;
  filter: blur(${unit(1)});
`;

const sheenSweep = keyframes`
  0% { transform: rotate(-90deg); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: rotate(270deg); opacity: 0; }
`;

const lockFlash = keyframes`
  0% { opacity: 0.95; transform: scale(0.85); }
  100% { opacity: 0; transform: scale(1.35); }
`;

// the moment it's picked, "locked in" (Jamie): a white flash, and a sheen that slides round the pendant's rim
const LockIn = styled.span`
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  pointer-events: none;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg 300deg, rgba(255, 255, 255, 0.9) 345deg, white 352deg, transparent 360deg);
    -webkit-mask: radial-gradient(closest-side, transparent 80%, black 86%, black 96%, transparent 100%);
    mask: radial-gradient(closest-side, transparent 80%, black 86%, black 96%, transparent 100%);
    animation: ${sheenSweep} 520ms cubic-bezier(0.3, 0.6, 0.4, 1) forwards;
  }
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, white, ${props => props.$color} 45%, transparent 70%);
    animation: ${lockFlash} 380ms ease-out forwards;
  }
`;

// dev only: which powers hang in the halo, to see how it looks with more or fewer (Jamie)
const DevPanel = styled.div`
  position: absolute;
  left: 0.6cqw;
  top: 0.6cqw;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  font: 11px monospace;
  color: #9fbfa8;
  background: rgba(10, 16, 12, 0.85);
  border: 1px solid #2d5a3c;
  label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
`;

/*
  The mini-monitor (Jamie): a little set of the same make as Kaiju-Vision, to the right of it. It flies in from out of
  shot, then switches on like the big one; then its wires slither out and plug into the big monitor's side.
  Sizes in cqw of the game frame (100 wide, 56.25 high).
*/
// 'brow': the top border, tall enough for its buttons (Jamie: swapped with the bottom's); the console sits below it
// ('foot': the strip along its bottom with the three round buttons; the top border as thin as the sides now: Jamie,
// playtest 30. 'brow' was the top's, with worded buttons)
const MINI = { left: 69, top: 2.2, width: 28, height: 34, casing: 1.3, brow: 1.3, foot: 3.6 };
// (less tall, a thicker rim jutting out round a recessed face: Jamie). Under the side monitor's place: the big monitor
// eases aside for it as it comes, from the avatar select on (Jamie)
const CONSOLE = { left: 71, top: 40.5, width: 24, height: 10, rim: 1.2 };
// (Jamie: after the picker's things fade in, the big monitor eases aside as the mini-monitor flies in, then the wires)
// (the side monitor and the console come once the big monitor is nearly aside, so they never fly over it: Jamie.
// 'consoleDelayMs': when the big monitor starts easing aside, 700 ms; 'riseDelayMs': the console's rise)
// ('onAtMs': the side screen switches on once its wires have plugged in, both of them: Jamie, playtest 29; was 1800)
export const MINI_TIMING = { flyDelayMs: 900, flyMs: 850, onAtMs: 3550, wiresAtMs: 2000, wiresMs: 1100, consoleDelayMs: 750, riseDelayMs: 1000 };

/*
  On Play! (Jamie): the side monitor and the console fly off to the right, out of shot, ripping their wires out of the
  big monitor (arcs of current at the sockets as they go), all gone before the game's first scene. A quick wind-up
  back, then off, faster and faster, tipping as they go. One motion for the casing and the wires' ends on it, so they
  stay together: in the frame's units (cqw).
*/
/*
  Caught by its wires (Jamie, playtest 26): it lunges off, the wires go taut and snap it back, it strains against them,
  shaking, until they tear out of both ends (current arcing at the sockets and at the torn plugs), then it's off,
  tumbling, its wires trailing and flailing behind it. 'phases': where each part ends, as shares of the time.
*/
export const FLY_OFF = {
  ms: 1500,
  phases: { windup: 0.07, lunge: 0.19, caught: 0.26, pop: 0.56 },
  back: { x: -0.9, y: -0.3, turn: -1.5 },
  lunge: { x: 5.2, y: -0.7, turn: 5 },
  caught: { x: 3.4, y: 0.2, turn: -3 },
  strain: { x: 4.6, shake: 0.55, turn: 4 },
  devices: {
    mini: { box: MINI, x: 64, y: -6, turn: 12, delayShare: 0 },
    console: { box: CONSOLE, x: 64, y: 5, turn: 8, delayShare: 0.08 }
  }
};
// where a device is at a moment of its fly-off (0 to 1): its move and its turn
export const getDeviceTime = (device, time) => Math.max(0, Math.min(1, (time - device.delayShare) / (1 - device.delayShare)));
const lerpPose = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, turn: a.turn + (b.turn - a.turn) * s });
// straining: pulling a little further, shaking harder as it goes
const getStrain = s => {
  const { caught, strain } = FLY_OFF;
  return {
    x: caught.x + (strain.x - caught.x) * s + Math.sin(s * Math.PI * 14) * strain.shake * (0.4 + s),
    y: caught.y + Math.sin(s * Math.PI * 10 + 1) * strain.shake * 0.7 * (0.4 + s),
    turn: caught.turn + (strain.turn - caught.turn) * s + Math.sin(s * Math.PI * 18) * 2.5 * (0.3 + s)
  };
};
const getFlyOff = (device, time) => {
  const t = getDeviceTime(device, time);
  const { back, lunge, caught, phases } = FLY_OFF;
  const rest = { x: 0, y: 0, turn: 0 };
  if (t < phases.windup) return lerpPose(rest, back, 1 - Math.pow(1 - t / phases.windup, 2));
  if (t < phases.lunge) return lerpPose(back, lunge, 1 - Math.pow(1 - (t - phases.windup) / (phases.lunge - phases.windup), 2));
  // the wires snap taut: yanked back
  if (t < phases.caught) return lerpPose(lunge, caught, 1 - Math.pow(1 - (t - phases.lunge) / (phases.caught - phases.lunge), 3));
  if (t < phases.pop) return getStrain((t - phases.caught) / (phases.pop - phases.caught));
  // torn free: off, faster and faster, tumbling
  const e = Math.pow((t - phases.pop) / (1 - phases.pop), 2.2);
  return lerpPose(getStrain(1), { x: device.x, y: device.y, turn: device.turn * 2.2 }, e);
};
// (as keyframes, the same motion, step by step)
/*
  Hinged (Jamie, playtest 29): the side units no longer fly; each turns on a hinge at its left edge, on an arm from the
  big monitor, swinging out from behind it into view (side first, then its face) and back the same way. The leaving
  motion keeps its beats (lunge, snapped back by the wires, straining, torn free), read as a swing: its 'x' becomes how
  far it has turned back (all the way, 'HINGE.awayDegrees', at its end). 'y' and 'turn' are kept small, a judder.
*/
// (the swing in eased in and out, not flicked: it spends a while turned, so its depth shows as on the way out: Jamie,
// playtest 33; was cubic-bezier(0.25, 0.8, 0.3, 1) over 1100 ms)
export const HINGE = { awayDegrees: 100, perspectiveCqw: 70, inMs: 1400, inEase: "cubic-bezier(0.45, 0.1, 0.35, 1)" };
const getSwing = (device, time) => {
  const { x, y, turn } = getFlyOff(device, time);
  return { degrees: (x / device.x) * HINGE.awayDegrees, y: y * 0.3, turn: turn * 0.25 };
};
// (Jamie, playtest 36: they never went fully out of sight. The swing takes the first SWING_SHARE of the leaving, then
// the unit, turned away, slides in under the big monitor's casing, gone, its arm drawn in after it: nothing left to
// blink out as the next scene comes)
const SWING_SHARE = 0.8;
const getTuckCqw = device => device.box.left - ARM.fromCqw + 3;
const getFlyOffKeyframes = device => keyframes`${[...Array(121).keys()].map(k => {
  const time = k / 120;
  const { degrees, y, turn } = getSwing(device, Math.min(1, time / SWING_SHARE));
  const tuck = time <= SWING_SHARE ? 0 : getTuckCqw(device) * Math.pow((time - SWING_SHARE) / (1 - SWING_SHARE), 1.6);
  return `${(time * 100).toFixed(3)}% { transform: translateX(${(-tuck).toFixed(3)}cqw) perspective(${HINGE.perspectiveCqw}cqw) translateY(${y.toFixed(3)}cqw) rotateY(${degrees.toFixed(2)}deg) rotate(${turn.toFixed(2)}deg); }`;
}).join("\n")}`;
// a point on a device (the frame's units) where it is at that moment: turned about the device's left edge (its far
// side drawn in toward the hinge as it turns; the perspective's shrink left out)
// (as its leaving's keyframes go: the swing, then the tuck under the casing, so the wires' ends on it go out of sight
// with it: Jamie, playtest 36)
const getMovedPoint = (point, device, time) => {
  const { degrees, y } = getSwing(device, Math.min(1, time / SWING_SHARE));
  const { box } = device;
  const across = Math.cos((Math.min(90, Math.abs(degrees)) * Math.PI) / 180);
  const tuck = time <= SWING_SHARE ? 0 : getTuckCqw(device) * Math.pow((time - SWING_SHARE) / (1 - SWING_SHARE), 1.6);
  return { x: box.left + (point.x - box.left) * across - tuck, y: point.y + y };
};
// swinging in from behind the monitor: turned away past edge-on (its back hidden), round to face out, a little past, back
const hingeIn = keyframes`
  0% { transform: perspective(${HINGE.perspectiveCqw}cqw) rotateY(${HINGE.awayDegrees}deg); }
  72% { transform: perspective(${HINGE.perspectiveCqw}cqw) rotateY(-5deg); }
  88% { transform: perspective(${HINGE.perspectiveCqw}cqw) rotateY(1.5deg); }
  100% { transform: perspective(${HINGE.perspectiveCqw}cqw) rotateY(0deg); }
`;
// the arm each unit swings on: from under the big monitor's casing (it hides the arm's root) out to the unit's hinge
const ARM = { fromCqw: 58, thickness: 1.1 };
const ArmBar = styled.div`
  position: absolute;
  z-index: 2;
  pointer-events: none;
  transform-origin: left center;
  ${props => props.$isLeaving && css`animation: ${armIn} ${FLY_OFF.ms * (1 - SWING_SHARE)}ms ease-in ${FLY_OFF.ms * SWING_SHARE}ms both;`}
  border-radius: 0.3cqw;
  background: linear-gradient(to bottom, #6a6d73, #3a3c41 45%, #1c1d21);
  box-shadow: 0 0.3cqw 0.5cqw rgba(0, 0, 0, 0.7), inset 0 0.08cqw 0 rgba(255, 255, 255, 0.25);
  /* the hinge's knuckle, at the unit's edge */
  &::after {
    content: "";
    position: absolute;
    right: -0.5cqw;
    top: 50%;
    width: 1.2cqw;
    height: 2.6cqw;
    transform: translateY(-50%);
    border-radius: 0.6cqw;
    background: linear-gradient(to right, #2a2b2f, #7a7d83 45%, #33353a);
    box-shadow: 0 0.2cqw 0.4cqw rgba(0, 0, 0, 0.7);
  }
`;
// (drawn in under the casing as its unit tucks away: Jamie, playtest 36)
const armIn = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;
const Arm = ({ box, isLeaving = false }) => (
  <ArmBar $isLeaving={isLeaving} style={{ left: `${ARM.fromCqw}cqw`, width: `${box.left - ARM.fromCqw}cqw`, top: `${box.top + box.height / 2 - ARM.thickness / 2}cqw`, height: `${ARM.thickness}cqw` }} />
);
// (Jamie, playtest 32: they looked paper-thin as they turned: real depth now, a back and two sides in 3D; the front's
// parts hide when turned away, so the back shows instead of a mirror of the front)
const DEPTH_CQW = 2.2; // (thicker, to read on the swing in too: Jamie, playtest 33; was 1.6)
const HINGED = css`
  transform-origin: 0 50%;
  transform-style: preserve-3d;
  & > *:not([data-depth]) { backface-visibility: hidden; }
`;
const DepthFace = styled.div`
  position: absolute;
  pointer-events: none;
  backface-visibility: visible;
`;
// the unit's back and its two sides, 'radius' its corners' rounding (the sides kept within it)
const Depth = ({ radius = 1.4 }) => (
  <>
    <DepthFace data-depth style={{ inset: 0, borderRadius: `${radius}cqw`, transform: `translateZ(-${DEPTH_CQW}cqw) rotateY(180deg)`, background: "linear-gradient(to bottom, #2a2725, #121110)", boxShadow: "inset 0 0 0 0.15cqw #080808" }} />
    <DepthFace data-depth style={{ left: "100%", top: `${radius * 0.6}cqw`, bottom: `${radius * 0.6}cqw`, width: `${DEPTH_CQW}cqw`, transformOrigin: "left center", transform: "rotateY(90deg)", background: "linear-gradient(to right, #3a3633, #1a1817)" }} />
    <DepthFace data-depth style={{ right: "100%", top: `${radius * 0.6}cqw`, bottom: `${radius * 0.6}cqw`, width: `${DEPTH_CQW}cqw`, transformOrigin: "right center", transform: "rotateY(-90deg)", background: "linear-gradient(to left, #3a3633, #1a1817)" }} />
  </>
);

const miniFlyOff = getFlyOffKeyframes(FLY_OFF.devices.mini);
const consoleFlyOff = getFlyOffKeyframes(FLY_OFF.devices.console);

/*
  Steam jets (Jamie): as a side unit flies, puffs of steam shoot from under it, opposite the way it goes (in from the
  upper right: down and to the right; the console rising: down; flying off right: down and to the left). Only while
  it flies. 'dx', 'dy': where a puff goes (cqw); 'delayMs', 'ms': the flight.
*/
const JETS = { puffMs: 420, puffs: 4, nozzles: [0.22, 0.78] };
const jetPuff = keyframes`
  0% { transform: translate(-50%, 0) scale(0.35); opacity: 0.9; }
  100% { transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(2.2); opacity: 0; }
`;
const jetWindow = keyframes`
  0% { opacity: 0; }
  3% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
`;
const JetHolder = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 96%;
  height: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0;
  animation: ${jetWindow} var(--ms) linear var(--delay) both;
  span {
    position: absolute;
    top: 0;
    width: 1.8cqw;
    height: 1.8cqw;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(240, 246, 250, 0.95), rgba(200, 214, 224, 0.5) 55%, transparent 72%);
    animation: ${jetPuff} ${JETS.puffMs}ms ease-out infinite;
  }
`;
const Jets = ({ dx, dy, delayMs, ms }) => (
  <JetHolder style={{ "--ms": `${ms}ms`, "--delay": `${delayMs}ms` }}>
    {JETS.nozzles.map(across => [...Array(JETS.puffs).keys()].map(n => (
      <span key={`${across}-${n}`} style={{ left: `${across * 100}%`, "--dx": `${dx}cqw`, "--dy": `${dy}cqw`, animationDelay: `${(n * JETS.puffMs) / JETS.puffs}ms` }} />
    )))}
  </JetHolder>
);

const flyIn = keyframes`
  0% { transform: translate(40cqw, -16cqw) rotate(16deg) scale(0.8); opacity: 0; }
  12% { opacity: 1; }
  72% { transform: translate(-0.9cqw, 0.5cqw) rotate(-1.6deg) scale(1.01); }
  100% { transform: none; opacity: 1; }
`;

const MiniMonitor = styled.div`
  position: absolute;
  left: ${MINI.left}cqw;
  top: ${MINI.top}cqw;
  width: ${MINI.width}cqw;
  height: ${MINI.height}cqw;
  z-index: 3;
  border-radius: 2cqw;
  background: ${TV_LOOK.casing};
  box-shadow: inset 0 0.2cqw 0 ${TV_LOOK.casingLight}, 0 0.25cqw 0 ${TV_LOOK.casingLight}, 0 0 0 0.15cqw #080808, 0 1cqw 2.5cqw rgba(0, 0, 0, 0.8);
  ${HINGED}
  animation: ${hingeIn} ${HINGE.inMs}ms ${HINGE.inEase} ${MINI_TIMING.flyDelayMs}ms both;
  ${props => props.$isLeaving && css`animation: ${miniFlyOff} ${FLY_OFF.ms}ms linear forwards;`}
  /* the same plastic as the big one's (its screen lies over this) */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    ${CASING_SHEEN}
  }
`;

const MiniScreen = styled.div`
  position: absolute;
  left: ${MINI.casing}cqw;
  right: ${MINI.casing}cqw;
  top: ${MINI.brow}cqw;
  bottom: ${MINI.foot}cqw;
  border-radius: 1.1cqw;
  overflow: hidden;
  background: #030404;
  box-shadow: inset 0 0 1cqw rgba(0, 0, 0, 0.9);
`;

// the glass, as the big one's: a darker edge and fine scan lines
const MiniGlass = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, ${TV_LOOK.vignetteOpacity}) 100%),
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, ${TV_LOOK.scanLineOpacity}) 0 1px, transparent 1px 3px);
`;

// the top border's buttons for the tamagotchi (Jamie): Feed, Pet, Clean up, in its middle
// the buttons' strip, at the bottom now (Jamie, playtest 30: as a tamagotchi's, in a row): each in a third of the width,
// under its word on the screen
const MiniBrow = styled.div`
  position: absolute;
  left: ${MINI.casing}cqw;
  right: ${MINI.casing}cqw;
  bottom: 0;
  height: ${MINI.foot}cqw;
  display: flex;
  align-items: center;
`;
const ButtonSlot = styled.span`
  flex: 1 1 0;
  display: flex;
  justify-content: center;
`;
export const SIDE_BUTTON_LABELS = ["Feed", "Pet", "Clean up"];

// the buttons' words, digital, along the bottom of the tamagotchi's screen, each with a line down to its button
const WordsRow = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3.4cqw;
  display: flex;
  pointer-events: none;
  font-family: gameboy;
  font-size: 0.8cqw;
  letter-spacing: 0.06cqw;
  color: #80EF80;
  text-shadow: 0 0 0.3cqw rgba(128, 239, 128, 0.6);
  & > div {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 0.3cqw;
  }
  & > div::after {
    content: "";
    flex: 1;
    width: 0.12cqw;
    margin-top: 0.35cqw;
    background: linear-gradient(to bottom, #80EF80, rgba(128, 239, 128, 0.35));
  }
`;
const ButtonWords = ({ labels = SIDE_BUTTON_LABELS }) => (
  <WordsRow>{labels.map(label => <div key={label}>{label}</div>)}</WordsRow>
);

/*
  Dev only (Jamie, 2026-11-24): every class, one at a time, on the side monitor as a player sees it (its name, its
  description and its battle), to check each one's layout. The tamagotchi's three buttons: the left goes back, the
  middle flags the class for an edit (again: unflags it), the right goes on and marks the class seen. Kept in the
  browser's own storage (not the game's saves, which are off): seen and flagged, by class key.
*/
const CLASS_REVIEW_KEY = "kaiju-dev-side-class-review";
const loadClassReview = () => {
  try {
    return { seen: [], flagged: [], ...JSON.parse(window.localStorage.getItem(CLASS_REVIEW_KEY) || "{}") };
  } catch {
    return { seen: [], flagged: [] };
  }
};
const saveClassReview = review => {
  try {
    window.localStorage.setItem(CLASS_REVIEW_KEY, JSON.stringify(review));
  } catch { /* (not kept) */ }
};
const ReviewStatus = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3.4cqw;
  z-index: 3;
  text-align: center;
  font: 0.75cqw monospace;
  color: #9fbfa8;
  pointer-events: none;
  span { color: #ff6060; }
`;

// round, wordless (their words are on the screen, over them: Jamie, playtest 30); the rubber as before
const BrowButtonShape = styled.button`
  width: 2.1cqw;
  height: 2.1cqw;
  padding: 0;
  font-size: 0;
  cursor: pointer;
  border-radius: 50%;
  ${RUBBER_BUTTON}
  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
`;

/*
  The console (Jamie): Play! and Back on their own set, below the side monitor. It flies in from the bottom, out of
  shot, and plugs into the big monitor by a wire of its own. Its face is metal, brushed, with screws at the corners,
  set in a plastic case whose other sides face away (only a rim of it shows).
*/
const consoleRise = keyframes`
  0% { transform: translateY(30cqw) rotate(-6deg); opacity: 0; }
  15% { opacity: 1; }
  70% { transform: translateY(-0.6cqw) rotate(0.8deg); }
  100% { transform: none; opacity: 1; }
`;

const Console = styled.div`
  position: absolute;
  left: ${CONSOLE.left}cqw;
  top: ${CONSOLE.top}cqw;
  width: ${CONSOLE.width}cqw;
  height: ${CONSOLE.height}cqw;
  z-index: 3;
  padding: ${CONSOLE.rim}cqw;
  box-sizing: border-box;
  border-radius: 1.4cqw;
  /* the case juts out toward the viewer: a lit top edge and a rounded lip, dark below, and a strong shadow under it */
  box-shadow:
    inset 0 0.22cqw 0 ${TV_LOOK.casingLight},
    inset 0 -0.3cqw 0.4cqw rgba(0, 0, 0, 0.55),
    0 0 0 0.15cqw #080808,
    0 0.5cqw 0.3cqw rgba(0, 0, 0, 0.6),
    0 1.4cqw 3cqw rgba(0, 0, 0, 0.85);
  ${CASING_SHEEN}
  ${HINGED}
  animation: ${hingeIn} ${HINGE.inMs}ms ${HINGE.inEase} ${MINI_TIMING.riseDelayMs}ms both;
  ${props => props.$isLeaving && css`animation: ${consoleFlyOff} ${FLY_OFF.ms}ms linear forwards;`}
`;

/*
  The console's face turns over (Jamie, mp playtests 2-3): a slab of metal, thick, on a bar across its middle; it
  turns a half turn up and over, like a flashcard, the next screen's buttons on its far side (as many sides as there are
  screens: the one it came from is gone once it's round). Behind it, the console's insides: dark, wiring dimly seen.
*/
export const FACE_FLIP = { ms: 720, thickness: 0.8 };
const FACE_HEIGHT = CONSOLE.height - 2 * CONSOLE.rim;
const slabOver = keyframes`
  from { transform: rotateX(0deg); }
  to { transform: rotateX(180deg); }
`;
const FaceWell = styled.div`
  position: relative;
  height: 100%;
  border-radius: 0.7cqw;
  perspective: 26cqw;
  /* the cavity: near black, its walls falling away into it, a few traces and parts in the dark */
  background:
    radial-gradient(ellipse at 50% 50%, rgba(40, 70, 48, 0.16), transparent 65%),
    repeating-linear-gradient(90deg, transparent 0 2.2cqw, rgba(120, 150, 130, 0.07) 2.2cqw 2.3cqw),
    repeating-linear-gradient(0deg, transparent 0 1.6cqw, rgba(120, 150, 130, 0.05) 1.6cqw 1.68cqw),
    linear-gradient(to bottom, #050606, #0b0d0c 50%, #040505);
  box-shadow:
    inset 0 0.8cqw 0.9cqw rgba(0, 0, 0, 0.95),
    inset 0 -0.6cqw 0.8cqw rgba(0, 0, 0, 0.9),
    inset 0.8cqw 0 0.8cqw rgba(0, 0, 0, 0.9),
    inset -0.8cqw 0 0.8cqw rgba(0, 0, 0, 0.9);
`;
// (the bar it turns on, across the middle, seen at its ends)
const FaceBar = styled.span`
  position: absolute;
  top: 50%;
  width: 0.7cqw;
  height: 0.7cqw;
  translate: 0 -50%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #8a8f96, #2a2c30 70%);
  box-shadow: 0 0 0.2cqw rgba(0, 0, 0, 0.9);
`;
const Slab = styled.div`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  ${props => props.$isTurning && css`animation: ${slabOver} ${FACE_FLIP.ms}ms cubic-bezier(0.55, 0.05, 0.3, 1) both; pointer-events: none;`}
`;
const SlabSide = styled.div`
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  transform: ${props => props.$isBack ? `rotateX(180deg) translateZ(${FACE_FLIP.thickness / 2}cqw)` : `translateZ(${FACE_FLIP.thickness / 2}cqw)`};
`;
// its top and bottom edges: the metal's thickness, seen as it turns
const SlabEdge = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - ${FACE_FLIP.thickness / 2}cqw);
  height: ${FACE_FLIP.thickness}cqw;
  backface-visibility: hidden;
  transform: rotateX(${props => props.$isTop ? 90 : -90}deg) translateZ(${FACE_HEIGHT / 2}cqw);
  border-radius: 0.2cqw;
  background:
    repeating-linear-gradient(to right, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 4px),
    linear-gradient(to bottom, #5c6066, #2e3135);
  box-shadow: inset 0 0 0 0.05cqw rgba(0, 0, 0, 0.6);
`;
const ConsoleFace = styled.div`
  position: relative;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1cqw;
  /* the buttons in the face's middle, side by side (Jamie, playtest 28: Back level with Play; was the lower half) */
  border-radius: 0.7cqw;
  /* brushed metal, dimmer (Jamie): fine horizontal streaks, a little lighter toward the top. Recessed in the case:
     the case's lip throws a shadow in along its top and left, and its bottom edge catches the light */
  background:
    repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px),
    linear-gradient(to bottom, #64686e, #474a50 55%, #33363b);
  box-shadow:
    inset 0 0.45cqw 0.5cqw rgba(0, 0, 0, 0.7),
    inset 0.3cqw 0 0.35cqw rgba(0, 0, 0, 0.45),
    inset 0 -0.08cqw 0 rgba(255, 255, 255, 0.18);
`;

// the ready light (Jamie): at the top, five sixths of the way across; blinking green with three picked (Jamie; was red), else dark
const readyBlink = keyframes`
  0%, 55% { background: radial-gradient(circle at 40% 35%, #c8ffb8, #2ee02a 55%, #0a6a0c); box-shadow: 0 0 0.6cqw 0.15cqw #3aff3a; }
  56%, 100% { background: radial-gradient(circle at 40% 35%, #1a4a1a, #062a08 70%); box-shadow: none; }
`;
// (larger, up and to the right: where Jamie marked it, about 78% across and 28% down the face)
const READY_LIGHT = { size: 1.35, across: 0.78, down: 0.28 };
const ReadyLight = styled.span`
  position: absolute;
  left: calc(${READY_LIGHT.across * 100}% - ${READY_LIGHT.size / 2}cqw);
  top: ${(CONSOLE.height - 2 * CONSOLE.rim) * READY_LIGHT.down - READY_LIGHT.size / 2}cqw;
  width: ${READY_LIGHT.size}cqw;
  height: ${READY_LIGHT.size}cqw;
  border-radius: 50%;
  border: 0.1cqw solid #1a1b1d;
  background: radial-gradient(circle at 40% 35%, #1a4a1a, #062a08 70%);
  ${props => props.$isOn && css`animation: ${readyBlink} 0.9s steps(1) infinite;`}
`;

// a screw head at each corner of the face
const Screw = styled.span`
  position: absolute;
  width: 0.7cqw;
  height: 0.7cqw;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #d6d9de, #6e7279 60%, #3a3d42);
  box-shadow: 0 0.05cqw 0.1cqw rgba(0, 0, 0, 0.6);
  &::after {
    content: "";
    position: absolute;
    left: 15%;
    right: 15%;
    top: 45%;
    height: 10%;
    background: #33363b;
    transform: rotate(${props => props.$turn}deg);
  }
`;

/*
  The wires (Jamie): out of the mini-monitor's underside, slithering across (wavy as they go, settling as they
  land), to plug into the big monitor's side. In the frame's units.
*/
const WIRES = [
  { from: { x: 73, y: MINI.top + MINI.height }, to: { x: 64.9, y: 30 }, sag: 5, color: "#0e0f10" },
  { from: { x: 77.5, y: MINI.top + MINI.height }, to: { x: 64.9, y: 34.5 }, sag: 6, color: "#121a14" },
];
const getWirePath = ({ from, to, sag }, wave = 0) =>
  `M ${from.x} ${from.y} C ${from.x + wave} ${from.y + sag}, ${to.x + 6 - wave} ${to.y + wave * 0.6}, ${to.x} ${to.y}`;

// (hidden until it starts: a wire not drawn yet still showed its round end as a dot, over the big monitor as it moved: Jamie)
const wireDraw = keyframes`
  0% { stroke-dashoffset: 100; opacity: 0; }
  2% { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
`;

const plugIn = keyframes`
  0%, 85% { opacity: 0; }
  100% { opacity: 1; }
`;

const WireLayer = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
  path {
    fill: none;
    stroke-linecap: round;
    stroke-dasharray: 100 100;
    animation: ${wireDraw} ${MINI_TIMING.wiresMs}ms cubic-bezier(0.4, 0.1, 0.3, 1) both;
  }
  rect { animation: ${plugIn} ${MINI_TIMING.wiresMs}ms linear both; }
  .arc path { stroke-dasharray: none; animation: none; fill: none; stroke-linecap: round; stroke-linejoin: round; }
`;

/*
  Electric arcs (Jamie, after the sentient wires in the anime movie X): as a wire's end nears the big monitor, bolts
  of current jump from it to the casing, crackling (redrawn every few hundredths of a second), and a last burst as
  it plugs in.
*/
const ARCS = { fromShare: 0.6, afterMs: 380, everyMs: 55, bolts: 2, spreadY: 2.6, jag: 0.7, color: "#a8f4ff" };

// a jagged bolt from one point to another, in a few kinked runs
const getBolt = (from, to) => {
  const steps = 5;
  const points = [from];
  for (let k = 1; k < steps; k++) {
    const share = k / steps;
    points.push({
      x: from.x + (to.x - from.x) * share + (Math.random() - 0.5) * ARCS.jag,
      y: from.y + (to.y - from.y) * share + (Math.random() - 0.5) * ARCS.jag * 2
    });
  }
  points.push(to);
  return `M ${points.map(({ x, y }) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")}`;
};

const useArcs = (delayMs, pathRefs, wires) => {
  const [bolts, setBolts] = useState([]);
  useEffect(() => {
    const start = performance.now();
    const lastMs = delayMs + (wires.length - 1) * 140 + MINI_TIMING.wiresMs + ARCS.afterMs;
    const interval = setInterval(() => {
      const now = performance.now() - start;
      const next = [];
      wires.forEach((wire, k) => {
        const progress = (now - (delayMs + k * 140)) / MINI_TIMING.wiresMs;
        if (progress < ARCS.fromShare || progress > 1 + ARCS.afterMs / MINI_TIMING.wiresMs) return;
        // the wire's end: where its drawing has got to, then the plug
        const path = pathRefs.current[k];
        let tip = wire.to;
        if (progress < 1 && path && path.getTotalLength) {
          const drawn = 1 - Math.pow(1 - progress, 2.2);
          const point = path.getPointAtLength(path.getTotalLength() * drawn);
          tip = { x: point.x, y: point.y };
        }
        for (let b = 0; b < ARCS.bolts; b++) {
          const to = { x: wire.to.x - 0.05, y: wire.to.y + (Math.random() - 0.5) * ARCS.spreadY };
          next.push({ key: `${k}-${b}`, d: getBolt(tip, to) });
        }
      });
      setBolts(next);
      if (now > lastMs) {
        setBolts([]);
        clearInterval(interval);
      }
    }, ARCS.everyMs);
    return () => clearInterval(interval);
  }, []);
  return bolts;
};

/*
  Ripped out (Jamie): as its device flies off, a wire's near end goes with it; the far end holds in its socket a moment,
  the wire pulled taut, then tears out and whips after it, current arcing from the socket to the torn end and off to
  the right.
*/
const RIP = { everyMs: 45, sparks: 3, arcsAfterPop: 0.14, trail: { x: -4, y: 7 }, swingShare: 0.12 };
const useRip = (device, wires, refs) => {
  const [bolts, setBolts] = useState([]);
  useEffect(() => {
    if (!device) return;
    const start = performance.now();
    let frameId;
    let lastBoltsAt = -Infinity;
    const run = () => {
      const now = performance.now();
      const time = Math.min((now - start) / FLY_OFF.ms, 1);
      const t = getDeviceTime(device, time);
      const { phases } = FLY_OFF;
      const ends = wires.map((wire, k) => {
        const from = getMovedPoint(wire.from, device, time);
        // held in its socket until the pop; then trailing behind the device, flailing (each its own way: tangling)
        const sincePop = t < phases.pop ? 0 : (t - phases.pop) / (1 - phases.pop);
        const swing = Math.min(1, sincePop / RIP.swingShare);
        const flail = sincePop > 0 ? (Math.sin(sincePop * Math.PI * (7 + k * 2.5) + k) * 3.5 + Math.sin(sincePop * Math.PI * 13 + k * 2) * 1.5) : 0;
        const trail = { x: from.x + RIP.trail.x + flail * 0.4, y: from.y + RIP.trail.y + flail * 0.5 };
        const to = { x: wire.to.x + (trail.x - wire.to.x) * swing, y: wire.to.y + (trail.y - wire.to.y) * swing };
        // slack, then taut from when it's caught (trembling), loose again once torn
        const taut = t < phases.lunge ? (t / phases.lunge) * 0.6 : t < phases.pop ? 0.95 : 0;
        const tremble = t >= phases.caught && t < phases.pop ? (Math.random() - 0.5) * 0.5 : 0;
        const d = getWirePath({ from, to, sag: wire.sag * (1 - taut) + tremble }, sincePop > 0 ? flail : tremble * 2);
        const { main, shine, plug } = refs.current[k] || {};
        if (main) main.setAttribute("d", d);
        if (shine) shine.setAttribute("d", d);
        if (plug) {
          plug.setAttribute("x", to.x - 0.2);
          plug.setAttribute("y", to.y - 0.55);
        }
        return to;
      });
      if (now - lastBoltsAt > RIP.everyMs) {
        lastBoltsAt = now;
        const next = [];
        // crackling at the sockets as it strains; at the pop and a moment after, at both ends: the sockets and the
        // torn plugs
        const isStraining = t > phases.caught + (phases.pop - phases.caught) * 0.5 && t < phases.pop;
        const isTorn = t >= phases.pop && t < phases.pop + RIP.arcsAfterPop;
        if (isStraining || isTorn) {
          wires.forEach((wire, k) => {
            const socket = { x: wire.to.x - 0.05, y: wire.to.y };
            const sparks = (from, spread, tag) => {
              for (let s = 0; s < RIP.sparks; s++) {
                const off = { x: from.x + (Math.random() - 0.3) * spread, y: from.y + (Math.random() - 0.5) * spread };
                next.push({ key: `spark-${tag}-${k}-${s}`, d: getBolt(from, off) });
              }
            };
            sparks(socket, isTorn ? 5 : 2.5, "socket");
            if (isTorn) {
              next.push({ key: `rip-${k}`, d: getBolt(socket, ends[k]) });
              sparks(ends[k], 4, "plug");
            }
          });
        }
        setBolts(next);
      }
      if (time < 1) frameId = requestAnimationFrame(run);
      else setBolts([]);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [device]);
  return bolts;
};

// 'wires': the side monitor's by default; the console has its own one. 'ripFor': its device's id ("mini" or
// "console") once it flies off
const Wires = ({ delayMs, wires = WIRES, ripFor = undefined }) => {
  // the wires go under the big monitor's casing (Jamie, playtest 26: their plugs were drawn over it, more so as it
  // moved): a hole in their layer the casing's shape, kept where the casing is each frame
  const layerRef = useRef(null);
  const holeRef = useRef(null);
  const clipId = useRef(`wireClip${Math.random().toString(36).slice(2, 8)}`).current;
  useEffect(() => {
    let frameId;
    const place = () => {
      const layer = layerRef.current;
      const hole = holeRef.current;
      const casing = document.querySelector("[data-tv-casing]");
      if (layer && hole) {
        const box = layer.getBoundingClientRect();
        const rect = casing && casing.getBoundingClientRect();
        const outer = "M -200 -200 H 300 V 260 H -200 Z";
        if (rect && rect.width > 0 && box.width > 0) {
          const toX = px => ((px - box.left) / box.width) * 100;
          const toY = py => ((py - box.top) / box.height) * 56.25;
          hole.setAttribute("d", `${outer} M ${toX(rect.left)} ${toY(rect.top)} H ${toX(rect.right)} V ${toY(rect.bottom)} H ${toX(rect.left)} Z`);
        } else hole.setAttribute("d", outer);
      }
      frameId = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frameId);
  }, []);
  const pathRefs = useRef([]);
  const ripRefs = useRef([]);
  const hookUpBolts = useArcs(delayMs, pathRefs, wires);
  const ripBolts = useRip(ripFor ? FLY_OFF.devices[ripFor] : undefined, wires, ripRefs);
  const bolts = ripFor ? ripBolts : hookUpBolts;
  return (
  <WireLayer ref={layerRef} viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id={clipId}><path ref={holeRef} clipRule="evenodd" d="M -200 -200 H 300 V 260 H -200 Z" /></clipPath>
      <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.25" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <g clipPath={`url(#${clipId})`}>
    {wires.map((wire, k) => {
      const style = { animationDelay: `${delayMs + k * 140}ms` };
      // (not while ripping: the frozen slither would hold the wire in place)
      const slither = !ripFor && (
        <animate attributeName="d" dur={`${MINI_TIMING.wiresMs / 1000}s`} begin={`${(delayMs + k * 140) / 1000}s`} fill="freeze"
          values={`${getWirePath(wire, 5)};${getWirePath(wire, -4)};${getWirePath(wire, 2)};${getWirePath(wire, 0)}`} />
      );
      return (
        <g key={k}>
          <path ref={element => { pathRefs.current[k] = element; ripRefs.current[k] = { ...ripRefs.current[k], main: element }; }} d={getWirePath(wire)} pathLength="100" stroke={wire.color} strokeWidth="0.75" style={style}>{slither}</path>
          <path ref={element => { ripRefs.current[k] = { ...ripRefs.current[k], shine: element }; }} d={getWirePath(wire)} pathLength="100" stroke="#3b3d41" strokeWidth="0.16" style={style} transform="translate(-0.12 -0.12)">{slither}</path>
          <rect ref={element => { ripRefs.current[k] = { ...ripRefs.current[k], plug: element }; }} x={wire.to.x - 0.2} y={wire.to.y - 0.55} width="1.3" height="1.1" rx="0.2" fill="#2a2b2e" stroke="#4a4542" strokeWidth="0.1" style={style} />
        </g>
      );
    })}
    {bolts.map(({ key, d }) => (
      <g key={key} className="arc" filter="url(#arcGlow)">
        <path d={d} stroke={ARCS.color} strokeWidth="0.32" opacity="0.55" />
        <path d={d} stroke="white" strokeWidth="0.1" />
      </g>
    ))}
    </g>
  </WireLayer>
  );
};

/*
  The class's battle preview (Jamie): below the class details, a little hex board where the player's avatar, with the
  picked powers, fights Kaiju coming in from the sides, live on the game's own engine (ClassBattle.jsx).
*/
const BATTLE = { top: 0.45, hex: { columns: 9, rows: 5 } }; // 'top': where it starts, of the screen's height

// the live preview's box: the game's board inside it, seen through it
// (where Jamie drew it on the side screen, then a little larger: Jamie); its edges fade to black, so the Kaiju walk
// into the shot rather than cut into it
// the side screen's details crossfade ('holdMs': leaving a power waits so long first): see CrossFade
const CROSSFADE = { ms: 220, holdMs: 160 };

const ClassLayer = styled.div`
  position: absolute;
  inset: 0;
  transition: opacity ${CROSSFADE.ms}ms ease-in-out;
`;

const BattleBox = styled.div`
  position: absolute;
  left: 3%;
  right: 3%;
  top: 47%;
  bottom: 1%;
  /* the pointer shows over it, the plain one (Jamie): the game's board hides it as it would in a game */
  cursor: default;
  & * { cursor: default !important; }
  -webkit-mask-image: linear-gradient(to right, transparent, black 9%, black 91%, transparent), linear-gradient(to bottom, transparent, black 3%, black 95%, transparent);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to right, transparent, black 9%, black 91%, transparent), linear-gradient(to bottom, transparent, black 3%, black 95%, transparent);
  mask-composite: intersect;
  overflow: hidden;
  opacity: 0.9; /* (the whole battle, a little faded: Jamie, playtest 29: 0.6, then 50% brighter) */
  border-radius: 0.4cqw;
  box-shadow: inset 0 0 0.6cqw rgba(0, 0, 0, 0.8);
`;

// the class's words: where "Class:" starts, a share of the side screen down (under its icons)
const CLASS_INFO_TOP = 19;

const Info = styled.div`
  position: absolute;
  inset: 1.4cqw 1.3cqw;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly; /* the active and the passive as far apart as the screen allows (Jamie) */
  /* the class: from a quarter of the way down the screen (Jamie) */
  /* the class: at the top of the screen (Jamie), its battle preview below it */
  /* (its icons at the top now, its words down by the arena: Jamie) */
  /* (Jamie, 2026-11-24: from a fixed top, down the column, so "Class:" and the name stay put from class to class and a
     longer description only reaches further down; was flex-end, which pushed it all up for a second line) */
  ${props => props.$isClass && css`justify-content: flex-start; top: ${CLASS_INFO_TOP}%; bottom: ${(1 - BATTLE.top) * 100}%;`}
  gap: 1.2cqw;
  font-size: 0.95cqw;
  line-height: 1.5;
  color: #d9dade;
`;

const PartHeader = styled.div`
  align-self: flex-start;
  text-align: left;
  font-family: gameboy;
  font-size: 0.85cqw;
  letter-spacing: 0.08cqw;
  color: #ffd24a; /* yellow, as "Class:" (Jamie) */
`;

// a number with its sign ("+2", "-1"), bigger than the words round it, to be read at a glance (Jamie, playtest 34)
const SignedNumber = styled.span`
  font-size: 1.4em;
  line-height: 1;
  vertical-align: -0.08em;
`;
const SIGNED = /([+\-−]\d+(?:\.\d+)?%?)/;
const withBigSigns = text => (typeof text == "string"
  ? text.split(SIGNED).map((part, k) => (k % 2 ? <SignedNumber key={k}>{part}</SignedNumber> : part))
  : text);

// (a thin underline in its own yellow: "Class:", Jamie playtest 32; "Recommended", playtest 34)
const UNDERLINED = { textDecoration: "underline", textDecorationThickness: "0.08cqw", textUnderlineOffset: "0.3cqw" };
// "Recommended", in the side screen's top right corner, boxed in "Class:"'s yellow (Jamie, playtest 34: a border, not
// an underline, and up in the corner)
const RecommendedTag = styled.div`
  position: absolute;
  top: 0.7cqw;
  right: 0.8cqw;
  padding: 0.25cqw 0.7cqw 0.2cqw;
  font-family: gameboy;
  font-size: 0.7cqw;
  letter-spacing: 0.08cqw;
  color: #ffd24a;
  border: 0.1cqw solid #ffd24a;
  border-radius: 999px; /* (a capsule: Jamie) */
  box-shadow: 0 0 0.4cqw rgba(255, 210, 74, 0.35);
  z-index: 2;
`;

const Part = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5cqw;
  text-align: ${props => props.$align};
  align-items: ${props => props.$align == "right" ? "flex-end" : "flex-start"};
`;

const TITLE_SIZE = 1.45; // cqw

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  white-space: nowrap;
  gap: 1.1cqw;
  font-family: gameboy;
  font-size: ${TITLE_SIZE}cqw;
  color: white;
`;

// the class's three icons: larger, at the top right of the side screen (Jamie; were at the bottom), spaced apart
// (ending at the screen's middle, centered 11% down: Jamie's lines)
// right-aligned now, as far in from the right as they were from the left (about 12%: Jamie)
// (Jamie, 2026-11-24: right-aligned, as far in from the right as "Class:" is from the left; each icon in a box of
// the same size, so a wide or narrow icon doesn't move the rest from class to class)
const IconGroup = styled.div`
  position: absolute;
  right: 1.3cqw;
  top: 11%;
  transform: translateY(-50%);
  display: flex;
  gap: 1.3cqw;
  i { font-size: 2.6cqw; width: 2.9cqw; height: 2.9cqw; line-height: 2.9cqw; text-align: center; flex: none; }
  /* a thin capsule round them, in "Class:"'s yellow (Jamie, playtest 29) */
  padding: 0.5cqw 1.1cqw;
  border: 0.12cqw solid #ffd24a;
  border-radius: 99cqw;
`;

const ClassText = styled.div`
  margin-top: 0.25cqw; /* (half the room under the name, with the column's gap: Jamie, 2026-11-24; was 1cqw) */
`;

// a title kept to one line (Jamie): too long for the screen, its words get smaller until it fits
const FitTitleRow = ({ text, children }) => {
  const ref = useRef(null);
  const [size, setSize] = useState(TITLE_SIZE);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || !row.parentElement) return;
    row.style.fontSize = `${TITLE_SIZE}cqw`;
    const room = row.parentElement.clientWidth;
    const needed = row.scrollWidth;
    setSize(needed > room ? Math.max(0.6, TITLE_SIZE * (room / needed) * 0.97) : TITLE_SIZE);
  }, [text]);
  return <TitleRow ref={ref} style={{ fontSize: `${size}cqw` }}>{children}</TitleRow>;
};

// (a power used in the class battle: its icon blinks, twice: Jamie, playtest 29)
// (softer, no scaling: Jamie, playtest 29): a gentle brighten and glow, once
// (twice, the glow about double the last try's: Jamie, playtest 32: too quiet. Still no scaling)
const iconBlink = keyframes`
  0%, 50%, 100% { filter: drop-shadow(0 0 0.2cqw currentColor); }
  22%, 72% { filter: brightness(1.7) drop-shadow(0 0 0.6cqw currentColor) drop-shadow(0 0 1cqw currentColor); }
`;
const Icon = styled.i`
  font-size: 1.9cqw;
  filter: drop-shadow(0 0 0.2cqw currentColor);
  ${props => props.$isBlinking && css`animation: ${iconBlink} 900ms ease-in-out;`}
`;

const TINT = { turnDegrees: 28, saturation: 0.7, lightness: 80 };
const getTint = (color, turn) => `hsl(from ${color} calc(h + ${turn}) calc(s * ${TINT.saturation}) ${TINT.lightness}%)`;
// the class: the three colors mixed, made light
const getClassTint = colors => !colors.length ? '#d9dade' : `color-mix(in oklab, ${colors.reduce((mix, color, k) => k ? `color-mix(in oklab, ${mix}, ${color} ${Math.round(100 / (k + 1))}%)` : color)} 45%, #eef0f4)`;

const Effect = styled.div`
  color: ${props => props.$color};
  filter: brightness(1.2);
`;

// (narrower than they were, clear of the screws: Jamie)
const MetalButton = styled.button`
  padding: 0.55cqw 1cqw;
  font-family: gameboy;
  font-size: 1.1cqw;
  cursor: pointer;
  border-radius: 0.45cqw;
  white-space: nowrap;
  ${RUBBER_BUTTON}
  /* (long labels, as the color vat's Irradiate and Back to Lab: smaller, so both fit the console. Jamie, playtest 26) */
  ${props => props.$isCompact && css`font-size: 0.8cqw; padding: 0.5cqw 0.7cqw;`}
  /* (Jamie, playtest 33: the vat's Irradiate big, as Play! is; Back to Lab small beside it, on two lines) */
  ${props => props.$isCompact && !props.$isMain && css`white-space: normal; line-height: 1.35; max-width: 6.4cqw; text-align: center; font-size: 0.75cqw;`}
  /* Play! (Jamie, playtest 28): bigger, up in the console's middle and a little left (not lined up with Back) */
  ${props => props.$isMain && css`
    font-size: 1.33cqw; /* (5/6 of the first try's: Jamie, playtest 28) */
    padding: 0.71cqw 1.25cqw;
    translate: -0.6cqw 0; /* ('translate': the press's transform still works) */
  `}
  ${props => props.$isMain && props.$isCompact && css`
    font-size: 1.2cqw;
    padding: 0.71cqw 1cqw;
    translate: -0.3cqw 0;
  `}
  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
  ${props => props.$isBacklit && css`animation: ${backlitBlink} 0.9s steps(1) infinite;`}
`;

// Play!, ready (Jamie): its letters lit green from behind, blinking in step with the ready light
const backlitBlink = keyframes`
  0%, 55% { color: #c8ffb8; text-shadow: 0 0 0.25cqw #3aff3a, 0 0 0.6cqw #2ee02a, 0 0 1cqw #1a9a1a; }
  56%, 100% { color: #3e8a3a; text-shadow: 0 0 0.15cqw rgba(46, 224, 42, 0.35); }
`;

/*
  The Play!/Back console (Jamie): there from the avatar select on. It rises in once the monitor is on, as the monitor
  eases aside for it, and its one wire slithers (and sparks) into the big monitor's side. The light blinks once three
  powers are picked.
*/
const CONSOLE_WIRES = [{ from: { x: CONSOLE.left + 2.5, y: CONSOLE.top + CONSOLE.height }, to: { x: 64.9, y: 50 }, sag: 3, color: "#0e0f10" }];

// 'backLabel': the other button's words (the color vat's: Back to Lab)
/*
  Rings etched into the console's face round its buttons (Jamie, playtest 29): three thin outlines of each button's
  shape, further apart as they go out; where one button's rings run into the other's, they break off (each set is cut
  where the other's outermost ring reaches). Engraved: a dark line, a faint light one just under it.
*/
// (Jamie, playtest 32: the outermost in clear sight on the face, never off it or under the screws: tighter, and each
// button's rings shrunk to fit if they'd come within 'edgeShare' of the face's height of an edge)
const ETCH = { offsets: [0.16, 0.36, 0.6], edgeShare: 0.07, radius: 0.18, dark: "rgba(0, 0, 0, 0.5)", light: "rgba(255, 255, 255, 0.16)" };
// Play's rings pulse green outward with its blinking word (Jamie, playtest 29): each ring a beat after the one inside it
const ringPulse = keyframes`
  0% { opacity: 0.95; }
  28% { opacity: 0; }
  100% { opacity: 0; }
`;
const PulseRing = styled.rect`
  animation: ${ringPulse} 0.9s ease-out infinite;
  filter: drop-shadow(0 0 2px #2ee02a);
`;
const EtchedRings = ({ faceRef, buttonRefs, glowingIndex = undefined }) => {
  const [boxes, setBoxes] = useState([]);
  useEffect(() => {
    let frameId;
    let last = "";
    const measure = () => {
      const face = faceRef.current;
      if (face) {
        // (from the layout, not the screen: as the face turns over, the screen's boxes move, and the rings slid along
        // the face with them. Jamie, mp playtest 3)
        const f = { width: face.offsetWidth, height: face.offsetHeight };
        const next = buttonRefs.map(ref => ref.current).filter(Boolean).map(element => {
          const [shiftX = 0, shiftY = 0] = (getComputedStyle(element).translate || "").split(" ").map(part => parseFloat(part) || 0);
          const box = { x: element.offsetLeft + shiftX, y: element.offsetTop + shiftY, width: element.offsetWidth, height: element.offsetHeight };
          // room to the face's edges, less a margin clear of the screws
          const margin = f.height * ETCH.edgeShare;
          const room = Math.min(box.x, box.y, f.width - box.x - box.width, f.height - box.y - box.height) - margin;
          const outer = box.height * ETCH.offsets[ETCH.offsets.length - 1];
          return { ...box, fit: Math.max(0.2, Math.min(1, room / outer)) };
        });
        const key = JSON.stringify(next.map(box => [box.x, box.y, box.width, box.height].map(Math.round)));
        if (key != last) {
          last = key;
          setBoxes(next);
        }
      }
      frameId = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frameId);
  }, []);
  const ringsOf = (box, k) => ETCH.offsets.map(share => {
    const o = box.height * share * (box.fit || 1);
    return { key: `${k}-${share}`, x: box.x - o, y: box.y - o, width: box.width + 2 * o, height: box.height + 2 * o, rx: box.height * ETCH.radius + o };
  });
  const sets = boxes.map(ringsOf);
  // (in step with the word's blink: where its 0.9 s loop is now, so each ring lights just after the word does)
  const glowing = glowingIndex !== undefined && buttonRefs[glowingIndex] && buttonRefs[glowingIndex].current;
  const blink = glowing && glowing.getAnimations ? glowing.getAnimations().find(animation => animation.effect && animation.effect.getTiming && animation.effect.getTiming().duration == 900) : undefined;
  const phaseSeconds = blink && blink.currentTime != null ? (Number(blink.currentTime) % 900) / 1000 : 0;
  return (
    // (inside the face only, under the casing's lip; the screws go over it)
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }} aria-hidden="true">
      {/* (Jamie, playtest 29: the innermost ring whole; the others stop where they meet the other button's ring of the
          same rank, so each pair ends at their crossing) */}
      <defs>
        {sets.map((rings, k) => rings.map((ring, n) => n == 0 ? null : (
          <mask key={`${k}-${n}`} id={`etch-cut-${k}-${n}`} maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
            <rect x="-1000" y="-1000" width="3000" height="3000" fill="white" />
            {sets.filter((_, other) => other != k).map(otherRings => {
              const meet = otherRings[n];
              return <rect key={meet.key} x={meet.x} y={meet.y} width={meet.width} height={meet.height} rx={meet.rx} fill="black" />;
            })}
          </mask>
        )))}
      </defs>
      {sets.map((rings, k) => rings.map(({ key, x, y, width, height, rx }, n) => (
        <g key={key} mask={n == 0 ? undefined : `url(#etch-cut-${k}-${n})`} fill="none">
          <rect x={x} y={y + 1} width={width} height={height} rx={rx} stroke={ETCH.light} strokeWidth="1" />
          <rect x={x} y={y} width={width} height={height} rx={rx} stroke={ETCH.dark} strokeWidth="1" />
          {k === glowingIndex && <PulseRing x={x} y={y} width={width} height={height} rx={rx} stroke="#5cff4a" strokeWidth="1.3" style={{ animationDelay: `${n * 0.13 - phaseSeconds}s` }} />}
        </g>
      )))}
    </svg>
  );
};

// 'isBackDisabled': shown, but not to be pressed (the color vat's Back to Lab while it dunks: Jamie, playtest 26)
// (Play's glow is the etched rings' own, as on every screen: Jamie, mp playtest 3, no ellipses pulsing over it)
// one side of the face: its screws, etched rings and buttons
// (Jamie, playtest 38) the keys: the arrows focus one of the face's buttons that can be pressed (its etched rings pulse
// green), and Enter presses it. Not while typing in a box (the vat's hex), and only on the face in front ('isKeyed')
const FaceSide = ({ isReady, playLabel, onPlay, onBack, backLabel = "Back", isBackDisabled = false, isKeyed = false }) => {
  const isCompact = `${playLabel}${onBack ? backLabel : ""}`.length > 14;
  const faceRef = useRef(null);
  const playRef = useRef(null);
  const backRef = useRef(null);
  const [focusIndex, setFocusIndex] = useState(undefined);
  const buttons = [{ isOn: !!isReady, press: onPlay }, ...(onBack ? [{ isOn: !isBackDisabled, press: onBack }] : [])];
  const isFocusOn = focusIndex !== undefined && !!buttons[focusIndex] && buttons[focusIndex].isOn;
  const keysRef = useRef({});
  keysRef.current = { buttons, focusIndex: isFocusOn ? focusIndex : undefined };
  useEffect(() => {
    if (!isKeyed) return;
    const onKey = event => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.repeat) return;
      const { buttons: all, focusIndex: at } = keysRef.current;
      const open = all.map((button, k) => button.isOn ? k : -1).filter(k => k >= 0);
      if (event.code.startsWith("Arrow")) {
        if (!open.length) return;
        event.preventDefault();
        const step = ["ArrowLeft", "ArrowUp"].includes(event.code) ? -1 : 1;
        const from = open.indexOf(at);
        setFocusIndex(open[from < 0 ? (step > 0 ? 0 : open.length - 1) : (from + step + open.length) % open.length]);
      } else if (event.code == "Enter" || event.code == "NumpadEnter") {
        // (the button pulsing green is the one Enter presses, arrows first or not: Play's, when it's ready. Jamie, playtest 39)
        const pressed = at !== undefined ? at : all[0] && all[0].isOn ? 0 : undefined;
        if (pressed === undefined) return;
        event.preventDefault();
        all[pressed].press();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isKeyed]);
  return (
    <ConsoleFace ref={faceRef}>
      {[[0.5, 0.5, 20], [null, 0.5, -35], [0.5, null, 60], [null, null, 5]].map(([screwLeft, top, turn], k) => (
        <Screw key={k} $turn={turn} style={{ zIndex: 2, left: screwLeft == null ? undefined : `${screwLeft}cqw`, right: screwLeft == null ? "0.5cqw" : undefined, top: top == null ? undefined : `${top}cqw`, bottom: top == null ? "0.5cqw" : undefined }} />
      ))}
      {/* (no ready light: Jamie, playtest 28) */}
      <EtchedRings faceRef={faceRef} buttonRefs={[playRef, backRef]} glowingIndex={isFocusOn ? focusIndex : isReady ? 0 : undefined} />
      <MetalButton ref={playRef} style={{ position: "relative", zIndex: 1 }} disabled={!isReady} $isBacklit={isReady} $isCompact={isCompact} $isMain onClick={onPlay}>
        {playLabel}
      </MetalButton>
      {onBack && <MetalButton ref={backRef} style={{ position: "relative", zIndex: 1 }} disabled={isBackDisabled} $isCompact={isCompact} onClick={onBack}>{backLabel}</MetalButton>}
    </ConsoleFace>
  );
};

// 'faceKey': which screen's buttons it has (multiplayer's pre-game: avatar, picker, vat); a new one turns the face over
// to them (FACE_FLIP)
export const PlayConsole = (props) => {
  const { faceKey = undefined, isLeaving = false } = props;
  const byKey = useRef({});
  byKey.current[faceKey] = props;
  const [shownKey, setShownKey] = useState(faceKey);
  const [isTurning, setIsTurning] = useState(false);
  useEffect(() => {
    if (faceKey === shownKey) return;
    setIsTurning(true);
    // (round: the new side is the front now, the slab back to rest in the same frame)
    const done = setTimeout(() => { setShownKey(faceKey); setIsTurning(false); }, FACE_FLIP.ms);
    return () => clearTimeout(done);
  }, [faceKey]);
  const front = isTurning ? byKey.current[shownKey] || props : props;
  return (
    <>
      <Wires delayMs={MINI_TIMING.riseDelayMs + MINI_TIMING.flyMs - 250} wires={CONSOLE_WIRES} ripFor={isLeaving ? "console" : undefined} />
      <Arm box={CONSOLE} isLeaving={isLeaving} />
      <Console $isLeaving={isLeaving}>
        <Depth radius={1.4} />
        <FaceWell>
          <FaceBar style={{ left: "-0.2cqw" }} />
          <FaceBar style={{ right: "-0.2cqw" }} />
          <Slab $isTurning={isTurning}>
            <SlabEdge $isTop />
            <SlabEdge />
            <SlabSide><FaceSide {...front} isKeyed={!isTurning && !isLeaving} /></SlabSide>
            {isTurning && <SlabSide $isBack><FaceSide {...props} /></SlabSide>}
          </Slab>
        </FaceWell>
      </Console>
    </>
  );
};

/*
  The side monitor, on its own (Jamie): it flies in with the console, from the avatar select on, its pet Kaiju on it;
  on the picker, the picker puts its own things on its screen and border (into the two places marked for them).
  Back from the avatar select: its screen switches off. On Play!: it flies off.
*/
const SideSlot = styled.div`
  position: absolute;
  inset: 0;
`;

/*
  The side screen's details crossfade (Jamie, playtest 26): the old ones fade out as the new fade in. 'id': what's
  showing (a power, the class, the tamagotchi); the one before stays a moment, fading.
*/
const crossIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const crossOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
const FadeLayer = styled.div`
  position: absolute;
  inset: 0;
  animation: ${props => props.$isLeaving ? crossOut : crossIn} ${CROSSFADE.ms}ms ease-in-out both;
  ${props => props.$isLeaving && css`pointer-events: none;`}
`;
// 'restIds': what shows with nothing hovered; going to one waits a moment ('holdMs'), so moving from one power to the
// next (through the gap between them) crossfades the two
const CrossFade = ({ id, children, restIds = [] }) => {
  const [shownId, setShownId] = useState(id);
  const [leaving, setLeaving] = useState(undefined); // { id, node }
  const nodes = useRef({});
  nodes.current[id] = children;
  const shownRef = useRef(id);
  useEffect(() => {
    if (id == shownRef.current) return;
    const commit = () => {
      const previous = shownRef.current;
      shownRef.current = id;
      setShownId(id);
      // (not the tamagotchi: a second one, fading, would take over its buttons)
      setLeaving(previous == "tama" ? undefined : { id: previous, node: nodes.current[previous] });
    };
    const isToRest = restIds.includes(id) && !restIds.includes(shownRef.current);
    const hold = setTimeout(commit, isToRest ? CROSSFADE.holdMs : 0);
    return () => clearTimeout(hold);
  }, [id]);
  useEffect(() => {
    if (!leaving) return;
    const timeout = setTimeout(() => setLeaving(undefined), CROSSFADE.ms);
    return () => clearTimeout(timeout);
  }, [leaving]);
  return (
    <>
      {leaving && leaving.id != shownId && <FadeLayer key={`out-${leaving.id}`} $isLeaving>{leaving.node}</FadeLayer>}
      <FadeLayer key={`in-${shownId}`}>{shownId == id ? children : nodes.current[shownId]}</FadeLayer>
    </>
  );
};

// 'bioOf': on the avatar select, the avatar whose file shows (the one hovered: Jamie)
/*
  The side monitor's set, for whatever goes on its screen ('children') and its top border ('brow'): it flies in, its
  screen switches on, its wires slither to the big monitor (the avatar select's and picker's, and the color vat's:
  Jamie, playtest 25, the same set beside both Lab screens).
*/
// 'rebootKey': a new one switches the screen on afresh (its picture opening from a line, CRT's power-on): the
// pre-game's screens changing in place (Jamie, mp playtest 2)
export const SideFrame = ({ children, brow = null, isPoweredOff = false, isLeaving = false, overlay = null, rebootKey = undefined }) => {
  const [isOn, setIsOn] = useState(false);
  const [boot, setBoot] = useState({ key: rebootKey, n: 0 });
  useEffect(() => {
    const timeout = setTimeout(() => setIsOn(true), MINI_TIMING.onAtMs);
    return () => clearTimeout(timeout);
  }, []);
  const [isRebooting, setIsRebooting] = useState(false);
  useLayoutEffect(() => {
    if (rebootKey === boot.key) return;
    setBoot({ key: rebootKey, n: boot.n + 1 }); // (the screen anew, dead...)
    setIsRebooting(true);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setIsRebooting(false))); // (...then on)
    return () => cancelAnimationFrame(frame);
  }, [rebootKey]);
  return (
    <>
      <Wires delayMs={MINI_TIMING.wiresAtMs} ripFor={isLeaving ? "mini" : undefined} />
      <Arm box={MINI} isLeaving={isLeaving} />
      <MiniMonitor $isLeaving={isLeaving}>
        <Depth radius={2} />
        {isLeaving
          ? null
          : null /* (no thrusters: it swings on its hinge now) */}
        <MiniScreen>
          <CrtScreen key={boot.n} isOn={isOn && !isPoweredOff && !isRebooting}>{children}</CrtScreen>
          {overlay}
          <MiniGlass />
        </MiniScreen>
        <MiniBrow>{brow}</MiniBrow>
      </MiniMonitor>
    </>
  );
};

// 'screen': the pre-game's (avatar, picker, vat: multiplayer's color, its panel put in here by the vat). A new one: the
// screen fades to black, then switches on afresh with it (Jamie, mp playtest 2; it was the power cut and burn-in)
export const SIDE_SWITCH = { fadeMs: 320 };
const SwitchBlack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  background: #030404;
  pointer-events: none;
  animation: ${crossIn} ${SIDE_SWITCH.fadeMs}ms ease-in both;
`;
const useScreenSwitch = screen => {
  const [shown, setShown] = useState(screen);
  const [isFading, setIsFading] = useState(false);
  useEffect(() => {
    if (screen == shown) {
      setIsFading(false);
      return;
    }
    setIsFading(true);
    const timeout = setTimeout(() => { setShown(screen); setIsFading(false); }, SIDE_SWITCH.fadeMs);
    return () => clearTimeout(timeout);
  }, [screen]);
  return [shown, isFading];
};

// (the Agent at least this long when the avatar select first shows, whatever's hovered, so he's seen: Jamie, playtest 29)
const AGENT_FIRST_MS = 4800; // (at least 3.5 s: Jamie; long enough now for his whole walk-in and line once the screen is on)
const SCREEN_POWER_ON_MS = 650;
// the avatar select's Lab sits dark this long before its lights flicker on (Game.tsx): the Agent waits for them too
export const LAB_LIGHTS_DELAY_MS = 2500; // (the CRT's power-on, CRT.onMs: the picture's up after it)
const TAMA_FIRST_MS = 3000;
// 'isQuiet': straight to the tamagotchi, no power cut (back after Back); 'isFadingOut': a character just clicked, the
// screen's content fades before the scene moves on (Jamie, playtest 34)
export const SideMonitor = ({ isPickerShowing, screen: givenScreen = undefined, isPoweredOff = false, isLeaving = false, bioOf: hoveredBio = undefined, isQuiet = false, isFadingOut = false }) => {
  const targetScreen = givenScreen || (isPickerShowing ? "picker" : "avatar");
  const [screen, isSwitching] = useScreenSwitch(targetScreen);
  const [isAgentHeld, setIsAgentHeld] = useState(true);
  const screenOnAt = useRef(Date.now() + MINI_TIMING.onAtMs); // (when its screen switches on: the Agent starts then)
  const lightsAt = useRef(Date.now() + LAB_LIGHTS_DELAY_MS); // (and not before the Lab's lights: Jamie, playtest 30)
  useEffect(() => {
    const timeout = setTimeout(() => setIsAgentHeld(false), MINI_TIMING.onAtMs + AGENT_FIRST_MS);
    return () => clearTimeout(timeout);
  }, []);
  const bioOf = isAgentHeld ? undefined : hoveredBio;
  // Stompy waits while his screen is switching or not showing him: he carries on once he can be seen (Jamie, playtest 34)
  useEffect(() => {
    holdTamagotchi(screen != "picker" || isSwitching || isPoweredOff, "side screen");
    return () => holdTamagotchi(false, "side screen");
  }, [screen, isSwitching, isPoweredOff]);
  return (
  <SideFrame
    isPoweredOff={isPoweredOff}
    isLeaving={isLeaving}
    rebootKey={screen}
    overlay={isSwitching && <SwitchBlack data-side-switch />}
    // (the three round buttons on the vat's too, unlit: Jamie, mp playtest 2)
    brow={screen == "picker" ? <div data-side-brow="picker" style={{ display: "contents" }} /> : ["Feed", "Pet", "Clean up"].map(label => (
      <ButtonSlot key={label}><BrowButtonShape disabled aria-label={label} title={label} /></ButtonSlot>
    ))}
  >
    {/* the avatar select: the candidates' files (Jamie: not the tamagotchi, that's on the picker) */}
    {/* the Agent and the files crossfade too (Jamie, playtest 29) */}
    {screen != "avatar" ? <SideSlot key={screen} data-side-screen={screen} /> : (
      // (faded out and staying so while the screen switches on to what's next: the bio flashed back before Stompy. Jamie, playtest 39)
      <div style={{ position: "absolute", inset: 0, opacity: isFadingOut || targetScreen != "avatar" ? 0 : 1, transition: "opacity 450ms ease-out" }}>
        <CrossFade id={bioOf || "agent"}><AvatarBio avatar={bioOf} agentDelayMs={Math.max(screenOnAt.current + SCREEN_POWER_ON_MS, lightsAt.current + 300) - Date.now()} /></CrossFade>
      </div> /* (no hold here: straight on to what's next) */
    )}
  </SideFrame>
  );
};

export const AbilityPicker = ({
  handleClickHome,
  pickedAbilities,
  setPickedAbilities,
  handleClickPlay,
  playLabel = undefined, // from the Lab, the button says where it goes
  onBack = undefined,
  isTeammate = undefined, // (no longer shown: there's always a teammate now)
  setIsTeammate = undefined,
  recommended = [] // the powers suggested for the fight ahead (Jamie, playtest 34): "Recommended" on their details
}) => {
  const { settingsManager, selectedAvatar } = useContext(GlobalSettingsContext);
  const [hovered, setHovered] = useState(undefined); // the index of the hovered (or key-chosen) pendant
  // every power in play; the halo shows the open ones only (Jamie: locked ones are hidden)
  const [allPowers] = useState(() => {
    settingsManager.initAbilityStatusData();
    return Object.values(settingsManager.getAbilityAndTileStatusData()).filter(({ element }) => !OUT_OF_PLAY_POWERS.includes(element));
  });
  // dev: shown or hidden by hand, over whether it's open
  const [devShown, setDevShown] = useState({});
  const [isDevOpen, setIsDevOpen] = useState(false);
  // dev: the side monitor's class review (CLASS_REVIEW_KEY)
  const [isClassReview, setIsClassReview] = useState(false);
  const [classReview, setClassReview] = useState(loadClassReview);
  const [reviewIndex, setReviewIndex] = useState(0);
  // dev: the avatar's height on the screen (Jamie); kept in LOOK, so the avatar select hands over to the same spot
  const [figureDrop, setFigureDrop] = useState(LOOK.figureDrop);
  const moveFigure = drop => {
    LOOK.figureDrop = drop;
    setFigureDrop(drop);
  };
  const powers = useMemo(() => allPowers.filter(({ element }) => devShown[element] ?? getIsSkillOpen(element)), [allPowers, devShown]);
  useEffect(() => setHovered(undefined), [powers.length]);
  const [lockIns, setLockIns] = useState({}); // each power's count of being picked, to play its lock-in again
  const isPendantsLiveRef = useRef(false); // (for the number keys)
  const anchorRef = useRef(null);
  const [frame, setFrame] = useState(null);
  // the side monitor's screen and border, for the picker's things (SideMonitor)
  const [side, setSide] = useState(null);
  // (looked for until it's there, and again if it's made anew: the side monitor now comes after the monitor's boot, so
  // it wasn't there yet as the picker opened, and its screen stayed empty. Jamie, playtest 29)
  useLayoutEffect(() => {
    const gameFrame = anchorRef.current && anchorRef.current.closest("[data-game-frame]");
    setFrame(gameFrame);
    let frameId;
    let last = { screen: null, brow: null };
    const find = () => {
      const screen = gameFrame && gameFrame.querySelector('[data-side-screen="picker"]');
      const brow = gameFrame && gameFrame.querySelector('[data-side-brow="picker"]');
      if (screen !== last.screen || brow !== last.brow) {
        last = { screen, brow };
        setSide(screen ? { screen, brow } : null);
      }
      frameId = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frameId);
  }, []);

  HALO_RADIUS = getHaloRadiusFor(powers.length);
  const angles = useMemo(() => powers.map((_, k) => powers.length > 1
    ? LOOK.haloStartDegrees + (k * (LOOK.haloEndDegrees - LOOK.haloStartDegrees)) / (powers.length - 1)
    : 90), [powers]);
  const traces = useMemo(() => angles.map((degrees, k) => getTrace({ degrees, radius: getPendantRadius(k) - LOOK.pendantSize / 2 - 10, across: getAcross(degrees), jog: k % 2 ? 1 : -1 })), [angles]);
  const stubs = useMemo(() => getStubs(angles), [angles]);

  const getIsPicked = power => pickedAbilities.includes(power.getElementUppercase());
  // the flash's order: the unpicked ones from the bottom-left (the halo's last angle) round clockwise (falling angles)
  const flashOrder = {};
  powers.map((power, k) => ({ k, degrees: angles[k], isPicked: getIsPicked(power) }))
    .filter(({ isPicked }) => !isPicked)
    .sort((a, b) => b.degrees - a.degrees)
    .forEach(({ k }, order) => { flashOrder[k] = order; });

  // the number keys (Jamie, playtest 38): 1 at the far bottom left, on round clockwise, 0 for a tenth; each beside its pendant
  const keyOrder = {};
  powers.map((power, k) => ({ k, degrees: angles[k] })).sort((a, b) => b.degrees - a.degrees).forEach(({ k }, order) => { keyOrder[k] = order; });
  const getKeyLabel = k => keyOrder[k] === undefined || keyOrder[k] > 9 ? undefined : String((keyOrder[k] + 1) % 10);

  const togglePower = power => {
    const element = power.getElementUppercase();
    const isPicked = pickedAbilities.includes(element);
    if (!isPicked && pickedAbilities.length >= PICK_COUNT) return;
    const picked = (isPicked ? pickedAbilities.filter(other => other != element) : [...pickedAbilities, element]).sort((a, b) => a.localeCompare(b));
    if (!isPicked) setLockIns(counts => ({ ...counts, [element]: (counts[element] || 0) + 1 }));
    setPickedAbilities(picked);
    settingsManager.setSortedPlayerChosenAbilityElementsString(picked);
  };

  // (no keys round the halo: Jamie)

  // dev: the class review's list: every class whose three powers are all in play
  const reviewKeys = useMemo(() => {
    const inPlay = allPowers.map(power => power.getElementUppercase());
    return Object.keys(SCI_FI_CLASSES).filter(key => key.split(",").every(element => inPlay.includes(element)));
  }, [allPowers]);
  const showReviewClass = index => {
    const k = (index + reviewKeys.length) % reviewKeys.length;
    setReviewIndex(k);
    setHovered(undefined);
    const picked = reviewKeys[k].split(",");
    setPickedAbilities(picked);
    settingsManager.setSortedPlayerChosenAbilityElementsString(picked);
  };
  const updateReview = change => setClassReview(review => {
    const next = change(review);
    saveClassReview(next);
    return next;
  });
  const startClassReview = isOn => {
    setIsClassReview(isOn);
    if (!isOn) return;
    // (from the first not yet seen)
    const firstUnseen = reviewKeys.findIndex(key => !classReview.seen.includes(key));
    showReviewClass(Math.max(0, firstUnseen));
  };
  const onReviewButton = label => {
    const key = reviewKeys[reviewIndex];
    if (label == "Feed") showReviewClass(reviewIndex - 1);
    if (label == "Pet") updateReview(review => ({ ...review, flagged: review.flagged.includes(key) ? review.flagged.filter(other => other != key) : [...review.flagged, key] }));
    if (label == "Clean up") {
      updateReview(review => ({ ...review, seen: review.seen.includes(key) ? review.seen : [...review.seen, key] }));
      showReviewClass(reviewIndex + 1);
    }
  };

  const keyed = useRef({});
  keyed.current = { powers, keyOrder, togglePower };
  useEffect(() => {
    const onKey = event => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.repeat) return;
      const match = /^(?:Digit|Numpad)(\d)$/.exec(event.code);
      if (!match) return;
      const { powers: all, keyOrder: order, togglePower: toggle } = keyed.current;
      if (!isPendantsLiveRef.current) return;
      const wanted = (Number(match[1]) + 9) % 10; // 1 is the first, 0 the tenth
      const k = Object.keys(order).find(index => order[index] == wanted);
      if (k === undefined || !all[k]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggle(all[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isReady = pickedAbilities.length == PICK_COUNT;
  const playerClass = isReady ? getSciFiClass(pickedAbilities) : undefined;
  const pickedPowers = powers.filter(getIsPicked);

  const figure = FIGURES[selectedAvatar] || FIGURES.guy;
  const scale = LOOK.figureHeight / (figure.feet - figure.head);
  const headTop = LOOK.torso.y - LOOK.headDrop * LOOK.figureHeight + figureDrop;
  const avatarColor = CHOSEN_GLOW.colors[selectedAvatar] || (PIECES_INFO[selectedAvatar] || PIECES_INFO.guy).color;
  // the same highlight as on the avatar select once chosen, at the same size on screen, so it carries on unbroken
  // through the hand-over (Jamie): its glow and white edge grow with the figure, as the avatar select's did
  const glowScale = LOOK.figureHeight / (figure.feet - figure.head);

  const getInfo = () => {
    const power = hovered !== undefined ? powers[hovered] : undefined;
    if (power) {
      return (
        <>
          {recommended.includes(power.getElementUppercase()) && <RecommendedTag>Recommended</RecommendedTag>}
          <Part $align="left">
            <PartHeader>Active:</PartHeader>
            <FitTitleRow text={power.activeName}><Icon className={`fa ${power.activeIcon}`} style={{ color: power.color }} />{power.activeName}</FitTitleRow>
            <div style={{ color: getTint(power.color, -TINT.turnDegrees) }}>{withBigSigns(power.activeDesc)}</div>
            {power.activeEffect1 && <Effect $color={power.color}>{withBigSigns(power.activeEffect1)}</Effect>}
          </Part>
          <Part $align="left">
            <PartHeader>Passive:</PartHeader>
            {/* the icon first, as the active's (Jamie, playtest 26); Charm's passive (Spurned) shows the Spurned status icon */}
            <FitTitleRow text={power.passiveName}><Icon className={`fa ${power.element == "wink" ? "fa-frown-o" : power.passiveIcon}`} style={{ color: power.element == "wink" ? "#ff4040" : power.color }} />{power.passiveName}</FitTitleRow>
            <div style={{ color: getTint(power.color, TINT.turnDegrees) }}>{withBigSigns(power.passiveDesc)}</div>
            {power.passiveEffect1 && <Effect $color={power.color}>{withBigSigns(power.passiveEffect1)}</Effect>}
          </Part>
        </>
      );
    }
    if (playerClass) {
      return (
        <Part $align="left">
          <PartHeader style={{ ...UNDERLINED, fontSize: "1.1cqw", marginTop: "-0.5cqw" }}>Class:</PartHeader>{/* (bigger and a little higher: Jamie, playtest 34; was 0.85) */}{/* (a thin underline: Jamie, playtest 32) */}
          <FitTitleRow text={playerClass[0]}>{playerClass[0]}</FitTitleRow>
          <ClassText style={{ color: getClassTint(pickedPowers.map(({ color }) => color)) }}>{playerClass[1]}</ClassText>
        </Part>
      );
    }
    return null; // (no "Choose 3 powers" here: Jamie; "Pick three abilities" is on the main screen)
  };

  // the Kaiju tamagotchi (Jamie): on the side monitor while nothing's hovered and three aren't picked; its buttons
  // work only then (with the class showing, they're off, and its clock waits)
  const tamaRef = useRef(null);
  // the battle preview's box, as a share of the game frame: the board sizes its view from it (its tiles the Peninsula's)
  const arenaRef = useRef(null);
  const [arenaWindow, setArenaWindow] = useState(null);
  const [blinks, setBlinks] = useState({});
  const [pendantFlash, setPendantFlash] = useState(0);
  // the pendants wait, dimmed and dead, until Stompy has said his hello and "Pick three abilities" (Jamie, playtest 34);
  // once he's met them (a later visit), they're live at once
  // (or with a power picked already, as they open: they've met him. Jamie, playtest 35)
  const [wasIntroduced] = useState(() => {
    if (pickedAbilities.length > 0) markTamagotchiIntroduced();
    return getHasTamagotchiIntroduced();
  });
  const isPendantsLive = wasIntroduced || pendantFlash > 0;
  isPendantsLiveRef.current = isPendantsLive; // each "Pick three abilities": the unpicked pendants flash in turn // each power's casts in the class battle, by element: its icon blinks on each
  const isArenaShowing = !!playerClass;
  useLayoutEffect(() => {
    if (!isArenaShowing) {
      setArenaWindow(null);
      return;
    }
    const measure = () => {
      const box = arenaRef.current;
      const frameBox = box && box.closest("[data-game-frame]");
      if (!box || !frameBox) return;
      const a = box.getBoundingClientRect();
      const f = frameBox.getBoundingClientRect();
      setArenaWindow({ left: (a.left - f.left) / f.width, top: (a.top - f.top) / f.height, right: (a.right - f.left) / f.width, bottom: (a.bottom - f.top) / f.height });
    };
    // measured again every frame while it shows: it can first be measured while the side monitor is still flying in
    // (a replay, its powers picked already), which put the board off in the dark until a resize (Jamie)
    let frameId;
    let last = "";
    const keepMeasuring = () => {
      const box = arenaRef.current;
      const frameBox = box && box.closest("[data-game-frame]");
      if (box && frameBox) {
        const a = box.getBoundingClientRect();
        const f = frameBox.getBoundingClientRect();
        const key = [a.left - f.left, a.top - f.top, a.width, a.height, f.width, f.height].map(Math.round).join(",");
        if (key != last) {
          last = key;
          measure();
        }
      }
      frameId = requestAnimationFrame(keepMeasuring);
    };
    keepMeasuring();
    return () => cancelAnimationFrame(frameId);
  }, [isArenaShowing]);
  // (on a replay's picker, the tamagotchi first for a few seconds, whatever's hovered or picked: Jamie, playtest 29)
  // (not when three are picked already as it opens: the class shows at once. Jamie, playtest 29)
  const [isTamaHeld, setIsTamaHeld] = useState(() => pickedAbilities.length < 3);
  useEffect(() => {
    const timeout = setTimeout(() => setIsTamaHeld(false), MINI_TIMING.onAtMs + TAMA_FIRST_MS);
    return () => clearTimeout(timeout);
  }, []);
  const isTamaShowing = !isClassReview && (isTamaHeld || (hovered === undefined && !playerClass));
  // Stompy waits, his clock and his happiness with it, while he can't be seen (a power's details or the class on the
  // screen instead): Jamie, playtest 35, back from reading to find Stompy Gen 2
  useEffect(() => {
    holdTamagotchi(!isTamaShowing, "unseen");
    return () => holdTamagotchi(false, "unseen");
  }, [isTamaShowing]);
  const sideScreen = (
    <>
            {/* the tamagotchi stays on (its own state), faded in and out as the rest crossfades (Jamie, playtest 29) */}
            <ClassLayer style={{ opacity: isTamaShowing ? 1 : 0, transitionDelay: isTamaShowing ? `${CROSSFADE.holdMs}ms` : "0ms", pointerEvents: isTamaShowing ? undefined : "none" }}>
              {/* (the pet's own screen lifted, a band left under it for the buttons' words: Jamie, playtest 30) */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: "3.2cqw" }}><Tamagotchi actRef={tamaRef} onPickThree={() => setPendantFlash(count => count + 1)} /></div>
              <ButtonWords />
            </ClassLayer>
            <CrossFade id={isTamaShowing ? "none" : hovered === undefined ? "class" : `power-${hovered}`} restIds={["none", "class"]}>
              {isTamaShowing ? null : <Info $isClass={hovered === undefined && !!playerClass}>{getInfo()}</Info>}
            </CrossFade>
            {/* kept while a class is picked, faded with the details (Jamie, playtest 28: it unmounted on each hover, the
                battle restarting and building itself in again from the top left) */}
            {!!playerClass && (
              <ClassLayer style={{ opacity: hovered === undefined && !isTamaShowing ? 1 : 0, transitionDelay: hovered === undefined && !isTamaShowing ? `${CROSSFADE.holdMs}ms` : "0ms", pointerEvents: hovered === undefined && !isTamaShowing ? undefined : "none" }}>
                <BattleBox ref={arenaRef} data-no-floating-words>
                  {arenaWindow && <ClassBattle powers={pickedAbilities} avatar={selectedAvatar} playWindow={arenaWindow} onCast={element => setBlinks(previous => ({ ...previous, [element]: (previous[element] || 0) + 1 }))} />}
                </BattleBox>
                {/* the class's icons, at the screen's top (Jamie) */}
                <IconGroup>
                  {pickedPowers.map(({ element, activeIcon, color }) => <Icon key={blinks[element] ? `${element}-${blinks[element]}` : element} $isBlinking={!!blinks[element]} className={`fa ${activeIcon}`} style={{ color }} />)}
                </IconGroup>
                {/* dev: the class review's buttons and where it's at */}
                {isClassReview && (
                  <>
                    <ReviewStatus>
                      {reviewIndex + 1}/{reviewKeys.length} {reviewKeys[reviewIndex]} &middot; seen {classReview.seen.length}
                      {classReview.seen.includes(reviewKeys[reviewIndex]) ? " (seen)" : ""}
                      {classReview.flagged.includes(reviewKeys[reviewIndex]) && <span> FLAGGED</span>}
                    </ReviewStatus>
                    <ButtonWords labels={["Back", "Flag", "Next"]} />
                  </>
                )}
              </ClassLayer>
            )}
    </>
  );
  // the tamagotchi's: off while the class shows
  const sideBrow = ["Feed", "Pet", "Clean up"].map(label => (
    <ButtonSlot key={label}><BrowButtonShape disabled={!isTamaShowing && !isClassReview} aria-label={label} title={label} onClick={() => isClassReview ? onReviewButton(label) : tamaRef.current && tamaRef.current(label)} /></ButtonSlot>
  ));
  const beside = (
    <>
      {import.meta.env.DEV && (
        <DevPanel>
          <label>
            dev: avatar up/down {figureDrop}
            <input type="range" min={-300} max={300} step={5} value={figureDrop} onChange={event => moveFigure(Number(event.target.value))} onKeyDown={event => event.stopPropagation()} />
          </label>
          <label><input type="checkbox" checked={isDevOpen} onChange={() => setIsDevOpen(!isDevOpen)} />dev: powers in the halo ({powers.length})</label>
          <label><input type="checkbox" checked={isClassReview} onChange={() => startClassReview(!isClassReview)} />dev: review classes on the side monitor (seen {classReview.seen.length}/{reviewKeys.length}, flagged {classReview.flagged.length})</label>
          {isClassReview && classReview.flagged.length > 0 && (
            <textarea readOnly rows={3} value={classReview.flagged.map(key => `${key}: ${(SCI_FI_CLASSES[key] || [])[0]}`).join("\n")} onKeyDown={event => event.stopPropagation()} title="Flagged for an edit: copy this list" />
          )}
          {isDevOpen && allPowers.map(({ element, activeName }) => (
            <label key={element}>
              <input type="checkbox" checked={devShown[element] ?? getIsSkillOpen(element)} onChange={event => setDevShown(shown => ({ ...shown, [element]: event.target.checked }))} />
              {activeName || element}{getIsSkillOpen(element) ? '' : ' (locked)'}
            </label>
          ))}
        </DevPanel>
      )}
    </>
  );

  return (
    <>
    <ScaleToFit width={STAGE.width} height={STAGE.height}>
      <Stage>
        <span ref={anchorRef} />
        <FadingIn>
        <Board viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="pickerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* the board: dim stubs between the pendants */}
          {stubs.map(({ key, d, pad, end }) => (
            <g key={key}>
              <path d={d} fill="none" stroke={LOOK.colors.stub} strokeWidth="2" strokeLinejoin="round" />
              <circle cx={pad.x} cy={pad.y} r="5" fill="black" stroke={LOOK.colors.stub} strokeWidth="2" />
              <circle cx={end.x} cy={end.y} r="4" fill="none" stroke={LOOK.colors.stub} strokeWidth="2" />
            </g>
          ))}
          {/* each pendant's trace, unpicked first so the lit ones lie on top */}
          {traces.map((trace, k) => ({ trace, k, power: powers[k] }))
            .sort((a, b) => Number(getIsPicked(a.power)) - Number(getIsPicked(b.power)))
            .map(({ trace, k, power }) => {
              const isPicked = getIsPicked(power);
              const isHovered = hovered === k;
              const stroke = isPicked ? power.color : isHovered ? LOOK.colors.traceHover : LOOK.colors.trace;
              return (
                <g key={power.element} filter={isPicked || isHovered ? "url(#pickerGlow)" : undefined}>
                  <path d={trace.d} fill="none" stroke={stroke} strokeWidth={isPicked ? 3.5 : 2.5} strokeLinejoin="round" />
                  <circle cx={trace.start.x} cy={trace.start.y} r="6" fill="black" stroke={stroke} strokeWidth="2.5" />
                  <circle cx={trace.end.x} cy={trace.end.y} r="6" fill="none" stroke={isPicked ? power.color : LOOK.colors.pad} strokeWidth="2.5" />
                  {isPicked && [0, 0.5].map(lag => (
                    <Bead key={lag} d={trace.d} pathLength="100" style={{ animationDelay: `${-lag * LOOK.beadMs}ms`, filter: `drop-shadow(0 0 4px ${power.color})` }} />
                  ))}
                </g>
              );
            })}
        </Board>
        </FadingIn>
        <Avatar
          style={{
            left: pctX(LOOK.torso.x - figure.middle * scale),
            top: pctY(headTop - figure.head * scale),
            width: pctX(FRAME.width * scale),
            height: pctY(FRAME.height * scale),
            backgroundImage: `url(/${figure.sheet})`,
            filter: `url(#underwater) drop-shadow(0 0 ${unit(CHOSEN_GLOW.colorPx * glowScale)} ${avatarColor}) drop-shadow(0 0 ${unit(CHOSEN_GLOW.whitePx * glowScale)} white)`
          }}
        />
        <FadingIn style={{ pointerEvents: "none" }}>
        {powers.map((power, k) => {
          const at = polar(angles[k], getPendantRadius(k));
          return (
            <Pendant
              key={power.element}
              aria-label={power.activeName}
              aria-pressed={getIsPicked(power)}
              style={{ left: pctX(at.x), top: pctY(at.y) }}
              $color={power.color}
              $isPicked={getIsPicked(power)}
              $isHovered={isPendantsLive && hovered === k}
              $isOff={!isPendantsLive}
              disabled={!isPendantsLive}
              onClick={() => isPendantsLive && togglePower(power)}
              onMouseEnter={() => isPendantsLive && setHovered(k)}
              onMouseLeave={() => setHovered(undefined)}
            >
              {pendantFlash > 0 && !getIsPicked(power) && flashOrder[k] !== undefined && (
                <PendantFlash key={`flash-${pendantFlash}`} $color={power.color} style={{ animationDelay: `${flashOrder[k] * PENDANT_FLASH.stepMs}ms` }} />
              )}
              {getIsPicked(power) && lockIns[power.getElementUppercase()] && (
                <React.Fragment key={lockIns[power.getElementUppercase()]}>
                  <ConfirmRays $color={power.color} />
                  <Orbit $color={power.color} />
                  <LockIn $color={power.color} />
                </React.Fragment>
              )}
              <i className={`fa ${power.activeIcon}`} style={{ color: power.color }} />
              {getKeyLabel(k) && <PendantKey $isPicked={getIsPicked(power)} $color={power.color}>{getKeyLabel(k)}</PendantKey>}
            </Pendant>
          );
        })}
        <PickCount>{`${pickedAbilities.length}/ ${PICK_COUNT}`}</PickCount>
        </FadingIn>
      </Stage>
    </ScaleToFit>
    {frame && createPortal(beside, frame)}
    {side && side.screen && createPortal(sideScreen, side.screen)}
    {side && side.brow && createPortal(sideBrow, side.brow)}
    </>
  );
};
