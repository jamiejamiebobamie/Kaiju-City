import React, { useContext } from "react";
import { Difficulty, GlobalSettingsContext } from "Home";
import styled from "styled-components";

export const Wrapper = styled.div`
  position: relative;
  display: flex;
  align-self: center;
  align-items: center;
  width: auto;
  height: 100dvh;
  max-height: 710px;
  max-width: 870px;
  flex-direction: column;
  align-self: center;
  align-items: center;
  border-radius: 10px;
  border-style: solid;
  border-thickness: thin;
  border-color: #db974f;
  transition: 3s;
  // margin-top: 80px;
`;

export const SectionHeader = styled.div`
  ${props => props.padding ? `padding: ${props.padding};` : "padding: 40px 0px 20px 30px;"}
  color: rgb(219, 151, 79);
  font-size: 20px;
  ${props => props.textAlign && `text-align: ${props.textAlign};`}
`;

export const DifficultyWrapper = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 10px 30px;
`;

export const DifficultyButtonWrapper = styled.div`
    width: 100%;
    display: flex;
    justify-content: center;
`;

export const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 500px;
  height: 50px;
  transform: scale(1.2, 1.5);
  margin 25px 50px;
`;

export const RadioButton = styled.div`
  display: flex;
  align-self: center;
  justify-content: center;
  width: 200px;
  min-width: 200px;
  height: 30px;

  font-alignment: center;
  cursor: pointer;

  border-top: 3px solid #5a8a7a;
  border-bottom: 5px solid #5a8a7a;
  border-right: solid black .75px;
  border-left: solid black .75px;
  border-radius: none;

  ${props => props.first && `
    border-left: 3px solid #5a8a7a;
    border-top-left-radius: 5px;
    border-bottom-left-radius: 5px;
    `
  }

  ${props => props.last &&
    `border-right: 3px solid #5a8a7a;
    border-top-right-radius: 5px;
    border-bottom-right-radius: 5px;`}

  color: #5a8a7a;
  filter: drop-shadow(0px 3px 1px black);
  -webkit-text-stroke: 0.5px black;


  ${props => !props.selected &&
    `&:hover {
    border-bottom: 3px solid #5a8a7a;
    transform: translate(0px, 3px);
    filter: drop-shadow(0px 0px 0px black);
  }`}

  ${props => props.selected &&
    `border-bottom: 3px solid #5a8a7a;
    transform: translate(0px, 1px);
    -webkit-text-stroke: 0.5px #fff080;
    color: #d1c569;
    filter: drop-shadow(rgb(255, 240, 128) 0px 0px 3px);
    `}


  ${props => props.selected && !(props.first || props.last) &&
    `border-right: solid #fff080 .75px;
    border-left: solid #fff080 .75px;`}

  ${props => props.selected && props.first && `border-right: solid #fff080 .75px;`}

  ${props => props.selected && props.last && `border-left: solid #fff080 .75px;`}

  font-size: 25px;
  text-stroke: 0.5px black;
  background-color: #376e5b;
`;

export const RadioButtonOutline = styled.div`
  position: absolute;
  z-index: ${props => props.zIndex};
  width: 200px;
  min-width: 200px;
  height: 29.5px;
  margin-top: -0.5px;
  pointer-events: none;

  border-top: 0.75px solid black;
  border-bottom: 0.5px solid black;
  border-right: none;
  border-left: none;
  border-radius: none;

${props => props.first &&
    `border-left: 0.3px solid black;
    border-top-left-radius: 3px;
    border-bottom-left-radius: 3px;`}

${props => props.last &&
    `border-right: 0.3px solid black;
    border-top-right-radius: 3px;
    border-bottom-right-radius: 3px;`}

${props => props.first && props.selected &&
    `border-left: 0.3px solid #fff080;
    border-top-left-radius: 3px;
    border-bottom-left-radius: 3px;`}

${props => props.last && props.selected &&
    `border-right: 0.3px solid #fff080;
    border-top-right-radius: 3px;
    border-bottom-right-radius: 3px;`}

${props => props.selected && `border-top: 0.75px solid #fff080; border-bottom: 0.5px solid #fff080;`}

`;

export const AbilityEditorSectionWrapper = styled.div`
  position: relative;
  width: 100%;

    display: flex;
    height: 400px;
    flex-direction: column;
    justify-content: flex-end;
`;

export const AbilityEditorButton = styled.div`
  display: flex;
  align-self: center;
  justify-content: center;

  width: 550px;
  height: 50px;

  font-alignment: center;
  cursor: pointer;

  border-radius: 5px;
  border-style: solid;

  border-top: 3px solid #5a8a7a;
  border-right: 4px solid #5a8a7a;
  border-left: 4px solid #5a8a7a;
  border-bottom: 7px solid #5a8a7a;
  color: #5a8a7a;
  filter: drop-shadow(0px 3px 1px black);

  &:hover {
    // margin-top: 4px;
    border-bottom: 4px solid #5a8a7a;
    transform: translate(0px, 5px);
    filter: drop-shadow(0px 0px 0px black);
  }

  line-height: 48px;
  font-size: 31px;
  text-stroke: 0.5px black;
  -webkit-text-stroke: 0.5px black;
  background-color: #376e5b;
`;

export const AbilityEditorButtonOutline = styled.div`
  position: absolute;
  z-index: ${props => props.zIndex};
  width: 550px;
  height: 49.5px;
  margin-top: -0.5px;
  pointer-events: none;
  border-radius: 3px;
  border: 0.75px solid black;
  border-right: 0.3px solid black;
  border-left: 0.3px solid black;
  border-bottom: 0.5px solid black;
`;

export const NavButtonSectionWrapper = styled.div`
    // position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    // flex-direction: column;
    // justify-content: flex-end;
    // padding: 0px 0px 0px 60px;
    justify-content: space-around;
    margin-bottom: 130px;
    `;

export const NavButton = styled.div`
  display: flex;
  align-self: flex-end;
  justify-content: center;

  width: 240px;
  height: 45px;

  margin: 0px 0px 110px;

  font-alignment: center;
  cursor: pointer;

  border-radius: 5px;
  border-style: solid;

  border: 4px solid #5a8a7a;
  border-bottom: 7px solid #5a8a7a;
  color: #5a8a7a;
  filter: drop-shadow(0px 3px 1px black);

  &:hover {
    border-bottom: 5px solid #5a8a7a;
    transform: translate(0px, 3px);
    filter: drop-shadow(0px 0px 0px black);
  }

  font-size: 27px;
  line-height: 42px;
  text-stroke: 0.5px black;
  -webkit-text-stroke: 0.5px black;
  background-color: #376e5b;

  ${props => props.margin && `margin: ${props.margin};`}
`;

export const NavButtonOutline = styled.div`
  position: absolute;
  z-index: ${props => props.zIndex};
  width: 240px;
  height: 44.5px;
  margin-top: -0.5px;
  pointer-events: none;
  border-radius: 3px;
  border: 0.75px solid black;
  border-right: 0.3px solid black;
  border-left: 0.3px solid black;
  border-bottom: 0.5px solid black;
`;

export const Settings = ({ handleClickHome, handleClickGame }) => {

  const { selectedDifficulty, setSelectedDifficulty } = useContext(GlobalSettingsContext);

  return (<Wrapper>
    <DifficultyWrapper>
      <SectionHeader>
        Difficulty:
      </SectionHeader>
      <DifficultyButtonWrapper>
        <RadioButton
          selected={selectedDifficulty == Difficulty.Easy}
          first={true} onClick={() => setSelectedDifficulty(Difficulty.Easy)}>
          <RadioButtonOutline selected={selectedDifficulty == Difficulty.Easy} first={true} zIndex={1} />
          Easy
        </RadioButton>
        <RadioButton
          selected={selectedDifficulty == Difficulty.Medium}
          onClick={() => setSelectedDifficulty(Difficulty.Medium)}>
          <RadioButtonOutline selected={selectedDifficulty == Difficulty.Medium} zIndex={1} />
          Medium
        </RadioButton>
        <RadioButton
          selected={selectedDifficulty == Difficulty.Hard}
          onClick={() => setSelectedDifficulty(Difficulty.Hard)}>
          <RadioButtonOutline selected={selectedDifficulty == Difficulty.Hard} zIndex={1} />
          Hard
        </RadioButton>
        <RadioButton
          selected={selectedDifficulty == Difficulty.Xtreme}
          last={true} onClick={() => setSelectedDifficulty(Difficulty.Xtreme)}>
          <RadioButtonOutline selected={selectedDifficulty == Difficulty.Xtreme} last={true} zIndex={1} />
          Xtreme
        </RadioButton>
      </DifficultyButtonWrapper>
    </DifficultyWrapper>
    <AbilityEditorSectionWrapper>
      <SectionHeader padding={'100px 0px 40px 0px'} textAlign={"center"}>
        Edit the properties of your abilities:
      </SectionHeader>
      <AbilityEditorButton onClick={() => { }}>
        <AbilityEditorButtonOutline zIndex={1} />
        Ability Editor
      </AbilityEditorButton>
    </AbilityEditorSectionWrapper>
    <NavButtonSectionWrapper>
      <NavButton margin={'0px 0px 0px 50px'} onClick={handleClickHome}>
        <NavButtonOutline zIndex={1} />
        Back
      </NavButton>
      <NavButton margin={'0px 50px 0px 0px'} onClick={handleClickGame}>
        <NavButtonOutline zIndex={1} />
        Play
      </NavButton>
    </NavButtonSectionWrapper>

  </Wrapper>
  );
};
