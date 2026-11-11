import React from "react";
import styled from "styled-components";
import { BlinkFadeEffect } from 'Components/AvatarSelection';

const Wrapper = styled.div`
  display: flex;
  ${props =>
    !props.isDead
      ? "margin-left: 5px;"
      : "flex-direction: column; margin-left: -10px; text-align: center; font-size: 15px; color: rgb(113, 255, 113); -webkit-text-stroke: 0.5px rgb(113, 255, 113);"}
  ${props =>
    !!props.isTeammate && props.isDead && "font-size: 19px;"}
  ${props =>
    !props.isTeammate && props.isDead && "line-height: 35px;"}

      ${props =>
    !!props.isTeammate && !props.isDead && "margin-bottom: 5px;"}

    
  width: 220px;
  height: 30px;
  justify-content: flex-start;
`;
/*
  How the health shows (Jamie, 2026-11-10): under HEALTH_LOOK.equalFrom capsules, each a set size, with room to spare;
  from there to HEALTH_LOOK.maxCapsules, all the same size, evenly spaced across the bar; past that, one capsule and
  "x N". every capsule shows now (Jamie, G2): health goes to 10 with training, more with Lichdom.
*/
export const HEALTH_LOOK = { equalFrom: 4, maxCapsules: 16, shareOfBar: 80 };

const getCapsuleShare = total => total < HEALTH_LOOK.equalFrom ? 100 / (HEALTH_LOOK.equalFrom + 1) : HEALTH_LOOK.shareOfBar / total;

const Count = styled.span`
  align-self: center;
  margin-left: 4px;
  font-family: gameboy;
  font-size: 15px;
  color: #ffe0e0;
  text-shadow: 1px 1px 0 black, 0 0 4px #ff2a3c, 0 0 8px #d22b2b;
`;

const Bar = styled.div`
  ${props => `min-width: ${getCapsuleShare(props.health + props.healthModifier)}%; width: ${getCapsuleShare(props.health + props.healthModifier)}%;`};
  height: 15px;
  min-height: 10px;
  margin-left: 10px;
  align-self: center;
  border-radius: 30px;
  background: linear-gradient(45deg, #d22b2b, #880808);
  margin: 5px;

  ${props =>
    !!props.isTeammate && !!props.health && "margin: 10px 5px 5px 5px;"}

  ${props => props.healthModifier > 0 
              && ((props.index + 1) > props.health) ?
                'background: linear-gradient(45deg, #2bd24aff, #065d1cff);' 
                : props.healthModifier < 0
                    && ((props.health + props.healthModifier) < 0 || (props.index + 1) > props.health + props.healthModifier) ?
                  `background: linear-gradient(45deg, #dfdfdfff, #c8c8c8ff);;  border-radius: 10px; border-style: solid; border-thickness: thin; border-color: #000;`
              : ''}  
`;
export const HealthBar = ({
  health = 0,
  isDead=false,
  isTeammate = false,
  healthModifier
}) => {
  const shown = healthModifier > 0 ? health + healthModifier : health;
  const bars = shown > HEALTH_LOOK.maxCapsules
    // a lot of health: one capsule, and how many
    ? [<Bar key="one" index={0} health={1} healthModifier={0} isTeammate={isTeammate} />, <Count key="count">x{health + healthModifier}</Count>]
    : Array(shown).fill(0).map((_, i) => <Bar key={i} index={i} health={health} healthModifier={healthModifier} isTeammate={isTeammate} />);
  return (
    <BlinkFadeEffect>
      <Wrapper
        isDead={isDead}
        isTeammate={isTeammate}
      >
        {!isDead ? bars : "Wasted!"}
      </Wrapper>
    </BlinkFadeEffect>

  );
};
