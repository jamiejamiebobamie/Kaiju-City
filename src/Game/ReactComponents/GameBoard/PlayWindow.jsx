import React, { useRef } from "react";
import styled, { keyframes } from "styled-components";
import { WIDE_SHOT } from "Game/DataClasses/Camera";

/*
  A dev tool for trying out smaller play areas: the part of the game frame the board fills.
  Its edges are fractions of the frame. Tiles stay the same size, so a smaller window shows less of the level.
*/
const WINDOW_LOOK = {
  minSize: 0.25, // the smallest the window can get, as a fraction of the frame
  handleSize: 1.4, // in cqw
  handleColor: "#ffd24a"
};

const STORAGE_KEY = "kaiju-play-window-2"; // a new key: the old saved windows sat in the middle, without room for the HUDs

export const FULL_WINDOW = { left: 0, top: 0, right: 1, bottom: 1 };

// a little taller than it is wide, with a margin above and below, on a 16:9 frame.
// left of the middle: with the HUDs beside it, the two are centered together.
export const PORTRAIT_WINDOW = { left: 0.157, top: 0.04, right: 0.623, bottom: 0.96 };

// a convenience for testing sizes: the game runs the same without it
export const loadPlayWindow = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || PORTRAIT_WINDOW;
  } catch {
    return PORTRAIT_WINDOW;
  }
};

export const savePlayWindow = playWindow => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playWindow));
  } catch {
    // the window just won't be remembered
  }
};

const Window = styled.div`
  position: absolute;
`;

const Outline = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  outline: 0.15cqw dashed ${WINDOW_LOOK.handleColor};
`;

// an 80s-90s television around the window: a thick plastic casing, a rounded glass screen, scan lines and a rolling bar
const TV_LOOK = {
  casingWidth: 2.6, // in cqw
  casingRadius: 3.2,
  screenRadius: 1.8,
  casing: "#1d1b1a",
  casingLight: "#4a4542",
  scanLineOpacity: 0.16,
  vignetteOpacity: 0.5,
  rollSeconds: 7, // the bright bar's trip down the screen
  rollOpacity: 0.06
};

const TvCasing = styled.div`
  position: absolute;
  inset: -${TV_LOOK.casingWidth}cqw;
  z-index: 2147483000;
  pointer-events: none;
  border: ${TV_LOOK.casingWidth}cqw solid ${TV_LOOK.casing};
  border-radius: ${TV_LOOK.casingRadius}cqw;
  box-shadow:
    inset 0 0.2cqw 0 ${TV_LOOK.casingLight},
    0 0.25cqw 0 ${TV_LOOK.casingLight},
    0 0 0 0.15cqw #080808,
    0 1cqw 2.5cqw rgba(0, 0, 0, 0.8);
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

const PowerLight = styled.div`
  position: absolute;
  right: 1.6cqw;
  bottom: -1.7cqw;
  z-index: 2147483002;
  width: 0.5cqw;
  height: 0.5cqw;
  border-radius: 50%;
  background: #ff3b30;
  box-shadow: 0 0 0.5cqw #ff3b30;
  pointer-events: none;
`;

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

// at the left of the bottom edge, clear of the recruit buttons in the middle
const BrandName = styled.div`
  position: absolute;
  left: 1.6cqw;
  bottom: -1.95cqw;
  z-index: 2147483002;
  font-family: gameboy;
  font-size: 0.8cqw;
  letter-spacing: 0.25cqw;
  color: #8c8580;
  pointer-events: none;
`;

// the game's buttons, set into the top of the casing like a TV's own buttons
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

export const BezelButton = styled.button`
  padding: 0.25cqw 0.8cqw;
  font-family: gameboy;
  font-size: 0.75cqw;
  letter-spacing: 0.1cqw;
  cursor: pointer;
  color: #a39b95;
  background: linear-gradient(to bottom, #2c2927, #121110);
  border: 0.1cqw solid #050505;
  border-radius: 0.3cqw;
  box-shadow: inset 0 0.08cqw 0 ${TV_LOOK.casingLight}, 0 0.12cqw 0 #050505;
  &:hover {
    color: #e6e0da;
  }
  &:active {
    transform: translateY(0.1cqw);
    box-shadow: inset 0 0.08cqw 0 #050505;
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
export const PlayWindow = ({ playWindow, setPlayWindow, isAdjusting, isOpen, isCut = false, buttons = null, isSiren = false, children }) => {
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
      transition: isAdjusting || isCut ? "none" : `left ${WIDE_SHOT.pullMs}ms ease-in-out, top ${WIDE_SHOT.pullMs}ms ease-in-out, width ${WIDE_SHOT.pullMs}ms ease-in-out, height ${WIDE_SHOT.pullMs}ms ease-in-out`
    }}>
      {children}
      {isSiren && !isOpen && <SirenEdge />}
      <ScreenGlass><RollingBar /></ScreenGlass>
      {!isOpen && (
        <>
          <ScreenCorners />
          <TvCasing />
          <BrandName>KAIJU-VISION</BrandName>
          <PowerLight />
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
