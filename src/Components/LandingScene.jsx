import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { TrafficLights } from "../Game/ReactComponents/GameBoard/TrafficLights";
import landingTraffic from "./data/landingTraffic.json";

/*
  The landing's scene (Jamie, 2026-11-18): the Lab windows' Peninsula, but seen straight up its middle (one-point
  perspective), the logo's own skyline standing on its tip, the moon over it, cars on its roads and glints on the water.
  It is placed by the logo's zoom spot (MainMenu's CITY_ZOOM.spot) and zooms about it with the skyline. Its own
  vanishing point (Jamie's mock-up): under the skyline's middle, on the horizon just above the skyline's ground, so the
  Peninsula runs straight up the screen's middle, the sea either side free (for the Kaiju sprites, a ship or buoy).
  The picture (scripts/labWindowView.py, LANDING=1) is drawn at half size and shown at twice it, pixelated; 'vanish':
  the zoom spot's point in it, in its own px.
*/
export const LANDING_VIEW = { src: "/zoom-scene/0-peninsula.png", size: { width: 1700, height: 1000 }, vanish: { x: 850, y: 380 }, scale: 2, fadeInMs: 1400 };
// the cars nearest the viewer (the bottom half of the Peninsula, distance under 330 in the picture's terms) more
// dramatic (Jamie): up to 2.4 times as fast, bigger, one more car to every 4 of the road's points there
const NEAR_TRAFFIC = { distance: 330, speed: 2.4, carEvery: 4, size: { near: 260, least: 0.5, most: 3 } };

/*
  The moon's reflection on the water (Jamie, rounds 4-5): under the moon, the crescent's own shape as it is in the sky
  (no perspective, no lean), made of single pixels that wink on and off and slip side to side a little with the swell,
  so the water breaks it up. In the picture's px: its middle, its size, how far a row slips, how much of it shows.
*/
const REFLECTION = { x: 1016, y: 458, radius: 26, slip: 1.4, shown: 0.35, color: "250, 238, 168", most: 0.45 };

const MoonReflection = () => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { radius: r, slip, shown, color, most } = REFLECTION;
    const pad = Math.ceil(slip) + 2;
    const size = Math.ceil(r * 2) + pad * 2;
    canvas.width = size;
    canvas.height = size;
    // the crescent's pixels (lit right, the moon's bite flipped: a reflection), each with its own time on the water
    const pixels = [];
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const inDisc = x * x + y * y <= r * r;
        const inBite = (x + 0.45 * r) ** 2 + (y - 0.15 * r) ** 2 <= (0.95 * r) ** 2;
        if (inDisc && !inBite) pixels.push({ x, y, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.6 });
      }
    }
    const rowPhase = [...Array(Math.ceil(r * 2) + 1)].map(() => Math.random() * Math.PI * 2);
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, size, size);
      pixels.forEach(({ x, y, phase, speed }) => {
        const wave = Math.sin(t * speed + phase);
        if (wave < 1 - shown * 2) return; // (off for a while: the water breaking it up)
        const row = Math.round(slip * Math.sin(t * 1.1 + rowPhase[y + Math.ceil(r)] + y * 0.4));
        ctx.fillStyle = `rgba(${color}, ${most * (0.4 + 0.6 * (wave + 1) / 2)})`;
        ctx.fillRect(pad + r + x + row, pad + r + y, 1, 1);
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, []);
  const { x, y, radius, slip } = REFLECTION;
  const pad = Math.ceil(slip) + 2;
  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", left: x - radius - pad, top: y - radius - pad, zIndex: 1, pointerEvents: "none", imageRendering: "pixelated" }} />;
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
// logo's skyline is raised (MainMenu): the anchor goes with the skyline's zoom spot, the picture stays put
export const LandingScene = ({ spot, zoom, isBack = false, logoScale = 1, lift = 0 }) => {
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
      <MoonReflection />
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
