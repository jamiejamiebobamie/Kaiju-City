import React from "react";
import styled from "styled-components";
import { Ability } from "./Ability";
import { PLAYER_ABILITIES } from "Utils/gameState";

const Wrapper = styled.div`
  display: flex;
  ${props =>
    props.isReversed ? "flex-flow: row wrap;" : "flex-flow: row wrap-reverse;"}
  justify-content: space-around;
  width: 100%;
  overflow: scroll;
  overflow-y: scroll;
  overflow: hidden;
  overflow-x: hidden;
  overflow-y: hidden;
  &::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
    width: 0; /* Remove scrollbar space */
    background: transparent; /* Optional: just make scrollbar invisible */
  }
`;
const AbilityTypeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  border-radius: 30px;
  // border-style: solid;
  border-width: thin;
  border-color: #db974f;
  padding: 10px;
`;
const AbilityButtonsWrapper = styled.div`
  display: flex;
  justify-content: space-around;
  width: 100%;
  height: 125px;
  margin-right: 20px;
  margin-top: -5px;
`;
const AbilityTypeTitle = styled.div`
  text-font: 10px;
  font-alignment: 30px;
  padding-top: 5px;
  display: flex;
  align-self: center;
  align-content: center;
  color: #db974f;
`;
const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 30px;
  border-style: solid;
  border-width: thin;
  border-color: #db974f;
  ${props => props.isPicked && `border-color: ${props.color};`}
  width: 60px;
  padding-top: 5px;
  padding-bottom: 5px;
`;
export const Abilities = ({
  handleChange,
  pickedAbilities,
  setDisplayString
}) => {
  const OffensivePowers =
    PLAYER_ABILITIES &&
    Object.values(PLAYER_ABILITIES)
      .slice(0, 6)
      .map(
        (
          {
            activeName,
            passiveName,
            color,
            displayLookup,
            elementUppercase,
            element,
            type
          },
          i
        ) => (
          <ButtonWrapper
            key={element}
            isPicked={pickedAbilities.includes(elementUppercase)}
            onClick={() => handleChange(elementUppercase)}
            color={color}
          >
            <Ability
              key={`${i}a`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={activeName}
              isActive={true}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
            <Ability
              key={`${i}b`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={passiveName}
              isActive={false}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
          </ButtonWrapper>
        )
      );
  const DefensivePowers =
    PLAYER_ABILITIES &&
    Object.values(PLAYER_ABILITIES)
      .slice(6, 8)
      .map(
        (
          {
            activeName,
            passiveName,
            color,
            displayLookup,
            elementUppercase,
            element,
            type
          },
          i
        ) => (
          <ButtonWrapper
            key={element}
            isPicked={pickedAbilities.includes(elementUppercase)}
            onClick={() => handleChange(elementUppercase)}
            color={color}
          >
            <Ability
              key={`${i}a`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={activeName}
              isActive={true}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
            <Ability
              key={`${i}b`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={passiveName}
              isActive={false}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
          </ButtonWrapper>
        )
      );
  const UtilityPowers =
    PLAYER_ABILITIES &&
    Object.values(PLAYER_ABILITIES)
      .slice(8, 10)
      .map(
        (
          {
            activeName,
            passiveName,
            color,
            displayLookup,
            elementUppercase,
            element,
            type
          },
          i
        ) => (
          <ButtonWrapper
            key={element}
            isPicked={pickedAbilities.includes(elementUppercase)}
            onClick={() => handleChange(elementUppercase)}
            color={color}
          >
            <Ability
              key={`${i}a`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={activeName}
              isActive={true}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
            <Ability
              key={`${i}b`}
              displayLookup={displayLookup}
              setDisplayString={setDisplayString}
              name={passiveName}
              isActive={false}
              element={element}
              isPicked={pickedAbilities.includes(elementUppercase)}
              color={color}
            />
          </ButtonWrapper>
        )
      );
  return (
    <Wrapper>
      <AbilityTypeWrapper>
        <AbilityButtonsWrapper>{OffensivePowers}</AbilityButtonsWrapper>
        <AbilityTypeTitle>Offense</AbilityTypeTitle>
      </AbilityTypeWrapper>
      <AbilityTypeWrapper>
        <AbilityButtonsWrapper>{DefensivePowers}</AbilityButtonsWrapper>
        <AbilityTypeTitle>Defense</AbilityTypeTitle>
      </AbilityTypeWrapper>
      <AbilityTypeWrapper>
        <AbilityButtonsWrapper>{UtilityPowers}</AbilityButtonsWrapper>
        <AbilityTypeTitle>Utility</AbilityTypeTitle>
      </AbilityTypeWrapper>
    </Wrapper>
  );
};
