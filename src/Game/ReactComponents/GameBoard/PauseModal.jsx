import React from "react";
import styled from "styled-components";
import { BlinkFadeEffect } from 'Components/AvatarSelection';

const Wrapper = styled.div`
  position: absolute;
  display: flex;
  z-index: 1111111111;
  flex-direction: column;
  width: 100%;
  text-align: center;
  align-self: center;
  color: #5eff5e;
  font-size: 30px;
  font-alignment: center;
  text-stroke: 0.5px #5eff5e;
  -webkit-text-stroke: 0.5px #5eff5e;
`;
export const PauseModal = () => {
  return <Wrapper>
    <BlinkFadeEffect>
      Paused
    </BlinkFadeEffect>
  </Wrapper>;
};
