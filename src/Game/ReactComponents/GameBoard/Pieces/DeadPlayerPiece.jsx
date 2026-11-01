import React from "react";
import styled from "styled-components";

const Wrapper = styled.i`
  display:  "flex";
  position: absolute;
  z-index: 19999;
  left: ${props => `${props.charLocation.x}px`};
  top: ${props => `${props.charLocation.y}px`};
  color: ${props => props.color};
  pointer-events: none;
`;

const SpriteSheet = styled.div`
  pointer-events: none;

  background-position: center;
  background-repeat: no-repeat;
  background-size: 100px 100px;

  transform: translate(-25px, 8px);
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
  pieceScale
}) => <Wrapper zIndex={zIndex} charLocation={charLocation} style={{ transform: `scale(${pieceScale})`, transformOrigin: "0 0" }}>
    <Character>
      <SpriteSheet color={color} style={{ backgroundImage: `url(/levels/dead/${avatar}.png)` }} />
    </Character>
  </Wrapper>
