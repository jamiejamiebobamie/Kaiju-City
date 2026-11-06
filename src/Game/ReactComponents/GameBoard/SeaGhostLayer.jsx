import React, { useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { GAME_TICK } from "Utils/gameState";

/*
  The Aquarium's sea ghosts (AquariumFlood.ts): sea creatures out of the broken tanks, pale and glowing.
  The icons are Game Icons' (public/icons/sea, CC BY 3.0: they need a line in the credits). Each is drawn as a mask,
  so it can take the ghosts' color. Between the game's ticks, each frame carries them on, so they glide.
*/
export const SEA_GHOST_LOOK = {
  sizeRows: 1.3,
  liftRows: 0.5, // they swim at chest height
  color: "#e9fbff",
  glow: "rgba(120, 220, 255, 0.95)",
  opacity: 0.82,
  fadeInMs: 500,
  fadeOutMs: 900 // the last of a ghost's life, it fades
};

const swim = keyframes`
  0%, 100% { transform: translate(-50%, -50%) rotate(-6deg); }
  50% { transform: translate(-50%, -58%) rotate(6deg); }
`;

const Layer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 2147479000;
`;

const GhostSpot = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform, opacity;
  transition: opacity 250ms ease-out;
`;

const GhostShape = styled.div`
  background: ${SEA_GHOST_LOOK.color};
  filter: drop-shadow(0 0 4px ${SEA_GHOST_LOOK.glow}) drop-shadow(0 0 10px ${SEA_GHOST_LOOK.glow});
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  animation: ${swim} 1.4s ease-in-out infinite;
`;

export const SeaGhostLayer = ({ gameManager, grid, lifeMs }) => {
  const flood = gameManager.aquariumFlood;
  const ghosts = flood ? flood.ghosts : [];
  const spots = useRef({});
  const shapes = useRef({});
  const lastTick = useRef({ ms: -1, wallMs: 0 });
  const rowPx = grid.rowStep * grid.scale;
  const sizePx = SEA_GHOST_LOOK.sizeRows * rowPx;
  const offset = { x: grid.charOffsetX * grid.scale, y: grid.charOffsetY * grid.scale + SEA_GHOST_LOOK.liftRows * rowPx };

  useEffect(() => {
    if (!flood) return undefined;
    let frame;
    const draw = () => {
      const nowMs = performance.now();
      if (flood.ms != lastTick.current.ms) lastTick.current = { ms: flood.ms, wallMs: nowMs };
      const isStill = gameManager.isPaused || !!gameManager.cutscene || gameManager.getGameResult() !== null;
      const aheadMs = isStill ? 0 : Math.min(nowMs - lastTick.current.wallMs, GAME_TICK.pieceMs);
      flood.ghosts.forEach(ghost => {
        const spot = spots.current[ghost.id];
        const shape = shapes.current[ghost.id];
        if (!spot) return;
        if (ghost.isGone) {
          spot.style.opacity = "0";
          return;
        }
        const x = ghost.x + ghost.vx * aheadMs;
        const y = ghost.y + ghost.vy * aheadMs;
        spot.style.transform = `translate(${x - offset.x}px, ${y - offset.y}px)`;
        const age = flood.ms - ghost.bornMs;
        const fade = Math.min(age / SEA_GHOST_LOOK.fadeInMs, (lifeMs - age) / SEA_GHOST_LOOK.fadeOutMs, 1);
        spot.style.opacity = `${SEA_GHOST_LOOK.opacity * Math.max(fade, 0)}`;
        // it faces the way it swims
        if (shape) shape.style.scale = ghost.vx < 0 ? "-1 1" : "1 1";
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [flood, gameManager, lifeMs]);

  if (!flood) return null;
  return (
    <Layer>
      {ghosts.filter(({ isGone }) => !isGone).map(ghost => (
        <GhostSpot key={ghost.id} ref={element => { spots.current[ghost.id] = element; }} style={{ opacity: 0 }}>
          <GhostShape ref={element => { shapes.current[ghost.id] = element; }} style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            maskImage: `url(/icons/sea/${ghost.icon}.svg)`,
            WebkitMaskImage: `url(/icons/sea/${ghost.icon}.svg)`
          }} />
        </GhostSpot>
      ))}
    </Layer>
  );
};
