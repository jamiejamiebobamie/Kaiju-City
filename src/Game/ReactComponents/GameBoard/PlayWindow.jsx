import React, { useRef } from "react";
import styled from "styled-components";
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

const STORAGE_KEY = "kaiju-play-window";

export const FULL_WINDOW = { left: 0, top: 0, right: 1, bottom: 1 };

// a little taller than it is wide, with a margin above and below, on a 16:9 frame
export const PORTRAIT_WINDOW = { left: 0.267, top: 0.04, right: 0.733, bottom: 0.96 };

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

// grey plating around the window, like the player HUDs
const Plating = styled.div`
  position: absolute;
  inset: -0.9cqw;
  z-index: 2147483000;
  pointer-events: none;
  border: 0.9cqw solid;
  border-image: linear-gradient(135deg, #74777e, #26282c 22%, #55585f 48%, #1c1d21 72%, #6a6d74) 1;
  box-shadow: 0 0 0 0.12cqw #08080a, inset 0 0 0 0.12cqw #08080a, 0 0 1cqw black;
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
export const PlayWindow = ({ playWindow, setPlayWindow, isAdjusting, isOpen, children }) => {
  const windowRef = useRef(null);
  const { left, top, right, bottom } = isOpen ? FULL_WINDOW : playWindow;

  const dragHandle = ({ clientX, clientY, buttons }, { edges }) => {
    if (!buttons) return;
    const frame = windowRef.current.parentElement.getBoundingClientRect();
    const spot = { x: (clientX - frame.left) / frame.width, y: (clientY - frame.top) / frame.height };
    setPlayWindow(edges.reduce((next, edge) => moveEdge(next, edge, spot), playWindow));
  };

  return (
    <Window ref={windowRef} style={{
      left: `${left * 100}%`,
      top: `${top * 100}%`,
      width: `${(right - left) * 100}%`,
      height: `${(bottom - top) * 100}%`,
      transition: isAdjusting ? "none" : `left ${WIDE_SHOT.pullMs}ms ease-in-out, top ${WIDE_SHOT.pullMs}ms ease-in-out, width ${WIDE_SHOT.pullMs}ms ease-in-out, height ${WIDE_SHOT.pullMs}ms ease-in-out`
    }}>
      {children}
      {!isOpen && <Plating />}
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
