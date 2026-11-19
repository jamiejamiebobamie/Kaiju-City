import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";

/*
  The buoy's flash (Jamie, 2026-11-19): the scene (not the logo, not [Press any key]) fades to white; then a sun spot
  fades in at the middle of the screen, a white star of many points, uneven in their lengths and widths, glowing; it
  holds a moment; then the white and the star fade quickly away together, and the scene is back (the Kaiju in the
  water, the embers, the helicopters coming in). The white is a touch soft (a cool pale grey) so the pure white star
  shows on it. Its times: FLASH (ms); the event starts under the full white (MainMenu: FLASH.whiteMs).
*/
export const FLASH = { whiteMs: 340, starInMs: 220, holdMs: 380, outMs: 520 };
const totalMs = FLASH.whiteMs + FLASH.starInMs + FLASH.holdMs + FLASH.outMs;
const share = ms => `${((ms / totalMs) * 100).toFixed(2)}%`;
const white = keyframes`
  0% { opacity: 0; }
  ${share(FLASH.whiteMs)} { opacity: 1; }
  ${share(FLASH.whiteMs + FLASH.starInMs + FLASH.holdMs)} { opacity: 1; }
  100% { opacity: 0; }
`;
const star = keyframes`
  0%, ${share(FLASH.whiteMs)} { opacity: 0; transform: translate(-50%, -50%) scale(0.6) rotate(-4deg); }
  ${share(FLASH.whiteMs + FLASH.starInMs)} { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  ${share(FLASH.whiteMs + FLASH.starInMs + FLASH.holdMs)} { opacity: 1; transform: translate(-50%, -50%) scale(1.06) rotate(1.5deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15) rotate(2.5deg); }
`;
const Cover = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  /* (a light cool grey all over: brighter in the middle, the white star was lost on it) */
  background: radial-gradient(circle at 50% 46%, rgb(214, 220, 233) 0%, rgb(204, 211, 227) 60%, rgb(192, 200, 219) 100%);
  animation: ${white} ${totalMs}ms ease-in-out forwards;
`;
const Star = styled.svg`
  position: fixed;
  left: 50%;
  top: 46%;
  width: min(90vw, 1150px);
  height: min(90vw, 1150px);
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  overflow: visible;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 1)) drop-shadow(0 0 14px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.9));
  animation: ${star} ${totalMs}ms ease-out forwards;
`;

// the star's points: many, at uneven angles, of uneven lengths and widths (a camera's sun star, not a drawn one)
const makeRays = () => {
  const random = (k, n) => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return [...Array(16).keys()].map(k => ({
    angle: (k / 16) * 360 + (random(k, 1) - 0.5) * 14,
    length: k % 4 == 0 ? 0.9 + random(k, 2) * 0.1 : 0.35 + random(k, 2) * 0.45,
    width: k % 4 == 0 ? 3 + random(k, 3) * 2.2 : 1.2 + random(k, 3) * 1.8
  }));
};

export const SceneFlash = () => {
  const rays = useMemo(makeRays, []);
  return (
    <>
      <Cover aria-hidden="true" />
      <Star aria-hidden="true" viewBox="-100 -100 200 200">
        <defs>
          <linearGradient id="flash-ray" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="flash-core">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {rays.map(({ angle, length, width }, k) => (
          <polygon key={k} points={`0,${-width} ${length * 100},0 0,${width}`} fill="url(#flash-ray)" transform={`rotate(${angle})`} />
        ))}
        <circle r="14" fill="url(#flash-core)" />
        <circle r="5" fill="#ffffff" />
      </Star>
    </>
  );
};
