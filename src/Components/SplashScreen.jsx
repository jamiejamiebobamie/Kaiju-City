import React from "react";
import styled, { keyframes } from "styled-components";

const LogoGif = styled.img`
  position: absolute;
  z-index: 9;

  top: 20%;


  display: flex;
  align-self: center;

  width: 700px;
  height: 350px;

  pointer-events: none;
  /* a tighter glow: the wide one ran past the top of the window (Jamie, 2026-11-12) */
  filter: drop-shadow(0 0 14px rgba(150, 60, 255, 0.85)) drop-shadow(0 0 32px rgba(130, 40, 255, 0.6));

  -webkit-animation-name: fadeInLogo;
  animation-name: fadeInLogo;

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
`;

// "Loading" with its dots coming one by one, then gone, and again (Jamie, 2026-11-12)
const dots = keyframes`
  0%, 20% { content: ""; }
  25%, 45% { content: "."; }
  50%, 70% { content: ".."; }
  75%, 100% { content: "..."; }
`;

const Loading = styled.div`
  position: absolute;
  z-index: 9;
  top: calc(20% + 380px);
  align-self: center;
  font-family: gameboy;
  font-size: 20px;
  letter-spacing: 3px;
  color: #c9a6ff;
  text-shadow: 0 0 6px rgba(150, 60, 255, 0.8);
  pointer-events: none;
  /* the word itself is centred; the dots hang off its right, outside the centring (Jamie) */
  &::after {
    content: "";
    position: absolute;
    left: 100%;
    top: 0;
    text-align: left;
    animation: ${dots} 1.6s steps(1) infinite;
  }
`;

export const SplashScreen = () => <>
  <LogoGif src={"./Logo.gif"} />
  <Loading>Loading</Loading>
</>;
