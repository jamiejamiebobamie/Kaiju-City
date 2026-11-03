import React, { useState } from "react";
import styled from "styled-components";

/*
  How to play, in two pages: hands over a drawn keyboard, and what the keys do.
  Page one: the number row and the arrow keys. Page two: WASD and the numpad.
*/
const KEY_COLORS = {
  player: "#55aaff",
  teammate: "#fff755",
  recruit: "#68e33b",
  move: "#ff9f43",
  plain: "#3a3d44"
};

const HAND_LOOK = { skin: "#e8b48a", outline: "#5a3a26", fingerWidth: 5, opacity: 0.6 };

const KEY = 10; // one key, in drawing units
const STEP = 11;

// where every key the overlay shows sits on the drawn keyboard
const KEYS = {
  ...Object.fromEntries("1234567890".split("").map((label, i) => [`Digit${label}`, { label, x: 10 + i * STEP, y: 10 }])),
  ...Object.fromEntries("QWERTYUIOP".split("").map((label, i) => [`Key${label}`, { label, x: 15 + i * STEP, y: 21 }])),
  ...Object.fromEntries("ASDFGHJKL".split("").map((label, i) => [`Key${label}`, { label, x: 18 + i * STEP, y: 32 }])),
  ...Object.fromEntries("ZXCVBNM".split("").map((label, i) => [`Key${label}`, { label, x: 23 + i * STEP, y: 43 }])),
  ArrowUp: { label: "▲", x: 140, y: 43 },
  ArrowLeft: { label: "◀", x: 129, y: 54 },
  ArrowDown: { label: "▼", x: 140, y: 54 },
  ArrowRight: { label: "▶", x: 151, y: 54 },
  ...Object.fromEntries([7, 8, 9, 4, 5, 6, 1, 2, 3].map((n, i) => [`Numpad${n}`, { label: `${n}`, x: 172 + (i % 3) * STEP, y: 21 + Math.floor(i / 3) * STEP }])),
  Numpad0: { label: "0", x: 172, y: 54, width: KEY + STEP }
};

const PAGES = [
  {
    title: "Number keys and arrows",
    colors: {
      ...Object.fromEntries([1, 2, 3].map(n => [`Digit${n}`, KEY_COLORS.player])),
      ...Object.fromEntries([4, 5, 6].map(n => [`Digit${n}`, KEY_COLORS.teammate])),
      ...Object.fromEntries([7, 8, 9].map(n => [`Digit${n}`, KEY_COLORS.recruit])),
      ...Object.fromEntries(["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].map(code => [code, KEY_COLORS.move]))
    },
    // the keys each hand's fingertips rest on
    hands: [
      { tips: ["Digit1", "Digit2", "Digit3", "Digit4"] },
      { tips: ["ArrowLeft", "ArrowUp", "ArrowRight"] }
    ],
    lines: [
      { keys: "1 2 3", text: "Your powers", color: KEY_COLORS.player },
      { keys: "4 5 6", text: "Your teammate's powers", color: KEY_COLORS.teammate },
      { keys: "7 8 9", text: "Call in a recruit", color: KEY_COLORS.recruit },
      { keys: "Arrows", text: "Move", color: KEY_COLORS.move }
    ]
  },
  {
    title: "WASD and the numpad",
    colors: {
      ...Object.fromEntries(["KeyW", "KeyA", "KeyS", "KeyD"].map(code => [code, KEY_COLORS.move])),
      ...Object.fromEntries([1, 2, 3].map(n => [`Numpad${n}`, KEY_COLORS.player])),
      ...Object.fromEntries([4, 5, 6].map(n => [`Numpad${n}`, KEY_COLORS.teammate])),
      ...Object.fromEntries([7, 8, 9].map(n => [`Numpad${n}`, KEY_COLORS.recruit]))
    },
    hands: [
      { tips: ["KeyA", "KeyW", "KeyD"] },
      { tips: ["Numpad4", "Numpad5", "Numpad6"] }
    ],
    lines: [
      { keys: "W A S D", text: "Move", color: KEY_COLORS.move },
      { keys: "Numpad 1 2 3", text: "Your powers", color: KEY_COLORS.player },
      { keys: "Numpad 4 5 6", text: "Your teammate's powers", color: KEY_COLORS.teammate },
      { keys: "Numpad 7 8 9", text: "Call in a recruit", color: KEY_COLORS.recruit }
    ]
  }
];

const getKeyCenter = code => {
  const { x, y, width = KEY } = KEYS[code];
  return { x: x + width / 2, y: y + KEY / 2 };
};

// fingers reach up from the palm to their keys; drawn twice, a little wider underneath, for an outline
const Hand = ({ tips }) => {
  const fingers = tips.map(getKeyCenter);
  const palm = {
    x: fingers.reduce((total, { x }) => total + x, 0) / fingers.length,
    y: Math.max(...fingers.map(({ y }) => y)) + 22
  };
  const drawFingers = (color, width) => fingers.map(({ x, y }, k) => (
    <line key={k} x1={palm.x + (x - palm.x) * 0.35} y1={palm.y - 6} x2={x} y2={y} stroke={color} strokeWidth={width} strokeLinecap="round" />
  ));
  return (
    <g opacity={HAND_LOOK.opacity}>
      {drawFingers(HAND_LOOK.outline, HAND_LOOK.fingerWidth + 1.6)}
      <ellipse cx={palm.x} cy={palm.y} rx={14} ry={9} fill={HAND_LOOK.skin} stroke={HAND_LOOK.outline} strokeWidth={0.8} />
      {drawFingers(HAND_LOOK.skin, HAND_LOOK.fingerWidth)}
    </g>
  );
};

const Keyboard = ({ page }) => (
  <svg viewBox="0 0 215 96" width="100%" role="img" aria-label={page.title}>
    <rect x={4} y={4} width={207} height={64} rx={4} fill="#1b1c20" stroke="#55585f" strokeWidth={1} />
    {Object.entries(KEYS).map(([code, { x, y, width = KEY }]) => (
      <rect key={code} x={x} y={y} width={width} height={KEY} rx={1.5} fill={page.colors[code] || KEY_COLORS.plain} stroke="#101114" strokeWidth={0.6} />
    ))}
    {page.hands.map((hand, k) => <Hand key={k} {...hand} />)}
    {/* the labels go over the hands, so every key can still be read */}
    {Object.entries(KEYS).map(([code, { label, x, y, width = KEY }]) => (
      <text key={code} x={x + width / 2} y={y + 7} textAnchor="middle" fontSize={5} fontFamily="gameboy" fill={page.colors[code] ? "#101018" : "#9a9da4"}>{label}</text>
    ))}
  </svg>
);

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
`;

const Panel = styled.div`
  width: min(56cqw, 92%);
  padding: 1.6cqw 2cqw;
  font-family: gameboy;
  color: #e6e8ec;
  background: #111214;
  border: 0.25cqw solid #8d9097;
  box-shadow: 0 0 2cqw black;
`;

const Title = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 1.6cqw;
  margin-bottom: 1cqw;
`;

const Lines = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5cqw 1.5cqw;
  margin-top: 1cqw;
  font-size: 1.05cqw;
`;

const Buttons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1cqw;
  margin-top: 1.4cqw;
`;

const PanelButton = styled.button`
  padding: 0.5cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1cqw;
  cursor: pointer;
  color: #dfe;
  background: #376e5b;
  border: 0.2cqw solid #5a8a7a;
  &:disabled {
    cursor: default;
    opacity: 0.4;
  }
`;

export const ControlsOverlay = ({ onClose }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const page = PAGES[pageIndex];
  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Title>
          <span>Controls: {page.title}</span>
          <span>{pageIndex + 1} / {PAGES.length}</span>
        </Title>
        <Keyboard page={page} />
        <Lines>
          {page.lines.map(({ keys, text, color }) => (
            <React.Fragment key={keys}>
              <span style={{ color }}>{keys}</span>
              <span>{text}</span>
            </React.Fragment>
          ))}
        </Lines>
        <Buttons>
          <PanelButton disabled={pageIndex == 0} onClick={() => setPageIndex(pageIndex - 1)}>Back</PanelButton>
          {pageIndex < PAGES.length - 1
            ? <PanelButton onClick={() => setPageIndex(pageIndex + 1)}>Next</PanelButton>
            : <PanelButton onClick={onClose}>Done</PanelButton>}
        </Buttons>
      </Panel>
    </Backdrop>
  );
};
