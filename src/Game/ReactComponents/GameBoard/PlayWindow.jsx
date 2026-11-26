import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { WIDE_SHOT } from "Game/DataClasses/Camera";
import SAVED_WINDOW from "Game/DataClasses/playWindow.json";
import { APARTMENT_TRIAL } from "Game/DataClasses/apartmentTrial";
import { CrtScreen } from "Components/CrtPower";
import { setAudioVolume } from "Utils/audio";

/*
  A dev tool for trying out smaller play areas: the part of the game frame the board fills.
  Its edges are fractions of the frame. Tiles stay the same size, so a smaller window shows less of the level.
*/
const WINDOW_LOOK = {
  minSize: 0.25, // the smallest the window can get, as a fraction of the frame
  handleSize: 1.4, // in cqw
  handleColor: "#ffd24a"
};


export const FULL_WINDOW = { left: 0, top: 0, right: 1, bottom: 1 };

// a little taller than it is wide, with a margin above and below, on a 16:9 frame.
// left of the middle: with the HUDs beside it, the two are centered together.
export const PORTRAIT_WINDOW = { left: 0.157, top: 0.04, right: 0.623, bottom: 0.96 };

/*
  The screen's design box (Jamie, 2026-11-25; layout phase 2): today's screen shape (the saved playWindow's, on the 16:9
  frame), at the screen's full height, in its middle. The views that fill the screen (the start screen's logo and buttons,
  the avatar select, the picker, the color vat, the Lab computer, the end screen, the credits) are laid out in it, so a
  wider screen (?screen=, the apartment's 1.253) shows them at the same size and place, with more round them: their
  backgrounds and the playfield fill the whole screen. On today's screen it is the screen exactly.
  (Not a container: what inside is sized from the game frame (cqw) stays so; what is sized from its box (%, its own
  container) gets this box.)
*/
export const SCREEN_DESIGN = { aspect: ((SAVED_WINDOW.right - SAVED_WINDOW.left) * 16) / ((SAVED_WINDOW.bottom - SAVED_WINDOW.top) * 9) };
export const DesignBox = styled.div`
  position: absolute;
  inset: 0;
  margin: auto;
  height: 100%;
  aspect-ratio: ${SCREEN_DESIGN.aspect};
  max-width: 100%;
`;

// a convenience for testing sizes: the game runs the same without it
// the window as Adjust window last left it, from the repo's own file: hard-coded as soon as it is saved
/*
  Trying another screen shape (Jamie, 2026-11-24; dev only): ?screen=1.253 in the address, the monitor's casing (the
  screen and its border) that many times as wide as it's tall, for this visit only, never saved. The screen keeps its
  height and its left edge; the border stays TV_LOOK.casingWidth. (On a 16:9 frame, as the game's is.)
*/
export const getTrialScreenShape = () => {
  const shape = import.meta.env.DEV && typeof window != "undefined" ? Number(new URLSearchParams(window.location.search).get("screen")) : 0;
  if (shape > 0.3 && shape < 4) return shape;
  return APARTMENT_TRIAL && APARTMENT_TRIAL.monitor.aspect ? APARTMENT_TRIAL.monitor.aspect : undefined; // (the apartment layout's: layout phase 3)
};
// ?apartment: each camera's place across the screen, as a share of the frame's width ('alone': the centered monitor's)
export const getTrialCameraShift = isSide => {
  if (!APARTMENT_TRIAL) return 0;
  const { dx = 0 } = APARTMENT_TRIAL.cameras[isSide ? "side" : "alone"] || {};
  return dx / 1920;
};
// and the whole view zoomed out (Jamie, 2026-11-24; dev only): ?zoom=0.85, the game frame (the monitor, the side elements
// and all) that much of its size, in the middle of the screen; the room round it follows the casing, so more of it shows
export const getTrialViewZoom = () => {
  const zoom = import.meta.env.DEV && typeof window != "undefined" ? Number(new URLSearchParams(window.location.search).get("zoom")) : 0;
  if (zoom >= 0.3 && zoom <= 1) return zoom;
  return APARTMENT_TRIAL ? APARTMENT_TRIAL.screenZoom : 1; // (the apartment layout's: layout phase 3)
};
const getTrialWindow = (saved, shape) => {
  // the casing's borders, as shares of the frame's width: both sides across, the top and the bottom down
  const across = (2 * TV_LOOK.casingSide) / 100;
  const down = (TV_LOOK.casingWidth + TV_LOOK.casingBottom) / 100;
  // (the thicker side and bottom borders kept inside the game frame, which clips: the screen in from the left by the side
  // border's extra, and its bottom up by the bottom border's, so the casing's outer edges stay where they were when the
  // border was casingWidth all round. Jamie, 2026-11-25: the left border looked thinner, cut off by the frame)
  const extraSide = (TV_LOOK.casingSide - TV_LOOK.casingWidth) / 100;
  const extraBottom = ((TV_LOOK.casingBottom - TV_LOOK.casingWidth) / 100) * (16 / 9); // (as a share of the frame's height)
  const bottom = saved.bottom - extraBottom;
  const heightInWidths = (bottom - saved.top) * (9 / 16);
  const width = shape * (heightInWidths + down) - across;
  // (?apartment: the side elements' camera moved across as in the layout)
  const left = saved.left + getTrialCameraShift(true) + extraSide;
  return { ...saved, left, bottom, right: Math.min(0.995, left + width) };
};
export const loadPlayWindow = () => {
  const shape = getTrialScreenShape();
  return shape ? getTrialWindow({ ...SAVED_WINDOW }, shape) : { ...SAVED_WINDOW };
};

// on the dev server, a moment after the last change, the new shape is written over that file
let saveTimeout;
export const savePlayWindow = playWindow => {
  if (!import.meta.env.DEV || getTrialScreenShape()) return; // (a trial shape is never saved)
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fetch("/__play-window/save", { method: "POST", body: JSON.stringify(playWindow) }).catch(() => {
      // the window just won't be saved
    });
  }, 500);
};

const Window = styled.div`
  position: absolute;
  cursor: default; /* (the usual pointer on the screen; its border, which lets the mouse through, and the room round it
    have the eye, but for the buttons' hand: Utils/eyeCursor. Jamie, 2026-11-25) */
  z-index: 5; /* (the whole monitor over the hinged side units and their arms, which sit behind it: Jamie, playtest 29) */
  background: #000; /* (the room behind the monitor never shows through its screen: Jamie) */
`;

const Outline = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  outline: 0.15cqw dashed ${WINDOW_LOOK.handleColor};
`;

// an 80s-90s television around the window: a thick plastic casing, a rounded glass screen, scan lines and a rolling bar
export const TV_LOOK = {
  casingWidth: 3.2, // in cqw, the top's (chunkier, more 80s: Jamie, playtest 29; was 2.6. The screen itself unchanged)
  // the sides and the bottom thicker (Jamie, 2026-11-25: room for the speaker grilles and the volume buttons; a step
  // toward the casing's coming redesign). Was 3.2 all round
  casingSide: 4.6,
  casingBottom: 5.2,
  casingRadius: 2.7, // (a little squarer: was 3.2)
  screenRadius: 1.8,
  casing: "#1d1b1a",
  casingLight: "#4a4542",
  scanLineOpacity: 0.16,
  vignetteOpacity: 0.5,
  rollSeconds: 7, // the bright bar's trip down the screen
  rollOpacity: 0.06
};

/*
  The hologram projector (Jamie, playtest 33): a black half-sphere on the casing's right edge, low down, its other half
  sunk in the casing. Off: black glass, a dull highlight. On (the dialogue panel's hologram showing: the panel sets
  data-holo-on on the page): a green glow round its rim, and a scan line passing over it, bent by its curve.
*/
export const HOLO_DOME = { down: 0.78, radiusCqw: 0.95 };
// (Jamie, playtest 34: on the border's face, toward the viewer, a round lens in the middle of the right border; it
// was on the casing's side edge, a half dome)
const domeScan = keyframes`
  from { background-position: 0 -140%, 0 0, 0 0; }
  to { background-position: 0 240%, 0 0, 0 0; }
`;
const ProjectorDome = styled.div`
  position: absolute;
  left: calc(100% + ${TV_LOOK.casingSide / 2}cqw - ${HOLO_DOME.radiusCqw}cqw);
  top: calc(${HOLO_DOME.down * 100}% - ${HOLO_DOME.radiusCqw}cqw);
  width: ${HOLO_DOME.radiusCqw * 2}cqw;
  height: ${HOLO_DOME.radiusCqw * 2}cqw;
  z-index: 2147483002; /* (over the casing's sheen, as the name and siren are) */
  pointer-events: none;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.28), transparent 22%),
    radial-gradient(circle at 50% 50%, #1c1e1f 0%, #070808 62%, #000 100%);
  box-shadow: 0 0 0 0.12cqw #0a0a0a, 0 0 0 0.22cqw #4a4542, 0.05cqw 0.15cqw 0.3cqw rgba(0, 0, 0, 0.8);
  transition: box-shadow 300ms;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    transition: opacity 300ms;
    /* the scan line, and the lens's curve over it: fish-eye, darker toward the rim */
    background:
      linear-gradient(to bottom, transparent 44%, rgba(160, 255, 190, 0.95) 50%, transparent 56%) 0 0 / 100% 45% no-repeat,
      radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.7) 100%),
      radial-gradient(circle at 50% 50%, rgba(109, 255, 160, 0.18), transparent 70%);
    animation: ${domeScan} 1.1s ease-in-out infinite;
  }
  :root[data-holo-on] & {
    box-shadow: inset 0 0 0.35cqw rgba(109, 255, 160, 0.9), 0 0 0 0.12cqw #0a0a0a, 0 0 0 0.22cqw #4a4542, 0 0 0.8cqw rgba(109, 255, 160, 0.6);
  }
  :root[data-holo-on] &::after { opacity: 1; }
`;

// (each side its own thickness: TV_LOOK.casingWidth the top's, casingSide, casingBottom)
const CASING_INSET = `-${TV_LOOK.casingWidth}cqw -${TV_LOOK.casingSide}cqw -${TV_LOOK.casingBottom}cqw`;
const CASING_WIDTHS = `${TV_LOOK.casingWidth}cqw ${TV_LOOK.casingSide}cqw ${TV_LOOK.casingBottom}cqw`;
const TvCasing = styled.div`
  position: absolute;
  inset: ${CASING_INSET};
  z-index: 2147483000;
  pointer-events: none;
  border: solid ${TV_LOOK.casing};
  border-width: ${CASING_WIDTHS};
  border-radius: ${TV_LOOK.casingRadius}cqw;
  box-shadow:
    inset 0 0.2cqw 0 ${TV_LOOK.casingLight},
    0 0.25cqw 0 ${TV_LOOK.casingLight},
    0 0 0 0.15cqw #080808,
    0 1cqw 2.5cqw rgba(0, 0, 0, 0.8);
`;

/*
  The casing's plastic (Jamie, 2026-11-15: it looked flat): lit from above, so a little lighter along the top and
  darker toward the bottom; a soft diagonal sheen across it; and a fine grain, like molded plastic. It IS the casing's
  ring (its own color under it all), drawn over the corners' fill, under the name, siren and buttons; not over the
  screen. (Its first try lay under the corners' fill, with a light grain: a border round the border. Jamie)
*/
export const CASING_SHEEN = `
  background:
    linear-gradient(125deg, transparent 30%, rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0.02) 46%, transparent 54%),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.06), transparent 25%, transparent 65%, rgba(0, 0, 0, 0.3)),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.07'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>"),
    ${TV_LOOK.casing};
  background-size: auto, auto, 120px 120px, auto;
`;

const CasingSheen = styled.div`
  position: absolute;
  inset: ${CASING_INSET};
  z-index: 2147483001; /* the corners' fill's, drawn after it: over it, under the name, siren and buttons (…002) */
  pointer-events: none;
  padding: ${CASING_WIDTHS};
  border-radius: ${TV_LOOK.casingRadius}cqw;
  ${CASING_SHEEN}
  /* the ring only: the whole box, less its middle (the screen) */
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
`;

// fills the corners outside the rounded glass with the casing's color
const ScreenCorners = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483001;
  pointer-events: none;
  border-radius: ${TV_LOOK.screenRadius}cqw;
  box-shadow: 0 0 0 ${TV_LOOK.screenRadius}cqw ${TV_LOOK.casing}, inset 0 0 1.5cqw rgba(0, 0, 0, 0.9);
`;

const roll = keyframes`
  from { top: -15%; }
  to { top: 100%; }
`;

// over the picture: fine scan lines and a darker edge, as on curved glass
const ScreenGlass = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482990;
  overflow: hidden;
  pointer-events: none;
  border-radius: ${TV_LOOK.screenRadius}cqw;
  background:
    radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, ${TV_LOOK.vignetteOpacity}) 100%),
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, ${TV_LOOK.scanLineOpacity}) 0 1px, transparent 1px 3px);
`;

const RollingBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: 15%;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, ${TV_LOOK.rollOpacity}), transparent);
  animation: ${roll} ${TV_LOOK.rollSeconds}s linear infinite;
`;

// the bottom right of the casing: a little pixel-art emergency light. a red see-through dome on a base, with a lamp inside
// whose light turns: a bright stripe sweeps across the dome, and its beam flashes out with each pulse of the red border.
// off (no siren), it sits dark.
const SIREN_LIGHT = { seconds: 1.1 }; // the same beat as the border's pulse

// its light turns: a beam sweeping round the dome, in pixel steps
const sirenTurn = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const sirenBeam = keyframes`
  0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.6); }
  50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.15); }
`;

const SirenBox = styled.div`
  position: absolute;
  right: 1.1cqw;
  bottom: calc(-${TV_LOOK.casingBottom / 2}cqw - 0.95cqw); /* (the middle of the bottom border) */
  z-index: 2147483002;
  width: 1.9cqw;
  height: 1.9cqw;
  pointer-events: none;
  & svg {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    shape-rendering: crispEdges;
    overflow: visible;
  }
  & .turn {
    transform-origin: 6px 6px;
    animation: ${sirenTurn} ${SIREN_LIGHT.seconds}s steps(8) infinite;
  }
`;

// the beam: a soft red flash round the dome, as the turning light faces out
const SirenBeam = styled.div`
  position: absolute;
  left: 50%;
  top: 45%;
  width: 4.5cqw;
  height: 4.5cqw;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 60, 60, 0.75), rgba(255, 30, 30, 0.25) 40%, transparent 70%);
  animation: ${sirenBeam} ${SIREN_LIGHT.seconds}s ease-in-out infinite;
`;

// seen from above: a round base set into the casing, the red glass dome on it, the lamp in the middle, and its turning beam
const PIXEL_CIRCLE = (cx, r) => {
  // rows of a pixel circle: for each row, the run of pixels inside it
  const rows = [];
  for (let y = -r; y < r; y++) {
    const half = Math.round(Math.sqrt(r * r - (y + 0.5) * (y + 0.5)));
    rows.push({ x: cx - half, y: cx + y, width: half * 2 });
  }
  return rows;
};

const PixelDisc = ({ r, fill }) => PIXEL_CIRCLE(6, r).map(({ x, y, width }) => <rect key={y} x={x} y={y} width={width} height={1} fill={fill} />);

const SirenLight = ({ isOn }) => (
  <SirenBox>
    {isOn && <SirenBeam />}
    <svg viewBox="0 0 12 12">
      <defs>
        <clipPath id="sirenTop">{PIXEL_CIRCLE(6, 5).map(({ x, y, width }) => <rect key={y} x={x} y={y} width={width} height={1} />)}</clipPath>
      </defs>
      {/* the base, coming up out of the casing, with its lit rim */}
      <PixelDisc r={6} fill="#26262b" />
      <rect x="2" y="1" width="8" height="1" fill="#5c5c64" />
      {/* the dome from above: see-through red, darker when off */}
      <PixelDisc r={5} fill={isOn ? "rgba(255, 45, 45, 0.6)" : "rgba(95, 14, 18, 0.8)"} />
      {/* the turning light: a beam from the lamp out to the dome's edge */}
      {isOn && (
        <g clipPath="url(#sirenTop)">
          <g className="turn">
            <rect x="6" y="5" width="5" height="2" fill="rgba(255, 230, 215, 0.9)" />
            <rect x="6" y="4" width="4" height="4" fill="rgba(255, 150, 130, 0.35)" />
          </g>
        </g>
      )}
      {/* the lamp, and a glint on the glass */}
      <rect x="5" y="5" width="2" height="2" fill={isOn ? "#fff1ea" : "#4a1416"} />
      <rect x="3" y="3" width="1" height="1" fill="rgba(255, 255, 255, 0.5)" />
    </svg>
  </SirenBox>
);

/*
  A mock-up toward the casing's redesign (Jamie, 2026-11-25; early-90s TV / monitor):
  - speaker grilles in both side borders: rows of round holes punched into the plastic, each dark inside, shadowed
    under its top lip and catching a little light on its bottom one, so they read as holes, not dots;
  - volume buttons in the bottom border, toward the right: two round, domed buttons, "-" on the left and "+" on the
    right, faded white, and between them on the casing a faded speaker icon. They press in, and do nothing yet.
*/
/*
  (Jamie, 2026-11-25, after the first try's straight grid: curved and flowing, as late-90s monitors' grilles) slanted,
  angular slots set along a curve: the column bows, swelling in the middle and tapering to a point at both ends, each
  row a little offset from the last, the slots smaller toward the ends. Mirrored on the left. Each slot: a light lip
  under it, the dark hole, darker at its top (in shadow under the plastic).
*/
// (Jamie, 2026-11-25, fourth try: both long sides straight, parallel to the screen; the outer side runs lower than
// the inner; the bottom a straight slant from the inner side's bottom down to the outer side's, at 'bottomAngle' to the
// monitor's bottom edge; whole slots, so that slant steps, jagged) 'top': where it starts, of the screen's height (its
// low point ends above the hologram lens on the right, at HOLO_DOME.down)
const SPEAKER = { widthCqw: 3.4, heightCqw: 27, rows: 26, slot: 13, thickness: 0.55, slant: 0.32, gap: 1.6, inner: 6, bottomAngle: 35 };
const SPEAKER_SLOTS = (() => {
  const slots = [];
  const { rows, slot, thickness, slant, gap, inner, bottomAngle } = SPEAKER;
  const width = 100;
  const height = (100 * SPEAKER.heightCqw) / SPEAKER.widthCqw;
  const step = slot * gap;
  const columns = Math.floor((width - inner - 4 - slot) / step) + 1;
  const firstX = inner + slot / 2 + slot * slant;
  const lastX = firstX + (columns - 1) * step;
  // the bottom's slant: the outer side's bottom at the last row, the inner side's higher by the angle
  const rise = Math.tan((bottomAngle * Math.PI) / 180);
  const rowStep = height / rows;
  const outerBottom = height - rowStep / 2;
  const smooth = t => t * t * (3 - 2 * t);
  for (let row = 0; row < rows; row++) {
    const y = (row + 0.5) * rowStep;
    // the top rounds in over its first rows, from the inner side out
    const cap = smooth(Math.min(1, (row + 1) / 3));
    for (let column = 0; column < columns; column++) {
      const x = firstX + column * step;
      if (column > (columns - 1) * cap + 0.01) continue;
      // below the slant (the line from the inner bottom down to the outer bottom): no slot
      const slantY = outerBottom - (lastX - x) * rise;
      if (y > slantY + rowStep * 0.35) continue;
      slots.push({ x, y, length: slot, thickness: slot * thickness, slant: slant * slot });
    }
  }
  return { slots, width, height };
})();
// (Jamie, 2026-11-25: up, with even room above it, to the top border, and below it, to the hologram lens on the right
// border: the space between the screen's top and the lens's top, less the grille, split in two; 'top' no longer used)
const SpeakerBox = styled.svg`
  position: absolute;
  top: calc((${HOLO_DOME.down * 100}% - ${HOLO_DOME.radiusCqw}cqw - ${SPEAKER.heightCqw}cqw) / 2);
  width: ${SPEAKER.widthCqw}cqw;
  height: ${SPEAKER.heightCqw}cqw;
  z-index: 2147483002;
  pointer-events: none;
  overflow: visible;
`;
// one slot: a slanted, rounded parallelogram, as the plastic was punched
const getSlotPath = ({ x, y, length, thickness, slant }) => {
  const halfLength = length / 2;
  const halfThickness = thickness / 2;
  return `M${x - halfLength + slant} ${y - halfThickness} L${x + halfLength + slant} ${y - halfThickness} L${x + halfLength - slant} ${y + halfThickness} L${x - halfLength - slant} ${y + halfThickness} Z`;
};
const SpeakerGrille = ({ isMirrored = false, style = undefined }) => (
  <SpeakerBox viewBox={`0 0 ${SPEAKER_SLOTS.width} ${SPEAKER_SLOTS.height}`} preserveAspectRatio="none" style={{ ...style, transform: isMirrored ? "scaleX(-1)" : undefined }} aria-hidden="true">
    <defs>
      <linearGradient id="speakerHole" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" />
        <stop offset="0.6" stopColor="#060505" />
        <stop offset="1" stopColor="#151313" />
      </linearGradient>
    </defs>
    {/* the lips: a faint light edge just under each slot */}
    {SPEAKER_SLOTS.slots.map((slot, k) => <path key={`lip ${k}`} d={getSlotPath({ ...slot, y: slot.y + 1.6 })} fill="rgba(255, 250, 240, 0.1)" strokeLinejoin="round" stroke="rgba(255, 250, 240, 0.1)" strokeWidth="1.2" />)}
    {SPEAKER_SLOTS.slots.map((slot, k) => <path key={k} d={getSlotPath(slot)} fill="url(#speakerHole)" strokeLinejoin="round" stroke="#030303" strokeWidth="1.4" />)}
  </SpeakerBox>
);
// (Jamie, 2026-11-25: at the left of the bottom border, over-sized; they start just right of the room's Kaiju Kola can,
// which stands in front of the casing's bottom left corner: it reaches about 5.6cqw in from the screen's left edge)
// ('liftCqw': up from the bottom border's middle, to the middle of its lit part: its foot shades dark. Jamie, 2026-11-25)
// (Jamie, 2026-11-25: a little smaller, 2.3, was 2.7)
const VOLUME = { buttonCqw: 2.3, gapCqw: 3.2, leftCqw: 7, liftCqw: 0.5, craterShare: 0.62 };
const VolumeBox = styled.div`
  position: absolute;
  left: ${VOLUME.leftCqw}cqw;
  bottom: calc(-${TV_LOOK.casingBottom / 2}cqw - ${VOLUME.buttonCqw / 2}cqw + ${VOLUME.liftCqw}cqw);
  z-index: 2147483002;
  display: flex;
  align-items: center;
  gap: ${VOLUME.gapCqw / 2}cqw;
`;
/*
  A button (Jamie, 2026-11-25, its second look): a flat ring flush with the casing's face, only a fine dark seam round
  it where it's set in; in its middle a shallow crater, going in. The light comes from above and to the left, so the
  crater's top left wall is in shadow and its bottom right wall catches a little light; its floor, a touch lighter.
  Pressed, the whole button sinks a hair and the crater's shadow deepens.
*/
const VolumeButton = styled.button`
  position: relative;
  width: ${VOLUME.buttonCqw}cqw;
  height: ${VOLUME.buttonCqw}cqw;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  background: ${TV_LOOK.casing};
  box-shadow:
    0 0 0 0.07cqw #090808,
    0 0.05cqw 0 0.07cqw rgba(255, 250, 240, 0.04),
    inset 0 0.05cqw 0 rgba(255, 250, 240, 0.045);
  &:active {
    box-shadow: 0 0 0 0.07cqw #090808, inset 0 0.08cqw 0.12cqw rgba(0, 0, 0, 0.5);
  }
  &:active > span {
    box-shadow:
      inset 0.14cqw 0.2cqw 0.32cqw rgba(0, 0, 0, 0.85),
      inset -0.05cqw -0.06cqw 0.08cqw rgba(255, 250, 240, 0.035);
  }
`;
const Crater = styled.span`
  position: absolute;
  inset: ${((1 - VOLUME.craterShare) / 2) * 100}%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 58% 62%, #24211f 0%, #1c1a19 55%, #171514 100%);
  box-shadow:
    inset 0.1cqw 0.14cqw 0.22cqw rgba(0, 0, 0, 0.7),
    inset -0.05cqw -0.06cqw 0.08cqw rgba(255, 250, 240, 0.05);
  & svg {
    width: 80%;
    height: 80%;
  }
`;
/*
  The worn white print (Jamie, 2026-11-25): chipped and peeled in clean-edged bits, the way old paint lifts off plastic,
  but still easy to read. Each mark has its own chips: dark shapes cut out of it (an SVG mask).
*/
const WORN_PRINT = "rgba(232, 227, 218, 0.42)";
const Chips = ({ id, chips }) => (
  <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
    <rect width="20" height="20" fill="white" />
    {chips.map((points, k) => <polygon key={k} points={points} fill="black" />)}
  </mask>
);
// the minus and the plus: bars the same size and weight, in the middle of a 20 x 20 box
const VolumeGlyph = ({ isPlus }) => {
  const id = isPlus ? "wornPlus" : "wornMinus";
  const chips = isPlus
    ? ["3.6,8.2 6,8.2 4.9,10.1", "12.6,12 16.4,12 16.4,10.4 14.2,10.7", "8.2,3.6 10.4,3.6 8.9,5.8", "10.2,14.4 11.8,13.8 11.8,16.4 10.4,16.4"]
    : ["3.6,8.2 5.9,8.2 4.6,10.2 3.6,10.3", "11,12 14,12 12.3,10.6", "14.8,8.2 16.4,8.2 16.4,10"];
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <defs><Chips id={id} chips={chips} /></defs>
      <g mask={`url(#${id})`} fill={WORN_PRINT}>
        <rect x="4" y="8.6" width="12" height="2.8" rx="0.3" />
        {isPlus && <rect x="8.6" y="4" width="2.8" height="12" rx="0.3" />}
      </g>
    </svg>
  );
};
const VolumeIcon = () => (
  <svg viewBox="0 0 16 12" style={{ width: "2.1cqw", height: "1.6cqw" }} aria-hidden="true">
    <defs>
      <mask id="wornSpeaker" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="12">
        <rect width="16" height="12" fill="white" />
        <polygon points="1,4 2.4,4 1.6,5.3 1,5.4" fill="black" />
        <polygon points="6.2,9.4 8,9.9 8,11 7,11" fill="black" />
        <polygon points="12.5,4.2 13.6,3.8 14,5.4" fill="black" />
        <polygon points="10.2,7.4 11,6.9 11.2,8.2" fill="black" />
      </mask>
    </defs>
    <g mask="url(#wornSpeaker)">
      <path d="M1 4h3l4-3v10L4 8H1z" fill={WORN_PRINT} />
      <path d="M10 3.5q2 2.5 0 5M12 1.8q3.5 4.2 0 8.4" fill="none" stroke={WORN_PRINT} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  </svg>
);
/*
  The volume (Jamie, 2026-11-25): the -/+ buttons step it, and the screen shows it as a 90s TV did: a row of solid green
  bars along the screen's lower part, left the least, right the most, the ones it's at lit, the rest dim; over everything
  on the screen (the pause words too), for a few moments after the last press. 'VOLUME_LEVEL.value' is for the sound
  system to come (0 to 'steps').
*/
export const VOLUME_LEVEL = { value: 10, steps: 16, shownMs: 2200 };
const volumeListeners = new Set();
const stepVolume = by => {
  VOLUME_LEVEL.value = Math.max(0, Math.min(VOLUME_LEVEL.steps, VOLUME_LEVEL.value + by));
  setAudioVolume(VOLUME_LEVEL.value / VOLUME_LEVEL.steps); // (the sound effects', the music's and the loops' volume: Utils/audio)
  volumeListeners.forEach(listener => listener());
};
const VolumeControls = () => (
  <VolumeBox>
    <VolumeButton type="button" aria-label="Volume down" tabIndex={-1} onClick={() => stepVolume(-1)}><Crater><VolumeGlyph /></Crater></VolumeButton>
    <VolumeIcon />
    <VolumeButton type="button" aria-label="Volume up" tabIndex={-1} onClick={() => stepVolume(1)}><Crater><VolumeGlyph isPlus /></Crater></VolumeButton>
  </VolumeBox>
);
const VOLUME_GREEN = "#3dff4a";
const VolumeShown = styled.div`
  position: absolute;
  left: 50%;
  bottom: 16%; /* (higher and bigger: Jamie, 2026-11-25; was 9%) */
  translate: -50% 0;
  z-index: 2147483647; /* (over everything on the screen) */
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  gap: 1.2cqw;
  font-family: gameboy;
  font-size: 1.9cqw;
  letter-spacing: 0.15cqw;
  color: ${VOLUME_GREEN};
  filter: drop-shadow(0 0 0.06cqw black) drop-shadow(0.12cqw 0.12cqw 0 rgba(0, 0, 0, 0.75));
`;
const VolumeBars = styled.div`
  display: flex;
  gap: 0.42cqw;
`;
const VolumeBar = styled.div`
  width: 1.45cqw;
  height: 2.9cqw;
  background: ${props => props.$isOn ? VOLUME_GREEN : "rgba(61, 255, 74, 0.16)"};
  box-shadow: ${props => props.$isOn ? "none" : "inset 0 0 0 0.12cqw rgba(61, 255, 74, 0.45)"};
`;
const VolumeDisplay = () => {
  const [shownValue, setShownValue] = useState(undefined);
  useEffect(() => {
    let timeout;
    const onChange = () => {
      setShownValue(VOLUME_LEVEL.value);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShownValue(undefined), VOLUME_LEVEL.shownMs);
    };
    volumeListeners.add(onChange);
    return () => {
      volumeListeners.delete(onChange);
      clearTimeout(timeout);
    };
  }, []);
  if (shownValue === undefined) return null;
  return (
    <VolumeShown aria-live="polite" aria-label={`Volume ${shownValue}`}>
      <span>VOLUME</span>
      <VolumeBars>
        {Array.from({ length: VOLUME_LEVEL.steps }, (_, k) => <VolumeBar key={k} $isOn={k < shownValue} />)}
      </VolumeBars>
    </VolumeShown>
  );
};

// "Battle!": where the screen meets the casing, a red glow pulses like a siren
const sirenPulse = keyframes`
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
`;

const SirenEdge = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482995;
  pointer-events: none;
  border-radius: ${TV_LOOK.screenRadius}cqw;
  box-shadow: inset 0 0 1.6cqw 0.35cqw rgba(255, 20, 50, 0.85), inset 0 0 0.25cqw 0.12cqw #ff2a4d;
  animation: ${sirenPulse} 1.1s ease-in-out infinite;
`;


// the game's buttons, set into the top of the casing like a TV's own buttons (back at the top: Jamie, 2026-11-25, after
// trying them along the bottom)
const BezelButtons = styled.div`
  position: absolute;
  left: 2.2cqw;
  top: -2.05cqw;
  z-index: 2147483002;
  display: flex;
  gap: 0.6cqw;
`;

// set into the casing beside the buttons, like a clock radio's display
export const BezelDisplay = styled.div`
  padding: 0.2cqw 0.8cqw;
  font-family: gameboy;
  font-size: 0.85cqw;
  letter-spacing: 0.15cqw;
  white-space: nowrap;
  color: #71ff71;
  text-shadow: 0 0 0.35cqw rgba(113, 255, 113, 0.8);
  background: linear-gradient(to bottom, #020803, #0a170c);
  border: 0.1cqw solid #050505;
  border-radius: 0.25cqw;
  box-shadow: inset 0 0.12cqw 0.3cqw black, 0 0.08cqw 0 ${TV_LOOK.casingLight};
`;

// a Kaiju down (Jamie, playtest 18): a green glow pulses round the count's display for a moment, as the red one does
// round the screen while they come (not a +1 rising from it any more)
const KILL_GLOW = { seconds: 2, pulses: 3 };

const killPulse = keyframes`
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
`;

const KillGlow = styled.span`
  position: absolute;
  inset: -0.12cqw;
  pointer-events: none;
  border-radius: 0.35cqw;
  box-shadow: 0 0 0.9cqw 0.25cqw rgba(60, 255, 90, 0.85), inset 0 0 0.5cqw 0.1cqw rgba(60, 255, 90, 0.7), 0 0 0 0.1cqw #3cff5a;
  animation: ${killPulse} ${KILL_GLOW.seconds / KILL_GLOW.pulses}s ease-in-out ${KILL_GLOW.pulses} forwards;
`;

// a new key each time the count goes up, so the glow plays again; it goes once it has played
const useKillGlow = (count, isOn = true) => {
  const [glowKey, setGlowKey] = useState(undefined);
  const lastCount = useRef(count);
  useEffect(() => {
    if (isOn && count > lastCount.current) setGlowKey(count);
    lastCount.current = count;
  }, [count, isOn]);
  useEffect(() => {
    if (glowKey === undefined) return;
    const timeout = setTimeout(() => setGlowKey(undefined), KILL_GLOW.seconds * 1000);
    return () => clearTimeout(timeout);
  }, [glowKey]);
  return glowKey;
};

const CounterHolder = styled.div`
  position: relative;
`;

export const KaijuCounter = ({ count, toWin, style = undefined }) => {
  const glowKey = useKillGlow(count);
  return (
    <CounterHolder style={style}>
      <BezelDisplay>{`KAIJU ${String(count).padStart(2, "0")}/${toWin}`}</BezelDisplay>
      {glowKey !== undefined && <KillGlow key={glowKey} />}
    </CounterHolder>
  );
};

// the objective's display in the casing (Jamie): it is always there; the objective runs across it, right to left
const OBJECTIVE_TICKER = { width: "16cqw", pxPerSecond: 7 }; // how fast it runs, in cqw a second

const tickerRun = keyframes`
  from { transform: translateX(var(--from)); }
  to { transform: translateX(var(--to)); }
`;

const TickerDisplay = styled(BezelDisplay)`
  width: ${OBJECTIVE_TICKER.width};
  min-height: 1.1cqw;
  overflow: hidden;
  text-align: center;
`;

const TickerText = styled.span`
  display: inline-block;
  white-space: nowrap;
  animation: ${tickerRun} linear infinite;
`;

// 'text': the objective ('' for none: the display stays, empty). 'isKaijuCount': the Kaiju count, as before.
export const ObjectiveTicker = ({ text, isKaijuCount, count, toWin }) => {
  const glowKey = useKillGlow(count, isKaijuCount);
  // from just past the right edge to just past the left one: the run's length, in cqw (gameboy letters are about 0.85cqw)
  const textCqw = text.length * 0.85 + 2;
  const seconds = (16 + textCqw) / OBJECTIVE_TICKER.pxPerSecond;
  return (
    <CounterHolder>
      <TickerDisplay>
        {isKaijuCount
          ? `KAIJU ${String(count).padStart(2, "0")}/${toWin}`
          : text && <TickerText key={text} style={{ "--from": OBJECTIVE_TICKER.width, "--to": `-${textCqw}cqw`, animationDuration: `${seconds}s` }}>{text.toUpperCase()}</TickerText>}
      </TickerDisplay>
      {isKaijuCount && glowKey !== undefined && <KillGlow key={glowKey} />}
    </CounterHolder>
  );
};

/*
  Every button on the monitors and consoles is rubber (Jamie, 2026-11-15): matte and soft-edged, a separate part set
  through a hole in the casing, so a thin black gap shows all round it. Pressed, it sinks into the hole.
*/
export const RUBBER_BUTTON = `
  color: #b3ada7;
  background: linear-gradient(to bottom, #2b2b2d, #1a1a1c);
  border: none;
  box-shadow:
    0 0 0 0.18cqw #020202,
    inset 0 0.1cqw 0.06cqw rgba(255, 255, 255, 0.1),
    inset 0 -0.15cqw 0.25cqw rgba(0, 0, 0, 0.55);
  &:hover:not(:disabled) {
    color: #ece6e0;
  }
  &:active:not(:disabled) {
    transform: translateY(0.08cqw) scale(0.98);
    box-shadow: 0 0 0 0.18cqw #020202, inset 0 0.15cqw 0.3cqw rgba(0, 0, 0, 0.75);
  }
`;

export const BezelButton = styled.button`
  padding: 0.25cqw 0.8cqw;
  font-family: gameboy;
  font-size: 0.75cqw;
  letter-spacing: 0.1cqw;
  cursor: pointer;
  border-radius: 0.35cqw;
  ${RUBBER_BUTTON}
  /* nothing it can do here now (Jamie, playtest 23) */
  &:disabled {
    cursor: default;
    opacity: 0.4;
  }
`;

const Handle = styled.div`
  position: absolute;
  z-index: 2147483647;
  width: ${WINDOW_LOOK.handleSize}cqw;
  height: ${WINDOW_LOOK.handleSize}cqw;
  border-radius: 50%;
  background: ${WINDOW_LOOK.handleColor};
  border: 0.15cqw solid black;
  touch-action: none;
`;

// where each handle sits on the window, and which edges it moves
const HANDLES = [
  { id: "top-left", x: 0, y: 0, edges: ["left", "top"], cursor: "nwse-resize" },
  { id: "top", x: 0.5, y: 0, edges: ["top"], cursor: "ns-resize" },
  { id: "top-right", x: 1, y: 0, edges: ["right", "top"], cursor: "nesw-resize" },
  { id: "right", x: 1, y: 0.5, edges: ["right"], cursor: "ew-resize" },
  { id: "bottom-right", x: 1, y: 1, edges: ["right", "bottom"], cursor: "nwse-resize" },
  { id: "bottom", x: 0.5, y: 1, edges: ["bottom"], cursor: "ns-resize" },
  { id: "bottom-left", x: 0, y: 1, edges: ["left", "bottom"], cursor: "nesw-resize" },
  { id: "left", x: 0, y: 0.5, edges: ["left"], cursor: "ew-resize" }
];

const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

const moveEdge = (playWindow, edge, { x, y }) => {
  const { minSize } = WINDOW_LOOK;
  const { left, top, right, bottom } = playWindow;
  switch (edge) {
    case "left": return { ...playWindow, left: clamp(x, 0, right - minSize) };
    case "right": return { ...playWindow, right: clamp(x, left + minSize, 1) };
    case "top": return { ...playWindow, top: clamp(y, 0, bottom - minSize) };
    default: return { ...playWindow, bottom: clamp(y, top + minSize, 1) };
  }
};

// kept inside of the window, so a handle on the edge of the frame can still be grabbed
const getHandleSpot = fraction => `calc(${fraction * 100}% - ${fraction * WINDOW_LOOK.handleSize}cqw)`;

// 'playWindow' is the window as set. 'isOpen' opens it up to the whole frame for a wide shot.
// 'buttons' sit on the casing. with the window open there is no casing, and they show over the picture.
// 'isSiren': the red alarm glow around the screen, for a Kaiju fight
// 'isPoweredOn' (Jamie, 2026-11-14): off, the screen is dead glass; switched on or off, the picture opens or closes like an
// old TV's. 'isClipped': the picture kept inside the glass (the screens before the game: they slide about in it)
export const PlayWindow = ({ playWindow, setPlayWindow, isAdjusting, isOpen, isCut = false, buttons = null, isSiren = false, isPoweredOn = true, isClipped = false, hasGlare = false, children }) => {
  const windowRef = useRef(null);
  const { left, top, right, bottom } = isOpen ? FULL_WINDOW : playWindow;

  const dragHandle = ({ clientX, clientY, buttons }, { edges }) => {
    if (!buttons) return;
    const frame = windowRef.current.parentElement.getBoundingClientRect();
    const spot = { x: (clientX - frame.left) / frame.width, y: (clientY - frame.top) / frame.height };
    setPlayWindow(edges.reduce((next, edge) => moveEdge(next, edge, spot), playWindow));
  };

  return (
    <Window ref={windowRef} data-play-screen style={{
      left: `${left * 100}%`,
      top: `${top * 100}%`,
      width: `${(right - left) * 100}%`,
      height: `${(bottom - top) * 100}%`,
      // (the screen's share of the frame's width, for what's sized to the screen in the frame's cqw: the notices. Jamie, 2026-11-25)
      "--screen-share": right - left,
      borderRadius: `${TV_LOOK.screenRadius}cqw`,
      transition: isAdjusting || isCut ? "none" : `left ${WIDE_SHOT.pullMs}ms ease-in-out, top ${WIDE_SHOT.pullMs}ms ease-in-out, width ${WIDE_SHOT.pullMs}ms ease-in-out, height ${WIDE_SHOT.pullMs}ms ease-in-out`
    }}>
      <CrtScreen isOn={isPoweredOn} isClipped={isClipped} hasGlare={hasGlare}>{children}</CrtScreen>
      {!isOpen && <VolumeDisplay />}
      {isSiren && !isOpen && <SirenEdge />}
      <ScreenGlass><RollingBar /></ScreenGlass>
      {!isOpen && (
        <>
          <ScreenCorners />
          <TvCasing data-tv-casing />
          <ProjectorDome data-holo-dome aria-hidden="true" />
          <CasingSheen />
          {/* (no "KAIJU-VISION" on it any more: Jamie, 2026-11-25) */}
          <SpeakerGrille isMirrored style={{ left: `calc(-${TV_LOOK.casingSide / 2}cqw - ${SPEAKER.widthCqw / 2}cqw)` }} />
          <SpeakerGrille style={{ right: `calc(-${TV_LOOK.casingSide / 2}cqw - ${SPEAKER.widthCqw / 2}cqw)` }} />
          <VolumeControls />
          <SirenLight isOn={isSiren} />
        </>
      )}
      {buttons && <BezelButtons style={isOpen ? { top: "1cqw", left: "1cqw" } : undefined}>{buttons}</BezelButtons>}
      {isAdjusting && <Outline />}
      {isAdjusting && HANDLES.map(handle => (
        <Handle
          key={handle.id}
          aria-label={`Resize ${handle.id}`}
          style={{ left: getHandleSpot(handle.x), top: getHandleSpot(handle.y), cursor: handle.cursor }}
          onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={e => dragHandle(e, handle)}
        />
      ))}
    </Window>
  );
};
