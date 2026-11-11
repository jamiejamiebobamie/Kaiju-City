import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { WIDE_SHOT } from "Game/DataClasses/Camera";
import SAVED_WINDOW from "Game/DataClasses/playWindow.json";

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

// a convenience for testing sizes: the game runs the same without it
// the window as Adjust window last left it, from the repo's own file: hard-coded as soon as it is saved
export const loadPlayWindow = () => ({ ...SAVED_WINDOW });

// on the dev server, a moment after the last change, the new shape is written over that file
let saveTimeout;
export const savePlayWindow = playWindow => {
  if (!import.meta.env.DEV) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fetch("/__play-window/save", { method: "POST", body: JSON.stringify(playWindow) }).catch(() => {
      // the window just won't be saved
    });
  }, 500);
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
  bottom: -2.15cqw;
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
