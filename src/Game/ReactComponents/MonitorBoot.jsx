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
  /* the normal arrow over it (the game's own screen may hide the pointer) */
  cursor: default;
  & *:not(button) { cursor: default; }
  pointer-events: auto;
`;
/*
  Behind the logo and Play (Jamie, playtest 30: the screens were dull): a cascade of 1s and 0s in purple, matrix-style:
  columns falling at their own speeds, each with a bright head and a trail that fades, now and then a digit flickering.
*/
// (Jamie, playtest 31: in cascades: neighbouring columns fall together in bands, like a waterfall, with longer trails)
// (denser: more columns, longer trails, bands back sooner: Jamie, playtest 31; was 42 columns, fade 0.045)
// (the digits 2.5 times as big: Jamie, playtest 31: a digit fills its column, so 64 / 2.5 columns across)
const RAIN = { columns: 33, /* (0.8 of the last size: 26 / 0.8) */ speed: [6, 12], fade: 0.03, head: "#f1dcff", body: [178, 92, 255], glyphs: "01", band: [2, 5], jitter: 0.12 };
const RainCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.7;
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
    // a cell's digit: fixed for its column and row (a hash), so nothing changes in place
    const glyphAt = (column, row) => RAIN.glyphs[(((column * 73856093) ^ (row * 19349663)) >>> 0) % RAIN.glyphs.length];
    const launchBand = (from, to, top) => {
      const speed = RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]);
      for (let k = from; k < to; k++) {
        drops[k] = { y: top - Math.random() * cell * 4, speed: speed * (1 + (Math.random() - 0.5) * RAIN.jitter * 2), band: from, bandEnd: to };
      }
    };
    const resize = () => {
      width = canvas.width = Math.max(1, canvas.clientWidth);
      height = canvas.height = Math.max(1, canvas.clientHeight);
      cell = width / RAIN.columns;
      drops = [...Array(RAIN.columns)].map(() => ({ y: 0, speed: 0, band: 0 }));
      // bands of neighbouring columns: each band one cascade, its columns a little apart in step and speed
      for (let k = 0; k < RAIN.columns;) {
        const size = Math.round(RAIN.band[0] + Math.random() * (RAIN.band[1] - RAIN.band[0]));
        launchBand(k, Math.min(RAIN.columns, k + size), Math.random() * height * 1.2 - height * 0.3); // (all down the screen from the start)
        k += size;
      }
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
          // the one above the head turns purple; the head itself bright. Each cell keeps its own digit (Jamie, playtest
          // 31: random digits each step made it jitter): the same one is drawn over it as it dims
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillText(glyphAt(k, row - 1), x, (row - 1) * cell);
          ctx.fillStyle = RAIN.head;
          ctx.fillText(glyphAt(k, row), x, row * cell);
        }
        // a band starts again together, once all of it has run off the bottom
        if (k == drop.band && drops.slice(drop.band, drop.bandEnd).every(other => other.y > height + cell * 10) && Math.random() < 0.5) {
          launchBand(drop.band, drop.bandEnd, -Math.random() * height * 0.1);
        }
      });
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
// (eased between bright and dim, not snapping: Jamie, playtest 31)
const playBlink = keyframes`
  /* (its brightest at three quarters: Jamie, playtest 31) */
  0%, 100% { color: #96bf8a; text-shadow: 0 0 0.5cqw rgba(58, 255, 58, 0.75); border-color: #2cbf2c; box-shadow: 0 0 1cqw rgba(58, 255, 58, 0.3); }
  50% { color: #3e8a3a; text-shadow: 0 0 0 rgba(58, 255, 58, 0); border-color: #2a6a28; box-shadow: 0 0 0 rgba(58, 255, 58, 0); }
`;
const PlayButton = styled.div`
  position: absolute;
  left: 50%;
  top: 73.7%; /* (up 2/5 of the gap under the logo: Jamie, playtest 31; was 79%) */
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
  font-family: gameboy;
  cursor: pointer; /* (the finger over it: Jamie, playtest 31) */
  /* (the rain's own dark, so no digits show through it: Jamie, playtest 31) */
  background: #05030a;
  outline: none;
  /* blinking once a second (Jamie, playtest 31) */
  animation: ${playBlink} 1.5s ease-in-out infinite; /* (slower: Jamie, playtest 31; was 1 s) */
  &:hover { background: #0f2a10; }
  ${props => props.$isPressed && css`
    transform: translate(-50%, -50%) scale(0.94);
    background: rgba(58, 255, 58, 0.25);
  `}
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
  // (Jamie, playtest 31: no pretend cursor: the player clicks Play themselves, with the normal arrow)
  useEffect(() => {
    const steps = { pressed: ["done", BOOT.clickHoldMs + BOOT.afterClickMs] }[phase];
    if (!steps) return;
    const timeout = setTimeout(() => {
      if (steps[0] == "done") {
        hasBooted = true;
        onDone();
      } else setPhase(steps[0]);
    }, steps[1]);
    return () => clearTimeout(timeout);
  }, [phase]);
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
          <PlayButton as="button" $isPressed={phase == "pressed"} onClick={() => phase == "start" && setPhase("pressed")}>PLAY</PlayButton>
        </>
      )}
    </Screen>
  );
};
