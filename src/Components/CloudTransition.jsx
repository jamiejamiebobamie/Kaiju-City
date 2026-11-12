import React, { useEffect, useRef } from "react";
import styled from "styled-components";

/*
  The clouds that sweep across between screens, drawn on one canvas: the original strips.
  Each strip slides in from its own side, meets the others in the middle, and slides back.
  Lit by the sun from above: bright white at the top of the screen to a deeper blue below.
  Each strip has its own outline, lit the same way, so the rows read as layered banks of cloud, not one mass.
  So the change of scene is never seen, the strips all meet at about the same time, and a bank of the same cloud
  fills in behind them while they meet. The scene changes at the middle of that.
*/
const CLOUD_LOOK = {
  topColor: "#ffffff",
  bottomColor: "#5d8fd6",
  outlineTopColor: "#b9d3f2", // the outlines: pale where the sun catches them, deep blue below
  outlineBottomColor: "#22467f",
  outlineWidth: 5,
  puffSize: 120, // the bank behind the strips is puffs, outlined too
  puffStep: 92,
  strips: 60,
  minSeconds: 2.6, // close together, so the strips meet at nearly the same moment
  maxSeconds: 3,
  stripHeight: 150,
  rowHeight: 40, // strips overlap, two to a row
  coveredHeight: 1050, // on taller screens the strips scale up
  bankStart: 0.36, // the bank behind the strips, as fractions of the shortest strip's trip
  bankFull: 0.44,
  bankEnd: 0.62
};

// the scene changes when the strips meet: 'inMs' after the clouds start
export const CLOUD_TIMING = {
  inMs: Math.round(CLOUD_LOOK.minSeconds * 0.5 * 1000),
  // the whole screen covered: the slowest strip has met the others too. the next screen is made only then (Jamie,
  // playtest 22: it showed through before the clouds had closed)
  coveredMs: Math.round(CLOUD_LOOK.maxSeconds * 0.5 * 1000) + 30,
  holdMs: 0,
  outMs: Math.round((CLOUD_LOOK.maxSeconds - CLOUD_LOOK.minSeconds * 0.5) * 1000)
};

const Canvas = styled.canvas`
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
`;

const easeInOut = t => t * t * (3 - 2 * t);
const lerp = (from, to, t) => from + (to - from) * easeInOut(t);

// how far in from its side a strip's near end is, and how wide it is, as fractions of the screen
const getStripShape = (progress, narrowWidth) => {
  const meeting = 0.45;
  if (progress < meeting) {
    const t = progress / meeting;
    return { inset: lerp(-1, 0.25, t), width: lerp(1, narrowWidth, t) };
  }
  if (progress < 0.5) return { inset: lerp(0.25, 0.5, (progress - meeting) / 0.05), width: narrowWidth };
  if (progress < 0.55) return { inset: lerp(0.5, 0.25, (progress - 0.5) / 0.05), width: narrowWidth };
  const t = (progress - 0.55) / meeting;
  return { inset: lerp(0.25, -1, t), width: lerp(narrowWidth, 1, t) };
};

// how much of the bank shows: in as the strips close, full while they meet, out as they part
const getBankOpacity = progress => {
  const { bankStart, bankFull, bankEnd } = CLOUD_LOOK;
  if (progress < bankStart || progress > bankEnd + (bankFull - bankStart)) return 0;
  if (progress < bankFull) return easeInOut((progress - bankStart) / (bankFull - bankStart));
  if (progress < bankEnd) return 1;
  return 1 - easeInOut((progress - bankEnd) / (bankFull - bankStart));
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
    const { topColor, bottomColor, strips, minSeconds, maxSeconds, stripHeight, rowHeight, coveredHeight } = CLOUD_LOOK;
    const scale = Math.max(height / coveredHeight, 1);
    const clouds = Array.from({ length: strips }, (_, index) => ({
      seconds: minSeconds + Math.random() * (maxSeconds - minSeconds),
      isLeft: index % 2 == 0,
      top: (index - index % 2 - 1) * rowHeight * scale
    }));
    const sunlight = ctx.createLinearGradient(0, 0, 0, height);
    sunlight.addColorStop(0, topColor);
    sunlight.addColorStop(1, bottomColor);
    const outline = ctx.createLinearGradient(0, 0, 0, height);
    outline.addColorStop(0, CLOUD_LOOK.outlineTopColor);
    outline.addColorStop(1, CLOUD_LOOK.outlineBottomColor);
    ctx.lineWidth = CLOUD_LOOK.outlineWidth * scale;
    // the bank's puffs, in staggered rows, each a little bigger or smaller
    const { puffSize, puffStep } = CLOUD_LOOK;
    const puffs = [];
    for (let row = 0, y = -puffSize / 2; y < height + puffSize; row += 1, y += puffStep * 0.62 * scale) {
      for (let x = (row % 2) * puffStep * scale / 2 - puffSize; x < width + puffSize; x += puffStep * scale) {
        puffs.push({ x, y, radius: puffSize * scale * (0.42 + Math.random() * 0.16) });
      }
    }

    let frameRef;
    const startMs = performance.now();
    const draw = nowMs => {
      const seconds = (nowMs - startMs) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = sunlight;
      ctx.strokeStyle = outline;
      const bankOpacity = getBankOpacity(seconds / minSeconds);
      if (bankOpacity > 0) {
        // the puffs fill the screen between them, under their outlines
        ctx.globalAlpha = bankOpacity;
        ctx.fillRect(0, 0, width, height);
        puffs.forEach(({ x, y, radius }) => {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      // top to bottom, so each strip's outline overlaps the one above, like rows of cloud
      clouds.forEach(({ seconds: duration, isLeft, top }) => {
        if (seconds >= duration) return;
        const { inset, width: stripWidth } = getStripShape(seconds / duration, 0.9 / duration);
        const pixelWidth = stripWidth * width;
        const near = inset * width;
        ctx.beginPath();
        ctx.roundRect(isLeft ? near : width - near - pixelWidth, top, pixelWidth, stripHeight * scale, stripHeight * scale / 2);
        ctx.fill();
        ctx.stroke();
      });
      if (seconds < maxSeconds) frameRef = requestAnimationFrame(draw);
    };
    frameRef = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef);
      ctx.clearRect(0, 0, width, height);
    };
  }, [isPlaying]);

  return <Canvas ref={canvasRef} />;
};
