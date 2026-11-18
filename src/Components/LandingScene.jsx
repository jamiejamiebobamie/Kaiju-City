import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { TrafficLights } from "../Game/ReactComponents/GameBoard/TrafficLights";
import landingTraffic from "./data/landingTraffic.json";
import { LANDING_TUNE_DEFAULTS } from "./LandingTuner";

/*
  The landing's scene (Jamie, 2026-11-18): the Lab windows' Peninsula, but seen straight up its middle (one-point
  perspective), the logo's own skyline standing on its tip, the moon over it, cars on its roads and glints on the water.
  It is placed by the logo's zoom spot (MainMenu's CITY_ZOOM.spot) and zooms about it with the skyline. Its own
  vanishing point (Jamie's mock-up): under the skyline's middle, on the horizon just above the skyline's ground, so the
  Peninsula runs straight up the screen's middle, the sea either side free (for the Kaiju sprites, a ship or buoy).
  The picture (scripts/labWindowView.py, LANDING=1) is drawn at half size and shown at twice it, pixelated; 'vanish':
  the zoom spot's point in it, in its own px.
*/
export const LANDING_VIEW = { src: "/zoom-scene/0-peninsula.png", size: { width: 1700, height: 1000 }, vanish: { x: 850, y: 380 }, horizon: 403, scale: 2, fadeInMs: 1400 };
// the cars nearest the viewer (the bottom half of the Peninsula, distance under 330 in the picture's terms) more
// dramatic (Jamie): up to 2.4 times as fast, bigger, one more car to every 4 of the road's points there
const NEAR_TRAFFIC = { distance: 330, speed: 2.4, carEvery: 4, size: { near: 260, least: 0.5, most: 3 } };

/*
  The moon's reflection on the water (Jamie, rounds 4-6): under the moon, the crescent's own shape as it is in the sky
  (no perspective, no lean), in short dashes along each row (between the strips and the single pixels tried), each
  winking on and off, each row slipping side to side a little with the swell; the moon's dark side there too, faint,
  as in the sky. In the picture's px: its middle, its size, how far a row slips, how much of it shows.
*/
// (its place and size: the tuner's, LandingTuner)
const REFLECTION = { slip: 1.4, shown: 0.45, dash: [2, 5], gapEvery: [1, 2], color: "250, 238, 168", most: 0.5, dark: { color: "120, 132, 196", most: 0.16 } };

const MoonReflection = ({ x, y, radius }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const r = Math.round(radius);
    const { slip, shown, dash, gapEvery, color, most, dark } = REFLECTION;
    const pad = Math.ceil(slip) + 2;
    const size = Math.ceil(r * 2) + pad * 2;
    canvas.width = size;
    canvas.height = size;
    const between = ([low, high]) => low + Math.floor(Math.random() * (high - low + 1));
    // each row's runs: lit (the crescent: lit right, the moon's bite flipped, as a reflection) or dark (the bite),
    // cut into dashes, each with its own time on the water
    const dashes = [];
    for (let y = -r; y <= r; y++) {
      let x = -r;
      while (x <= r) {
        const length = between(dash);
        const middle = x + length / 2;
        const inDisc = middle * middle + y * y <= r * r;
        const inBite = (middle + 0.45 * r) ** 2 + (y - 0.15 * r) ** 2 <= (0.95 * r) ** 2;
        if (inDisc) dashes.push({ x, y, length, isLit: !inBite, phase: Math.random() * Math.PI * 2, speed: 0.7 + Math.random() * 1.4 });
        x += length + between(gapEvery);
      }
    }
    const rowPhase = [...Array(Math.ceil(r * 2) + 1)].map(() => Math.random() * Math.PI * 2);
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, size, size);
      dashes.forEach(({ x, y, length, isLit, phase, speed }) => {
        const wave = Math.sin(t * speed + phase);
        if (wave < 1 - shown * 2) return; // (off for a while: the water breaking it up)
        const row = Math.round(slip * Math.sin(t * 1.1 + rowPhase[y + Math.ceil(r)] + y * 0.4));
        const strength = 0.4 + 0.6 * (wave + 1) / 2;
        ctx.fillStyle = isLit ? `rgba(${color}, ${most * strength})` : `rgba(${dark.color}, ${dark.most * strength})`;
        ctx.fillRect(pad + r + x + row, pad + r + y, length, 1);
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [radius]);
  const pad = Math.ceil(REFLECTION.slip) + 2;
  const r = Math.round(radius);
  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", left: Math.round(x) - r - pad, top: Math.round(y) - r - pad, zIndex: 1, pointerEvents: "none", imageRendering: "pixelated" }} />;
};

/*
  The moon (Jamie, 2026-11-18): the pale yellow crescent over the Peninsula, its dark side the sky's own colour lit by
  its glow (the stars behind it hidden), the glow round it; its own layer, so the tuner can place and size it live
  (it was drawn into the picture). Nothing of it below the horizon. In the picture's px: its middle and radius.
  The sky's colour by row: as scripts/labWindowView.py paints it (night black at the top to blue at the horizon, the
  horizon's glow), so the dark side matches it.
*/
const MOON = { lit: [250, 238, 168], glow: [38, 44, 70], glowReach: 1.6, bite: { x: -0.45, y: -0.15, size: 0.95 } };
const getSkyAt = row => {
  const t = Math.pow(Math.max(0, Math.min(1, row / LANDING_VIEW.horizon)), 2.2);
  const shine = Math.exp(-Math.pow((row - LANDING_VIEW.horizon) / 6, 2));
  return [11 * (1 - t) + 26 * t + 18 * shine, 12 * (1 - t) + 40 * t + 26 * shine, 14 * (1 - t) + 72 * t + 48 * shine];
};
const Moon = ({ x, y, radius }) => {
  const discRef = useRef(null);
  const glowRef = useRef(null);
  const reach = Math.ceil(radius * (1 + MOON.glowReach)) + 1;
  const box = { left: Math.round(x) - reach, top: Math.round(y) - reach, size: reach * 2 };
  useEffect(() => {
    const disc = discRef.current && discRef.current.getContext("2d");
    const glow = glowRef.current && glowRef.current.getContext("2d");
    if (!disc || !glow) return;
    const discData = disc.createImageData(box.size, box.size);
    const glowData = glow.createImageData(box.size, box.size);
    for (let py = 0; py < box.size; py++) {
      const row = box.top + py;
      if (row >= LANDING_VIEW.horizon - 1) continue; // (behind the horizon)
      const sky = getSkyAt(row);
      for (let px = 0; px < box.size; px++) {
        const dx = box.left + px - x;
        const dy = row - y;
        const distance = Math.hypot(dx, dy);
        const k = (py * box.size + px) * 4;
        if (distance <= radius) {
          const inBite = Math.hypot(dx - MOON.bite.x * radius, dy - MOON.bite.y * radius) <= MOON.bite.size * radius;
          const base = sky.map((value, c) => value + MOON.glow[c]);
          const color = inBite ? base : base.map((value, c) => value * 0.15 + MOON.lit[c] * 0.85);
          discData.data.set([...color.map(Math.round), 255], k);
        } else {
          const halo = Math.pow(Math.max(0, 1 - (distance - radius) / (radius * MOON.glowReach)), 2);
          if (halo > 0) glowData.data.set([...MOON.glow.map(value => Math.round(value * halo)), 255], k);
        }
      }
    }
    disc.putImageData(discData, 0, 0);
    glow.putImageData(glowData, 0, 0);
  }, [x, y, radius]);
  const style = { position: "absolute", left: box.left, top: box.top, width: box.size, height: box.size, pointerEvents: "none", imageRendering: "pixelated" };
  return (
    <>
      {/* (the glow added onto the sky: black adds nothing) */}
      <canvas ref={glowRef} width={box.size} height={box.size} aria-hidden="true" style={{ ...style, mixBlendMode: "plus-lighter" }} />
      <canvas ref={discRef} width={box.size} height={box.size} aria-hidden="true" style={style} />
    </>
  );
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Stage = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
`;

// the vanishing point: the zoom scales about it ('$zoom': MainMenu's zoom in or out, the logo's own keyframes)
const Anchor = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  ${props => props.$zoom}
`;

// (placed and sized by its style: scaled with the logo)
const View = styled.div`
  position: absolute;
  width: ${LANDING_VIEW.size.width}px;
  height: ${LANDING_VIEW.size.height}px;
  transform-origin: 0 0;
  background: url(${LANDING_VIEW.src}) 0 0 / 100% 100%;
  image-rendering: pixelated;
`;

const Fade = styled.div`
  position: absolute;
  inset: 0;
  animation: ${fadeIn} ${LANDING_VIEW.fadeInMs}ms ease-out both;
`;

// 'spot': the zoom spot, as shares across and down the logo's image ([data-landing-logo]); 'zoom': the css that zooms
// it (in on leaving, back out after Leave); 'isBack': the landing came back by the zoom out (no fade in then);
// 'logoScale': the logo's size (the picture is drawn for it at 1, and scaled with it); 'lift': how far (logo px) the
// logo's skyline is raised (MainMenu): the anchor goes with the skyline's zoom spot, the picture stays put;
// 'tune': the moon's and its reflection's places and sizes (LandingTuner)
export const LandingScene = ({ spot, zoom, isBack = false, logoScale = 1, lift = 0, tune = LANDING_TUNE_DEFAULTS }) => {
  const stageRef = useRef(null);
  const [vanish, setVanish] = useState(undefined);
  useLayoutEffect(() => {
    // placed from the logo's box (its wrapper's, scaled, and its offsets in it: they leave out the zoom's transforms)
    // and the stage's own (so a shift of the whole landing moves both alike)
    const place = () => {
      const logo = document.querySelector("[data-landing-logo]");
      const stage = stageRef.current;
      const wrapper = logo && logo.offsetParent;
      if (!wrapper || !stage) return;
      const holder = wrapper.getBoundingClientRect();
      const own = stage.getBoundingClientRect();
      const k = holder.width / wrapper.offsetWidth;
      setVanish({
        x: holder.left - own.left + k * (logo.offsetLeft + spot.x * logo.offsetWidth),
        y: holder.top - own.top + k * (logo.offsetTop + spot.y * logo.offsetHeight - lift),
        k
      });
    };
    place();
    // (a frame later on a resize: the logo's size follows it from MainMenu's state)
    const onResize = () => requestAnimationFrame(place);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [logoScale, lift]);
  const scale = LANDING_VIEW.scale * (vanish ? vanish.k : 1);
  const content = (
    <View style={{ left: -LANDING_VIEW.vanish.x * scale, top: -LANDING_VIEW.vanish.y * scale + (vanish ? vanish.k : 1) * lift, transform: `scale(${scale})` }}>
      <Moon {...tune.moon} />
      <MoonReflection {...tune.reflection} />
      <TrafficLights paths={landingTraffic.paths} glints={landingTraffic.glints} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} zIndex={1} near={NEAR_TRAFFIC} />
    </View>
  );
  return (
    <Stage ref={stageRef} aria-hidden="true">
      {vanish && (
        <Anchor $zoom={zoom} style={{ left: vanish.x, top: vanish.y }}>
          {isBack ? content : <Fade>{content}</Fade>}
        </Anchor>
      )}
    </Stage>
  );
};
