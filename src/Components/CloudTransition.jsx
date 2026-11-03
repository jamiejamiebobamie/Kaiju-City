import React, { useEffect, useRef } from "react";
import styled from "styled-components";

/*
  The clouds that roll across between screens, like an old cartoon's scene change.
  Two banks of puffy clouds roll in from the left and the right until they cover the whole screen.
  The next screen is set up while it is covered, and then the banks part again.
  Each bank is painted once, onto its own canvas, and then only slid across.
*/
export const CLOUD_TIMING = {
  inMs: 750, // until the screen is covered
  holdMs: 350, // covered: the next screen is made now
  outMs: 950
};

const CLOUD_LOOK = {
  rows: 6,
  bankWidth: 0.6, // of the screen: the two banks overlap in the middle
  puffSize: [0.55, 0.85], // a puff's radius, as a fraction of a row's height
  base: "#d7ebff",
  shade: "#9fc3ec", // under each puff, so they read as round
  edge: "#7ea8d8", // a soft outline, as a cartoon cloud has
  highlight: "#ffffff",
  lightX: -0.35, // where the light catches each puff, as a fraction of its radius
  lightY: -0.45
};

const Canvas = styled.canvas`
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
`;

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const random = (min, max) => min + Math.random() * (max - min);

// one round puff, lit from the top left
const drawPuff = (ctx, x, y, r) => {
  const { shade, base, highlight, lightX, lightY } = CLOUD_LOOK;
  const light = ctx.createRadialGradient(x + r * lightX, y + r * lightY, r * 0.1, x, y, r);
  light.addColorStop(0, highlight);
  light.addColorStop(0.55, base);
  light.addColorStop(1, shade);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

// a bank of clouds, facing in from one side: a solid body, with a row of puffs along its leading edge
const paintBank = (width, height, isLeft) => {
  const { rows, bankWidth, puffSize, base, edge } = CLOUD_LOOK;
  const rowHeight = height / rows;
  const maxPuff = rowHeight * puffSize[1];
  // past the middle by more than a puff, so the two banks always close the gap between them
  const bodyWidth = Math.max(width * bankWidth, width / 2 + maxPuff * 1.3);
  const bank = document.createElement("canvas");
  bank.width = Math.ceil(bodyWidth + maxPuff * 2);
  bank.height = height;
  const ctx = bank.getContext("2d");
  // painted facing right, and mirrored for the right-hand bank
  if (!isLeft) {
    ctx.translate(bank.width, 0);
    ctx.scale(-1, 1);
  }
  const rowEdges = Array.from({ length: rows }, () => bodyWidth - random(0, maxPuff * 0.8));
  // puffs along each row's leading edge, and a few between rows so the rows run together
  const puffs = [];
  rowEdges.forEach((edgeX, row) => {
    const middle = (row + 0.5) * rowHeight;
    puffs.push({ x: edgeX, y: middle, r: rowHeight * random(...puffSize) });
    puffs.push({ x: edgeX - rowHeight * 0.45, y: middle - rowHeight * 0.35, r: rowHeight * random(0.4, 0.6) });
    puffs.push({ x: edgeX - rowHeight * 0.4, y: middle + rowHeight * 0.38, r: rowHeight * random(0.4, 0.6) });
  });
  // the outline first: every puff a little larger, in the edge color
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, Math.min(...rowEdges) - rowHeight * 0.3, height);
  puffs.forEach(({ x, y, r }) => {
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, Math.min(...rowEdges) - rowHeight * 0.3 - 3, height);
  // the back puffs first, then the leading ones, so the front of the bank sits on top
  [...puffs].sort((a, b) => a.x - b.x).forEach(({ x, y, r }) => drawPuff(ctx, x, y, r));
  return { bank };
};

// how far the banks have rolled in, from 0 (off their sides) to 1 (meeting in the middle)
const getRollIn = ms => {
  const { inMs, holdMs, outMs } = CLOUD_TIMING;
  if (ms < inMs) return easeOut(ms / inMs);
  if (ms < inMs + holdMs) return 1;
  return 1 - easeIn(Math.min((ms - inMs - holdMs) / outMs, 1));
};

export const CloudTransition = ({ isPlaying }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    const { innerWidth: width, innerHeight: height } = window;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const left = paintBank(width, height, true);
    const right = paintBank(width, height, false);
    const totalMs = CLOUD_TIMING.inMs + CLOUD_TIMING.holdMs + CLOUD_TIMING.outMs;

    let frameRef;
    const startMs = performance.now();
    const draw = nowMs => {
      const ms = nowMs - startMs;
      ctx.clearRect(0, 0, width, height);
      const rollIn = getRollIn(ms);
      ctx.drawImage(left.bank, -left.bank.width * (1 - rollIn), 0);
      ctx.drawImage(right.bank, width - right.bank.width * rollIn, 0);
      if (ms < totalMs) frameRef = requestAnimationFrame(draw);
    };
    frameRef = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef);
      ctx.clearRect(0, 0, width, height);
    };
  }, [isPlaying]);

  return <Canvas ref={canvasRef} />;
};
