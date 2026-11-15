import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";

/*
  A monitor's power (Jamie, 2026-11-14: "sell" the Kaiju-Vision monitor). Before it is first switched on the screen
  is dead: black glass with a faint reflection. Switched on, the picture opens like an old TV, the same as the
  doodads' switch-on: a dot, a bright line across, then the whole picture. Switched off: the picture squashes to a
  bright line, the line to a dot, a sparkle flares on it, and the glass is dead again.
*/
export const CRT = { onMs: 650, offMs: 700 };

const crtOn = keyframes`
  0% { transform: scale(0.01, 0.006); filter: brightness(5); opacity: 1; }
  30% { transform: scale(1.02, 0.006); filter: brightness(4); }
  60% { transform: scale(1, 1); filter: brightness(1.8); }
  100% { transform: scale(1, 1); filter: brightness(1); }
`;

const crtOff = keyframes`
  0% { transform: scale(1, 1); filter: brightness(1); opacity: 1; }
  35% { transform: scale(1.02, 0.006); filter: brightness(3); opacity: 1; }
  62% { transform: scale(0.01, 0.006); filter: brightness(5); opacity: 1; }
  72%, 100% { transform: scale(0, 0); opacity: 0; }
`;

const sparkle = keyframes`
  0%, 55% { opacity: 0; transform: translate(-50%, -50%) scale(0.2) rotate(0deg); }
  68% { opacity: 1; transform: translate(-50%, -50%) scale(1.3) rotate(25deg); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(70deg); }
`;

// the picture: hidden while dead, opening or closing as the power comes and goes
export const PoweredPicture = styled.div`
  position: absolute;
  inset: 0;
  ${props => props.$isClipped && css`overflow: hidden; border-radius: inherit;`}
  /* (not visibility: a child setting its own visibility would show through the dead glass. Jamie found the avatar
     select's words showing before the switch-on) */
  ${props => props.$state == "dead" && css`opacity: 0; pointer-events: none;`}
  ${props => props.$state == "turningOn" && css`animation: ${crtOn} ${CRT.onMs}ms ease-out both;`}
  ${props => props.$state == "turningOff" && css`animation: ${crtOff} ${CRT.offMs}ms ease-in forwards;`}
`;

/*
  Off must look darker than on (Jamie, 2026-11-15: the dead glass was brighter than the powered picture, so switching
  on made the screen go darker). Dead: near black, only a faint reflection. On: the reflection, and a faint glow of
  lit phosphor from the middle over the picture, so switching on brightens it.
*/
const REFLECTION = opacity => `linear-gradient(125deg, transparent 20%, rgba(255, 255, 255, ${opacity}) 32%, transparent 44%)`;

// the dead screen: near-black glass, a faint reflection across it
export const DeadGlass = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background:
    ${REFLECTION(0.03)},
    radial-gradient(ellipse at 35% 30%, #08090a, #020203 70%);
`;

// the same reflection kept over the picture once it's on (Jamie: the avatar select and the power picker)
const glowUp = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Glare = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482985; /* over the picture's own layers, under the monitor's glass and casing */
  pointer-events: none;
  border-radius: inherit;
  background:
    ${REFLECTION(0.05)},
    radial-gradient(ellipse at 50% 45%, rgba(170, 190, 210, 0.07), transparent 70%);
  mix-blend-mode: screen;
  animation: ${glowUp} ${CRT.onMs}ms ease-out both;
`;

const Sparkle = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0;
  animation: ${sparkle} ${CRT.offMs}ms linear forwards;
  box-shadow: 0 0 1cqw 0.6cqw white, 0 0 2.5cqw 1.2cqw #80EF80;
  &::before, &::after {
    content: '';
    position: absolute;
    left: -6cqw;
    top: -0.2cqw;
    width: 12cqw;
    height: 0.4cqw;
    background: radial-gradient(closest-side, white, #80EF80 45%, transparent);
  }
  &::after { transform: rotate(90deg); }
`;

// the power's state from on/off: a first 'off' is dead (no switch-off), and a first 'on' is simply on
export const useCrtPower = isOn => {
  const [state, setState] = useState(isOn ? "on" : "dead");
  const last = useRef(isOn); // (a change only: React's StrictMode runs this twice on mount)
  useLayoutEffect(() => {
    if (last.current === isOn) return;
    last.current = isOn;
    if (isOn) {
      setState("turningOn");
      const timeout = setTimeout(() => setState("on"), CRT.onMs);
      return () => clearTimeout(timeout);
    }
    setState("turningOff");
    const timeout = setTimeout(() => setState("dead"), CRT.offMs);
    return () => clearTimeout(timeout);
  }, [isOn]);
  return state;
};

// a screen's picture, behind dead glass until it is switched on
// 'hasGlare': the glass's reflection stays over the picture once it's on
export const CrtScreen = ({ isOn, isClipped = false, hasGlare = false, children }) => {
  const state = useCrtPower(isOn);
  return (
    <>
      {state != "on" && <DeadGlass />}
      <PoweredPicture $state={state} $isClipped={isClipped}>{children}</PoweredPicture>
      {state == "turningOff" && <Sparkle />}
      {hasGlare && state != "dead" && <Glare />}
    </>
  );
};

// fits a fixed-size design (width x height, in px) into its parent, centered, scaled to fit
export const ScaleToFit = ({ width, height, children }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const parent = ref.current && ref.current.parentElement;
    if (!parent) return;
    const fit = () => setScale(Math.min(parent.clientWidth / width, parent.clientHeight / height) || 1);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [width, height]);
  return (
    <div ref={ref} style={{ position: "absolute", left: "50%", top: "50%", width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
      {children}
    </div>
  );
};
