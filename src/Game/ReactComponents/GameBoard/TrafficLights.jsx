import React, { useEffect, useRef } from "react";

/*
  Cars on the Peninsula's roads, seen from the Lab's window (Jamie, 2026-11-18): tiny lights moving along the highways
  and over the two bridges at the tip. 'paths' (scripts/labWindowView.py) are each road's outline in the picture: up
  one side and back down the other, so traffic runs both ways. Each point is [x, y, distance]; they're evenly spaced
  on the map, so a steady step along them is a steady speed, the far ones crawling as they should.
  Coming toward the window: white headlights; going away: red tail lights.
*/
const TRAFFIC = {
  pointsPerSecond: [3, 6], // a car's speed, in path points (4 map px each)
  carEvery: 6, // one car to so many path points
  size: { near: 150, least: 0.5, most: 2.2 }, // px: 'near' / distance, kept between these
  head: "255, 246, 214",
  tail: "255, 70, 50",
  farAlpha: 0.3,
  apart: 2.5 // px: no two cars drawn closer than this (no clumps where a road's outline folds back)
};
const between = ([low, high]) => low + Math.random() * (high - low);

/*
  A road's outline made drivable (Jamie, 2026-11-19: near cars bunched and left the highway where side streets join it):
  - its spurs cut: where the outline runs out and back (a side street's stub) within a few points, the excursion's
    skipped (its length along the outline over three times the gap across it);
  - its cars pulled in off the edges toward the road's middle ('inward' of the way across to the other edge: the
    nearest point running the other way);
  - wound so the cars going away (red) keep to the right of the road and those coming (white) to the left: run
    backward if it's the other way round ('isBackward').
*/
const LANE = { spurPoints: 14, spurRatio: 3, inward: 0.3, otherSideGap: 6 };
const makeDrivable = path => {
  const hop = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const kept = [];
  for (let k = 0; k < path.length;) {
    kept.push(path[k]);
    let next = k + 1;
    let along = 0;
    const lengths = [];
    for (let m = k + 1; m < Math.min(path.length, k + LANE.spurPoints + 1); m++) { along += hop(path[m - 1], path[m]); lengths[m] = along; }
    for (let m = Math.min(path.length - 1, k + LANE.spurPoints); m > k + 2; m--) {
      if (lengths[m] > LANE.spurRatio * hop(path[k], path[m]) + 2) { next = m; break; }
    }
    k = next;
  }
  const way = k => { const a = kept[Math.max(0, k - 1)], b = kept[Math.min(kept.length - 1, k + 1)]; return [b[0] - a[0], b[1] - a[1]]; };
  const inner = kept.map((point, i) => {
    const [wx, wy] = way(i);
    let best = null, bestGap = Infinity;
    for (let j = 0; j < kept.length; j++) {
      if (Math.abs(i - j) < LANE.otherSideGap) continue;
      const gap = hop(point, kept[j]);
      if (gap >= bestGap) continue;
      const [vx, vy] = way(j);
      if (wx * vx + wy * vy >= 0) continue; // (the other edge runs the other way)
      best = kept[j]; bestGap = gap;
    }
    return best ? [point[0] + (best[0] - point[0]) * LANE.inward, point[1] + (best[1] - point[1]) * LANE.inward, point[2]] : point;
  });
  // (y down the picture: the right edge going up and the left coming down winds negative)
  let area = 0;
  inner.forEach((a, i) => { const b = inner[(i + 1) % inner.length]; area += a[0] * b[1] - b[0] * a[1]; });
  return { points: inner, isBackward: area > 0 };
};

// the water's glints (Jamie, playtest 36: the water moving a little): spots on the sea that brighten and fade, each in
// its own time, the far ones smaller
const GLINT = { seconds: [1.6, 4.2], color: "150, 185, 255", most: 0.55, size: { near: 90, least: 0.4, most: 1.6 } };

// 'near' (the landing, Jamie: the cars nearest the viewer more dramatic): within 'distance' cars go up to 'speed' times
// as fast and are drawn bigger ('size': TRAFFIC.size's, overridden), and there are more of them ('carEvery' there)
export const TrafficLights = ({ paths, glints = [], width, height, zIndex, near = undefined }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !paths) return;
    const ctx = canvas.getContext("2d");
    const sizing = { ...TRAFFIC.size, ...(near && near.size) };
    const closeness = distance => near ? Math.max(0, Math.min(1, 1 - distance / near.distance)) : 0;
    // each road's cars evenly spaced round it (a little off even), all at the road's one speed, so they never catch each
    // other up and bunch (Jamie, 2026-11-19: they bunched at the base: each car had its own speed, and the near boost
    // changed along the road, piling them up where it eased off); a road coming near the viewer has more cars and its
    // whole length goes quicker, by its nearest point
    const roads = paths.map(makeDrivable);
    const cars = roads.map(road => road.points).flatMap((path, p) => {
      const nearest = Math.min(...path.map(point => point[2]));
      const nearCount = near ? path.filter(point => point[2] < near.distance).length : 0;
      const count = Math.max(1, Math.floor(path.length / TRAFFIC.carEvery) + (near ? Math.floor(nearCount / near.carEvery) : 0));
      const speed = between(TRAFFIC.pointsPerSecond) * (near ? 1 + (near.speed - 1) * closeness(nearest) : 1);
      const spacing = (path.length - 1) / count;
      const start = Math.random() * spacing;
      const span = path.length - 1;
      // (wrapped onto the road either way: a nudge back could put the first car before its start, off the road)
      const way = roads[p].isBackward ? -1 : 1;
      return [...Array(count).keys()].map(k => ({ p, at: (((start + k * spacing + (Math.random() - 0.5) * spacing * 0.4) % span) + span) % span, speed: speed * way }));
    });
    const sparkles = glints.map(([x, y, distance]) => ({ x, y, distance, period: between(GLINT.seconds), phase: Math.random() }));
    let frameId;
    let last = performance.now();
    const run = () => {
      const now = performance.now();
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      sparkles.forEach(glint => {
        const wave = Math.sin(((now / 1000) / glint.period + glint.phase) * Math.PI * 2);
        if (wave <= 0.2) return;
        const size = Math.max(GLINT.size.least, Math.min(GLINT.size.most, GLINT.size.near / glint.distance));
        ctx.globalAlpha = GLINT.most * (wave - 0.2) / 0.8;
        ctx.fillStyle = `rgb(${GLINT.color})`;
        ctx.fillRect(glint.x - size * 1.5, glint.y - size * 0.4, size * 3, size * 0.8); // (a flat glint, wider than tall)
      });
      // (Jamie, 2026-11-19: cars bunched at a junction, where a road's traced outline folds back on itself in a small
      // space: a car is not drawn on top of one already drawn this frame, within 'apart' px of the picture)
      const drawn = new Map();
      const cell = TRAFFIC.apart;
      const isCrowded = (x, y) => {
        const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const others = drawn.get(`${cx + i},${cy + j}`);
          if (others && others.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < cell)) return true;
        }
        return false;
      };
      cars.forEach(car => {
        const path = roads[car.p].points;
        const span = path.length - 1;
        car.at = (((car.at + car.speed * seconds) % span) + span) % span;
        const k = Math.floor(car.at);
        const share = car.at - k;
        const [x1, y1, d1] = path[k];
        const [x2, y2, d2] = path[k + 1];
        const x = x1 + (x2 - x1) * share;
        const y = y1 + (y2 - y1) * share;
        const distance = d1 + (d2 - d1) * share;
        const size = Math.max(sizing.least, Math.min(sizing.most, sizing.near / distance));
        if (isCrowded(x, y)) return;
        const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
        drawn.set(key, [...(drawn.get(key) || []), [x, y]]);
        const isComing = car.speed > 0 ? y2 > y1 : y2 < y1; // down the picture: toward the window
        const color = isComing ? TRAFFIC.head : TRAFFIC.tail;
        // the far ones fainter, so the tip's crowd of them glows rather than glitters
        ctx.globalAlpha = Math.max(TRAFFIC.farAlpha, Math.min(1, sizing.near / distance));
        ctx.fillStyle = `rgba(${color}, 0.25)`;
        ctx.beginPath();
        ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [paths, glints, width, height, near]);
  return <canvas ref={ref} width={width} height={height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, zIndex, pointerEvents: "none" }} />;
};
