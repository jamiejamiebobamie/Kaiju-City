import React from "react";
import { keyframes } from "styled-components";

/*
  The screens' way out (Jamie, playtest 22): layers slide off left at their own speeds, a parallax, and once moving
  they blur sideways (#speedBlur: a blur along x only). Put <SpeedBlurFilter /> on the screen once.
*/
export const SpeedBlurFilter = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <filter id="speedBlur" x="-50%" y="0" width="200%" height="100%"><feGaussianBlur stdDeviation="16 0" /></filter>
  </svg>
);

// 'translate', not 'transform': it adds to a layer's own transform (the Kaiju's walk keeps going as it slides)
export const slideAway = (distance, isBlurred = true) => keyframes`
  0% { translate: 0 0; filter: none; }
  22% { filter: none; }
  23% { ${isBlurred ? "filter: url(#speedBlur);" : ""} }
  100% { translate: ${distance} 0; ${isBlurred ? "filter: url(#speedBlur);" : ""} }
`;
