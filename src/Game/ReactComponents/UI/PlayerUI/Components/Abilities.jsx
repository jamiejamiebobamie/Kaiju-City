import React from "react";
import styled from "styled-components";
import { Ability } from "./Ability";

export const TutorialAbilitiesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: -60px;
  margin-top: 180px;
  // margin-top: 200px;
  height: 90px;
  width: 700px;
`;

const Wrapper = styled.div`
  display: flex;
  ${props =>
    props.isReversed ? "flex-flow: row wrap;" : "flex-flow: row wrap-reverse;"}
  justify-content: flex-start;
  height: 100px;
  width: 210px;
  overflow: none;

  ${TutorialAbilitiesWrapper} > & {
    backgroung-color: red;
    width: 100%;
  }
`;

export const Abilities = ({
  playerIndex,
  setDisplayString,
  isReversed,
  isPaused,
  isCharacterAlive,
  onUseAbility,
  abilities = []
}) => {
  const abilityButtons = abilities.map((abilityData, i) => (
    <Ability
      key={i}
      abilityIndex={i}
      setDisplayString={setDisplayString}
      abilityData={abilityData}
      keyNum={isReversed ? i + 4 : i + 1}
      playerIndex={playerIndex}
      isPaused={isPaused}
      isCharacterAlive={isCharacterAlive}
      onUseAbility={onUseAbility}
    />
  ));
  return (
    <Wrapper isReversed={isReversed}>
      {abilityButtons}
    </Wrapper>
  );
};
