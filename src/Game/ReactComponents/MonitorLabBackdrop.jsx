import React, { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";
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

/*
  The whole scene down a little (Jamie: the gap between each name and number on his line), "Choose your character"
  left where it is: the Lab picture, the tanks, their light and the avatars (AvatarChoice moves its row as much), as a
  share of the screen's height. The spots below are before it.
*/
export const SCENE_DROP = 0.072;

export const BACKDROP_SPOTS = {
  guy: { x: 0.26, y: 0.358 + SCENE_DROP }, // (up with the avatars, their heads to Jamie's line; were 0.385)
  girl: { x: 0.74, y: 0.358 + SCENE_DROP },
  figureHeight: 0.217, // the figures on the avatar select, of the screen's height
  tankHeight: 0.5,
  tankRaise: 0.033, // the tank's middle above the figure's (the tanks where they were, the avatars higher in them)
  light: { width: 0.2, height: 0.3 } // a pool of light's size, of the screen
};
const LIGHT = { dim: 0.6, lit: 0.95 }; // how much a pool of light lifts the darkness: at rest, and hovered or chosen

const Scene = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  transition: transform ${HANDOVER_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
  background: #050608;
`;

// the Lab picture, down with the scene (above it, the dark of the room's ceiling)
const LabPicture = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: ${SCENE_DROP * 100}%;
  height: 100%;
  background: url(${LAB.src}) center / cover no-repeat;
  image-rendering: pixelated;
`;

// a tank's place, empty (the front layer's bubbles)
const TankPlace = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: ${TANK.width} / ${TANK.height};
`;

const Tank = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: ${TANK.width} / ${TANK.height};
  background: url(${TANK.src}) center / 100% 100% no-repeat;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 0.6cqw rgba(120, 220, 255, 0.35));
`;

const fadeAway = keyframes`
  from { opacity: 0.8; }
  to { opacity: 0; }
`;

const rise = keyframes`
  from { background-position-x: 0%; }
  to { background-position-x: 100%; }
`;

// a burst of bubbles, inside the glass, tinted toward the water's cyan: played once where it's put
const Bubbles = styled.div`
  position: absolute;
  width: 60%;
  top: 30%;
  bottom: 20%;
  transform: translateX(-50%);
  background: url(${BUBBLES.src}) 0 0 / ${BUBBLES.frames * 100}% 100% no-repeat;
  animation: ${rise} ${BUBBLES.seconds}s steps(${BUBBLES.frames - 1}) forwards${props => props.$isFading ? css`, ${fadeAway} ${BUBBLES.seconds}s linear forwards` : ""};
  image-rendering: pixelated;
  filter: hue-rotate(150deg) saturate(0.7) brightness(1.15);
  mix-blend-mode: screen;
  opacity: 0.8;
`;

// bursts at random (Jamie): each tank its own, every 1 to 3 s after the last, at a spot across the glass
const BURSTS = { gapMs: [1000, 3000], across: [0.32, 0.68] };
const between = ([low, high]) => low + Math.random() * (high - low);

// 'isFading': fainter as it plays (the ones over the avatars: Jamie)
const BubbleBursts = ({ scale = 1, isFading = false }) => {
  const [burst, setBurst] = useState(undefined); // { k, x }
  useEffect(() => {
    let timeout;
    let k = 0;
    const next = () => {
      timeout = setTimeout(() => {
        k += 1;
        setBurst({ k, x: between(BURSTS.across) });
        timeout = setTimeout(() => {
          setBurst(undefined);
          next();
        }, BUBBLES.seconds * 1000);
      }, between(BURSTS.gapMs));
    };
    next();
    return () => clearTimeout(timeout);
  }, []);
  return burst ? <Bubbles key={burst.k} $isFading={isFading} style={{ left: `${burst.x * 100}%`, width: `${60 * scale}%` }} /> : null;
};

// the avatars in the water: a slow wobble, an svg filter the avatars use (url(#underwater))
const UnderwaterFilter = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <filter id="underwater" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.045" numOctaves="2" seed="3" result="ripple">
        <animate attributeName="baseFrequency" dur="6s" values="0.012 0.045;0.016 0.055;0.012 0.045" repeatCount="indefinite" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="ripple" scale="5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);

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

/*
  The camera's move onto the chosen one (the select's whole scene goes with it: the backdrop, and the avatar select
  itself, so the chosen avatar lands where the picker's stands): zoomed by as much as the avatar grows, its spot moved
  to the picker's. For a box filling the screen, from its top left corner.
*/
export const getFocusTransform = focus => {
  if (!focus) return "none";
  const k = PICKER_FIGURE.height / BACKDROP_SPOTS.figureHeight;
  const from = BACKDROP_SPOTS[focus];
  const to = { x: PICKER_FIGURE.x, y: PICKER_FIGURE.headY + PICKER_FIGURE.height / 2 };
  return `translate(${(to.x - k * from.x) * 100}%, ${(to.y - k * from.y) * 100}%) scale(${k})`;
};
export const FOCUS_MOVE = `transform ${HANDOVER_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

// 'mode': "choice" (two avatars) or "picker"; 'hovered': the avatar under the mouse; 'focus': the chosen one, while
// it slides to the picker and on the picker (the scene follows it there). 'layer': "back" (the Lab, the tanks, the
// light) under the avatars, or "front" (only some of the bubbles) over them, in step with it
export const MonitorLabBackdrop = ({ mode, hovered = undefined, focus = undefined, layer = "back" }) => {
  const spots = ["guy", "girl"].map(id => ({
    id,
    ...BACKDROP_SPOTS[id],
    light: focus ? (focus == id ? LIGHT.lit : 0) : hovered == id ? LIGHT.lit : LIGHT.dim
  }));
  const mask = getMask(spots.filter(({ light }) => light > 0));
  const transform = getFocusTransform(focus);
  const darkness = mode == "picker" ? LAB.darknessPicker : LAB.darkness;
  if (layer == "front") {
    return (
      <Scene aria-hidden="true" style={{ transform, background: "none", pointerEvents: "none", zIndex: 7 }}>
        {spots.map(({ id, x, y }) => (
          <TankPlace key={id} style={{ left: `${x * 100}%`, top: `${(y - BACKDROP_SPOTS.tankRaise) * 100}%`, height: `${BACKDROP_SPOTS.tankHeight * 100}%` }}>
            <BubbleBursts scale={0.7} isFading />
          </TankPlace>
        ))}
      </Scene>
    );
  }
  return (
    <Scene aria-hidden="true" style={{ transform }}>
      <LabPicture />
      <UnderwaterFilter />
      {spots.map(({ id, x, y }) => (
        <Tank key={id} style={{ left: `${x * 100}%`, top: `${(y - BACKDROP_SPOTS.tankRaise) * 100}%`, height: `${BACKDROP_SPOTS.tankHeight * 100}%` }}>
          <BubbleBursts />
        </Tank>
      ))}
      <Darkness style={{ background: `rgba(2, 4, 8, ${darkness})`, WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: "source-in", maskComposite: "intersect" }} />
    </Scene>
  );
};
