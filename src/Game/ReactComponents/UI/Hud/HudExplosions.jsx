import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { CAMERA } from "Utils/camera";

/*
  A dead HUD's end (Jamie, 2026-11-16, phase 4): once it has fallen out of shot, a fireball rises into the shot from
  below where it went, and the room flashes yellow, then orange, then red, and fades back. No sprite sheet: the fire is
  particles, billowing puffs that start white-hot and cool through yellow, orange and red to smoke as they rise and
  widen; some sparks fly up with them. Behind everything but the room (drawn just over it, under the monitor and the
  HUDs). Several at once share the one canvas: each burns at its own stage, and their light adds up.
*/
export const BLAST = {
  puffs: 80,
  sparks: 36,
  spread: 90, // px across where it rises from
  rise: [320, 720], // px/s up
  sideways: 140,
  radius: [26, 64],
  growth: 2.4, // how much a puff widens over its life
  lifeMs: [1300, 2500],
  drag: 1.1,
  lift: -40, // px/s² (hot air keeps rising)
  // the heat: white-hot, yellow, orange, red, then smoke (shares of a puff's life)
  ramp: [
    { at: 0, rgb: [255, 252, 225] },
    { at: 0.12, rgb: [255, 216, 90] },
    { at: 0.3, rgb: [255, 136, 36] },
    { at: 0.5, rgb: [206, 44, 22] },
    { at: 0.68, rgb: [70, 56, 54] },
    { at: 1, rgb: [30, 28, 30] }
  ],
  // the room's flash: rising fast, then fading through the colors (s)
  flash: { peak: 0.08, fade: 2.2, strength: 0.42, colors: [[255, 236, 120], [255, 150, 40], [220, 40, 20]] },
  // the room lit by it (Jamie, playtest 26: the bookcase catching its colors): a light from where it went off, strong
  // near it and falling off across the room ('reach': its radius, as a share of the window's width), the room's
  // surfaces taking its color ('screen'); a faint wash over all of it ('ambient')
  light: { reach: 0.75, strength: 0.75, ambient: 0.12 }
};

const listeners = new Set();
// where a HUD went out of shot (the page's px): the fireball rises from there
export const triggerHudExplosion = point => listeners.forEach(listener => listener(point));

const between = ([low, high]) => low + Math.random() * (high - low);
const getHeat = share => {
  const { ramp } = BLAST;
  const k = Math.max(0, ramp.findIndex(stop => stop.at > share) - 1);
  const a = ramp[k];
  const b = ramp[Math.min(k + 1, ramp.length - 1)];
  const t = b.at > a.at ? (share - a.at) / (b.at - a.at) : 0;
  return a.rgb.map((value, n) => Math.round(value + (b.rgb[n] - value) * Math.min(1, Math.max(0, t))));
};

const Canvas = styled.canvas`
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
`;

// the blast's light, over the room: its colors added to what's there (the bookcase catching them)
const LightCanvas = styled(Canvas)`
  mix-blend-mode: screen;
`;

export const HudExplosions = () => {
  const canvasRef = useRef(null);
  const lightRef = useRef(null);
  useEffect(() => {
    const blasts = []; // { born }
    const puffs = [];
    const sparks = [];
    const onBlast = ({ x: seenX, y: seenY }) => {
      // (the canvas moves with the camera: its px are the page's less the camera's offset)
      const x = seenX - CAMERA.x;
      const y = seenY - CAMERA.y;
      const born = performance.now();
      blasts.push({ born, x, y });
      for (let k = 0; k < BLAST.puffs; k++) {
        puffs.push({
          x: x + (Math.random() - 0.5) * BLAST.spread * 2, y: y + 40 + Math.random() * 120,
          vx: (Math.random() - 0.5) * BLAST.sideways * 2, vy: -between(BLAST.rise),
          radius: between(BLAST.radius), life: between(BLAST.lifeMs), age: -Math.random() * 260
        });
      }
      for (let k = 0; k < BLAST.sparks; k++) {
        sparks.push({ x: x + (Math.random() - 0.5) * BLAST.spread, y: y + 30, vx: (Math.random() - 0.5) * 520, vy: -between([500, 1100]), life: between([700, 1300]), age: 0 });
      }
    };
    listeners.add(onBlast);
    let frameId;
    let last = performance.now();
    const run = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width != window.innerWidth || canvas.height != window.innerHeight) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // the flash over the room: each blast's, added up, on the light's own canvas
        const lightCanvas = lightRef.current;
        const lightCtx = lightCanvas && lightCanvas.getContext("2d");
        if (lightCanvas && (lightCanvas.width != canvas.width || lightCanvas.height != canvas.height)) {
          lightCanvas.width = canvas.width;
          lightCanvas.height = canvas.height;
        }
        if (lightCtx) lightCtx.clearRect(0, 0, canvas.width, canvas.height);
        for (let k = blasts.length - 1; k >= 0; k--) {
          const seconds = (now - blasts[k].born) / 1000;
          const { peak, fade, strength, colors } = BLAST.flash;
          const level = seconds < peak ? seconds / peak : Math.exp(-(seconds - peak) * fade);
          if (level < 0.01 && seconds > peak) {
            blasts.splice(k, 1);
            continue;
          }
          const stage = Math.min(colors.length - 1, Math.floor((seconds / 0.9) * colors.length));
          const [r, g, b] = colors[stage];
          const { light } = BLAST;
          const { x = canvas.width, y = canvas.height } = blasts[k];
          if (!lightCtx) continue;
          lightCtx.globalCompositeOperation = "lighter";
          const radius = canvas.width * light.reach;
          const glow = lightCtx.createRadialGradient(x, y, 0, x, y, radius);
          glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${light.strength * level})`);
          glow.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${light.strength * 0.45 * level})`);
          glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          lightCtx.fillStyle = glow;
          lightCtx.fillRect(0, 0, canvas.width, canvas.height);
          lightCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${light.ambient * level})`;
          lightCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // the fire: cooled puffs first, as smoke, then the hot ones over them, added as light (so smoke never blots
        // the flame)
        for (let k = puffs.length - 1; k >= 0; k--) {
          const p = puffs[k];
          p.age += dt * 1000;
          if (p.age > p.life) {
            puffs.splice(k, 1);
            continue;
          }
          if (p.age < 0) continue;
          p.vy += BLAST.lift * dt;
          p.vx *= 1 - BLAST.drag * dt;
          p.vy *= 1 - BLAST.drag * 0.6 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        const drawPuff = p => {
          const share = p.age / p.life;
          const [r, g, b] = getHeat(share);
          const radius = p.radius * (0.4 + share * BLAST.growth);
          const alpha = share < 0.1 ? share / 0.1 : 1 - Math.max(0, share - 0.55) / 0.45;
          ctx.globalCompositeOperation = share < 0.5 ? "lighter" : "source-over";
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.75 * alpha})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        };
        const lit = puffs.filter(p => p.age >= 0);
        lit.filter(p => p.age / p.life >= 0.5).forEach(drawPuff);
        lit.filter(p => p.age / p.life < 0.5).forEach(drawPuff);
        // the sparks
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let k = sparks.length - 1; k >= 0; k--) {
          const s = sparks[k];
          s.age += dt * 1000;
          if (s.age > s.life) {
            sparks.splice(k, 1);
            continue;
          }
          s.vy += 900 * dt;
          const fromX = s.x;
          const fromY = s.y;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          ctx.strokeStyle = `rgba(255, 220, 140, ${1 - s.age / s.life})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => {
      listeners.delete(onBlast);
      cancelAnimationFrame(frameId);
    };
  }, []);
  return (
    <>
      <LightCanvas ref={lightRef} aria-hidden="true" />
      <Canvas ref={canvasRef} aria-hidden="true" />
    </>
  );
};
