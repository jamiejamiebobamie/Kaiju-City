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
  The moon's reflection on the water (Jamie, round 4: lower right, where he looped it): the crescent upside down and
  drawn out downward, cut into thin strips that each sway on the swell and break up, brightening and fading, so it
  moves with the water. In the picture's px: its middle, the moon's size (scripts/labWindowView.py MOON_R), how far
  it's drawn out, and the strips' height and gap.
*/
// (Jamie: no need to be true to perspective if that loses the crescent: not drawn out, close strips, a gentle sway;
// the moon's pale yellow)
const REFLECTION = { x: 1142, y: 535, radius: 35, stretch: 1, strip: 1, gap: 1, sway: 1.2, color: "250, 238, 168", most: 0.6 };

const MoonReflection = () => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { radius: r, stretch, strip, gap, sway, color, most } = REFLECTION;
    const size = { width: Math.ceil(r * 2 + sway * 4 + 8), height: Math.ceil(r * 2 * stretch + 8) };
    canvas.width = size.width;
    canvas.height = size.height;
    const middle = { x: size.width / 2, y: size.height / 2 };
    // each strip: its row in the crescent (lit right, its bite now below the middle: upside down), its own swell
    const strips = [];
    for (let y = -r * stretch; y <= r * stretch; y += strip + gap) {
      const yy = y / stretch;
      const disc = Math.sqrt(Math.max(0, r * r - yy * yy));
      const bx = -0.45 * r, by = 0.15 * r, br = 0.95 * r; // (the moon's bite, flipped)
      const bite = br * br - (yy - by) * (yy - by);
      const from = bite > 0 ? Math.max(-disc, bx + Math.sqrt(bite)) : -disc;
      if (from < disc) strips.push({ y, from, to: disc, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.8, breakAt: Math.random() });
    }
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, size.width, size.height);
      strips.forEach(({ y, from, to, phase, speed, breakAt }) => {
        const shift = sway * Math.sin(t * speed + phase + y * 0.35);
        const fade = 1 - Math.abs(y) / (r * stretch);
        const flicker = 0.55 + 0.45 * Math.sin(t * speed * 1.7 + phase * 2);
        ctx.fillStyle = `rgba(${color}, ${most * fade * flicker})`;
        // broken by the water: a gap moving along the strip
        const split = from + (to - from) * ((breakAt + t * 0.12 * speed) % 1);
        const gapWidth = (to - from) * 0.18;
        ctx.fillRect(middle.x + from + shift, middle.y + y, Math.max(0, split - from), strip);
        ctx.fillRect(middle.x + split + gapWidth + shift, middle.y + y, Math.max(0, to - split - gapWidth), strip);
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, []);
  const { x, y, radius, stretch, sway } = REFLECTION;
  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", left: x - radius - sway * 2 - 4, top: y - radius * stretch - 4, zIndex: 1, pointerEvents: "none", imageRendering: "pixelated" }} />;
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
// 'logoScale': the logo's size (the picture is drawn for it at 1, and scaled with it)
export const LandingScene = ({ spot, zoom, isBack = false, logoScale = 1 }) => {
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
        y: holder.top - own.top + k * (logo.offsetTop + spot.y * logo.offsetHeight),
        k
      });
    };
    place();
    // (a frame later on a resize: the logo's size follows it from MainMenu's state)
    const onResize = () => requestAnimationFrame(place);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [logoScale]);
  const scale = LANDING_VIEW.scale * (vanish ? vanish.k : 1);
  const content = (
    <View style={{ left: -LANDING_VIEW.vanish.x * scale, top: -LANDING_VIEW.vanish.y * scale, transform: `scale(${scale})` }}>
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
