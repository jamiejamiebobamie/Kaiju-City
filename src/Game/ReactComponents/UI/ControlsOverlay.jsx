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

const HAND_LOOK = {
  skin: "#e8b48a",
  shade: "#c98f66", // the creases at each joint
  nail: "#f6d9c4",
  outline: "#5a3a26",
  opacity: 0.72,
  fingerWidths: [3.4, 3.9, 4.2, 4.1], // pinky, ring, middle, index
  thumbWidth: 4.6,
  palmDrop: 21, // how far below the fingertips the middle of the palm is
  palmHalfWidth: 10,
  palmHalfHeight: 9
};

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
    // each finger's key, pinky to index, and where the thumb rests. a spot can be a key or a point.
    hands: [
      { side: "left", fingers: ["Digit1", "Digit2", "Digit3", "Digit4"], thumb: { x: 50, y: 58 } },
      { side: "right", fingers: [{ x: 166, y: 52 }, "ArrowRight", "ArrowUp", "ArrowLeft"], thumb: { x: 122, y: 74 } }
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
      { side: "left", fingers: [{ x: 11, y: 37 }, "KeyA", "KeyW", "KeyD"], thumb: { x: 52, y: 64 } },
      { side: "right", fingers: [{ x: 210, y: 38 }, "Numpad6", "Numpad5", "Numpad4"], thumb: { x: 177, y: 59 } }
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

const getSpot = spot => typeof spot == "string" ? getKeyCenter(spot) : spot;

// a point 'amount' of the way from one spot to another, pushed sideways by 'bend' to curve the finger
const along = (from, to, amount, bend = 0) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + dx * amount - (dy / length) * bend, y: from.y + dy * amount + (dx / length) * bend };
};

// a finger in three bones, from its knuckle to its tip, with a crease at each joint and a nail
const Finger = ({ base, tip, width, bend }) => {
  const joints = [base, along(base, tip, 0.45, bend), along(base, tip, 0.76, bend * 0.6), tip];
  const bones = joints.slice(1).map((end, k) => ({ from: joints[k], to: end, width: width * (1 - k * 0.1) }));
  const drawBones = (color, extra) => bones.map(({ from, to, width: boneWidth }, k) => (
    <line key={k} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={boneWidth + extra} strokeLinecap="round" />
  ));
  const nail = along(tip, joints[2], 0.18);
  return (
    <g>
      {drawBones(HAND_LOOK.outline, 1.2)}
      {drawBones(HAND_LOOK.skin, 0)}
      {joints.slice(1, 3).map(({ x, y }, k) => <circle key={k} cx={x} cy={y} r={width * 0.22} fill={HAND_LOOK.shade} />)}
      <ellipse cx={nail.x} cy={nail.y} rx={width * 0.3} ry={width * 0.38} fill={HAND_LOOK.nail} />
    </g>
  );
};

// a left or right hand: the palm sits below the fingertips, the fingers fan out from its top edge, and the thumb from its inner side
const Hand = ({ side, fingers, thumb }) => {
  const tips = fingers.map(getSpot);
  const thumbTip = getSpot(thumb);
  const { palmDrop, palmHalfWidth, palmHalfHeight, thumbWidth } = HAND_LOOK;
  const palm = {
    x: tips.reduce((total, { x }) => total + x, 0) / tips.length,
    y: Math.max(...tips.map(({ y }) => y)) + palmDrop
  };
  const inward = side == "left" ? 1 : -1; // toward the thumb
  // pinky to index: across the top of the palm, from its outer edge to its inner edge
  const bases = tips.map((_, k) => ({
    x: palm.x + inward * (k - 1.5) * palmHalfWidth * 0.55,
    y: palm.y - palmHalfHeight * 0.75 + Math.abs(k - 1.8) * 0.8
  }));
  const thumbBase = { x: palm.x + inward * palmHalfWidth * 0.8, y: palm.y + palmHalfHeight * 0.1 };
  const thumbJoint = along(thumbBase, thumbTip, 0.5, -inward * 1.5);
  const palmPath = `M ${palm.x - palmHalfWidth} ${palm.y - palmHalfHeight * 0.6}
    Q ${palm.x} ${palm.y - palmHalfHeight * 1.2} ${palm.x + palmHalfWidth} ${palm.y - palmHalfHeight * 0.6}
    L ${palm.x + palmHalfWidth * 0.85} ${palm.y + palmHalfHeight}
    L ${palm.x + palmHalfWidth * 0.55} ${palm.y + palmHalfHeight * 2.4}
    L ${palm.x - palmHalfWidth * 0.55} ${palm.y + palmHalfHeight * 2.4}
    L ${palm.x - palmHalfWidth * 0.85} ${palm.y + palmHalfHeight} Z`;
  const thumbBones = [[thumbBase, thumbJoint, thumbWidth], [thumbJoint, thumbTip, thumbWidth * 0.9]];
  const drawThumb = (color, extra) => thumbBones.map(([from, to, width], k) => (
    <line key={k} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width + extra} strokeLinecap="round" />
  ));
  return (
    <g opacity={HAND_LOOK.opacity}>
      {drawThumb(HAND_LOOK.outline, 1.2)}
      <path d={palmPath} fill={HAND_LOOK.skin} stroke={HAND_LOOK.outline} strokeWidth={0.8} strokeLinejoin="round" />
      {drawThumb(HAND_LOOK.skin, 0)}
      <circle cx={thumbJoint.x} cy={thumbJoint.y} r={1} fill={HAND_LOOK.shade} />
      {tips.map((tip, k) => (
        <Finger key={k} base={bases[k]} tip={tip} width={HAND_LOOK.fingerWidths[k]} bend={inward * (k - 1.5) * 0.6} />
      ))}
    </g>
  );
};

const Keyboard = ({ page }) => (
  <svg viewBox="0 0 215 100" width="100%" role="img" aria-label={page.title}>
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
  cursor: pointer;
`;

const Panel = styled.div`
  position: relative;
  width: min(56cqw, 92%);
  padding: 1.6cqw 2cqw;
  font-family: gameboy;
  color: #e6e8ec;
  background: #111214;
  border: 0.25cqw solid #8d9097;
  box-shadow: 0 0 2cqw black;
  cursor: pointer;
  user-select: none;
`;

const CloseButton = styled.button`
  position: absolute;
  left: 0.8cqw;
  top: 0.6cqw;
  padding: 0;
  font-size: 1.8cqw;
  line-height: 1;
  cursor: pointer;
  color: #e6e8ec;
  background: none;
  border: 0;
`;

const Title = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 1.6cqw;
  margin: 0 0 1cqw 2.2cqw;
`;

const Lines = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5cqw 1.5cqw;
  margin-top: 1cqw;
  font-size: 1.05cqw;
`;

const Hint = styled.div`
  margin-top: 1.4cqw;
  text-align: right;
  font-size: 0.9cqw;
  color: #9a9da4;
`;

// a click on the panel turns the page, round and round. a click off it, or on the cross, closes it.
export const ControlsOverlay = ({ onClose }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const page = PAGES[pageIndex];
  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => {
        e.stopPropagation();
        // on to the next page; past the last, it closes. it never wraps back to the first.
        if (pageIndex < PAGES.length - 1) setPageIndex(pageIndex + 1);
        else onClose();
      }}>
        <CloseButton aria-label="Close" className="fa fa-times" onClick={e => {
          e.stopPropagation();
          onClose();
        }} />
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
        <Hint>{pageIndex < PAGES.length - 1 ? "Click for the next page." : "Click to close."} Click outside to close.</Hint>
      </Panel>
    </Backdrop>
  );
};
