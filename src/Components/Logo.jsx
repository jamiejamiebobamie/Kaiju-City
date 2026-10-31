import React, { useState } from "react";
import styled from "styled-components";
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

  animation: fadeKaijuWalk linear 60s infinite;

  @keyframes fadeKaijuWalk {
    0% {
      opacity: 0;
      transform: scale(2.7) translate(10px, 67px);
    }
    8.5%{
      opacity: 0;
    }
    13% {
      opacity: 1;
    }
    41.5%{
      opacity: 1;
    }
    44% {
      opacity: 0;
    }
    50% {
      opacity: 0;
      transform: scale(2.7) translate(290px, 67px);
    }
    51% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(-240px, 67px);
    }
    64.5%{
      opacity: 0;
    }
    69% {
      opacity: 1;
    }
    91.5%{
      opacity: 1;
    }
    94% {
      opacity: 0;
    }
    100% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(80px, 67px);
    }  
  }
  
`;


const SpriteSheet = styled.div`
  pointer-events: none;
  display: flex;

  background-color: #101c30;

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

export const Logo = () => (<LogoWrapper>
  <Title isDescription={false}>
    <StyledSpookyText isDescription={true}>Kaiju</StyledSpookyText>{" "}
    <StyledSciFiText>City</StyledSciFiText>
    <StyledSpookyTextShadow>Kaiju</StyledSpookyTextShadow>{" "}
  </Title>
  <LogoImage src={"./SVG_logo.svg"} />
  <KaijuWrapper >
    <SpriteSheet />
  </KaijuWrapper>
  <KaijuWrapper isSmoke={true}>
    <SpriteSheet isSmoke={true}/>
  </KaijuWrapper>
</LogoWrapper>);