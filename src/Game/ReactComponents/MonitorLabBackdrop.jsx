import React from "react";
import styled from "styled-components";

/*
  Behind the avatar select and the power picker, on the main monitor only (Jamie, 2026-11-15): the Lab, darkened, a
  glass tank behind each avatar (cut from the Lab fight's picture: no empty ones yet, so they hold Kaiju shapes), and a
  pool of light round each avatar that brightens its tank and the wall behind; brighter still on hover, or for the
  chosen one on the picker (as the color vat's room is lit).
  Spots are shares of the screen: where the avatars stand (estimates, to tune).
*/
const LAB = { src: "/levels/lab.png", width: 1408, height: 768, darkness: 0.8, lightRadius: 0.32 };
// a tank in the Lab fight's picture (its top-left one), in its pixels
const TANK = { x: 63, y: 185, width: 98, height: 217 };

export const BACKDROP_SPOTS = {
  // the avatar select: the guy left, the girl right; the middles of the figures, and the tanks' height
  choice: { guy: { x: 0.256, y: 0.46 }, girl: { x: 0.744, y: 0.46 }, tankHeight: 0.5 },
  // the picker: the one chosen, in the middle
  picker: { x: 0.5, y: 0.5, tankHeight: 0.64 }
};
const LIGHT = { dim: 0.55, lit: 0.95 }; // how much a pool of light lifts the darkness: at rest, and hovered or chosen

const Scene = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: url(${LAB.src}) center / cover no-repeat;
  image-rendering: pixelated;
`;

const Tank = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: ${TANK.width} / ${TANK.height};
  background-image: url(${LAB.src});
  background-repeat: no-repeat;
  background-size: ${(LAB.width / TANK.width) * 100}% ${(LAB.height / TANK.height) * 100}%;
  background-position: ${(TANK.x / (LAB.width - TANK.width)) * 100}% ${(TANK.y / (LAB.height - TANK.height)) * 100}%;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 0.6cqw rgba(120, 220, 255, 0.35));
`;

const Darkness = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(2, 4, 8, ${LAB.darkness});
`;

// a hole of light in the darkness at each spot, as bright as its 'light' (0 to 1)
const getMask = spots => spots.map(({ x, y, light }) => {
  const r = LAB.lightRadius * 100;
  return `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(0, 0, 0, ${1 - light}) 0%, rgba(0, 0, 0, ${1 - light * 0.6}) ${r * 0.55}%, black ${r}%)`;
}).join(", ");

// 'mode': "choice" (two avatars) or "picker" (the chosen one); 'hovered': the avatar under the mouse on the select
export const MonitorLabBackdrop = ({ mode, hovered = undefined }) => {
  const spots = mode == "picker"
    ? [{ ...BACKDROP_SPOTS.picker, light: LIGHT.lit, tankHeight: BACKDROP_SPOTS.picker.tankHeight }]
    : ["guy", "girl"].map(id => ({ ...BACKDROP_SPOTS.choice[id], light: hovered == id ? LIGHT.lit : LIGHT.dim, tankHeight: BACKDROP_SPOTS.choice.tankHeight }));
  const mask = getMask(spots);
  return (
    <Scene aria-hidden="true">
      {spots.map(({ x, y, tankHeight }, k) => (
        <Tank key={k} style={{ left: `${x * 100}%`, top: `${y * 100}%`, height: `${tankHeight * 100}%` }} />
      ))}
      <Darkness style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: "source-in", maskComposite: "intersect" }} />
    </Scene>
  );
};
