import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { LAB_SPOT, PENINSULA } from "Game/DataClasses/Levels/levels";
import { getPerimeterEdges, getTileCenter } from "Game/DataClasses/GameBoard/hexGrid";

/*
  The Agent's radio calls show the Peninsula on a radar (Jamie, 2026-11-06): only its outline, in green, a third of the
  screen tall and in the middle, with a sweep turning round from the Lab, out past the edges of the screen.
  With the siren, one glowing dot for each Kaiju in the coming fight: they come in from off the screen toward the
  Peninsula, quick at first, slowing all the while (a continuous decay), so by about 15 s they have all but stopped.
*/
export const RADAR = {
  mapShare: 1 / 3, // the Peninsula's height, as a share of the screen's
  color: "#3dff7a",
  sweepSeconds: 4, // one turn
  sweepTrail: 0.9, // the fading light behind the sweep, in radians
  rings: 4, // range rings round the Lab
  dotColor: "#ff4d3d",
  dotRadius: 4,
  dotDecaySeconds: 3, // how fast they slow: after 15 s (five of these) they have almost stopped
  dotStopShare: 0.9, // how close they come: this share of the way from off the screen to the coast
  blipSeconds: 1.2 // a dot flares as the sweep passes it, and fades over this long
};

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2147482900;
  background: radial-gradient(circle at 50% 50%, #071a0e 0%, #020805 75%);
`;

// the Peninsula's outline, from its land tiles' outer edges, in the Peninsula's own pixels
const getOutline = () => {
  const { grid, walkableTiles } = PENINSULA;
  const halfWidth = (grid.colStep * grid.scale * 2) / 3;
  const halfHeight = (grid.rowStep * grid.scale) / 2;
  const getCorners = ({ x, y }) => [
    { x: x + halfWidth, y }, { x: x + halfWidth / 2, y: y + halfHeight }, { x: x - halfWidth / 2, y: y + halfHeight },
    { x: x - halfWidth, y }, { x: x - halfWidth / 2, y: y - halfHeight }, { x: x + halfWidth / 2, y: y - halfHeight }
  ];
  return getPerimeterEdges(walkableTiles).map(({ tile, edge }) => {
    const corners = getCorners(getTileCenter(grid, tile));
    return [corners[edge], corners[(edge + 1) % 6]];
  });
};

// 'dotCount': Kaiju in the coming fight. 'alarmAtMs': when the siren began (no dots before it, or without one)
export const RadarMap = ({ dotCount = 0, alarmAtMs = undefined }) => {
  const canvasRef = useRef(null);
  const alarmRef = useRef(alarmAtMs);
  alarmRef.current = alarmAtMs;
  const dotsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const outline = getOutline();
    const { width: mapWidth, height: mapHeight } = PENINSULA.world;
    let frame;
    const startMs = performance.now();

    const draw = nowMs => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width != Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = (height * RADAR.mapShare) / mapHeight;
      const left = width / 2 - (mapWidth * scale) / 2;
      const top = height / 2 - (mapHeight * scale) / 2;
      const toScreen = ({ x, y }) => ({ x: left + x * scale, y: top + y * scale });
      const lab = toScreen(LAB_SPOT);
      const reach = Math.hypot(width, height);

      // range rings round the Lab
      ctx.strokeStyle = RADAR.color;
      ctx.lineWidth = 1;
      for (let k = 1; k <= RADAR.rings; k += 1) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(lab.x, lab.y, (reach / RADAR.rings) * k, 0, Math.PI * 2);
        ctx.stroke();
      }

      // the sweep, and its fading light behind it
      const angle = (((nowMs - startMs) / 1000) / RADAR.sweepSeconds) * Math.PI * 2;
      const trailSteps = 24;
      for (let k = 0; k < trailSteps; k += 1) {
        const share = k / trailSteps;
        const from = angle - RADAR.sweepTrail * share;
        ctx.globalAlpha = 0.18 * (1 - share);
        ctx.fillStyle = RADAR.color;
        ctx.beginPath();
        ctx.moveTo(lab.x, lab.y);
        ctx.arc(lab.x, lab.y, reach, from - RADAR.sweepTrail / trailSteps, from);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lab.x, lab.y);
      ctx.lineTo(lab.x + Math.cos(angle) * reach, lab.y + Math.sin(angle) * reach);
      ctx.stroke();

      // the Peninsula, in outline
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = RADAR.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      outline.forEach(([a, b]) => {
        const from = toScreen(a);
        const to = toScreen(b);
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
      });
      ctx.stroke();
      // the Lab
      ctx.fillStyle = RADAR.color;
      ctx.beginPath();
      ctx.arc(lab.x, lab.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // the Kaiju, once the siren goes: in from off the screen, slowing as they come
      const alarm = alarmRef.current;
      if (alarm !== undefined && dotCount > 0) {
        const middle = { x: width / 2, y: height / 2 };
        if (dotsRef.current.length != dotCount) {
          dotsRef.current = Array.from({ length: dotCount }, (_, k) => ({ angle: (k / dotCount) * Math.PI * 2 + Math.random() * 0.6 }));
        }
        const seconds = Math.max((nowMs - alarm) / 1000, 0);
        const share = (1 - Math.exp(-seconds / RADAR.dotDecaySeconds)) * RADAR.dotStopShare;
        const coast = (mapHeight * scale) / 2;
        dotsRef.current.forEach(({ angle: dotAngle }) => {
          const distance = reach / 2 + 40 - (reach / 2 + 40 - coast) * share;
          const spot = { x: middle.x + Math.cos(dotAngle) * distance, y: middle.y + Math.sin(dotAngle) * distance };
          // it flares as the sweep goes past it, seen from the Lab
          const seen = Math.atan2(spot.y - lab.y, spot.x - lab.x);
          const since = ((angle - seen) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const flare = Math.exp(-(since / (Math.PI * 2)) * RADAR.sweepSeconds / RADAR.blipSeconds * 3);
          ctx.globalAlpha = 0.45 + 0.55 * flare;
          ctx.fillStyle = RADAR.dotColor;
          ctx.shadowColor = RADAR.dotColor;
          ctx.shadowBlur = 8 + 10 * flare;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, RADAR.dotRadius + 2 * flare, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [dotCount]);

  return <Canvas ref={canvasRef} />;
};
