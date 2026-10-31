import React, { useState, useContext } from "react";
import styled from "styled-components";
import { Abilities } from "Tutorial/Components/Abilities";
import { DescriptionDisplay } from "../UI/DescriptionDisplay";
import {
  ButtonsWrapper,
  Button,
  ButtonOutline
} from "../../Components/StyledComponents";
import { GlobalSettingsContext } from 'Home';

const Wrapper = styled.div`
  display: flex;
  height: auto;
  width: auto;
  background-color: #152642;
  flex-direction: column;
  justify-content: center;
  align-self: center;
  align-items: center;
  border-radius: 10px;
  border-style: solid;
  border-thickness: thin;
  border-radius: 10px;
  border-color: #db974f;
  -webkit-animation-duration: 1s;
  animation-duration: 1s;
  -webkit-animation-name: fadeInUp;
  animation-name: fadeInUp;
  @keyframes fadeInUp {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    10% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
const AbilityButtonsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  // border: 1px solid white;
  width: 100%;
  overflow: hidden;
  overflow-x: hidden;
  overflow-y: hidden;
  &::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
    width: 0; /* Remove scrollbar space */
    background: transparent; /* Optional: just make scrollbar invisible */
  }
`;
const Title = styled.div`
  ${props =>
    props.fontSize !== undefined
      ? `font-size: ${props.fontSize}px;`
      : "font-size: 29px;"}
  font-alignment: 30px;
  display: flex;
  margin-left: 50px;
  color: #db974f;
  align-items: center;
`;
const DescriptionDisplayWrapper = styled.div`
  display: flex;
  position: relative;
  justify-content: space-around;
  width: 100%;
  margin-top: 15px;
`;
export const ButtonGroup = styled.div`
  /* position: absolute; */
  /* z-index: 2; */
  display: flex;
  justify-content: flex-end;
  // flex-direction: row;
  align-items: center;
  width: 80%;
  height: 30px;
  top: 20px;
  right: 30px;
  bottom: 30px;
  transform: scale(1.2, 1.5);

  ${props => props.margin ? `margin: ${props.margin}` : `margin-top: 80px; margin-bottom: 20px;`}
  // /* background-color: orange; */
`;
const CheckboxWrapper = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin: 20px;
`;
const CheckboxText = styled.div`
  display: flex;
  width: 200px;
  margin: 10px;
  color: #db974f;
  text-stroke: 0.5px black;
  -webkit-text-stroke: 0.5px black;
`;
const Checkbox = styled.div`
  display: flex;
  margin-top: 3px;
  margin-left: 10px;
  border-style: solid;
  border-thickness: thin;
  width: 10px;
  height: 10px;
  &:hover {
    background-color: #d064ed;
  }
`;
const Checkmark = styled.i`
  margin-left: -2px;
  margin-top: -5px;
`;
export const AbilityPicker = ({
  handleClickHome,
  pickedAbilities,
  setPickedAbilities,
  handleClickPlay,
  playerData,
  numAbilitiesToPick,
  isTeammate,
  setIsTeammate
}) => {
  const { settingsManager } = useContext(GlobalSettingsContext);

  const [displayString, setDisplayString] = useState(null);
  const handleChange = element => {
    let _pickedAbilities;
    if (pickedAbilities.includes(element)) {
      _pickedAbilities = [...pickedAbilities, element]
        .filter(pickedElement => pickedElement !== element)
        .sort((a1, a2) => a1.localeCompare(a2));
      setPickedAbilities(_pickedAbilities);
    } else if (pickedAbilities.length < numAbilitiesToPick) {
      _pickedAbilities = [...pickedAbilities, element].sort((a1, a2) =>
        a1.localeCompare(a2)
      );
      setPickedAbilities(_pickedAbilities);
    }
    if (_pickedAbilities) settingsManager.setSortedPlayerChosenAbilityElementsString(_pickedAbilities);
  };
  const isPlayButtonDisabled = Array.isArray(pickedAbilities) && pickedAbilities.length < 3;
  return (
    <>
      <Wrapper>
        <AbilityButtonsWrapper>
          <div style={{ height: "75px" }}>
            <br />
            <Title>Choose your abilities</Title>
          </div>
          <Abilities
            handleChange={handleChange}
            pickedAbilities={pickedAbilities}
            setDisplayString={setDisplayString}
          />
        </AbilityButtonsWrapper>
        <DescriptionDisplayWrapper>
          <DescriptionDisplay
            isClassWrapper={true}
            displayString={displayString}
            pickedAbilities={pickedAbilities}
            playerData={playerData}
            isTutorial={true}
          />
        </DescriptionDisplayWrapper>
        <CheckboxWrapper>
          <Title alignContent={"flex-start"} fontSize={15}>
            Pick 3 abilities
          </Title>
          <CheckboxText>
            Teammate?
            <Checkbox onClick={() => setIsTeammate(_isT => !_isT)}>
              {isTeammate && <Checkmark className="fa fa-check" />}
            </Checkbox>
          </CheckboxText>
        </CheckboxWrapper>
        <ButtonGroup margin={`60px 0px -10px 0px`}>
          <ButtonsWrapper>
            <Button disabled={isPlayButtonDisabled} onClick={isPlayButtonDisabled ? () => { } : handleClickPlay}>
              <ButtonOutline zIndex={1} />
              Play!
            </Button>
          </ButtonsWrapper>
          <ButtonsWrapper>
            <Button onClick={handleClickHome}>
              <ButtonOutline zIndex={1} />
              Back
            </Button>
          </ButtonsWrapper>
        </ButtonGroup>
      </Wrapper>
    </>
  );
};
