import React, { useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { CircuitDiscSpriteSheet, Doodads } from "Components/AvatarSelection";
import { getIsAvatarOpen, ROSTER } from "../DataClasses/Avatars";
import { PIECES_INFO } from "Utils/gameState";

/*
  The Lab's character screen. On a black screen the discs come on one by one, like neon tubes.
  Characters not yet unlocked stand as black silhouettes.
*/
const ROSTER_LOOK = {
  stepSeconds: 0.16, // between one disc coming on and the next
  columns: 5,
  cellWidth: 11, // in vw
  cellHeight: 15
};

const neonOn = keyframes`
  0% { opacity: 0; filter: brightness(0.2); }
  12% { opacity: 0.9; filter: brightness(2); }
  20% { opacity: 0.1; filter: brightness(0.3); }
  34% { opacity: 0.8; filter: brightness(1.6); }
  44% { opacity: 0.25; filter: brightness(0.5); }
  100% { opacity: 1; filter: brightness(1); }
`;

// the same turn on the spot as on the home screen
const turnAround = keyframes`
  from { background-position: 0 -1380px; }
  to { background-position: 0 0; }
`;

// on the monitor's screen, like everything in the game. sizes are fractions of the screen (cqw, cqh).
const Page = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482980;
  container-type: size;
  border-radius: 1.8cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5cqw;
  background: black;
  color: #d9dade;
  font-family: gameboy;
`;

const Heading = styled.div`
  font-size: 1.6cqw;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: ${ROSTER_LOOK.columns * ROSTER_LOOK.cellWidth}vw;
`;

const Cell = styled.button`
  position: relative;
  width: ${ROSTER_LOOK.cellWidth}vw;
  height: ${ROSTER_LOOK.cellHeight}vw;
  padding: 0;
  overflow: visible;
  color: inherit;
  font-family: gameboy;
  background: none;
  border: 0;
  cursor: ${props => props.disabled ? "default" : "pointer"};
  animation: ${neonOn} 0.9s linear both;
`;

const DiscHolder = styled.div`
  position: absolute;
  left: 50%;
  bottom: 2.6cqw;
  width: 0;
  height: 0;
  transform: scale(0.42);
  pointer-events: none;
  > div {
    top: -180px;
    left: -76px;
  }
`;

const Figure = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1.6cqw;
  width: 152px;
  height: 230px;
  transform: translateX(-50%) scale(0.72);
  transform-origin: 50% 100%;
  background-position: 0 -460px;
  background-repeat: no-repeat;
  ${props => props.$isHovered && css`
    animation: ${turnAround} 1.2s steps(6) -0.4s infinite;
    filter: drop-shadow(0 0 2px #80EF80);
  `}
`;

// the home screen's art around a character, at the size of the discs here
const DoodadHolder = styled.div`
  position: absolute;
  left: 50%;
  bottom: 2.2cqw;
  width: 0;
  height: 0;
  transform: scale(0.42);
  pointer-events: none;
  > div {
    top: -230px;
    left: -76px;
  }
`;

const Name = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.3cqw;
  font-size: 0.75cqw;
  text-align: center;
`;

const Tag = styled.div`
  position: absolute;
  left: 50%;
  top: 0.2cqw;
  transform: translateX(-50%);
  padding: 0.15cqw 0.4cqw;
  font-size: 0.7cqw;
  color: #0b0c0e;
  background: ${props => props.$isPlayer ? "#e8e9ec" : "#8d9097"};
`;

const Controls = styled.div`
  display: flex;
  gap: 0.8cqw;
`;

const MetalButton = styled.button`
  padding: 0.5cqw 1.2cqw;
  font-family: gameboy;
  font-size: 0.9cqw;
  cursor: pointer;
  color: ${props => props.$isOn ? "#0b0c0e" : "#d9dade"};
  background: ${props => props.$isOn ? "#d9dade" : "linear-gradient(#4a4c52, #26282c)"};
  border: 0.12cqw solid #8d9097;
`;

const RosterCell = ({ avatar, index, player, teammate, onPick }) => {
  const isOpen = getIsAvatarOpen(avatar);
  const [isHovered, setIsHovered] = useState(false);
  const [doodadOpacity, setDoodadOpacity] = useState(0);
  const isChosen = avatar.id == player || avatar.id == teammate;
  return (
    <Cell
      disabled={!isOpen}
      aria-label={isOpen ? avatar.name : "Locked"}
      onClick={() => onPick(avatar.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ animationDelay: `${index * ROSTER_LOOK.stepSeconds}s` }}
    >
      <DiscHolder style={{ opacity: isOpen ? 1 : 0.3 }}><CircuitDiscSpriteSheet persistDisc={avatar.id == player} isRed={avatar.id == teammate} /></DiscHolder>
      {isOpen && (
        <DoodadHolder>
          <Doodads hasPrompt={false} show={isHovered && !isChosen} persistDisc={false} isRed={avatar.id == teammate} globalTranslation="0px, 0px" opacity={doodadOpacity} setOpacity={setDoodadOpacity} />
        </DoodadHolder>
      )}
      <Figure $isHovered={isOpen && isHovered} style={{ backgroundImage: `url(/${PIECES_INFO[avatar.id].spriteSheetSrc})`, ...(isOpen ? {} : { filter: "brightness(0) drop-shadow(0 0 1px #8d9097) drop-shadow(0 0 5px #5a5d64)" }) }} />
      {avatar.id == player && <Tag $isPlayer>Player</Tag>}
      {avatar.id == teammate && <Tag>Teammate</Tag>}
      <Name>{isOpen ? avatar.name : "???"}</Name>
    </Cell>
  );
};

export const AvatarRoster = ({ player, teammate, onChoose, onClose }) => {
  const [slot, setSlot] = useState("player");

  const pick = id => {
    if (slot == "player") onChoose(id, id == teammate ? player : teammate);
    else onChoose(id == player ? teammate : player, id);
  };

  return createPortal(
    <Page>
      <Heading>Choose avatar</Heading>
      <Controls>
        <MetalButton $isOn={slot == "player"} onClick={() => setSlot("player")}>Player</MetalButton>
        <MetalButton $isOn={slot == "teammate"} onClick={() => setSlot("teammate")}>Teammate</MetalButton>
      </Controls>
      <Grid>
        {ROSTER.map((avatar, index) => <RosterCell key={avatar.id} avatar={avatar} index={index} player={player} teammate={teammate} onPick={pick} />)}
      </Grid>
      <MetalButton onClick={onClose}>Done</MetalButton>
    </Page>,
    document.querySelector("[data-play-screen]") || document.body
  );
};
