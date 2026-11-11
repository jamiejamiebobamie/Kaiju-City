import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { LAB_SPOT, PENINSULA } from "Game/DataClasses/Levels/levels";
import { getPerimeterEdges, getTileCenter } from "Game/DataClasses/GameBoard/hexGrid";

/*
  The Agent's radio calls show the Peninsula on a radar (Jamie, 2026-11-06): only its outline, in green, two thirds of
  the screen tall and in the middle, going on out of the shot at its foot and along its bridges, with a sweep turning
  round from the Lab, out past the edges of the screen, over a grainy screen.
  With the siren, one glowing dot for each Kaiju in the coming fight: they come in from off the screen toward the
  Peninsula, quick at first, slowing all the while (a continuous decay), so by about 15 s they have all but stopped,
  each at its own distance. A dot lights up as the sweep passes over it.
*/
export const RADAR = {
  mapShare: 2 / 3, // the Peninsula's height, as a share of the screen's (Jamie)
  color: "#3dff7a",
  sweepSeconds: 4, // one turn
  sweepTrail: 0.9, // the fading light behind the sweep, in radians
  rings: 4, // range rings round the Lab
  dotColor: "#ff4a4a", // red, glowing (Jamie, 2026-11-10; was a soft purple)
  dotGlow: "#ff1a1a",
  dotRadius: 5,
  dotDecaySeconds: 3, // how fast they slow: after 15 s (five of these) they have almost stopped
  dotStops: [0.75, 1.5], // where each one stops, as multiples of the Peninsula's half height from the middle: each its own, so they don't close in as a ring
  dotStartSpread: 160, // they start at different distances off the screen, up to this many pixels apart
  blipSeconds: 0.7, // a dot lights up as the sweep passes over it, and fades back over this long
  grainOpacity: 0.16, // the screen's grain
  // the Peninsula goes on out of the shot along each bridge: the bridge's last tile, and the way it runs
  bridges: [{ tile: { i: 22, j: 6 }, dir: { x: 0.868, y: -0.496 } }, { tile: { i: 4, j: 1 }, dir: { x: -0.868, y: -0.496 } }]
};

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2147482900;
  background: radial-gradient(circle at 50% 50%, #071a0e 0%, #020805 75%);
`;

/*
  The Peninsula's outline, from its land tiles' outer edges, in the Peninsula's own pixels. It is open where the land
  goes on out of the shot: along the bottom of its foot, and at the ends of the bridges. 'runs' carry those on:
  a corner, and the way it goes.
*/
const getOutline = () => {
  const { grid, walkableTiles } = PENINSULA;
  const halfWidth = (grid.colStep * grid.scale * 2) / 3;
  const halfHeight = (grid.rowStep * grid.scale) / 2;
  // clockwise from the right-hand corner: edge n runs from corner n to corner n + 1
  const getCorners = ({ x, y }) => [
    { x: x + halfWidth, y }, { x: x + halfWidth / 2, y: y + halfHeight }, { x: x - halfWidth / 2, y: y + halfHeight },
    { x: x - halfWidth, y }, { x: x - halfWidth / 2, y: y - halfHeight }, { x: x + halfWidth / 2, y: y - halfHeight }
  ];
  const isSame = (a, b) => a.i == b.i && a.j == b.j;
  const lowest = Math.max(...walkableTiles.map(tile => getTileCenter(grid, tile).y));
  const bottomTiles = walkableTiles.filter(tile => getTileCenter(grid, tile).y >= lowest - grid.rowStep * grid.scale * 0.6);
  const runs = [];

  // the foot: its bottom edges go, and its two sides carry on straight down
  const footCorners = bottomTiles.map(tile => getCorners(getTileCenter(grid, tile)));
  const footLeft = footCorners.reduce((left, corners) => corners[3].x < left.x ? corners[3] : left, footCorners[0][3]);
  const footRight = footCorners.reduce((right, corners) => corners[0].x > right.x ? corners[0] : right, footCorners[0][0]);
  runs.push({ from: footLeft, dir: { x: 0, y: 1 } }, { from: footRight, dir: { x: 0, y: 1 } });

  // each bridge: its end goes, and its two sides carry on the way it runs
  RADAR.bridges.forEach(({ tile, dir }) => {
    const center = getTileCenter(grid, tile);
    const across = { x: -dir.y, y: dir.x };
    const getAcross = corner => (corner.x - center.x) * across.x + (corner.y - center.y) * across.y;
    const corners = getCorners(center);
    runs.push(
      { from: corners.reduce((best, corner) => getAcross(corner) > getAcross(best) ? corner : best), dir },
      { from: corners.reduce((best, corner) => getAcross(corner) < getAcross(best) ? corner : best), dir }
    );
  });

  const edges = getPerimeterEdges(walkableTiles).filter(({ tile, edge }) => {
    // the foot's downward edges (from the right-hand corner round the bottom to the left-hand one)
    if (bottomTiles.some(bottom => isSame(bottom, tile)) && edge <= 2) return false;
    // a bridge's end
    const bridge = RADAR.bridges.find(({ tile: end }) => isSame(end, tile));
    if (bridge) {
      const center = getTileCenter(grid, tile);
      const corners = getCorners(center);
      const middle = { x: (corners[edge].x + corners[(edge + 1) % 6].x) / 2, y: (corners[edge].y + corners[(edge + 1) % 6].y) / 2 };
      const ahead = (middle.x - center.x) * bridge.dir.x + (middle.y - center.y) * bridge.dir.y;
      if (ahead > halfWidth * 0.3) return false;
    }
    return true;
  }).map(({ tile, edge }) => {
    const corners = getCorners(getTileCenter(grid, tile));
    return [corners[edge], corners[(edge + 1) % 6]];
  });
  return { edges, runs };
};

// the screen's grain: made once, drawn at a new place each frame
const makeGrain = () => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let k = 0; k < image.data.length; k += 4) {
    const value = Math.random() * 255;
    image.data[k] = value * 0.7;
    image.data[k + 1] = value;
    image.data[k + 2] = value * 0.75;
    image.data[k + 3] = Math.random() < 0.5 ? 255 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
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
    const grain = makeGrain();
    const grainPattern = ctx.createPattern(grain, "repeat");
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

      // the Peninsula, in outline, going on out of the shot at its foot and along its bridges
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = RADAR.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      outline.edges.forEach(([a, b]) => {
        const from = toScreen(a);
        const to = toScreen(b);
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
      });
      outline.runs.forEach(({ from, dir }) => {
        const start = toScreen(from);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + dir.x * reach, start.y + dir.y * reach);
      });
      ctx.stroke();
      // the Lab
      ctx.fillStyle = RADAR.color;
      ctx.beginPath();
      ctx.arc(lab.x, lab.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // the Kaiju, once the siren goes: in from off the screen, slowing as they come, each to its own distance
      const alarm = alarmRef.current;
      if (alarm !== undefined && dotCount > 0) {
        const middle = { x: width / 2, y: height / 2 };
        if (dotsRef.current.length != dotCount) {
          const [nearest, furthest] = RADAR.dotStops;
          dotsRef.current = Array.from({ length: dotCount }, (_, k) => ({
            angle: (k / dotCount) * Math.PI * 2 + Math.random() * 0.6,
            stop: nearest + Math.random() * (furthest - nearest),
            start: Math.random() * RADAR.dotStartSpread
          }));
        }
        const seconds = Math.max((nowMs - alarm) / 1000, 0);
        const share = 1 - Math.exp(-seconds / RADAR.dotDecaySeconds);
        const halfHeight = (mapHeight * scale) / 2;
        dotsRef.current.forEach(({ angle: dotAngle, stop, start }) => {
          const from = reach / 2 + 40 + start;
          const to = halfHeight * stop;
          const distance = from - (from - to) * share;
          const spot = { x: middle.x + Math.cos(dotAngle) * distance, y: middle.y + Math.sin(dotAngle) * distance };
          // seen from the Lab: it lights up while the sweep is over it, then fades back
          const seen = Math.atan2(spot.y - lab.y, spot.x - lab.x);
          const since = ((angle - seen) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const flare = Math.exp(-((since / (Math.PI * 2)) * RADAR.sweepSeconds) / RADAR.blipSeconds * 3);
          const radius = RADAR.dotRadius + 4 * flare;
          ctx.globalAlpha = 0.7 + 0.3 * flare;
          ctx.fillStyle = RADAR.dotColor;
          ctx.shadowColor = RADAR.dotGlow;
          ctx.shadowBlur = 14 + 28 * flare;
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, radius, 0, Math.PI * 2);
          ctx.fill();
          // a pale heart, brightest as the sweep crosses
          ctx.globalAlpha = 0.25 + 0.75 * flare;
          ctx.fillStyle = "#efe6ff";
          ctx.beginPath();
          ctx.arc(spot.x, spot.y, radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
      }

      // grain over it all, at a new place each frame
      ctx.globalAlpha = RADAR.grainOpacity;
      const offsetX = Math.random() * grain.width;
      const offsetY = Math.random() * grain.height;
      ctx.save();
      ctx.translate(-offsetX, -offsetY);
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, width + offsetX, height + offsetY);
      ctx.restore();
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [dotCount]);

  return <Canvas ref={canvasRef} />;
};
