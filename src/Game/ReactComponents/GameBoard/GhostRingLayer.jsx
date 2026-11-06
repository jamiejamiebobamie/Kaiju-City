import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { GAME_TICK } from "Utils/gameState";

/*
  The ghost boss's ring (GhostBoss.ts), drawn over the board. The game moves the ghosts each tick; between ticks,
  each frame carries them on, so a ring this fast still turns smoothly.
*/
export const GHOST_LOOK = {
  sizeRows: 1.25, // a ghost's height, in tile rows
  liftRows: 0.55, // drawn this far above where it is, so it floats at chest height
  color: "#f4f6ff",
  glow: "rgba(200, 215, 255, 0.95)",
  opacity: 0.86,
  formBlurPx: 7, // fading in, it starts this blurred
  formFlicker: 0.35, // and flickers, more at first
  goneMs: 260 // a spent ghost fades this fast
};

const ghostShake = keyframes`
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-3px, 1px) rotate(-8deg); }
  40% { transform: translate(3px, -1px) rotate(7deg); }
  60% { transform: translate(-2px, -2px) rotate(-6deg); }
  80% { transform: translate(2px, 2px) rotate(8deg); }
`;

const ghostBob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12%); }
`;

const Layer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 2147480000;
`;

const GhostSpot = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform, opacity;
  transition: opacity ${GHOST_LOOK.goneMs}ms ease-out;
`;

const GhostIcon = styled.i`
  display: block;
  transform: translate(-50%, -50%);
  color: ${GHOST_LOOK.color};
  text-shadow: 0 0 6px ${GHOST_LOOK.glow}, 0 0 14px ${GHOST_LOOK.glow}, 0 0 2px #000;
  animation: ${ghostBob} 0.9s ease-in-out infinite;
  &[data-shaking] {
    animation: ${ghostShake} 0.16s linear infinite;
    color: #ffffff;
    text-shadow: 0 0 6px #fff, 0 0 18px #c9b8ff, 0 0 2px #000;
  }
`;

export const GhostRingLayer = ({ gameManager, grid }) => {
  const ring = gameManager.ghostRing;
  const spots = useRef({});
  const icons = useRef({});
  const lastTick = useRef({ ms: -1, wallMs: 0 });
  const rowPx = grid.rowStep * grid.scale;
  const sizePx = GHOST_LOOK.sizeRows * rowPx;
  const offset = { x: grid.charOffsetX * grid.scale, y: grid.charOffsetY * grid.scale + GHOST_LOOK.liftRows * rowPx };

  useEffect(() => {
    if (!ring) return undefined;
    let frame;
    const draw = () => {
      const nowMs = performance.now();
      if (ring.ms != lastTick.current.ms) lastTick.current = { ms: ring.ms, wallMs: nowMs };
      // carried on from the last tick, but never past the next one
      const isStill = gameManager.isPaused || gameManager.getGameResult() !== null;
      const aheadMs = isStill ? 0 : Math.min(nowMs - lastTick.current.wallMs, GAME_TICK.pieceMs);
      const fade = ring.getFade(ring.ms + aheadMs);
      const shaking = ring.getShakingGhost();
      ring.ghosts.forEach(ghost => {
        const spot = spots.current[ghost.id];
        const icon = icons.current[ghost.id];
        if (!spot || !icon) return;
        if (ghost.state == "gone") {
          spot.style.opacity = "0";
          return;
        }
        const { x, y } = ghost.state == "circling" ? ring.getCirclingSpot(ghost, ring.ms + aheadMs) : { x: ghost.x + ghost.vx * aheadMs, y: ghost.y + ghost.vy * aheadMs };
        spot.style.transform = `translate(${x - offset.x}px, ${y - offset.y}px)`;
        // fading in: blurred and flickering at first, each ghost a little out of step
        const flicker = fade < 1 ? 1 - GHOST_LOOK.formFlicker * (1 - fade) * (0.5 + 0.5 * Math.sin(nowMs / 45 + ghost.id * 1.7)) : 1;
        spot.style.opacity = `${GHOST_LOOK.opacity * fade * flicker}`;
        spot.style.filter = fade < 1 ? `blur(${GHOST_LOOK.formBlurPx * (1 - fade)}px)` : "";
        if (shaking && shaking.id == ghost.id) icon.setAttribute("data-shaking", "");
        else icon.removeAttribute("data-shaking");
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [ring, gameManager]);

  if (!ring) return null;
  return (
    <Layer>
      {ring.ghosts.map(ghost => (
        <GhostSpot key={ghost.id} ref={element => { spots.current[ghost.id] = element; }} style={{ opacity: 0 }}>
          <GhostIcon ref={element => { icons.current[ghost.id] = element; }} className="fa fa-snapchat-ghost" style={{ fontSize: `${sizePx}px` }} />
        </GhostSpot>
      ))}
    </Layer>
  );
};
