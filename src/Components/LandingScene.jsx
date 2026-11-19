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
// (brightness: 0.75 of what it was, Jamie 2026-11-19: it outshone the title and the skyline)
const MOON = { lit: [250, 238, 168], glow: [38, 44, 70], glowReach: 1.6, bite: { x: -0.45, y: -0.15, size: 0.95 }, brightness: 0.75 };
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
          const color = inBite ? base : base.map((value, c) => Math.max(value, (value * 0.15 + MOON.lit[c] * 0.85) * MOON.brightness));
          discData.data.set([...color.map(Math.round), 255], k);
        } else {
          const halo = Math.pow(Math.max(0, 1 - (distance - radius) / (radius * MOON.glowReach)), 2);
          if (halo > 0) glowData.data.set([...MOON.glow.map(value => Math.round(value * halo * MOON.brightness)), 255], k);
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

/*
  The surf (Jamie, round 7): the map's breaking waves along the Peninsula's coasts, and the water round Treasure Island's
  foot, alive: light blue points, faint always, with brighter swells sweeping along them and a twinkle of their own;
  the far ones smaller. Points from scripts/labWindowView.py ('surf', 'islandSurf': [x, y, distance]).
*/
// (Jamie, round 8: the top chunk's coasts outlined, 'coast'; always showing was tried and taken back: too strong at
// the top, Treasure Island janky)
const SURF = { color: "170, 205, 255", rest: 0.12, most: 0.75, swell: { speed: 1.5, across: 0.045, down: 0.11 }, size: { near: 90, least: 0.5, most: 1.6 } };
// 'pixel': the coast's thin outline: drawn at three times the picture's resolution (a third of its pixel each, about a
// screen pixel: Jamie, 2026-11-19, one of the picture's was too thick), each point's own strength (its 4th value), at
// 'rest' when no swell is on it
const FINE = 3;
const Surf = ({ points, width, height, pixel = false, rest = SURF.rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !points) return;
    const ctx = canvas.getContext("2d");
    const spots = points.map(([x, y, distance, weight = 1]) => ({ x, y, weight, size: Math.max(SURF.size.least, Math.min(SURF.size.most, SURF.size.near / distance)), phase: Math.random() * Math.PI * 2, speed: 1 + Math.random() * 2 }));
    const fine = pixel ? FINE : 1;
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, width * fine, height * fine);
      ctx.fillStyle = `rgb(${SURF.color})`;
      spots.forEach(({ x, y, weight, size, phase, speed }) => {
        // a swell rolling along (by place), and each point's own flicker
        const swell = Math.max(0, Math.sin(t * SURF.swell.speed - x * SURF.swell.across - y * SURF.swell.down)) ** 3;
        const twinkle = 0.5 + 0.5 * Math.sin(t * speed + phase);
        ctx.globalAlpha = (rest + (SURF.most - rest) * swell * twinkle) * weight;
        if (pixel) ctx.fillRect(Math.round(x * fine), Math.round(y * fine), 1, 1);
        else ctx.fillRect(x - size, y - size * 0.4, size * 2, size * 0.8);
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [points, width, height, pixel, rest]);
  const fine = pixel ? FINE : 1;
  return <canvas ref={ref} width={width * fine} height={height * fine} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, zIndex: 1, pointerEvents: "none", imageRendering: pixel ? "pixelated" : undefined }} />;
};
/*
  The stars (Jamie, 2026-11-19): gently twinkling, each brightening and dimming slowly in its own time, a few now and
  then flaring a little brighter; single pixels of the picture, as they were drawn into it. Points from
  scripts/labWindowView.py ('stars': [x, y, brightness]).
*/
// (more visible, Jamie: deeper dimming, quicker, more of them flaring, a brighter white)
const STAR = { color: "225, 232, 255", seconds: [1.6, 4.5], low: 0.06, flare: 0.25, flareFrom: 0.82 };
const Stars = ({ points, width, height }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !points) return;
    const ctx = canvas.getContext("2d");
    const stars = points.map(([x, y, brightness]) => ({ x, y, brightness, period: STAR.seconds[0] + Math.random() * (STAR.seconds[1] - STAR.seconds[0]), phase: Math.random(), flares: Math.random() < STAR.flare }));
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${STAR.color})`;
      stars.forEach(({ x, y, brightness, period, phase, flares }) => {
        const wave = 0.5 + 0.5 * Math.sin((t / period + phase) * Math.PI * 2);
        ctx.globalAlpha = brightness * (STAR.low + (1 - STAR.low) * wave);
        ctx.fillRect(x, y, 1, 1);
        if (flares && wave > STAR.flareFrom) { // (a little cross of light at its brightest)
          ctx.globalAlpha = Math.min(1, brightness * (wave - STAR.flareFrom) / (1 - STAR.flareFrom));
          ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
        }
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [points, width, height]);
  return <canvas ref={ref} width={width} height={height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none", imageRendering: "pixelated" }} />;
};

const SURF_POINTS = [...(landingTraffic.surf || []), ...(landingTraffic.islandSurf || [])];
// (the top chunk's coast: pixel thin, a little brighter at rest so its shape reads: Jamie, 2026-11-19)
const COAST = { rest: 0.3 };

/*
  The helicopter (Jamie, 2026-11-19): a police or military one, its searchlight down on the Peninsula. It swoops in
  from the top right, settles over the Peninsula's near end, then flies on up its middle toward the city, smaller and
  smaller as it goes (it and its circle of light on the land), until it's lost behind the skyline's buildings. Small
  pixel art: a dark body, its rotor a blur, skids, a red light blinking and a white strobe. Its way: the Peninsula's
  middle, from scripts/labWindowView.py ('copter': [x, y, scale, distance] of its ground spot). In the picture's px.
*/
const COPTER = {
  ms: 17000, enterMs: 2600, lightOnMs: 800, leaveMs: 1400,
  from: { x: 1340, y: 230, size: 2.6 }, // (off the window's top right, near and big)
  altitude: 62, // px above its ground spot, at size 1
  body: 1.35, // its drawing's scale (it was too small to make out)
  light: { color: "255, 246, 222", rx: 10, ry: 3.2, sway: 4 }
};
const Copter = ({ path, horizon }) => {
  const ref = useRef(null);
  const { width, height } = LANDING_VIEW.size;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !path || !path.length) return;
    const ctx = canvas.getContext("2d");
    const nearRow = path[0][1];
    // its size by how far below the horizon its ground spot is (it shrinks into the distance)
    const sizeAt = row => 0.22 + 0.95 * Math.pow(Math.max(0, (row - horizon) / (nearRow - horizon)), 0.85);
    const ground = share => {
      const k = Math.max(0, Math.min(path.length - 1.001, share * (path.length - 1)));
      const i = Math.floor(k), f = k - i;
      return { x: path[i][0] + (path[i + 1][0] - path[i][0]) * f, y: path[i][1] + (path[i + 1][1] - path[i][1]) * f };
    };
    const ease = t => t * t * (3 - 2 * t);
    const start = performance.now();
    let frameId;
    const block = (x, y, w, h) => ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const run = now => {
      const ms = now - start;
      ctx.clearRect(0, 0, width, height);
      if (ms > COPTER.ms) return;
      const first = ground(0);
      let spot, size, air;
      if (ms < COPTER.enterMs) {
        // swooping in: from off the top right to over the near end
        const t = ease(ms / COPTER.enterMs);
        size = COPTER.from.size + (sizeAt(first.y) - COPTER.from.size) * t;
        spot = first;
        air = { x: COPTER.from.x + (first.x - COPTER.from.x) * t, y: COPTER.from.y + (first.y - COPTER.altitude * sizeAt(first.y) - COPTER.from.y) * t };
      } else {
        const t = ease((ms - COPTER.enterMs) / (COPTER.ms - COPTER.enterMs));
        spot = ground(t);
        size = sizeAt(spot.y);
        air = { x: spot.x + Math.sin(ms / 900) * 2 * size, y: spot.y - COPTER.altitude * size };
      }
      const fade = Math.min(1, (COPTER.ms - ms) / COPTER.leaveMs);
      // the searchlight: a cone from its belly to a circle on the ground, sweeping a little
      const lightOn = ms < COPTER.enterMs ? 0 : Math.min(1, (ms - COPTER.enterMs) / COPTER.lightOnMs);
      if (lightOn > 0) {
        const sway = Math.sin(ms / 1300) * COPTER.light.sway * size;
        const gx = spot.x + sway, gy = spot.y;
        const rx = COPTER.light.rx * size, ry = COPTER.light.ry * size;
        const cone = ctx.createLinearGradient(0, air.y, 0, gy);
        cone.addColorStop(0, `rgba(${COPTER.light.color}, ${0.32 * lightOn * fade})`);
        cone.addColorStop(1, `rgba(${COPTER.light.color}, ${0.1 * lightOn * fade})`);
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(air.x - 0.8 * size, air.y + 2 * size);
        ctx.lineTo(air.x + 0.8 * size, air.y + 2 * size);
        ctx.lineTo(gx + rx, gy);
        ctx.lineTo(gx - rx, gy);
        ctx.closePath();
        ctx.fill();
        const pool = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx);
        pool.addColorStop(0, `rgba(${COPTER.light.color}, ${0.55 * lightOn * fade})`);
        pool.addColorStop(1, `rgba(${COPTER.light.color}, 0)`);
        ctx.fillStyle = pool;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.scale(1, ry / rx);
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.restore();
        ctx.fill();
      }
      // the helicopter: seen from behind as it goes away (made out against the dark land: a lighter body, its top edge
      // caught by the moon, its lights bright)
      ctx.globalAlpha = fade;
      const u = size * COPTER.body;
      ctx.fillStyle = "#2b2f3d";
      block(air.x - 3.5 * u, air.y - 1.5 * u, 7 * u, 3 * u); // body
      block(air.x - 2.5 * u, air.y - 2.4 * u, 5 * u, 1 * u); // cabin top
      block(air.x - 0.5 * u, air.y + 1.5 * u, 1 * u, 2.2 * u); // tail, toward us
      ctx.fillStyle = "#6a7396";
      block(air.x - 2.5 * u, air.y - 2.4 * u, 5 * u, Math.max(1, 0.4 * u)); // moonlit top
      block(air.x + 2.6 * u, air.y - 1.5 * u, Math.max(1, 0.5 * u), 2.4 * u); // moonlit right side
      ctx.fillStyle = "#363a4a";
      block(air.x - 4 * u, air.y + 2.2 * u, 2.2 * u, 0.6 * u); // skids
      block(air.x + 1.8 * u, air.y + 2.2 * u, 2.2 * u, 0.6 * u);
      // the rotor: a pale blur, flickering
      ctx.fillStyle = `rgba(200, 210, 232, ${0.35 + 0.25 * Math.abs(Math.sin(ms / 23))})`;
      block(air.x - 8 * u, air.y - 3.3 * u, 16 * u, Math.max(1, 0.7 * u));
      // a red light blinking, a white strobe (a glow round each)
      const light = (x, y, color, glow) => {
        ctx.fillStyle = glow; block(x - 1, y - 1, 3, 3);
        ctx.fillStyle = color; block(x, y, 1, 1);
      };
      if (Math.floor(ms / 600) % 2 == 0) light(air.x, air.y + 3.6 * u, "#ff4848", "rgba(255, 72, 72, 0.35)");
      if (ms % 1300 < 110) light(air.x + 3 * u, air.y - 0.6 * u, "#ffffff", "rgba(255, 255, 255, 0.45)");
      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [path, horizon]);
  return <canvas ref={ref} width={width} height={height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, zIndex: 2, pointerEvents: "none", imageRendering: "pixelated" }} />;
};
export const COPTER_MS = COPTER.ms;

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
// 'tune': the moon's and its reflection's places and sizes (LandingTuner); 'event': the scene's current event (its
// number, while one is on: MainMenu's cycle), when the helicopter flies
export const LandingScene = ({ spot, zoom, isBack = false, logoScale = 1, lift = 0, tune = LANDING_TUNE_DEFAULTS, event = undefined }) => {
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
      <Stars points={landingTraffic.stars} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} />
      <Surf points={SURF_POINTS} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} />
      <Surf points={landingTraffic.coast} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} pixel rest={COAST.rest} />
      <Moon {...tune.moon} />

      <MoonReflection {...tune.reflection} />
      <TrafficLights paths={landingTraffic.paths} glints={landingTraffic.glints} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} zIndex={1} near={NEAR_TRAFFIC} />
    </View>
  );
  // the helicopter flies in front of the logo (Jamie, 2026-11-19): its own stage over it, placed and zoomed as the
  // scene's (below the zoom's pictures and [Press any key])
  const front = event !== undefined && (
    <View style={{ left: -LANDING_VIEW.vanish.x * scale, top: -LANDING_VIEW.vanish.y * scale + (vanish ? vanish.k : 1) * lift, transform: `scale(${scale})`, background: "none" }}>
      <Copter key={event} path={landingTraffic.copter} horizon={LANDING_VIEW.horizon} />
    </View>
  );
  return (
    <>
      <Stage ref={stageRef} aria-hidden="true">
        {vanish && (
          <Anchor $zoom={zoom} style={{ left: vanish.x, top: vanish.y }}>
            {isBack ? content : <Fade>{content}</Fade>}
          </Anchor>
        )}
      </Stage>
      <Stage aria-hidden="true" style={{ zIndex: 12 }}>
        {vanish && front && <Anchor $zoom={zoom} style={{ left: vanish.x, top: vanish.y }}>{front}</Anchor>}
      </Stage>
    </>
  );
};
