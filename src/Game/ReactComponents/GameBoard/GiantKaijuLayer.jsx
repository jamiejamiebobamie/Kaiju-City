import React, { useMemo } from "react";
import styled, { css, keyframes } from "styled-components";
import { getSortZIndex } from "Game/DataClasses/Levels/levels";
import { FINALE } from "Game/DataClasses/GameManager";
import { GIANT_KAIJU } from "Game/DataClasses/GiantKaiju";

/*
  The final battle's giant Kaiju (GiantKaiju.ts): the Kaiju's own sheet, walking up the Peninsula, in the teammate's color.
  Its weak spot is outlined and pulses; a hit flashes it purple. A stomp or a tail sweep shows where it will land first.
*/
// the Kaiju in each frame of its walk up: from y 51 (the top of its head) to y 188 (its feet), its middle at x 80
const SHEET = { src: "/spritesheet/kaiju_sprite2.png", frameWidth: 180, frameHeight: 230.33, frames: 10, upRow: 1, art: { top: 51, feet: 188, middleX: 80 } };
export const GIANT_LOOK = {
  hitFlashMs: 320,
  outlineColor: "#fff27a",
  hitColor: "#b45cff",
  warnColor: "255, 40, 40"
};

const walkUp = keyframes`
  from { background-position-x: 0px; }
  to { background-position-x: -${SHEET.frameWidth * SHEET.frames}px; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
`;

const shrink = keyframes`
  0% { transform: scale(1); filter: brightness(1); opacity: 1; }
  70% { transform: scale(0.35); filter: brightness(2.2); opacity: 1; }
  100% { transform: scale(0.05); filter: brightness(4); opacity: 0; }
`;

const Body = styled.div`
  position: absolute;
  pointer-events: none;
  transform-origin: 0 0;
  transition: left 110ms linear, top 110ms linear;
`;

const Sprite = styled.div`
  width: ${SHEET.frameWidth}px;
  height: ${SHEET.frameHeight}px;
  background-image: url(${SHEET.src});
  background-position-y: -${SHEET.frameHeight * SHEET.upRow}px;
  animation: ${walkUp} 1.6s steps(${SHEET.frames}) infinite;
  transform-origin: ${SHEET.art.middleX}px ${SHEET.art.feet}px;
  ${props => props.$isShrinking && css`animation: ${walkUp} 1.6s steps(${SHEET.frames}) infinite, ${shrink} ${FINALE.rayMs}ms ease-in forwards;`}
`;

const WeakSpot = styled.div`
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  border: 3px solid ${GIANT_LOOK.outlineColor};
  box-shadow: 0 0 10px ${GIANT_LOOK.outlineColor}, inset 0 0 10px ${GIANT_LOOK.outlineColor};
  animation: ${pulse} 0.9s ease-in-out infinite;
  transition: left 110ms linear, top 110ms linear;
  &[data-hit] {
    border-color: ${GIANT_LOOK.hitColor};
    background: rgba(180, 92, 255, 0.45);
    box-shadow: 0 0 18px ${GIANT_LOOK.hitColor}, inset 0 0 14px ${GIANT_LOOK.hitColor};
  }
`;

const Warning = styled.div`
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  transform: translate(-50%, -50%) scaleY(0.6);
`;

// a color's hue, in degrees, however the color is written
const getHue = color => {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = color;
  const hex = ctx.fillStyle;
  if (!hex.startsWith("#")) return 120;
  const [r, g, b] = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max == min) return 0;
  const d = max - min;
  const hue = max == r ? ((g - b) / d) % 6 : max == g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hue * 60 + 360) % 360;
};

export const GiantKaijuLayer = ({ gameManager, level }) => {
  const giant = gameManager.giant;
  const color = gameManager.giantColor || "#7fff7f";
  // sepia turns the sheet a warm brown (about 35 degrees): from there it is turned to the teammate's color
  const tint = useMemo(() => `sepia(1) saturate(2.6) hue-rotate(${getHue(color) - 35}deg) drop-shadow(0 0 14px ${color})`, [color]);
  if (!giant || gameManager.giantIsGone) return null;
  const feet = giant.getFeet();
  const size = giant.getSizePx();
  // its size is the Kaiju's, not the frame's
  const scale = size.height / (SHEET.art.feet - SHEET.art.top);
  const zIndex = getSortZIndex(level, feet.y) + 20001;
  const part = giant.getPartBox();
  const isHit = giant.ms - gameManager.giantHitAtMs < GIANT_LOOK.hitFlashMs;
  const isShrinking = gameManager.giantShrinkAtMs !== undefined;
  return (
    <>
      {gameManager.giantWarnings.map(({ type, spot, radiusPx, endsAtMs, startMs }, k) => {
        const progress = Math.min(Math.max((giant.ms - startMs) / Math.max(endsAtMs - startMs, 1), 0), 1);
        const isStomp = type == "stomp";
        return (
          <Warning key={`${type} ${startMs} ${k}`} style={{
            left: `${spot.x}px`,
            top: `${spot.y}px`,
            width: `${radiusPx * 2}px`,
            height: `${radiusPx * 2}px`,
            zIndex: getSortZIndex(level, spot.y) + 20000,
            // a stomp's shadow darkens as the foot comes down; a sweep's ring brightens
            background: isStomp ? `rgba(0, 0, 0, ${0.15 + 0.5 * progress})` : "transparent",
            border: `${isStomp ? 2 : 4}px solid rgba(${GIANT_LOOK.warnColor}, ${0.35 + 0.6 * progress})`
          }} />
        );
      })}
      <Body style={{ left: `${feet.x - SHEET.art.middleX * scale}px`, top: `${feet.y - SHEET.art.feet * scale}px`, transform: `scale(${scale})`, zIndex, filter: tint }}>
        <Sprite $isShrinking={isShrinking} />
      </Body>
      {!isShrinking && (
        <WeakSpot data-hit={isHit ? "" : undefined} style={{ left: `${part.left}px`, top: `${part.top}px`, width: `${part.width}px`, height: `${part.height}px`, zIndex: zIndex + 1 }} />
      )}
    </>
  );
};

// the two meters over the board: the giant's power, and how close it is to the city
const Meters = styled.div`
  position: absolute;
  top: 3.2cqw;
  left: 50%;
  transform: translateX(-50%);
  width: 34cqw;
  display: flex;
  flex-direction: column;
  gap: 0.6cqw;
  pointer-events: none;
  z-index: 2147482600;
  font-family: inherit;
  font-size: 0.9cqw;
  letter-spacing: 0.1cqw;
  color: #f2f2f2;
  text-shadow: 0 0 3px #000;
`;

const MeterBar = styled.div`
  height: 1cqw;
  border: 0.15cqw solid rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.55);
  border-radius: 0.3cqw;
  overflow: hidden;
  & > div {
    height: 100%;
    transition: width 0.3s;
  }
`;

export const GiantMeters = ({ gameManager }) => {
  const { giant, giantPiece } = gameManager;
  if (!giant || !giantPiece || gameManager.giantIsGone) return null;
  const power = giantPiece.lives / giantPiece.maxLives;
  const progress = giant.getProgress();
  return (
    <Meters>
      <div>KAIJU POWER</div>
      <MeterBar><div style={{ width: `${power * 100}%`, background: gameManager.giantColor }} /></MeterBar>
      <div>DISTANCE TO THE CITY</div>
      <MeterBar><div style={{ width: `${(1 - progress) * 100}%`, background: progress > 0.75 ? "#ff3b3b" : "#ffd23b" }} /></MeterBar>
    </Meters>
  );
};

export { GIANT_KAIJU };
