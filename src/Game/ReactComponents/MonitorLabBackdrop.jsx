import React from "react";
import styled, { keyframes } from "styled-components";
import { PICKER_FIGURE } from "./AbilityPicker";

/*
  Behind the avatar select and the power picker, on the main monitor only (Jamie, 2026-11-15): the Lab, darkened, a
  glass tank behind each avatar (cut from the Lab fight's picture and emptied of its Kaiju shape: lab-tank-empty.png)
  with bubbles rising in it (Jamie's disc bubbles), and a pool of light round each avatar that brightens its tank and
  the wall; brighter on hover, and for the chosen one on the picker (as the color vat's room is lit).
  One scene for both: as the chosen avatar slides and grows into its place on the picker, the whole scene goes with
  it (zoomed in on the chosen tank by as much as the avatar grows, and centered as the avatar is), so they stay lined up.
  Spots are shares of the screen, on the avatar select: the middles of the figures (measured off Jamie's screenshots).
*/
const LAB = { src: "/levels/lab.png", darkness: 0.82, darknessPicker: 0.9 };
const TANK = { src: "/levels/lab-tank-empty.png", width: 98, height: 217 };
const BUBBLES = { src: "/spritesheet/disc_bubbles.png", frames: 7, frameWidth: 177, frameHeight: 528, seconds: 2.4 };
const HANDOVER_MS = 1100; // the avatar select's slide (CHOICE.slideMs)

export const BACKDROP_SPOTS = {
  guy: { x: 0.26, y: 0.385 },
  girl: { x: 0.74, y: 0.385 },
  figureHeight: 0.217, // the figures on the avatar select, of the screen's height
  tankHeight: 0.5,
  tankRaise: 0.06, // the tank's middle above the figure's, so the avatar stands low in it (Jamie)
  light: { width: 0.2, height: 0.3 } // a pool of light's size, of the screen
};
const LIGHT = { dim: 0.6, lit: 0.95 }; // how much a pool of light lifts the darkness: at rest, and hovered or chosen

const Scene = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  transition: transform ${HANDOVER_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
  background: url(${LAB.src}) center / cover no-repeat;
  image-rendering: pixelated;
`;

const Tank = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: ${TANK.width} / ${TANK.height};
  background: url(${TANK.src}) center / 100% 100% no-repeat;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 0.6cqw rgba(120, 220, 255, 0.35));
`;

const rise = keyframes`
  from { background-position-x: 0%; }
  to { background-position-x: 100%; }
`;

// the bubbles, inside the glass (its middle part), tinted toward the water's cyan
const Bubbles = styled.div`
  position: absolute;
  left: 12%;
  right: 12%;
  top: 30%;
  bottom: 20%;
  background: url(${BUBBLES.src}) 0 0 / ${BUBBLES.frames * 100}% 100% no-repeat;
  animation: ${rise} ${BUBBLES.seconds}s steps(${BUBBLES.frames - 1}) infinite;
  image-rendering: pixelated;
  filter: hue-rotate(150deg) saturate(0.7) brightness(1.15);
  mix-blend-mode: screen;
  opacity: 0.8;
`;

const Darkness = styled.div`
  position: absolute;
  inset: -50%;
  pointer-events: none;
`;

// a hole of light in the darkness at each spot, as bright as its 'light' (0 to 1); in the darkness's own box (it
// reaches past the screen by half all round, so a zoomed-in scene stays dark at its edges)
const getMask = spots => spots.map(({ x, y, light }) => {
  const { width, height } = BACKDROP_SPOTS.light;
  const at = { x: (x + 0.5) / 2 * 100, y: (y + 0.5) / 2 * 100 };
  return `radial-gradient(ellipse ${width * 50}% ${height * 50}% at ${at.x}% ${at.y}%, rgba(0, 0, 0, ${1 - light}) 0%, rgba(0, 0, 0, ${1 - light * 0.55}) 55%, black 100%)`;
}).join(", ");

// 'mode': "choice" (two avatars) or "picker"; 'hovered': the avatar under the mouse; 'focus': the chosen one, while
// it slides to the picker and on the picker (the scene follows it there)
export const MonitorLabBackdrop = ({ mode, hovered = undefined, focus = undefined }) => {
  const spots = ["guy", "girl"].map(id => ({
    id,
    ...BACKDROP_SPOTS[id],
    light: focus ? (focus == id ? LIGHT.lit : 0) : hovered == id ? LIGHT.lit : LIGHT.dim
  }));
  const mask = getMask(spots.filter(({ light }) => light > 0));
  // following the chosen one: zoomed by as much as the avatar grows, its spot moved to the picker's
  let transform = "none";
  if (focus) {
    const k = PICKER_FIGURE.height / BACKDROP_SPOTS.figureHeight;
    const from = BACKDROP_SPOTS[focus];
    const to = { x: PICKER_FIGURE.x, y: PICKER_FIGURE.headY + PICKER_FIGURE.height / 2 };
    transform = `translate(${(to.x - k * from.x) * 100}%, ${(to.y - k * from.y) * 100}%) scale(${k})`;
  }
  const darkness = mode == "picker" ? LAB.darknessPicker : LAB.darkness;
  return (
    <Scene aria-hidden="true" style={{ transform }}>
      {spots.map(({ id, x, y }) => (
        <Tank key={id} style={{ left: `${x * 100}%`, top: `${(y - BACKDROP_SPOTS.tankRaise) * 100}%`, height: `${BACKDROP_SPOTS.tankHeight * 100}%` }}>
          <Bubbles />
        </Tank>
      ))}
      <Darkness style={{ background: `rgba(2, 4, 8, ${darkness})`, WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: "source-in", maskComposite: "intersect" }} />
    </Scene>
  );
};
