import React from "react";
import { PLAYER_CLASSES } from "Utils/gameState";
import { getAbilityPickerDescription } from "Utils/utils";
import styled from "styled-components";
import { Logo } from "../../Components/Logo";

const AbilityIcon = styled.i`
  z-index: ${props => props.i};
  justify-self: center;
  align-self: center;
  transform: scale(2);
  color: ${props => (props.color ? props.color : "grey")};
`;
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 600px;
  ${props =>
    !props.isClassWrapper &&
    "padding: 20px; border-style: solid; border-thickness: thin; max-width: 400px;"}
  /* width: 100%; */
  width: 500px;
  padding-left: 40px;
  padding-right: 40px;

  // height: 300px;
  border-style: solid;
  border-radius: 10px;
  border-color: #db974f;
  // text-font: 30px;
  font-alignment: 30px;
  color: #db974f;
  /* background-color: green; */
  /* box-shadow: 3px 7px 10px black; */
  align-self: flex-end;
  height: 300px;
  border-width: 1px;
`;
export const DescriptionDisplay = ({
  displayString,
  playerData,
  isClassWrapper,
  pickedAbilities,
  isTutorial
}) => {

  const classObject = Array.isArray(pickedAbilities) &&
    pickedAbilities.length === 3 &&
    Array.isArray(PLAYER_CLASSES) &&
    !!PLAYER_CLASSES.find(classObject =>
      typeof (classObject.elems) == 'string'
      && classObject.elems.split(",").sort((a1, a2) => a1.localeCompare(a2)).join(",") === pickedAbilities.join(",")) ?
    PLAYER_CLASSES.find(classObject =>
      typeof (classObject.elems) == 'string'
      && classObject.elems.split(",").sort((a1, a2) => a1.localeCompare(a2)).join(",") === pickedAbilities.join(","))
    : null;

  const [_string, playerIndex] = (displayString &&
    displayString.split(" ")) || ["", 0];

  const {
    title,
    description,
    effect1,
    effect2,
    RoE,
    AoE,
    img,
    icon,
    color
  } = (displayString &&
    getAbilityPickerDescription(_string, playerData, Number(playerIndex))) ||
  (!!classObject && getAbilityPickerDescription("class", [{
    playerClass: classObject.class_name,
    playerClassDescription: classObject.player_class_description,
    elements: classObject.elems
  }], Number(playerIndex))) ||
    {
      title: "",
      description: "Select 3 abilities to find out your class",
      img: "",
      formatData: {}
    };

  return (
    <Wrapper isClassWrapper={isClassWrapper}>
      <h2
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "25px",
          minHeight: "70px",
          alignItems: "center"
        }}
      >
        {!isTutorial && !title ? (
          <Logo isDescription={true} />
        ) : (
          <span style={{ maxWidth: "450px" }}>{title}</span>
        )}
        {!!title && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end"
            }}
          >
            {(!!RoE && !!AoE) ? <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                flexDirection: "column",
                fontSize: "11px",
                // height: '20px',
                marginTop: '-5px',
                marginRight: '30px'
              }}
            >
              <p>{`Range: ${RoE}`}</p>
              <p>{`Area: ${AoE}`}</p>
            </div> : null}
            <AbilityIcon color={color} className={`fa ${icon}`} />
          </div>
        )}
      </h2>
      <p>{description}</p>
      <p>{effect1}</p>
      {/* <p>{effect2}</p> */}
      <img src={img} />
    </Wrapper>
  );
};
