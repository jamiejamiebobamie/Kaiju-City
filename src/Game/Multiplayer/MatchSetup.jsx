import React, { useState } from "react";
import styled from "styled-components";
import { BATTLEGROUNDS, DEFAULT_SETUP, MAX_TEAM_SIZE } from "./multiplayerMatch";

/*
  Multiplayer's match setup (Jamie, 2026-11-19), on the monitor once the two are linked: the host picks the match type,
  the battleground (each one's whole scene as a thumbnail) and whether each side brings a team, and how many (up to 5:
  the teammate, up to 3 recruits, an Agent). The guest waits ('isWaiting') until the host's done.
*/
const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.4cqw;
  background: rgba(3, 6, 4, 0.94);
  font-family: gameboy;
  color: #c8ffb8;
  text-shadow: 0 0 0.5cqw #3aff3a;
`;
const Title = styled.div`
  font-size: 2cqw;
  letter-spacing: 0.3cqw;
`;
const Label = styled.div`
  font-size: 0.95cqw;
  letter-spacing: 0.12cqw;
  color: #9fd894;
  text-shadow: none;
`;
const Row = styled.div`
  display: flex;
  gap: 1cqw;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
`;
const Choice = styled.button`
  padding: 0.6cqw 1.3cqw;
  font-family: gameboy;
  font-size: 1cqw;
  letter-spacing: 0.12cqw;
  color: ${props => (props.$isOn ? "#05030a" : "#c8ffb8")};
  background: ${props => (props.$isOn ? "#3aff3a" : "#05030a")};
  border: 0.18cqw solid #3aff3a;
  border-radius: 0.4cqw;
  cursor: pointer;
  outline: none;
  &:disabled { color: #3e5a3a; border-color: #2a4a28; background: #05030a; cursor: not-allowed; }
`;
const Card = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4cqw;
  padding: 0.4cqw;
  width: 11cqw;
  font-family: gameboy;
  font-size: 0.75cqw;
  color: #c8ffb8;
  background: #05030a;
  border: 0.18cqw solid ${props => (props.$isOn ? "#3aff3a" : "#2a4a28")};
  box-shadow: ${props => (props.$isOn ? "0 0 1cqw rgba(58, 255, 58, 0.5)" : "none")};
  border-radius: 0.4cqw;
  cursor: pointer;
  outline: none;
`;
// (the whole scene, small: its layers over each other, as the flooded Aquarium's shattered hall over the hall)
const Thumb = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: #000;
  & img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
`;
const Count = styled.div`
  min-width: 2.4cqw;
  text-align: center;
  font-size: 1.4cqw;
`;

// 'progress' (the guest's): which of the host's choices are made, ticked off as they come ({ match, teams, count })
// 'onProgress' (the host's): told as each is made
const CHECKS = [["match", "Match selected"], ["teams", "Teammates on/off selected"], ["count", "Number of teammates selected"]];
const Checklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6cqw;
  font-size: 0.95cqw;
  letter-spacing: 0.1cqw;
`;
const Check = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  color: ${props => (props.$isDone ? "#c8ffb8" : "#4e6e48")};
  text-shadow: ${props => (props.$isDone ? "0 0 0.4cqw #3aff3a" : "none")};
  transition: color 300ms;
`;
const Box = styled.span`
  position: relative;
  width: 1.1cqw;
  height: 1.1cqw;
  border: 0.15cqw solid currentColor;
  &::after {
    content: "";
    position: absolute;
    inset: 0.2cqw;
    background: #3aff3a;
    box-shadow: 0 0 0.4cqw #3aff3a;
    transform: scale(${props => (props.$isDone ? 1 : 0)});
    transition: transform 200ms ease-out;
  }
`;

// waiting on the other player, on the monitor (Jamie: no fade to a black page)
export const MultiplayerWaiting = ({ text = "Waiting for other player...", children = undefined }) => (
  <Screen>
    <Title style={{ fontSize: "1.6cqw" }}>{text}</Title>
    {children}
  </Screen>
);

export const MatchSetup = ({ isWaiting = false, progress = {}, onProgress = (progress) => {}, onDone }) => {
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [done, setDone] = useState({});
  const change = (values, ticks) => {
    setSetup(current => ({ ...current, ...values }));
    setDone(current => {
      const next = { ...current, ...ticks };
      onProgress(next);
      return next;
    });
  };
  if (isWaiting) {
    return (
      <Screen>
        <Title>Connected!</Title>
        <Label>The host is setting up the match...</Label>
        <Checklist>
          {CHECKS.map(([key, text]) => <Check key={key} $isDone={!!progress[key]}><Box $isDone={!!progress[key]} />{text}</Check>)}
        </Checklist>
      </Screen>
    );
  }
  const isTeams = setup.teamSize > 0;
  return (
    <Screen onKeyDown={event => event.stopPropagation()}>
      <Title>Match setup</Title>
      <Label>Match</Label>
      <Row>
        <Choice $isOn={setup.mode == "standing"} onClick={() => change({ mode: "standing" }, { match: true })}>Last one standing</Choice>
        <Choice disabled title="Coming next">Peninsula defense - next</Choice>
      </Row>
      <Label>Battleground</Label>
      <Row>
        {BATTLEGROUNDS.map(({ id, name, thumbnail, thumbnailPosition, thumbnailZoom }) => (
          <Card key={id} $isOn={setup.level == id} onClick={() => change({ level: id }, { match: true })}>
            <Thumb>{thumbnail.map(src => <img key={src} src={src} alt="" style={thumbnailPosition ? { objectPosition: thumbnailPosition, transform: `scale(${thumbnailZoom || 1})`, transformOrigin: thumbnailPosition } : undefined} />)}</Thumb>
            {name}
          </Card>
        ))}
      </Row>
      <Label>Have Teammates?</Label>
      <Row>
        <Choice $isOn={!isTeams} onClick={() => change({ teamSize: 0 }, { teams: true, count: true })}>Off</Choice>
        <Choice $isOn={isTeams} onClick={() => change({ teamSize: isTeams ? setup.teamSize : 1 }, { teams: true })}>On</Choice>
      </Row>
      {isTeams && (
        <>
          <Label>How many per team?</Label>
          <Row>
            <Choice onClick={() => change({ teamSize: Math.max(1, setup.teamSize - 1) }, { count: true })} disabled={setup.teamSize <= 1}>-</Choice>
            <Count>{setup.teamSize}</Count>
            <Choice onClick={() => change({ teamSize: Math.min(MAX_TEAM_SIZE, setup.teamSize + 1) }, { count: true })} disabled={setup.teamSize >= MAX_TEAM_SIZE}>+</Choice>
          </Row>
        </>
      )}
      <Choice $isOn onClick={() => onDone(setup)}>Continue</Choice>
    </Screen>
  );
};
