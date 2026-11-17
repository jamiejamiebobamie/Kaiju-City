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
  top: min(calc(20% + 436px), calc(100% - 84px)); /* (Jamie, 2026-11-15: lowered 80px, then raised a line, 24px; was 20% + 380px), kept on screen */
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

// a wave through the word (Jamie: it was too still): each letter lifts and brightens in turn, then settles
const LETTER_WAVE = { seconds: 1.6, stepSeconds: 0.09, risePx: 6 };

const letterRise = keyframes`
  0%, 40%, 100% { transform: translateY(0); color: #c9a6ff; text-shadow: 0 0 6px rgba(150, 60, 255, 0.8); }
  15% { transform: translateY(-${LETTER_WAVE.risePx}px); color: #f3e6ff; text-shadow: 0 0 10px rgba(200, 120, 255, 1), 0 0 3px white; }
  28% { transform: translateY(1px); }
`;

const Letter = styled.span`
  display: inline-block;
  animation: ${letterRise} ${LETTER_WAVE.seconds}s ease-in-out infinite;
`;

// how far the landing's images have come in (Jamie, playtest 29: a loader before the landing; the logo moved to the
// monitor's boot, so it's off this screen)
const Progress = styled.div`
  position: absolute;
  z-index: 9;
  top: calc(50% + 34px);
  left: 50%;
  width: 260px;
  height: 6px;
  transform: translateX(-50%);
  border: 1px solid rgba(201, 166, 255, 0.6);
  box-shadow: 0 0 8px rgba(150, 60, 255, 0.5);
  & > div {
    height: 100%;
    background: #c9a6ff;
    box-shadow: 0 0 8px rgba(200, 120, 255, 0.9);
    transition: width 200ms linear;
  }
`;
export const SplashScreen = ({ progress = 0 }) => <>
  <Loading style={{ top: "calc(50% - 20px)" }}>
    {"Loading".split("").map((letter, k) => <Letter key={k} style={{ animationDelay: `${k * LETTER_WAVE.stepSeconds}s` }}>{letter}</Letter>)}
  </Loading>
  <Progress><div style={{ width: `${Math.round(progress * 100)}%` }} /></Progress>
</>;
