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
  farAlpha: 0.3
};
const between = ([low, high]) => low + Math.random() * (high - low);

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
    const cars = paths.flatMap((path, p) => {
      const nearPoints = near ? path.map((point, k) => [point, k]).filter(([point]) => point[2] < near.distance).map(([, k]) => k) : [];
      const extra = near ? Math.floor(nearPoints.length / near.carEvery) : 0;
      return [
        ...[...Array(Math.max(1, Math.floor(path.length / TRAFFIC.carEvery))).keys()].map(() => Math.random() * (path.length - 1)),
        ...[...Array(extra).keys()].map(() => Math.min(path.length - 1.01, nearPoints[Math.floor(Math.random() * nearPoints.length)]))
      ].map(at => ({ p, at, speed: between(TRAFFIC.pointsPerSecond) }));
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
      cars.forEach(car => {
        const path = paths[car.p];
        const here = path[Math.floor(car.at)];
        const boost = near ? 1 + (near.speed - 1) * closeness(here[2]) : 1;
        car.at = (car.at + car.speed * boost * seconds) % (path.length - 1);
        const k = Math.floor(car.at);
        const share = car.at - k;
        const [x1, y1, d1] = path[k];
        const [x2, y2, d2] = path[k + 1];
        const x = x1 + (x2 - x1) * share;
        const y = y1 + (y2 - y1) * share;
        const distance = d1 + (d2 - d1) * share;
        const size = Math.max(sizing.least, Math.min(sizing.most, sizing.near / distance));
        const isComing = y2 > y1; // down the picture: toward the window
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
