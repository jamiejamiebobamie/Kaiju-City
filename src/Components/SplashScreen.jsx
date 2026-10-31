import React from "react";
import styled from "styled-components";

const LogoGif = styled.img`
  position: absolute;
  z-index: 9;

  top: 20%;


  display: flex;
  align-self: center;
  
  width: 700px;
  height: 350px;

  pointer-events: none;

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


export const SplashScreen = () => <LogoGif src={"./Logo.gif"} />;