import React, { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { loadAssets } from "Utils/assetLoader";
import { getIsGameBeaten } from "../DataClasses/Unlocks";
import { unlockEverything } from "../DataClasses/Avatars";
import { checkPeerService, getLinkedRoomCode } from "../Multiplayer/peerLink";
import { MultiplayerLobby } from "../Multiplayer/MultiplayerLobby";
import { getDeviceKind, TOUCH_INTRO } from "Utils/device";
import { LabTerminal, LAB_TERMINAL } from "./LabTerminal";
import { DesignBox } from "./GameBoard/PlayWindow";
import { playSfx } from "Utils/sfx";

/*
  The main monitor's boot (Jamie, playtest 29), the first time it comes on in a visit: the game's logo (off the
  splash now) and a bar while the game's own images load (the second loader); then its start screen, and a cursor
  that glides over to Play and clicks it, and on to the character select. Most games load once before their menu:
  here the menu comes after the load, so it answers at once.
*/
const BOOT = { minLoadMs: 2200, startHoldMs: 700, cursorMoveMs: 1300, clickHoldMs: 260, afterClickMs: 450 };
let hasBooted = false;
export const getHasBooted = () => hasBooted;
// (out of a multiplayer match: the start screen again next time, Single Player or Multiplayer, not straight to the avatars)
export const resetBoot = () => { hasBooted = false; };

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
  Behind the logo and Play (Jamie, playtest 30: the screens were dull): a cascade in purple, matrix-style: columns
  falling at their own speeds, each with a bright head and a trail that fades.
  (Jamie, 2026-11-27: Kaiju, not 1s and 0s: flat neon silhouettes of the Kaiju's sprite frames, as Stompy is drawn. At
  the head, its walk toward the viewer steps on, bright; the step it's on as the head moves on burns there, purple, and
  fades away where it is, as a phantom)
*/
// (Jamie, playtest 31: in cascades: neighbouring columns fall together in bands, like a waterfall, with longer trails)
// (denser: more columns, longer trails, bands back sooner: Jamie, playtest 31; was 42 columns, fade 0.045)
// (the digits 2.5 times as big: Jamie, playtest 31: a digit fills its column, so 64 / 2.5 columns across)
// (Jamie, 2026-11-27: the Kaiju larger, 22 columns, was 33; and more cascades: 'lanes' falling in each column at once)
const RAIN = { columns: 22, lanes: 2, /* (0.8 of the last size: 26 / 0.8) */ speed: [4, 8] /* (a third slower: Jamie, 2026-11-27; was 6 to 12 cells a second) */, fade: 0.03, head: "#f1dcff", body: [178, 92, 255], glyphs: "01", band: [2, 5], jitter: 0.12, flashMs: 70, background: "#05030a", clearEveryMs: 500, clearBelow: 80 /* (r + g + b: the background is 18; a fade stalls about 16 above it in each channel, ~66) */ };
// the Kaiju's frames (Stompy's sheet: Tamagotchi's SHEET), each a silhouette in one color
const RAIN_SHEET = { src: "/spritesheet/kaiju_sprite2.png", frames: 10, rows: 6, frameWidth: 180, frameHeight: 1382 / 6 };
const RAIN_FRAME_COUNT = RAIN_SHEET.frames * RAIN_SHEET.rows;
// (Jamie, 2026-11-27: only the row walking toward the viewer, down the screen, its walk played in order; no random poses)
const RAIN_WALK_ROW = 2;
const rainSheet = typeof Image != "undefined" ? new Image() : undefined;
if (rainSheet) rainSheet.src = RAIN_SHEET.src;
// each frame's figure: its box on the sheet, trimmed of empty space (found once)
const figureBoxes = new Map();
const getFigureBox = frame => {
  if (figureBoxes.has(frame)) return figureBoxes.get(frame);
  const width = rainSheet.naturalWidth / RAIN_SHEET.frames;
  const height = rainSheet.naturalHeight / RAIN_SHEET.rows;
  const left = (frame % RAIN_SHEET.frames) * width;
  const top = Math.floor(frame / RAIN_SHEET.frames) * height;
  const scan = document.createElement("canvas");
  scan.width = Math.ceil(width);
  scan.height = Math.ceil(height);
  const scanCtx = scan.getContext("2d");
  scanCtx.drawImage(rainSheet, left, top, width, height, 0, 0, width, height);
  const { data } = scanCtx.getImageData(0, 0, scan.width, scan.height);
  let [minX, minY, maxX, maxY] = [scan.width, scan.height, -1, -1];
  for (let y = 0; y < scan.height; y++) {
    for (let x = 0; x < scan.width; x++) {
      if (data[(y * scan.width + x) * 4 + 3] < 40) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const box = maxX < 0 ? { x: left, y: top, width, height } : { x: left + minX, y: top + minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  figureBoxes.set(frame, box);
  return box;
};
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
    let lanes = []; // each lane: a drop per column, in its own bands
    // a frame's silhouette in a color, at the cell's size (made once each)
    let tints = new Map();
    const getTint = (frame, color) => {
      const key = `${frame}|${color}`;
      if (tints.has(key)) return tints.get(key);
      if (!rainSheet || !rainSheet.complete || !rainSheet.naturalWidth) return undefined;
      const size = Math.max(4, Math.round(cell));
      const tint = document.createElement("canvas");
      tint.width = size;
      tint.height = size;
      const tintCtx = tint.getContext("2d");
      // (the figure only, trimmed of the frame's empty space, fitted to the cell: the frames are mostly space)
      const box = getFigureBox(frame);
      const fit = size / Math.max(box.width, box.height);
      const drawWidth = box.width * fit;
      const drawHeight = box.height * fit;
      tintCtx.imageSmoothingEnabled = false;
      tintCtx.drawImage(rainSheet, box.x, box.y, box.width, box.height, (size - drawWidth) / 2, size - drawHeight, drawWidth, drawHeight);
      tintCtx.globalCompositeOperation = "source-in";
      tintCtx.fillStyle = color;
      tintCtx.fillRect(0, 0, size, size);
      tints.set(key, tint);
      return tint;
    };
    // a drop's first step: anywhere in the walk; then each next one in turn
    const getRandomFrame = () => RAIN_WALK_ROW * RAIN_SHEET.frames + Math.floor(Math.random() * RAIN_SHEET.frames);
    const getNextFrame = frame => RAIN_WALK_ROW * RAIN_SHEET.frames + ((frame % RAIN_SHEET.frames) + 1) % RAIN_SHEET.frames;
    // a cell's Kaiju (or, till the sheet's in, its digit), drawn over a cleared cell
    const drawCell = (column, row, frame, color) => {
      const x = column * cell;
      const y = row * cell - cell * 0.85;
      ctx.fillStyle = RAIN.background;
      ctx.fillRect(x, y, cell, cell);
      const tint = getTint(frame, color);
      if (tint) ctx.drawImage(tint, x, y, cell, cell);
      else {
        ctx.fillStyle = color;
        ctx.fillText(RAIN.glyphs[frame % RAIN.glyphs.length], x + cell / 2, row * cell);
      }
    };
    const launchBand = (drops, from, to, top) => {
      playSfx("boot-tick", { gain: 0.45, minGapMs: 40 }); // (the boot patter: a data tick as each cascade starts. Jamie, 2026-11-26)
      const speed = RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]);
      for (let k = from; k < to; k++) {
        drops[k] = { y: top - Math.random() * cell * 4, speed: speed * (1 + (Math.random() - 0.5) * RAIN.jitter * 2), band: from, bandEnd: to, frame: getRandomFrame(), flashAt: 0 };
      }
    };
    const resize = () => {
      width = canvas.width = Math.max(1, canvas.clientWidth);
      height = canvas.height = Math.max(1, canvas.clientHeight);
      cell = width / RAIN.columns;
      tints = new Map();
      lanes = [...Array(RAIN.lanes)].map(() => [...Array(RAIN.columns)].map(() => ({ y: 0, speed: 0, band: 0, frame: 0, flashAt: 0 })));
      // bands of neighbouring columns: each band one cascade, its columns a little apart in step and speed
      lanes.forEach(drops => {
        for (let k = 0; k < RAIN.columns;) {
          const size = Math.round(RAIN.band[0] + Math.random() * (RAIN.band[1] - RAIN.band[0]));
          launchBand(drops, k, Math.min(RAIN.columns, k + size), Math.random() * height * 1.2 - height * 0.3); // (all down the screen from the start)
          k += size;
        }
      });
      ctx.fillStyle = RAIN.background;
      ctx.fillRect(0, 0, width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    let frameId;
    let last = performance.now();
    let lastClearAt = last;
    const run = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // the trails fade
      ctx.fillStyle = `rgba(5, 3, 10, ${RAIN.fade})`;
      ctx.fillRect(0, 0, width, height);
      // (and fade away for good: a little fade each frame stalls just above black, in the canvas's rounding, leaving
      // faint ghosts for ever. Every so often the faintest go black: Jamie, 2026-11-27)
      if (now - lastClearAt > RAIN.clearEveryMs && width > 1) {
        lastClearAt = now;
        const image = ctx.getImageData(0, 0, width, height);
        const { data } = image;
        for (let at = 0; at < data.length; at += 4) {
          if (data[at] + data[at + 1] + data[at + 2] < RAIN.clearBelow) {
            data[at] = 5;
            data[at + 1] = 3;
            data[at + 2] = 10;
          }
        }
        ctx.putImageData(image, 0, 0);
      }
      ctx.font = `${Math.round(cell * 0.95)}px gameboy, monospace`;
      ctx.textAlign = "center";
      const [r, g, b] = RAIN.body;
      const body = `rgb(${r}, ${g}, ${b})`;
      lanes.forEach(drops => drops.forEach((drop, k) => {
        const before = Math.floor(drop.y / cell);
        drop.y += drop.speed * cell * dt;
        const row = Math.floor(drop.y / cell);
        if (row != before && row >= 0) {
          // the head moves on: the frame it was on burns into the cell it leaves, purple, and fades there
          drawCell(k, row - 1, drop.frame, body);
          drop.frame = getNextFrame(drop.frame);
          drop.flashAt = now;
          drawCell(k, row, drop.frame, RAIN.head);
        } else if (row >= 0 && now - drop.flashAt >= RAIN.flashMs) {
          // at the head, the walk steps on
          drop.frame = getNextFrame(drop.frame);
          drop.flashAt = now;
          drawCell(k, row, drop.frame, RAIN.head);
        }
        // a band starts again together, once all of it has run off the bottom
        if (k == drop.band && drops.slice(drop.band, drop.bandEnd).every(other => other.y > height + cell * 4) && Math.random() < 0.5) /* (back sooner: Jamie, 2026-11-27; was 10 cells past) */ {
          launchBand(drops, drop.band, drop.bandEnd, -Math.random() * height * 0.1);
        }
      }));
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
  top: 40.8%; /* (logo and Play down together, centered on the screen: Jamie, playtest 31; was 33.8%) (30% bigger, its bottom kept where it was, so the gap to Play's the same: Jamie, playtest 31; was 40%) */
  width: 93.6%; /* (was 72%) */
  transform: translate(-50%, -50%);
  /* (a brighter, whiter purple edge, so its dark Kaiju at the sides stand out: Jamie, playtest 31; was a deep purple) */
  filter: drop-shadow(0 0 0.25cqw rgba(236, 214, 255, 0.95)) drop-shadow(0 0 1cqw rgba(196, 140, 255, 0.8));
  animation: ${logoIn} 900ms ease-out both;
  transition: width 500ms ease-in-out, top 500ms ease-in-out;
  /* the mode's choice: smaller and higher, the three buttons in a column under it (Jamie, 2026-11-24) */
  ${props => props.$isSmall && css`
    width: 72%; /* (a bit bigger and lower, filling the space over the buttons: Jamie, playtest 38; was 60%, 30%) */
    top: 32%;
  `}
`;
const Bar = styled.div`
  position: absolute;
  left: 50%;
  top: 77%; /* (down with the logo: was 70%) */
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
  top: calc(77% + 1.6cqw);
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
  top: 80.7%; /* (down with the logo: was 73.7%) (up 2/5 of the gap under the logo: Jamie, playtest 31; was 79%) */
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

// after PLAY, the game's mode (Jamie, 2026-11-18): Single Player, or Multiplayer, closed until the game's been beaten
// once (Unlocks: GAME_BEATEN_UNLOCK), or while the multiplayer service is down (peerLink: checkPeerService)
// (a column at the bottom, each as wide as the widest: Jamie, 2026-11-24; was a row)
const ModeRow = styled.div`
  position: absolute;
  left: 50%;
  bottom: 8.5%; /* (a bit higher: Jamie, playtest 38; was 5.5%) */
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1.2cqw;
  align-items: stretch;
  /* (at least half the screen, wider when the longest name needs it: "Single Player" ran past its button's right
     edge once the casing grew and the screen shrank: Jamie, 2026-11-25) */
  width: max-content;
  min-width: 50%;
  & > button { white-space: nowrap; padding: 0.8cqw 1.5cqw; }
`;
const ModeButton = styled.button`
  padding: 1cqw 2cqw;
  font-size: 1.5cqw;
  letter-spacing: 0.2cqw;
  font-family: gameboy;
  color: #c8ffb8;
  background: #05030a;
  border: 0.2cqw solid #3aff3a;
  border-radius: 0.4cqw;
  text-shadow: 0 0 0.5cqw #3aff3a;
  box-shadow: 0 0 1cqw rgba(58, 255, 58, 0.4);
  cursor: pointer;
  outline: none;
  &:hover:not(:disabled) { background: #0f2a10; }
  &:disabled { color: #3e5a3a; border-color: #2a4a28; text-shadow: none; box-shadow: none; cursor: not-allowed; }
`;
// (inside the button, under its name, in red: not dimmed with the closed button, but a muted red, soft against its
// dark shading: Jamie)
const DevUnlock = styled.button`
  position: absolute;
  left: 50%;
  top: 1.5%; /* (out of the buttons' way, now at the bottom) */
  transform: translateX(-50%);
  padding: 0.3cqw 0.8cqw;
  font: 0.8cqw monospace;
  color: #9fd894;
  background: #05030a;
  border: 1px dashed #3a6a34;
  cursor: pointer;
`;
const ModeNote = styled.span`
  display: block;
  margin-top: 0.5cqw;
  font-size: 0.7cqw;
  letter-spacing: 0.08cqw;
  color: #ab4840;
  text-shadow: 0 0 0.3cqw rgba(171, 72, 64, 0.3);
`;

// Settings (Jamie, 2026-11-24): the screen fades to black, then the Lab's computer slides in from the right (LabTerminal,
// its start-screen menu: unlock codes and Quit); its Quit slides it back out, and the screen fades back up
const blackIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const blackOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
const BlackOut = styled.div`
  position: absolute;
  inset: 0;
  z-index: 60;
  background: black;
  animation: ${props => props.$isLifting ? blackOut : blackIn} ${LAB_TERMINAL.fadeMs}ms ease-in-out both;
`;

// 'onDone': on into the game; with Multiplayer, given the link to the other player (and any messages already come)
// 'startAt': back from the avatar select (single player's Back): straight to the mode buttons, loaded already
// 'isAutoPlay': PLAY presses itself after a beat (the touch intro: TOUCH_INTRO)
export const MonitorBoot = ({ onDone, startAt = undefined, isAutoPlay = false }) => {
  const [phase, setPhase] = useState(startAt || "loading"); // loading, start, moving, pressed, mode
  // (the touch intro: PLAY pressed by itself, its click heard)
  useEffect(() => {
    if (!isAutoPlay || phase != "start") return;
    const timeout = setTimeout(() => { playSfx("ui-click"); setPhase("pressed"); }, TOUCH_INTRO.playAfterMs);
    return () => clearTimeout(timeout);
  }, [isAutoPlay, phase]);
  const [, setDevTick] = useState(0); // (dev only: the unlock below re-renders it) (and a code entered in Settings)
  const [settings, setSettings] = useState(undefined); // Settings: 'fading', 'open', then 'closing'
  const openSettings = () => {
    setSettings("fading");
    setTimeout(() => setSettings("open"), LAB_TERMINAL.fadeMs);
  };
  const closeSettings = () => {
    setSettings("closing");
    setDevTick(k => k + 1); // (a code may have opened Multiplayer)
    setTimeout(() => setSettings(undefined), LAB_TERMINAL.fadeMs);
  };
  const isBeaten = getIsGameBeaten();
  // the multiplayer service checked once the game's beaten (Jamie): undefined while asking, then up or down
  const [isServiceUp, setIsServiceUp] = useState(undefined);
  useEffect(() => {
    if (!isBeaten || phase != "mode") return;
    let isCancelled = false;
    checkPeerService(isServiceUp === false).then(isUp => !isCancelled && setIsServiceUp(isUp));
    return () => { isCancelled = true; };
  }, [phase, isBeaten]);
  const isMultiplayerOpen = isBeaten && isServiceUp === true;
  const multiplayerNote = !isBeaten ? "Beat the game to unlock" : isServiceUp === undefined ? "Checking..." : !isServiceUp ? "Currently down" : "";
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let isCancelled = false;
    const minimum = new Promise(resolve => setTimeout(resolve, BOOT.minLoadMs));
    if (startAt) return;
    Promise.all([loadAssets("game", share => !isCancelled && setProgress(share)), minimum]).then(() => {
      if (isCancelled) return;
      setPhase("start");
    });
    return () => { isCancelled = true; };
  }, []);
  // (Jamie, playtest 31: no pretend cursor: the player clicks Play themselves, with the normal arrow)
  useEffect(() => {
    // (opened from a host's link: past the mode, straight to joining them. Jamie)
    // (a phone: no mode screen at all, straight on to single player: no multiplayer yet, and Settings there is only for
    // unlocks. An iPad keeps it. Jamie, 2026-11-28)
    const afterPlay = getDeviceKind() == "phone" ? "done" : getLinkedRoomCode() ? "lobby" : "mode";
    const steps = { pressed: [afterPlay, BOOT.clickHoldMs] }[phase];
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
      {/* (the logo and the buttons in the screen's design box: today's size on a wider screen, the rain round them. Layout
          phase 2) */}
      <DesignBox>
      <Logo src="/Logo.gif" alt="" $isSmall={phase == "mode"} /> {/* (the splash's, moved here) */}
      {phase == "loading" ? (
        <>
          <Bar><div style={{ width: `${Math.round(progress * 100)}%` }} /></Bar>
          <Label>Loading {Math.round(progress * 100)}%</Label>
        </>
      ) : phase == "mode" ? (
        <ModeRow>
          <ModeButton onClick={() => { hasBooted = true; setTimeout(onDone, BOOT.afterClickMs); }}>Single Player</ModeButton>
          <ModeButton disabled={!isMultiplayerOpen} onClick={() => setPhase("lobby")}>
            Multiplayer
            {multiplayerNote && <ModeNote>{multiplayerNote}</ModeNote>}
          </ModeButton>
          <ModeButton disabled={!!settings} onClick={openSettings}>Settings</ModeButton>
        </ModeRow>
      ) : phase == "lobby" ? (
        <MultiplayerLobby onBack={() => setPhase("mode")} onConnected={(link, messages) => { hasBooted = true; onDone({ link, messages }); }} />
      ) : (
        <>
          <PlayButton as="button" $isPressed={phase == "pressed"} onClick={() => phase == "start" && setPhase("pressed")}>PLAY</PlayButton>
        </>
      )}
      </DesignBox>
      {settings && <BlackOut $isLifting={settings == "closing"} />}
      {settings == "open" && <LabTerminal context="landing" onClose={closeSettings} />}
      {/* dev only (Jamie: the dev panel isn't up here): as if the game's beaten and everything's unlocked, so Multiplayer opens */}
      {import.meta.env.DEV && phase == "mode" && !isBeaten && (
        <DevUnlock onClick={() => { unlockEverything(['rapidTransit', 'rooftop', 'aquarium']); setDevTick(k => k + 1); }}>Unlock everything (dev)</DevUnlock>
      )}
    </Screen>
  );
};
