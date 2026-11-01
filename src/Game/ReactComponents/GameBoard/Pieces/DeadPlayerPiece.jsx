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

  ${props =>
    props.isPlayerOne
      ? 'background: url("dead_player.png");'
      : 'background: url("dead_teammate.png");'}

  background-position: center;
  background-repeat: no-repeat;
  background-size: 80px 80px;

  transform: translate(-15px, 18px);
  height: 80px;
  width: 80px;

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
  i = 0
}) => <Wrapper zIndex={zIndex} charLocation={charLocation}>
    <Character>
      <SpriteSheet isPlayerOne={i === 0} color={color} />
    </Character>
  </Wrapper>
