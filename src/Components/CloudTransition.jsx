import React, { useEffect, useRef } from "react";
import styled from "styled-components";

/*
  The clouds that sweep across between screens, drawn on one canvas.
  Each strip slides in from its own side, meets the others in the middle, and slides back.
*/
const CLOUD_LOOK = {
  color: "#b5d9fe",
  strips: 44,
  minSeconds: 1.5,
  maxSeconds: 3,
  stripHeight: 150,
  rowHeight: 50, // strips overlap, two to a row
  coveredHeight: 1050 // on taller screens the strips scale up
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

export const CloudTransition = ({ isPlaying }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    const { innerWidth: width, innerHeight: height } = window;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const { color, strips, minSeconds, maxSeconds, stripHeight, rowHeight, coveredHeight } = CLOUD_LOOK;
    const scale = Math.max(height / coveredHeight, 1);
    const clouds = Array.from({ length: strips }, (_, index) => ({
      seconds: minSeconds + Math.random() * (maxSeconds - minSeconds),
      isLeft: index % 2 == 0,
      top: (index - index % 2 - 1) * rowHeight * scale
    }));

    let frameRef;
    const startMs = performance.now();
    const draw = nowMs => {
      const seconds = (nowMs - startMs) / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.beginPath();
      clouds.forEach(({ seconds: duration, isLeft, top }) => {
        if (seconds >= duration) return;
        const { inset, width: stripWidth } = getStripShape(seconds / duration, 0.9 / duration);
        const pixelWidth = stripWidth * width;
        const near = inset * width;
        ctx.roundRect(isLeft ? near : width - near - pixelWidth, top, pixelWidth, stripHeight * scale, stripHeight * scale / 2);
      });
      ctx.fill();
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
