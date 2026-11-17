import React, { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { loadAssets } from "Utils/assetLoader";

/*
  The main monitor's boot (Jamie, playtest 29), the first time it comes on in a visit: the game's logo (off the
  splash now) and a bar while the game's own images load (the second loader); then its start screen, and a cursor
  that glides over to Play and clicks it, and on to the character select. Most games load once before their menu:
  here the menu comes after the load, so it answers at once.
*/
const BOOT = { minLoadMs: 2200, startHoldMs: 700, cursorMoveMs: 1300, clickHoldMs: 260, afterClickMs: 450 };
let hasBooted = false;
export const getHasBooted = () => hasBooted;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 50;
  background: radial-gradient(ellipse at 50% 45%, #1a0b2a, #05030a 75%);
  font-family: gameboy;
  overflow: hidden;
`;
/*
  Behind the logo and Play (Jamie, playtest 30: the screens were dull): a cascade of 1s and 0s in purple, matrix-style:
  columns falling at their own speeds, each with a bright head and a trail that fades, now and then a digit flickering.
*/
const RAIN = { columns: 42, speed: [5, 13], fade: 0.09, head: "#f1dcff", body: [178, 92, 255], glyphs: "01" };
const RainCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
`;
const MatrixRain = () => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let cell = 10;
    let drops = [];
    const resize = () => {
      width = canvas.width = Math.max(1, canvas.clientWidth);
      height = canvas.height = Math.max(1, canvas.clientHeight);
      cell = width / RAIN.columns;
      drops = [...Array(RAIN.columns)].map(() => ({ y: Math.random() * -height, speed: RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]) }));
      ctx.fillStyle = "#05030a";
      ctx.fillRect(0, 0, width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frameId;
    let last = performance.now();
    const run = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // the trails fade
      ctx.fillStyle = `rgba(5, 3, 10, ${RAIN.fade})`;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${Math.round(cell * 0.95)}px gameboy, monospace`;
      ctx.textAlign = "center";
      const [r, g, b] = RAIN.body;
      drops.forEach((drop, k) => {
        const before = Math.floor(drop.y / cell);
        drop.y += drop.speed * cell * dt;
        const row = Math.floor(drop.y / cell);
        if (row != before && row >= 0) {
          const x = (k + 0.5) * cell;
          // the one above the head turns purple; the head itself bright
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillText(RAIN.glyphs[Math.floor(Math.random() * RAIN.glyphs.length)], x, (row - 1) * cell);
          ctx.fillStyle = RAIN.head;
          ctx.fillText(RAIN.glyphs[Math.floor(Math.random() * RAIN.glyphs.length)], x, row * cell);
        }
        if (drop.y > height + cell * 6 && Math.random() < 0.04) {
          drop.y = Math.random() * -height * 0.3;
          drop.speed = RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]);
        }
      });
      // now and then a digit in a trail flickers
      if (Math.random() < 0.3) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fillText(RAIN.glyphs[Math.floor(Math.random() * 2)], (Math.floor(Math.random() * RAIN.columns) + 0.5) * cell, Math.floor(Math.random() * (height / cell)) * cell);
      }
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);
  return <RainCanvas ref={ref} aria-hidden="true" />;
};

const logoIn = keyframes`from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); }`;
const Logo = styled.img`
  position: absolute;
  left: 50%;
  top: 40%;
  width: 72%;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 0 1.2cqw rgba(150, 60, 255, 0.85));
  animation: ${logoIn} 900ms ease-out both;
`;
const Bar = styled.div`
  position: absolute;
  left: 50%;
  top: 70%;
  width: 46%;
  height: 0.6cqw;
  transform: translateX(-50%);
  border: 0.1cqw solid rgba(201, 166, 255, 0.6);
  & > div {
    height: 100%;
    background: #c9a6ff;
    box-shadow: 0 0 0.6cqw rgba(200, 120, 255, 0.9);
    transition: width 200ms linear;
  }
`;
const Label = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: calc(70% + 1.6cqw);
  text-align: center;
  font-size: 1cqw;
  letter-spacing: 0.12cqw;
  color: #c9a6ff;
`;
const PlayButton = styled.div`
  position: absolute;
  left: 50%;
  top: 79%; /* (low, a smidge above 5/6 of the way down: Jamie, playtest 29) */
  transform: translate(-50%, -50%);
  padding: 1cqw 3cqw;
  font-size: 2cqw;
  letter-spacing: 0.3cqw;
  color: #c8ffb8;
  border: 0.2cqw solid #3aff3a;
  border-radius: 0.4cqw;
  text-shadow: 0 0 0.5cqw #3aff3a;
  box-shadow: 0 0 1cqw rgba(58, 255, 58, 0.4);
  transition: transform 120ms, background 120ms;
  ${props => props.$isPressed && css`
    transform: translate(-50%, -50%) scale(0.94);
    background: rgba(58, 255, 58, 0.25);
  `}
`;
// the cursor: an arrow, gliding from the lower right to Play
const Cursor = styled.svg`
  position: absolute;
  width: 1.5cqw; /* (twice the last: Jamie, playtest 29) */
  height: 2cqw;
  z-index: 2;
  filter: drop-shadow(0.1cqw 0.14cqw 0 rgba(0, 0, 0, 0.6));
  transition: left ${BOOT.cursorMoveMs}ms cubic-bezier(0.45, 0.05, 0.25, 1), top ${BOOT.cursorMoveMs}ms cubic-bezier(0.45, 0.05, 0.25, 1), transform 120ms;
  ${props => props.$isPressed && css`transform: scale(0.85);`}
`;

export const MonitorBoot = ({ onDone }) => {
  const [phase, setPhase] = useState("loading"); // loading, start, moving, pressed
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let isCancelled = false;
    const minimum = new Promise(resolve => setTimeout(resolve, BOOT.minLoadMs));
    Promise.all([loadAssets("game", share => !isCancelled && setProgress(share)), minimum]).then(() => {
      if (isCancelled) return;
      setPhase("start");
    });
    return () => { isCancelled = true; };
  }, []);
  useEffect(() => {
    const steps = { start: ["moving", BOOT.startHoldMs], moving: ["pressed", BOOT.cursorMoveMs + 80], pressed: ["done", BOOT.clickHoldMs + BOOT.afterClickMs] }[phase];
    if (!steps) return;
    const timeout = setTimeout(() => {
      if (steps[0] == "done") {
        hasBooted = true;
        onDone();
      } else setPhase(steps[0]);
    }, steps[1]);
    return () => clearTimeout(timeout);
  }, [phase]);
  const isAtPlay = phase == "moving" || phase == "pressed";
  return (
    <Screen>
      <MatrixRain />
      <Logo src="/Logo.gif" alt="" /> {/* (the splash's, moved here) */}
      {phase == "loading" ? (
        <>
          <Bar><div style={{ width: `${Math.round(progress * 100)}%` }} /></Bar>
          <Label>Loading {Math.round(progress * 100)}%</Label>
        </>
      ) : (
        <>
          <PlayButton $isPressed={phase == "pressed"}>PLAY</PlayButton>
          <Cursor viewBox="0 0 22 30" $isPressed={phase == "pressed"} style={{ left: isAtPlay ? "52%" : "80%", /* (starting well inside the screen, never on the casing) */ top: isAtPlay ? "80%" : "88%" }}>
            <path d="M1 1 L1 23 L7 17 L11 27 L15 25 L11 15 L19 15 Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
          </Cursor>
        </>
      )}
    </Screen>
  );
};
