import React from "react";
import styled from "styled-components";
import { GAME_TICK } from "Utils/gameState";

// the body moves once a game tick: easing between ticks keeps a thrown body smooth
const TICK_EASE = `${GAME_TICK.pieceMs}ms linear`;

const Wrapper = styled.i`
  display: flex;
  position: absolute;
  z-index: 19999;
  color: ${props => props.color};
  pointer-events: none;
`;

const SpriteSheet = styled.div`
  pointer-events: none;

  background-position: center;
  background-repeat: no-repeat;
  background-size: 100px 100px;

  height: 100px;
  width: 100px;

  ${props => `filter: drop-shadow(0 0 20px ${props.color});`}
`;

const Character = styled.div`
    margin-left: -20px;
    margin-top: -45px;
    width: 50px;
    height: 75px;
    position: absolute;
    z-index: 1;
    pointer-events: none;
    animation-iteration-count: 2s;
`;

export const DeadPlayer = ({
  charLocation,
  color,
  zIndex,
  avatar,
  pieceScale,
  angle = 0,
  isFlying = false
}) => <Wrapper
    zIndex={zIndex}
    color={color}
    style={{
      left: `${charLocation.x}px`,
      top: `${charLocation.y}px`,
      transform: `scale(${pieceScale})`,
      transformOrigin: "0 0",
      transition: isFlying ? `left ${TICK_EASE}, top ${TICK_EASE}` : "none"
    }}>
    <Character>
      <SpriteSheet
        color={color}
        style={{
          backgroundImage: `url(/levels/dead/${avatar}.png)`,
          transform: `translate(-25px, 8px) rotate(${angle}deg)`,
          transition: isFlying ? `transform ${TICK_EASE}` : "transform 200ms ease-out"
        }} />
    </Character>
  </Wrapper>
