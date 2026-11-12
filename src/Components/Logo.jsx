import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  Title,
  StyledSpookyText,
  StyledSciFiText,
  StyledSpookyTextShadow
} from './StyledComponents'
import "App.css";

const LogoWrapper = styled.div`
  position: absolute;
  display: flex;
  align-self: center;
  flex-direction: column;

  width: 700px;
  height: 350px;

  margin-top: -370px;
`;

const LogoImage = styled.img`
  pointer-events: none;
  position: absolute;
  z-index: 9;
  display: flex;

  align-self: center;


  justify-content: space-between;
  width: 600px;
  height: 300px;

  -webkit-animation-duration: 3s;
  animation-duration: 3s;

  @keyframes fadeInLogo {
    0% {
      opacity: 0;
    }
    10% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

const KaijuWrapper = styled.div`
  pointer-events: none;

  position: absolute;

  ${props => props.isSmoke ? "z-index: 9; filter: invert(1) blur(1px) drop-shadow(0px 0px 1px rgb(191, 64, 191)) opacity(.25);" :  "z-index: 8; filter: drop-shadow(0px 0px 1px rgb(191, 64, 191));" }

  /* trimmed to when it's in view (Jamie, playtest 22: it was hidden a third of the minute): the same spots where it
     fades in and out by the buildings and the same walking speed, just no long wait off past them */
  animation: fadeKaijuWalk linear 40s infinite;

  @keyframes fadeKaijuWalk {
    0% {
      opacity: 0;
      transform: scale(2.7) translate(57.6px, 67px);
    }
    6.75% {
      opacity: 1;
    }
    49.5% {
      opacity: 1;
    }
    53.25% {
      opacity: 0;
      transform: scale(2.7) translate(256px, 67px);
    }
    54.5% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(-151.8px, 67px);
    }
    61.25% {
      opacity: 1;
    }
    95% {
      opacity: 1;
    }
    98.75% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(40.8px, 67px);
    }
    100% {
      opacity: 0;
      transform: scale(2.7) translate(57.6px, 67px);
    }
  }
  
`;


const SpriteSheet = styled.div`
  pointer-events: none;
  display: flex;

  background-color: #0b0c0e;

  ${props => props.isSmoke ?
    "background: url('spritesheet/kaiju-walk-smoke.png');"
    : "  -webkit-mask-image: url('spritesheet/kaiju-walk.png'); mask-image: url('spritesheet/kaiju-walk.png');"
  }

  ${props => props.isSmoke && "filter: hue-rotate(180deg);"}

    ${props => props.isSmoke ? "transform: scale(0.7, 0.4) translate(-90px, -165px);" : "transform: scale(0.4) translate(-130px, -165px);"}
  
  width: 180px;
  height: 231px;

  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  -webkit-transition: -webkit-transform 3s ease-in-out;

   ${props => props.isSmoke ? 'animation: smoke-flow 5s steps(10) infinite;' : 'animation: walk 5s steps(10) infinite;'}

  @keyframes walk {
    0% {
      -webkit-mask-position: 0px 0px; 
      mask-position: 0px 0px;
    }
  
    100% {
      -webkit-mask-position: -1800px 0px; 
      mask-position: -1800px 0px;
    }
  }

    @keyframes smoke-flow {
    0% {
        background-position-x: 0px;
        background-position-y: 0px;
    }
  
    100% {
      background-position-x: -1800px;
      background-position-y: 0px;
    }
  }



`;

/*
  The Kaiju's breath (Jamie, playtest 22): on each down-step of its walk it breathes out glowing purple embers, round and
  clean (not the page's pixel ones). they puff out of its mouth and drift back behind it, rising a little, and fade.
  they live in the Kaiju's own frame, so they turn round with it and trail behind whichever way it walks.
  'mouth' is in that frame (its sprite's box runs about x 2-74, y 3-96, the head top right); 'stepsAt': when in the
  5 s walk loop the feet come down, as shares of it.
*/
// each breath (Jamie): the embers come out together, set like a little cloud, pushed forward from the mouth and slowing to
// a stop; then they hang where they are and the Kaiju walks on through them, so in its own frame they slip back at its
// walking pace ('walkPerSecond', in its frame's units), sinking a little, and fade
const BREATH = { mouth: { x: 51, y: 28 }, loopSeconds: 5, stepsAt: [0.05, 0.55], perStep: 9, lifeShare: 0.48, pushShare: 0.1, walkPerSecond: 10, cloud: { width: 7, height: 5 }, headWidth: 11 };
const BREATH_LIFE_SECONDS = BREATH.loopSeconds * BREATH.lifeShare;
const BREATH_EMBERS = BREATH.stepsAt.flatMap((at, step) => Array.from({ length: BREATH.perStep }, (_, k) => {
  const random = n => ((Math.sin((step * 10 + k) * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  // a spot in a cloud: within an ellipse, thicker in the middle
  const angle = random(6) * Math.PI * 2;
  const reach = Math.sqrt(random(7));
  const cx = Math.cos(angle) * reach * BREATH.cloud.width / 2;
  const cy = Math.sin(angle) * reach * BREATH.cloud.height / 2;
  // forward, as it's breathed out: never further than a head's width from the mouth, with the cloud (Jamie)
  const push = Math.min(3 + random(2) * 4, BREATH.headWidth - cx - BREATH.cloud.width / 2);
  // the step's lurch (Jamie): as the foot lands the head dips forward and down, and the breath is thrown the same way
  const hangSeconds = BREATH_LIFE_SECONDS * (1 - BREATH.pushShare);
  return {
    key: `${step} ${k}`,
    delay: -(BREATH.loopSeconds - (at + random(1) * 0.02) * BREATH.loopSeconds), // starts at its step in the loop
    cx, cy,
    fx: cx + push, fy: cy + 2 + random(3) * 2,
    lx: cx + push * 0.8, ly: cy - 1, // then it lifts a little as the head comes back up
    bx: cx + push - BREATH.walkPerSecond * hangSeconds, by: cy + 2 + random(8) * 5, // left behind as it walks on, sinking
    size: 1 + random(4) * 1.2,
    color: ["#d47bff", "#b04cff", "#f0c4ff"][Math.floor(random(5) * 3)]
  };
}));

const breathPuff = keyframes`
  0% { transform: translate(var(--cx), var(--cy)) scale(0.5); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1); }
  2% { opacity: 1; }
  ${BREATH.lifeShare * BREATH.pushShare * 100}% { transform: translate(var(--fx), var(--fy)) scale(1); animation-timing-function: ease-out; }
  ${BREATH.lifeShare * BREATH.pushShare * 2 * 100}% { transform: translate(var(--lx), var(--ly)) scale(1); animation-timing-function: linear; }
  ${BREATH.lifeShare * 100 * 0.7}% { opacity: 0.8; }
  ${BREATH.lifeShare * 100}% { transform: translate(var(--bx), var(--by)) scale(0.6); opacity: 0; }
  100% { transform: translate(var(--bx), var(--by)) scale(0.6); opacity: 0; }
`;

const BreathEmber = styled.span`
  position: absolute;
  z-index: 1;
  border-radius: 50%;
  pointer-events: none;
  animation: ${breathPuff} ${BREATH.loopSeconds}s infinite;
`;

const Breath = () => BREATH_EMBERS.map(({ key, delay, cx, cy, fx, fy, lx, ly, bx, by, size, color }) => (
  <BreathEmber key={key} style={{
    left: `${BREATH.mouth.x}px`, top: `${BREATH.mouth.y}px`, width: `${size}px`, height: `${size}px`,
    background: `radial-gradient(circle, white 0%, ${color} 55%, transparent 100%)`,
    boxShadow: `0 0 ${size * 2}px ${color}`,
    animationDelay: `${delay}s`, "--cx": `${cx}px`, "--cy": `${cy}px`, "--fx": `${fx}px`, "--fy": `${fy}px`, "--lx": `${lx}px`, "--ly": `${ly}px`, "--bx": `${bx}px`, "--by": `${by}px`
  }} />
));

export const Logo = () => (<LogoWrapper>
  <Title isDescription={false}>
    <StyledSpookyText isDescription={true}>Kaiju</StyledSpookyText>{" "}
    <StyledSciFiText>City</StyledSciFiText>
    <StyledSpookyTextShadow>Kaiju</StyledSpookyTextShadow>{" "}
  </Title>
  <LogoImage src={"./SVG_logo.svg"} />
  <KaijuWrapper >
    <SpriteSheet />
    <Breath />
  </KaijuWrapper>
  <KaijuWrapper isSmoke={true}>
    <SpriteSheet isSmoke={true}/>
  </KaijuWrapper>
</LogoWrapper>);