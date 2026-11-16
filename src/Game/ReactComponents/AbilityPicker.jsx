import React, { useState, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { GlobalSettingsContext } from 'Home';
import { getSciFiClass } from "../DataClasses/sciFiClasses";
import { getIsSkillOpen, OUT_OF_PLAY_POWERS } from "../DataClasses/Avatars";
import { PIECES_INFO } from "Utils/gameState";
import { Tamagotchi } from "./Tamagotchi";
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
  torso: { x: 500, y: 450 }, // the upper torso: the halo's middle
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
  right: ${(40 / STAGE.width) * 100}%;
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

const Avatar = styled.div`
  position: absolute;
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
const Pendant = styled.button`
  position: absolute;
  pointer-events: auto;
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
const MINI = { left: 69, top: 2.2, width: 28, height: 34, casing: 1.3, brow: 4.2 };
// (less tall, a thicker rim jutting out round a recessed face: Jamie). It's there from the avatar select on, so it
// stands right of the monitor in the middle ('left'), and moves under the side monitor once that's in ('leftAside')
const CONSOLE = { left: 77, leftAside: 72.5, top: 40.5, width: 22, height: 10, rim: 1.2, moveMs: 700 };
// (Jamie: after the picker's things fade in, the big monitor eases aside as the mini-monitor flies in, then the wires)
export const MINI_TIMING = { flyDelayMs: 500, flyMs: 850, onAtMs: 1400, wiresAtMs: 1600, wiresMs: 1100, consoleDelayMs: 750 };

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
  animation: ${flyIn} ${MINI_TIMING.flyMs}ms cubic-bezier(0.2, 0.9, 0.3, 1) ${MINI_TIMING.flyDelayMs}ms both;
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
  bottom: ${MINI.casing}cqw;
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
const MiniBrow = styled.div`
  position: absolute;
  left: ${MINI.casing}cqw;
  right: ${MINI.casing}cqw;
  top: 0;
  height: ${MINI.brow}cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8cqw;
`;

const BrowButton = styled.button`
  padding: 0.35cqw 0.9cqw;
  font-family: gameboy;
  font-size: 0.7cqw;
  cursor: pointer;
  border-radius: 0.35cqw;
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
  transition: left ${CONSOLE.moveMs}ms ease-in-out;
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
  animation: ${consoleRise} ${MINI_TIMING.flyMs}ms cubic-bezier(0.2, 0.9, 0.3, 1) ${MINI_TIMING.consoleDelayMs}ms both;
`;

const ConsoleFace = styled.div`
  position: relative;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.4cqw;
  /* the buttons' middle three quarters of the way down (Jamie): the face's lower half, centered */
  padding-top: ${(CONSOLE.height - 2 * CONSOLE.rim) / 2}cqw;
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

// the ready light (Jamie): at the top, five sixths of the way across; blinking red with three picked, else dark
const readyBlink = keyframes`
  0%, 55% { background: radial-gradient(circle at 40% 35%, #ffb3a8, #ff2a1a 55%, #8a0c05); box-shadow: 0 0 0.6cqw 0.15cqw #ff3a20; }
  56%, 100% { background: radial-gradient(circle at 40% 35%, #5a1a16, #2a0705 70%); box-shadow: none; }
`;
const ReadyLight = styled.span`
  position: absolute;
  left: calc(${(5 / 6) * 100}% - 0.45cqw);
  top: ${(CONSOLE.height - 2 * CONSOLE.rim) * 0.4 - 0.45}cqw; /* its middle two fifths of the way down (Jamie) */
  width: 0.9cqw;
  height: 0.9cqw;
  border-radius: 50%;
  border: 0.1cqw solid #1a1b1d;
  background: radial-gradient(circle at 40% 35%, #5a1a16, #2a0705 70%);
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

const wireDraw = keyframes`
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
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

const useArcs = (delayMs, pathRefs) => {
  const [bolts, setBolts] = useState([]);
  useEffect(() => {
    const start = performance.now();
    const lastMs = delayMs + (WIRES.length - 1) * 140 + MINI_TIMING.wiresMs + ARCS.afterMs;
    const interval = setInterval(() => {
      const now = performance.now() - start;
      const next = [];
      WIRES.forEach((wire, k) => {
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

const Wires = ({ delayMs }) => {
  const pathRefs = useRef([]);
  const bolts = useArcs(delayMs, pathRefs);
  return (
  <WireLayer viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.25" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    {WIRES.map((wire, k) => {
      const style = { animationDelay: `${delayMs + k * 140}ms` };
      const slither = (
        <animate attributeName="d" dur={`${MINI_TIMING.wiresMs / 1000}s`} begin={`${(delayMs + k * 140) / 1000}s`} fill="freeze"
          values={`${getWirePath(wire, 5)};${getWirePath(wire, -4)};${getWirePath(wire, 2)};${getWirePath(wire, 0)}`} />
      );
      return (
        <g key={k}>
          <path ref={element => { pathRefs.current[k] = element; }} d={getWirePath(wire)} pathLength="100" stroke={wire.color} strokeWidth="0.75" style={style}>{slither}</path>
          <path d={getWirePath(wire)} pathLength="100" stroke="#3b3d41" strokeWidth="0.16" style={style} transform="translate(-0.12 -0.12)">{slither}</path>
          <rect x={wire.to.x - 0.2} y={wire.to.y - 0.55} width="1.3" height="1.1" rx="0.2" fill="#2a2b2e" stroke="#4a4542" strokeWidth="0.1" style={style} />
        </g>
      );
    })}
    {bolts.map(({ key, d }) => (
      <g key={key} className="arc" filter="url(#arcGlow)">
        <path d={d} stroke={ARCS.color} strokeWidth="0.32" opacity="0.55" />
        <path d={d} stroke="white" strokeWidth="0.1" />
      </g>
    ))}
  </WireLayer>
  );
};

const Info = styled.div`
  position: absolute;
  inset: 1.4cqw 1.3cqw;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly; /* the active and the passive as far apart as the screen allows (Jamie) */
  /* the class: from a quarter of the way down the screen (Jamie) */
  ${props => props.$isClass && css`justify-content: flex-start; padding-top: ${(MINI.height - MINI.casing - MINI.brow) / 4 - 1.4}cqw;`}
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

// the class's three icons, under its description, at the right (Jamie): spaced apart
const IconGroup = styled.div`
  align-self: flex-end;
  display: flex;
  gap: 1.2cqw;
  margin-top: ${TITLE_SIZE / 2 - 0.5}cqw; /* (the part's own gap makes up the rest) */
`;

const ClassText = styled.div`
  margin-top: 1cqw; /* more room under the name (Jamie) */
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

const Icon = styled.i`
  font-size: 1.9cqw;
  filter: drop-shadow(0 0 0.2cqw currentColor);
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
  padding: 0.6cqw 1.3cqw;
  font-family: gameboy;
  font-size: 1.2cqw;
  cursor: pointer;
  border-radius: 0.45cqw;
  ${RUBBER_BUTTON}
  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
`;

const consoleWireDraw = keyframes`
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
`;
const ConsoleWireLayer = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
`;
const ConsoleWirePath = styled.path`
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 100 100;
  transition: d ${CONSOLE.moveMs}ms ease-in-out;
  animation: ${consoleWireDraw} ${MINI_TIMING.wiresMs}ms cubic-bezier(0.4, 0.1, 0.3, 1) ${MINI_TIMING.flyMs}ms both;
`;

/*
  The Play!/Back console (Jamie): there from the avatar select on (it rises in once the monitor is on), standing right
  of the monitor while that's in the middle, and moving under the side monitor as the monitor eases aside. Its one wire
  runs from its underside into the big monitor's side, following it. The light blinks once three powers are picked.
  'monitorRight': the big monitor's right edge, in the frame's units.
*/
export const PlayConsole = ({ isAside, monitorRight, isReady, playLabel, onPlay, onBack }) => {
  const left = isAside ? CONSOLE.leftAside : CONSOLE.left;
  const from = { x: left + 2.5, y: CONSOLE.top + CONSOLE.height };
  const to = { x: monitorRight, y: 50 };
  const wire = `M ${from.x} ${from.y} C ${from.x} ${from.y + 3}, ${to.x + 3} ${to.y + 1}, ${to.x} ${to.y}`;
  return (
    <>
      <ConsoleWireLayer viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
        <ConsoleWirePath pathLength="100" stroke="#0e0f10" strokeWidth="0.75" style={{ d: `path("${wire}")` }} />
        <ConsoleWirePath pathLength="100" stroke="#3b3d41" strokeWidth="0.16" style={{ d: `path("${wire}")`, transform: "translate(-0.12px, -0.12px)" }} />
      </ConsoleWireLayer>
      <Console style={{ left: `${left}cqw` }}>
        <ConsoleFace>
          {[[0.5, 0.5, 20], [null, 0.5, -35], [0.5, null, 60], [null, null, 5]].map(([screwLeft, top, turn], k) => (
            <Screw key={k} $turn={turn} style={{ left: screwLeft == null ? undefined : `${screwLeft}cqw`, right: screwLeft == null ? "0.5cqw" : undefined, top: top == null ? undefined : `${top}cqw`, bottom: top == null ? "0.5cqw" : undefined }} />
          ))}
          <ReadyLight $isOn={isReady} />
          <MetalButton disabled={!isReady} onClick={onPlay}>{playLabel}</MetalButton>
          {onBack && <MetalButton onClick={onBack}>Back</MetalButton>}
        </ConsoleFace>
      </Console>
    </>
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
  setIsTeammate = undefined
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
  // dev: the avatar's height on the screen (Jamie); kept in LOOK, so the avatar select hands over to the same spot
  const [figureDrop, setFigureDrop] = useState(LOOK.figureDrop);
  const moveFigure = drop => {
    LOOK.figureDrop = drop;
    setFigureDrop(drop);
  };
  const powers = useMemo(() => allPowers.filter(({ element }) => devShown[element] ?? getIsSkillOpen(element)), [allPowers, devShown]);
  useEffect(() => setHovered(undefined), [powers.length]);
  const [lockIns, setLockIns] = useState({}); // each power's count of being picked, to play its lock-in again
  const anchorRef = useRef(null);
  const [frame, setFrame] = useState(null);
  useLayoutEffect(() => setFrame(anchorRef.current && anchorRef.current.closest("[data-game-frame]")), []);
  const [isMiniOn, setIsMiniOn] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setIsMiniOn(true), MINI_TIMING.onAtMs);
    return () => clearTimeout(timeout);
  }, []);

  HALO_RADIUS = getHaloRadiusFor(powers.length);
  const angles = useMemo(() => powers.map((_, k) => powers.length > 1
    ? LOOK.haloStartDegrees + (k * (LOOK.haloEndDegrees - LOOK.haloStartDegrees)) / (powers.length - 1)
    : 90), [powers]);
  const traces = useMemo(() => angles.map((degrees, k) => getTrace({ degrees, radius: getPendantRadius(k) - LOOK.pendantSize / 2 - 10, across: getAcross(degrees), jog: k % 2 ? 1 : -1 })), [angles]);
  const stubs = useMemo(() => getStubs(angles), [angles]);

  const getIsPicked = power => pickedAbilities.includes(power.getElementUppercase());

  const togglePower = power => {
    const element = power.getElementUppercase();
    const isPicked = pickedAbilities.includes(element);
    if (!isPicked && pickedAbilities.length >= PICK_COUNT) return;
    const picked = (isPicked ? pickedAbilities.filter(other => other != element) : [...pickedAbilities, element]).sort((a, b) => a.localeCompare(b));
    if (!isPicked) setLockIns(counts => ({ ...counts, [element]: (counts[element] || 0) + 1 }));
    setPickedAbilities(picked);
    settingsManager.setSortedPlayerChosenAbilityElementsString(picked);
  };

  // keys: the arrows go round the halo (left toward its left end, right toward its right), Space or Enter picks
  const keyState = useRef({});
  keyState.current = { hovered, powers, togglePower };
  useEffect(() => {
    const onKey = event => {
      const { hovered, powers, togglePower } = keyState.current;
      if (!powers.length) return;
      if (event.key == "ArrowLeft" || event.key == "ArrowUp") {
        setHovered(hovered === undefined ? 0 : Math.min(powers.length - 1, hovered + 1));
      } else if (event.key == "ArrowRight" || event.key == "ArrowDown") {
        setHovered(hovered === undefined ? 0 : Math.max(0, hovered - 1));
      } else if ((event.key == " " || event.key == "Enter") && hovered !== undefined) {
        togglePower(powers[hovered]);
      } else return;
      event.preventDefault();
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
          <Part $align="left">
            <PartHeader>Active:</PartHeader>
            <FitTitleRow text={power.activeName}><Icon className={`fa ${power.activeIcon}`} style={{ color: power.color }} />{power.activeName}</FitTitleRow>
            <div style={{ color: getTint(power.color, -TINT.turnDegrees) }}>{power.activeDesc}</div>
            {power.activeEffect1 && <Effect $color={power.color}>{power.activeEffect1}</Effect>}
          </Part>
          <Part $align="right">
            <PartHeader>Passive:</PartHeader>
            <FitTitleRow text={power.passiveName}>{power.passiveName}<Icon className={`fa ${power.passiveIcon}`} style={{ color: power.color }} /></FitTitleRow>
            <div style={{ color: getTint(power.color, TINT.turnDegrees) }}>{power.passiveDesc}</div>
            {power.passiveEffect1 && <Effect $color={power.color}>{power.passiveEffect1}</Effect>}
          </Part>
        </>
      );
    }
    if (playerClass) {
      return (
        <Part $align="left">
          <PartHeader>Class:</PartHeader>
          <FitTitleRow text={playerClass[0]}>{playerClass[0]}</FitTitleRow>
          <ClassText style={{ color: getClassTint(pickedPowers.map(({ color }) => color)) }}>{playerClass[1]}</ClassText>
          <IconGroup>
            {pickedPowers.map(({ element, activeIcon, color }) => <Icon key={element} className={`fa ${activeIcon}`} style={{ color }} />)}
          </IconGroup>
        </Part>
      );
    }
    return null; // (no "Choose 3 powers" here: Jamie; "Pick three abilities" is on the main screen)
  };

  // the Kaiju tamagotchi (Jamie): on the side monitor while nothing's hovered and three aren't picked; its buttons
  // work only then (with the class showing, they're off, and its clock waits)
  const tamaRef = useRef(null);
  const isTamaShowing = hovered === undefined && !playerClass;
  const beside = (
    <>
      <Wires delayMs={MINI_TIMING.wiresAtMs} />
      <MiniMonitor>
        <MiniScreen>
          <CrtScreen isOn={isMiniOn}>
            {isTamaShowing ? <Tamagotchi actRef={tamaRef} /> : <Info $isClass={hovered === undefined && !!playerClass}>{getInfo()}</Info>}
          </CrtScreen>
          <MiniGlass />
        </MiniScreen>
        <MiniBrow>
          {/* the tamagotchi's: off while the class shows */}
          {["Feed", "Pet", "Clean up"].map(label => (
            <BrowButton key={label} disabled={!isTamaShowing} onClick={() => tamaRef.current && tamaRef.current(label)}>{label}</BrowButton>
          ))}
        </MiniBrow>
      </MiniMonitor>
      {import.meta.env.DEV && (
        <DevPanel>
          <label>
            dev: avatar up/down {figureDrop}
            <input type="range" min={-300} max={300} step={5} value={figureDrop} onChange={event => moveFigure(Number(event.target.value))} onKeyDown={event => event.stopPropagation()} />
          </label>
          <label><input type="checkbox" checked={isDevOpen} onChange={() => setIsDevOpen(!isDevOpen)} />dev: powers in the halo ({powers.length})</label>
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
            filter: `drop-shadow(0 0 ${unit(CHOSEN_GLOW.colorPx * glowScale)} ${avatarColor}) drop-shadow(0 0 ${unit(CHOSEN_GLOW.whitePx * glowScale)} white)`
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
              $isHovered={hovered === k}
              onClick={() => togglePower(power)}
              onMouseEnter={() => setHovered(k)}
              onMouseLeave={() => setHovered(undefined)}
            >
              {getIsPicked(power) && lockIns[power.getElementUppercase()] && (
                <React.Fragment key={lockIns[power.getElementUppercase()]}>
                  <ConfirmRays $color={power.color} />
                  <Orbit $color={power.color} />
                  <LockIn $color={power.color} />
                </React.Fragment>
              )}
              <i className={`fa ${power.activeIcon}`} style={{ color: power.color }} />
            </Pendant>
          );
        })}
        <PickCount>{`${pickedAbilities.length}/ ${PICK_COUNT}`}</PickCount>
        </FadingIn>
      </Stage>
    </ScaleToFit>
    {frame && createPortal(beside, frame)}
    </>
  );
};
