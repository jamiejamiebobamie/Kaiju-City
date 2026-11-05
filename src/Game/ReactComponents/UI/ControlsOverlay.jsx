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

// the hands are silhouettes, each one merged shape: a skin fill over a dark outline, a little see-through
const HAND_LOOK = {
  skin: "#e2ad85",
  outline: "#3d2618",
  opacity: 0.8,
  outlineWidth: 1.3,
  fingerWidths: [3.1, 3.6, 3.8, 3.7], // pinky, ring, middle, index
  knuckleSpread: [-1.65, -0.55, 0.55, 1.6], // across the top of the palm, outer to inner, in finger widths
  knuckleDrop: [2.6, 0.7, 0, 0.6], // the pinky's knuckle sits lowest
  thumbWidth: 4.2,
  palmHalfWidth: 9.5,
  palmHalfHeight: 9,
  palmBelowTips: 24, // how far below the fingertips the middle of the palm sits
  wristLength: 16,
  wristHalfWidth: 6.5
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
      { side: "left", fingers: ["Digit1", "Digit2", "Digit3", "Digit4"], thumb: { x: 45, y: 60 } },
      { side: "right", fingers: [{ x: 166, y: 52 }, "ArrowRight", "ArrowUp", "ArrowLeft"], thumb: { x: 133, y: 77 } }
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
      { side: "left", fingers: [{ x: 11, y: 37 }, "KeyA", "KeyW", "KeyD"], thumb: { x: 45, y: 67 } },
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

const add = (a, b, scale = 1) => ({ x: a.x + b.x * scale, y: a.y + b.y * scale });

// a finger's three bones, knuckle to tip, curled a little toward the keys as fingers are when typing
const getFingerBones = (base, tip, width, bend) => {
  const joints = [base, along(base, tip, 0.48, bend), along(base, tip, 0.78, bend * 0.55), tip];
  return joints.slice(1).map((end, k) => ({ from: joints[k], to: end, width: width * (1 - k * 0.12) }));
};

/*
  A left or right hand over the keys, seen from above. The palm sits below the fingertips, along the hand's own line.
  The fingers fan from a curved row of knuckles: middle longest, pinky shortest and set lowest.
  The thumb grows from a pad low on the inner side of the palm and reaches in under the hand, toward the space bar.
  The wrist runs on down and fades out.
*/
const Hand = ({ side, fingers, thumb, id }) => {
  const tips = fingers.map(getSpot);
  const thumbTip = getSpot(thumb);
  const { palmBelowTips, palmHalfWidth, palmHalfHeight, thumbWidth, fingerWidths, knuckleSpread, knuckleDrop, wristLength, wristHalfWidth } = HAND_LOOK;
  const middleTips = { x: (tips[1].x + tips[2].x) / 2, y: (tips[1].y + tips[2].y) / 2 };
  const palm = { x: middleTips.x, y: Math.max(...tips.map(({ y }) => y)) + palmBelowTips };
  // the hand's line, from the palm up to the fingertips, and across it, toward the thumb
  const upLength = Math.hypot(middleTips.x - palm.x, middleTips.y - palm.y) || 1;
  const up = { x: (middleTips.x - palm.x) / upLength, y: (middleTips.y - palm.y) / upLength };
  const inward = side == "left" ? 1 : -1;
  const across = { x: -up.y * inward, y: up.x * inward };
  const knuckleRow = add(palm, up, palmHalfHeight * 0.9);
  const bases = tips.map((_, k) => add(add(knuckleRow, across, knuckleSpread[k] * fingerWidths[2]), up, -knuckleDrop[k]));
  const fingerBones = tips.flatMap((tip, k) => getFingerBones(bases[k], tip, fingerWidths[k], inward * (k - 1.5) * 0.5));

  const thumbBase = add(add(palm, across, palmHalfWidth * 0.75), up, -palmHalfHeight * 0.35);
  const thumbJoint = along(thumbBase, thumbTip, 0.5, -inward * 1.8);
  const thumbBones = [{ from: thumbBase, to: thumbJoint, width: thumbWidth }, { from: thumbJoint, to: thumbTip, width: thumbWidth * 0.85 }];

  const corner = (a, b) => add(add(palm, across, a * palmHalfWidth), up, b * palmHalfHeight);
  const outerTop = corner(-1, 0.75);
  const innerTop = corner(1, 0.75);
  const innerBottom = corner(0.95, -0.7);
  const outerBottom = corner(-0.9, -0.8);
  const wristInner = add(add(palm, across, wristHalfWidth), up, -(palmHalfHeight + wristLength));
  const wristOuter = add(add(palm, across, -wristHalfWidth), up, -(palmHalfHeight + wristLength));
  const top = add(palm, up, palmHalfHeight * 1.25);
  const palmPath = `M ${outerTop.x} ${outerTop.y} Q ${top.x} ${top.y} ${innerTop.x} ${innerTop.y}
    Q ${innerBottom.x + across.x * 2} ${innerBottom.y + across.y * 2} ${innerBottom.x} ${innerBottom.y}
    L ${wristInner.x} ${wristInner.y} L ${wristOuter.x} ${wristOuter.y}
    L ${outerBottom.x} ${outerBottom.y} Z`;
  const thenar = add(add(palm, across, palmHalfWidth * 0.55), up, -palmHalfHeight * 0.3);

  // every part twice: dark and a little wider first, then the skin over it, so the hand reads as one outlined shape
  const drawParts = (color, extra, fill) => (
    <>
      <path d={palmPath} fill={fill} stroke={color} strokeWidth={extra * 2} strokeLinejoin="round" />
      <ellipse cx={thenar.x} cy={thenar.y} rx={palmHalfWidth * 0.55 + extra} ry={palmHalfHeight * 0.75 + extra} fill={color} />
      {[...thumbBones, ...fingerBones].map(({ from, to, width }, k) => (
        <line key={k} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width + extra * 2} strokeLinecap="round" />
      ))}
    </>
  );
  return (
    <g opacity={HAND_LOOK.opacity} mask={`url(#${id}-fade)`}>
      <defs>
        <linearGradient id={`${id}-fadeGradient`} gradientUnits="userSpaceOnUse" x1={palm.x} y1={palm.y} x2={wristOuter.x} y2={wristOuter.y}>
          <stop offset="0.35" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="320" height="220">
          <rect x="-50" y="-50" width="320" height="220" fill={`url(#${id}-fadeGradient)`} />
        </mask>
      </defs>
      {drawParts(HAND_LOOK.outline, HAND_LOOK.outlineWidth / 2, HAND_LOOK.outline)}
      {drawParts(HAND_LOOK.skin, 0, HAND_LOOK.skin)}
    </g>
  );
};

const Keyboard = ({ page }) => (
  <svg viewBox="0 0 215 108" width="100%" role="img" aria-label={page.title}>
    <rect x={4} y={4} width={207} height={64} rx={4} fill="#1b1c20" stroke="#55585f" strokeWidth={1} />
    {Object.entries(KEYS).map(([code, { x, y, width = KEY }]) => (
      <rect key={code} x={x} y={y} width={width} height={KEY} rx={1.5} fill={page.colors[code] || KEY_COLORS.plain} stroke="#101114" strokeWidth={0.6} />
    ))}
    {page.hands.map((hand, k) => <Hand key={k} id={`hand${k}`} {...hand} />)}
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
