import React from "react";
import styled from "styled-components";

const Monster = styled.div`
    position: absolute;
    display: flex;
    justify-content: center;
    flex-direction:column;
    margin-left: -15px;
    margin-top: -25px;
    width: 40px;
    height: 40px;
    z-index: 20000;
    left: ${props => `${props.charLocation.x}px`};
    top: ${props => `${props.charLocation.y}px`};
    pointer-events: none;

    -webkit-animation-name: fadeOut;
    animation-name: fadeOut;
    -webkit-animation-duration: 10s;
    animation-duration: 10s;

    opacity: 0;

    @keyframes fadeOut {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }

}`;
const SpriteSheet = styled.div`
  pointer-events: none;
  display: flex;
  background: url("spritesheet/burning_kaiju_sprite.png");
  transform: scale(0.6) translate(-50px, -75px);
  width: 103px;
  height: 155px;
  filter: drop-shadow(0 0 1px #bf40bf);
  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  -webkit-transition: -webkit-transform 3s ease-in-out;
  animation: exploding 1.3s steps(5) 1 normal forwards;
  @keyframes exploding {
    from {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    to {
      background-position-x: -515px; 
      background-position-y: 0px;
    }
  }
`;

const Character = styled.div`
    width: 50px;
    height: 75px;
    position: absolute;
    z-index: 1;
  pointer-events: none;
  animation-iteration-count: 2s;
  animation: shake 0.5s;
  @keyframes shake {
    0% {
      transform: translate(1px, 1px) rotate(0deg);
    }
    10% {
      transform: translate(-1px, -2px) rotate(-1deg);
    }
    20% {
      transform: translate(-3px, 0px) rotate(1deg);
    }
    30% {
      transform: translate(3px, 2px) rotate(0deg);
    }
    40% {
      transform: translate(1px, -1px) rotate(1deg);
    }
    50% {
      transform: translate(-1px, 2px) rotate(-1deg);
    }
    60% {
      transform: translate(-3px, 1px) rotate(0deg);
    }
    70% {
      transform: translate(3px, 1px) rotate(-1deg);
    }
    80% {
      transform: translate(-1px, -1px) rotate(1deg);
    }
    90% {
      transform: translate(1px, 2px) rotate(0deg);
    }
    100% {
      transform: translate(1px, -2px) rotate(-1deg);
    }
  }
}
`;
export const ExplodingKaiju = ({ zIndex, charLocation, color }) => {
  return (
    <Monster zIndex={zIndex} charLocation={charLocation}>
      <Character>
        <SpriteSheet color={color} />
      </Character>
    </Monster>
  );
};
