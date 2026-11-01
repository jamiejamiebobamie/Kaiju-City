import React, { useState, useContext } from "react";
import styled from "styled-components";
import { GlobalSettingsContext } from 'Home';
import { getSciFiClass } from "../DataClasses/sciFiClasses";
import { getIsSkillOpen, getSkillUnlock } from "../DataClasses/Avatars";

const PICK_COUNT = 3;

const GROUPS = [
  { label: "Offense", getIsInGroup: ({ type }) => type[0] == "offensive" },
  { label: "Defense", getIsInGroup: ({ type }) => type[0] == "defensive" },
  { label: "Utility", getIsInGroup: ({ type }) => type[0] != "offensive" && type[0] != "defensive" }
];

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, #2b2d32, #0b0c0e 75%);

  /* the circuit board, tinted, and melting away into the background in places */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url(/circuit-board.png);
    image-rendering: pixelated;
    -webkit-mask-image: radial-gradient(ellipse 45% 60% at 12% 25%, black, transparent), radial-gradient(ellipse 50% 55% at 88% 80%, black, transparent), radial-gradient(ellipse 30% 35% at 70% 8%, rgba(0, 0, 0, 0.7), transparent);
    mask-image: radial-gradient(ellipse 45% 60% at 12% 25%, black, transparent), radial-gradient(ellipse 50% 55% at 88% 80%, black, transparent), radial-gradient(ellipse 30% 35% at 70% 8%, rgba(0, 0, 0, 0.7), transparent);
  }

  /* a plastic sheen across the board */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(125deg, transparent 18%, rgba(255, 255, 255, 0.1) 26%, transparent 34%, transparent 62%, rgba(255, 255, 255, 0.07) 70%, transparent 78%),
      linear-gradient(135deg, rgba(70, 120, 150, 0.16), transparent 45%, rgba(120, 90, 150, 0.14));
  }
`;

const Panel = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(880px, 92vw);
  padding: 22px 26px;
  color: #d9dade;
  background: linear-gradient(160deg, #3a3c42, #1c1d21 45%, #2b2d32);
  border: 3px solid #8d9097;
  box-shadow: 0 0 0 2px #08080a, inset 0 0 0 2px #08080a, 0 10px 30px black;
`;

const Title = styled.div`
  font-size: 26px;
  letter-spacing: 1px;
`;

const Groups = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const GroupLabel = styled.div`
  font-size: 13px;
  color: #8d9097;
`;

const Powers = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const PowerButton = styled.button`
  position: relative;
  width: 64px;
  height: 64px;
  cursor: ${props => props.disabled ? "not-allowed" : "pointer"};
  font-size: 26px;
  background: ${props => props.$isPicked ? "#d9dade" : "linear-gradient(#4a4c52, #1f2024)"};
  border: 2px solid ${props => props.$isPicked ? "white" : "#5a5d64"};
  border-radius: 50%;
  &:hover {
    border-color: white;
  }
`;

const LockBadge = styled.i`
  position: absolute;
  right: -2px;
  bottom: -2px;
  padding: 4px 5px;
  font-size: 12px;
  color: #d9dade;
  background: #0b0c0e;
  border-radius: 50%;
`;

const Description = styled.div`
  min-height: 150px;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
  background: #0f1012;
  border: 2px solid #4a4c52;
`;

const ClassLine = styled.div`
  min-height: 24px;
  font-size: 13px;
  line-height: 1.6;
`;

const ClassName = styled.span`
  margin-right: 12px;
  font-size: 18px;
  color: white;
`;

const PowerName = styled.div`
  margin-bottom: 8px;
  font-size: 16px;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
`;

const TeammateToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const Buttons = styled.div`
  display: flex;
  gap: 10px;
`;

const MetalButton = styled.button`
  padding: 10px 22px;
  font-family: gameboy;
  font-size: 15px;
  cursor: pointer;
  color: #d9dade;
  background: linear-gradient(#5a5d64, #2b2d32);
  border: 2px solid #8d9097;
  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
`;

export const AbilityPicker = ({
  handleClickHome,
  pickedAbilities,
  setPickedAbilities,
  handleClickPlay,
  isTeammate,
  setIsTeammate
}) => {
  const { settingsManager } = useContext(GlobalSettingsContext);
  const [powers] = useState(() => {
    settingsManager.initAbilityStatusData();
    return Object.values(settingsManager.getAbilityAndTileStatusData()).filter(({ element }) => element != "kaijuFire");
  });
  const [shownPower, setShownPower] = useState(undefined);

  const togglePower = power => {
    const element = power.getElementUppercase();
    const isPicked = pickedAbilities.includes(element);
    if (!isPicked && pickedAbilities.length >= PICK_COUNT) return;
    const picked = (isPicked ? pickedAbilities.filter(other => other != element) : [...pickedAbilities, element]).sort((a, b) => a.localeCompare(b));
    setPickedAbilities(picked);
    settingsManager.setSortedPlayerChosenAbilityElementsString(picked);
  };

  const getLockedText = ({ element }) => `Terminate ${getSkillUnlock(element).recruitName} to unlock this power.`;
  const isReady = pickedAbilities.length == PICK_COUNT;
  const playerClass = isReady ? getSciFiClass(pickedAbilities) : undefined;

  return (
    <Backdrop>
    <Panel>
      <Title>Choose your abilities</Title>
      <Groups>
        {GROUPS.map(({ label, getIsInGroup }) => (
          <Group key={label}>
            <GroupLabel>{label}</GroupLabel>
            <Powers>
              {powers.filter(getIsInGroup).map(power => {
                const isOpen = getIsSkillOpen(power.element);
                return (
                  <PowerButton
                    key={power.element}
                    aria-label={power.activeName}
                    disabled={!isOpen}
                    $isPicked={pickedAbilities.includes(power.getElementUppercase())}
                    onClick={() => togglePower(power)}
                    onMouseEnter={() => setShownPower(power)}
                  >
                    <i className={`fa ${power.activeIcon}`} style={{ color: isOpen ? power.color : "#5a5d64" }} />
                    {!isOpen && <LockBadge className="fa fa-lock" />}
                  </PowerButton>
                );
              })}
            </Powers>
          </Group>
        ))}
      </Groups>
      <Description>
        {shownPower ? (
          <>
            <PowerName>{shownPower.activeName}</PowerName>
            {getIsSkillOpen(shownPower.element) ? shownPower.activeDesc : getLockedText(shownPower)}
            <br />
            {getIsSkillOpen(shownPower.element) && shownPower.activeEffect1}
          </>
        ) : "Hover over a power to read about it."}
      </Description>
      <ClassLine>
        {playerClass ? <><ClassName>{playerClass[0]}</ClassName>{playerClass[1]}</> : "Pick 3 powers to find out your class."}
      </ClassLine>
      <Footer>
        <span>{pickedAbilities.length} of {PICK_COUNT} picked</span>
        <TeammateToggle>
          <input type="checkbox" checked={isTeammate} onChange={() => setIsTeammate(value => !value)} /> Teammate
        </TeammateToggle>
        <Buttons>
          <MetalButton disabled={!isReady} onClick={handleClickPlay}>Play!</MetalButton>
          <MetalButton onClick={handleClickHome}>Back</MetalButton>
        </Buttons>
      </Footer>
    </Panel>
    </Backdrop>
  );
};
