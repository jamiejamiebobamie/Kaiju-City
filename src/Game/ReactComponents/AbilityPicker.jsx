import React, { useState, useContext } from "react";
import styled from "styled-components";
import { GlobalSettingsContext } from 'Home';
import { getSciFiClass } from "../DataClasses/sciFiClasses";
import { getIsSkillOpen, getSkillUnlock } from "../DataClasses/Avatars";

const PICK_COUNT = 3;

// powers the player can't pick: the Kaiju's own fire, and Water (Tidal Wave), taken out of the picker (Jamie, 2026-11-05); NPCs still use Water
const PICKER_HIDDEN = ["kaijuFire", "water"];

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

/*
  Yellow accents on the board: a warm light under it that shows through the gaps between the traces,
  and a darker gold on the traces in the same places, so the two read as one board.
  Kept to a few spots, away from the middle, so they don't compete with the powers' colors.
*/
const BOARD_YELLOW = {
  light: "255, 210, 63", // under the board
  gold: "201, 150, 30", // on the traces
  spots: [
    { x: 14, y: 30, size: 22 },
    { x: 84, y: 76, size: 26 },
    { x: 70, y: 10, size: 14 },
    { x: 30, y: 88, size: 12 }
  ]
};

const getSpotGradients = (color, opacity) => BOARD_YELLOW.spots
  .map(({ x, y, size }) => `radial-gradient(circle ${size}vmax at ${x}% ${y}%, rgba(${color}, ${opacity}), transparent)`)
  .join(", ");

// under the board: z-index -1 puts it above the backdrop's color but beneath the board
const BoardLight = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: ${getSpotGradients(BOARD_YELLOW.light, 0.35)};
`;

// over the board, coloring only what is there: the traces go gold near the light
const BoardGold = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: color;
  background: ${getSpotGradients(BOARD_YELLOW.gold, 0.55)};
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

// the class shows in the description when nothing is hovered
const ClassName = styled.div`
  margin-bottom: 8px;
  font-size: 18px;
  color: white;
`;

// each power: the big circle is its active, the small one at its foot its passive
const PowerSlot = styled.div`
  position: relative;
`;

const PassiveCircle = styled.div`
  position: absolute;
  left: -4px;
  bottom: -4px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: #0b0c0e;
  border: 2px solid #5a5d64;
  border-radius: 50%;
  &:hover {
    border-color: white;
  }
`;

const PowerName = styled.div`
  margin-bottom: 8px;
  font-size: 16px;
`;

const PassiveEffect = styled.span`
  filter: brightness(1.2);
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
  playLabel = undefined, // from the Lab, the button says where it goes
  onBack = undefined,
  isTeammate,
  setIsTeammate
}) => {
  const { settingsManager } = useContext(GlobalSettingsContext);
  const [powers] = useState(() => {
    settingsManager.initAbilityStatusData();
    return Object.values(settingsManager.getAbilityAndTileStatusData()).filter(({ element }) => !PICKER_HIDDEN.includes(element));
  });
  const [hovered, setHovered] = useState(undefined); // { power, part: 'active' or 'passive' }

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

  // the hovered active or passive; with nothing hovered, the class the three picked powers make
  const getDescription = () => {
    if (!hovered) {
      if (!playerClass) return "Hover over a power to read about it. Pick 3 powers to find out your class.";
      return <><ClassName>{playerClass[0]}</ClassName>{playerClass[1]}</>;
    }
    const { power, part } = hovered;
    if (!getIsSkillOpen(power.element)) return <><PowerName>{power.activeName}</PowerName>{getLockedText(power)}</>;
    if (part == "passive") {
      return (
        <>
          <PowerName>Passive: {power.passiveName}</PowerName>
          {power.passiveDesc}
          <br />
          <PassiveEffect style={{ color: power.color }}>{power.passiveEffect1}</PassiveEffect>
        </>
      );
    }
    return (
      <>
        <PowerName>{power.activeName}</PowerName>
        {power.activeDesc}
        <br />
        {power.activeEffect1}
      </>
    );
  };

  return (
    <Backdrop>
    <BoardLight />
    <BoardGold />
    <Panel>
      <Title>Choose your abilities</Title>
      <Groups>
        {GROUPS.map(({ label, getIsInGroup }) => (
          <Group key={label}>
            <GroupLabel>{label}</GroupLabel>
            <Powers>
              {powers.filter(getIsInGroup).map(power => {
                const isOpen = getIsSkillOpen(power.element);
                const iconColor = isOpen ? power.color : "#5a5d64";
                return (
                  <PowerSlot key={power.element} onMouseLeave={() => setHovered(undefined)}>
                    <PowerButton
                      aria-label={power.activeName}
                      disabled={!isOpen}
                      $isPicked={pickedAbilities.includes(power.getElementUppercase())}
                      onClick={() => togglePower(power)}
                      onMouseEnter={() => setHovered({ power, part: "active" })}
                    >
                      <i className={`fa ${power.activeIcon}`} style={{ color: iconColor }} />
                      {!isOpen && <LockBadge className="fa fa-lock" />}
                    </PowerButton>
                    <PassiveCircle aria-label={power.passiveName} onMouseEnter={() => setHovered({ power, part: "passive" })}>
                      <i className={`fa ${power.passiveIcon}`} style={{ color: iconColor }} />
                    </PassiveCircle>
                  </PowerSlot>
                );
              })}
            </Powers>
          </Group>
        ))}
      </Groups>
      <Description>{getDescription()}</Description>
      <Footer>
        <span>{pickedAbilities.length} of {PICK_COUNT} picked</span>
        <TeammateToggle>
          <input type="checkbox" checked={isTeammate} onChange={() => setIsTeammate(value => !value)} /> Teammate
        </TeammateToggle>
        <Buttons>
          <MetalButton disabled={!isReady} onClick={handleClickPlay}>{playLabel || "Play!"}</MetalButton>
          {!onBack && <MetalButton onClick={handleClickHome}>Back</MetalButton>}
        </Buttons>
      </Footer>
    </Panel>
    </Backdrop>
  );
};
