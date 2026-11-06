import React, { useEffect, useRef } from "react";
import styled from "styled-components";

/*
  Wakes behind pieces walking through shallow water.
  Look-and-feel numbers for the wakes are all here.
*/
const WAKE_LOOK = {
  color: "#d8f6ff",
  spacing: 0.3, // distance between wakes, in rows
  lifeMs: 1800,
  armLength: 1.5, // the V behind a piece, in rows
  armSpread: 0.6, // angle of each arm of the V, in radians
  rippleSize: 1, // in rows
  opacity: 0.45, // see-through: the water stays the thing you see (Jamie, 2026-11-06)
  vOpacity: 0.6, // the V is fainter still than the ripples
  lineWidth: 3,
  maxPixelRatio: 1.5
};

const StyledCanvas = styled.canvas`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
`;

export const WakeCanvas = ({ gameManager, level, isActive, zoom }) => {
  const canvasRef = useRef(null);
  const { world, grid, flood } = level;

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pixelRatio = Math.min((window.devicePixelRatio || 1) * zoom, WAKE_LOOK.maxPixelRatio);
    canvas.width = world.width * pixelRatio;
    canvas.height = world.height * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);

    const rowHeight = grid.rowStep * grid.scale;
    const lastSpots = new Map();
    let wakes = [];
    let frameRef;

    const addWakes = nowMs => {
      gameManager.getPieces().forEach(piece => {
        if (piece.isDead || !piece.isOnTiles) return;
        // the piece's feet
        const x = piece.charLocation.x - grid.charOffsetX * grid.scale;
        const y = piece.charLocation.y - grid.charOffsetY * grid.scale;
        const last = lastSpots.get(piece);
        if (!last) {
          lastSpots.set(piece, { x, y });
          return;
        }
        const distance = Math.hypot(x - last.x, y - last.y);
        if (distance < rowHeight * WAKE_LOOK.spacing) return;
        lastSpots.set(piece, { x, y });
        if (y < flood.top) return;
        wakes.push({ piece, x, y, angle: Math.atan2(y - last.y, x - last.x), startMs: nowMs });
      });
    };

    const draw = nowMs => {
      addWakes(nowMs);
      wakes = wakes.filter(({ startMs }) => nowMs - startMs < WAKE_LOOK.lifeMs);
      ctx.clearRect(0, 0, world.width, world.height);
      ctx.strokeStyle = WAKE_LOOK.color;
      ctx.lineWidth = WAKE_LOOK.lineWidth;
      ctx.lineCap = "round";
      // only each walker's newest wake draws its V: older ones are ripples, so the V's don't stack up inside each other
      const newest = new Map();
      wakes.forEach(wake => newest.set(wake.piece, wake));
      wakes.forEach(wake => {
        const { x, y, angle, startMs } = wake;
        const age = (nowMs - startMs) / WAKE_LOOK.lifeMs;
        const length = rowHeight * WAKE_LOOK.armLength * (0.5 + age);
        const ripple = rowHeight * WAKE_LOOK.rippleSize * (0.3 + age);
        ctx.globalAlpha = WAKE_LOOK.opacity * (1 - age);

        // the V, opening out behind the piece
        if (newest.get(wake.piece) == wake) {
          ctx.globalAlpha = WAKE_LOOK.opacity * WAKE_LOOK.vOpacity * (1 - age);
          ctx.beginPath();
          [-1, 1].forEach(side => {
            const armAngle = angle + Math.PI + side * WAKE_LOOK.armSpread;
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(armAngle) * length, y + Math.sin(armAngle) * length * 0.6);
          });
          ctx.stroke();
          ctx.globalAlpha = WAKE_LOOK.opacity * (1 - age);
        }

        // a ripple, flattened to sit on the floor
        ctx.beginPath();
        ctx.ellipse(x, y, ripple, ripple * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      frameRef = requestAnimationFrame(draw);
    };
    frameRef = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef);
      ctx.clearRect(0, 0, world.width, world.height);
    };
  }, [gameManager, level, isActive, zoom]);

  if (!flood) return null;
  return <StyledCanvas ref={canvasRef} style={{ width: `${world.width}px`, height: `${world.height}px` }} />;
};
