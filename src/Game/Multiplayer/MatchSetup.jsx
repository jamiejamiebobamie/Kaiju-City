import React, { useState } from "react";
import styled from "styled-components";
import { BATTLEGROUNDS, DEFAULT_SETUP, MAX_KAIJU_TO_WIN, MAX_TEAM_SIZE } from "./multiplayerMatch";

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
  text-align: center;
  white-space: pre-line; /* (centred, and broken where it says: Jamie) */
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
// (the match types one above the other, in the middle, the same width: Jamie, mp playtest 3)
const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.9cqw;
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

// the link's state over a match (Jamie): "Buffering..." while the other's gone quiet, on the monitor's screen
export const NetNotice = styled.div`
  position: absolute;
  left: 50%;
  top: 12%;
  transform: translateX(-50%);
  z-index: 30;
  padding: 0.5cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.2cqw;
  letter-spacing: 0.15cqw;
  color: #c8ffb8;
  background: rgba(3, 6, 4, 0.85);
  border: 0.15cqw solid #3aff3a;
  text-shadow: 0 0 0.5cqw #3aff3a;
  pointer-events: none;
`;

// co-op's line checks (Jamie): a check for each player who's pressed Enter; both in, the bar goes green a moment
const ChecksBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1cqw;
  padding: 0.4cqw 0.8cqw;
  font-family: gameboy;
  font-size: 0.8cqw;
  letter-spacing: 0.08cqw;
  color: #c8ffb8;
  background: ${props => (props.$isBoth ? "rgba(58, 255, 58, 0.28)" : "transparent")};
  transition: background 200ms;
`;
export const CoopChecks = ({ checks, ownRole }) => {
  if (!checks || !checks.isWaiting) return null;
  const isBoth = checks.host && checks.guest;
  const sides = [[ownRole, "You"], [ownRole == "host" ? "guest" : "host", ownRole == "host" ? "Guest" : "Host"]];
  return (
    <ChecksBar $isBoth={isBoth}>
      {sides.map(([who, label]) => <Check key={who} $isDone={!!checks[who]}><Box $isDone={!!checks[who]} />{label}</Check>)}
    </ChecksBar>
  );
};

// co-op's vote (Jamie): each one's pick, the seconds left, and the coin flip if it came to that
const VoteBar = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1cqw;
  padding: 0.3cqw 0.6cqw;
  font-family: gameboy;
  font-size: 0.75cqw;
  letter-spacing: 0.08cqw;
  color: #c8ffb8;
`;
const VOTE_NAMES = { recruit: "Recruit", terminate: "Terminate" };
export const CoopVote = ({ vote, ownRole, now }) => {
  if (!vote) return null;
  const otherRole = ownRole == "host" ? "guest" : "host";
  const left = Math.max(0, Math.ceil((vote.endsAt - now) / 1000));
  return (
    <VoteBar>
      <span>You: {VOTE_NAMES[vote[ownRole]] || "..."}</span>
      <span>{ownRole == "host" ? "Guest" : "Host"}: {vote.result ? VOTE_NAMES[vote[otherRole]] || "-" : vote[otherRole] ? "Voted" : "..."}</span>
      <span>{vote.result ? (vote.isFlip ? `Coin flip: ${VOTE_NAMES[vote.result]}!` : `${VOTE_NAMES[vote.result]}!`) : `${left}s`}</span>
    </VoteBar>
  );
};

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
  const [step, setStep] = useState("type"); // type, level, kaiju, coop, teams
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
  /*
    One choice to a screen (Jamie, mp playtest 2), each on to the next, Back to undo the last:
    Match Type → Level (Last team standing) | Kaiju to Defeat (Peninsula defense) | the campaign together (Co-op)
    → Teammates? (the two matches)
  */
  const go = next => setStep(next);
  const back = () => setStep(({ level: "type", kaiju: "type", coop: "type", teams: setup.mode == "defense" ? "kaiju" : "level" })[step] || "type");
  const finish = values => onDone({ ...setup, ...values });
  const Back = () => <Choice onClick={back}>Back</Choice>;
  return (
    <Screen onKeyDown={event => event.stopPropagation()} style={step == "type" ? { justifyContent: "flex-start", paddingTop: "22%" } : undefined}>
      {step == "type" && (
        <>
          <Title style={{ marginBottom: "1cqw" }}>Match Type</Title>
          <Column>
            <Choice onClick={() => { change({ mode: "standing" }, { match: true }); go("level"); }}>Last team standing</Choice>
            <Choice onClick={() => { change({ mode: "defense" }, { match: true }); go("kaiju"); }}>Peninsula defense</Choice>
            {/* (the campaign together, the guest the teammate. Jamie, 2026-11-20) */}
            <Choice onClick={() => { change({ mode: "coop" }, { match: true, teams: true, count: true }); go("coop"); }}>Co-op Campaign</Choice>
          </Column>
        </>
      )}
      {step == "level" && (
        <>
          <Title>Level</Title>
          <Row>
            {BATTLEGROUNDS.map(({ id, name, thumbnail, thumbnailPosition, thumbnailZoom }) => (
              <Card key={id} $isOn={setup.level == id} onClick={() => { change({ level: id }, {}); go("teams"); }}>
                <Thumb>{thumbnail.map(src => <img key={src} src={src} alt="" style={thumbnailPosition ? { objectPosition: thumbnailPosition, transform: `scale(${thumbnailZoom || 1})`, transformOrigin: thumbnailPosition } : undefined} />)}</Thumb>
                {name}
              </Card>
            ))}
          </Row>
          <div style={{ marginTop: "1.2cqw" }}><Back /></div>
        </>
      )}
      {step == "kaiju" && (
        <>
          <Title>Kaiju to Defeat</Title>
          <Row>
            <Choice onClick={() => change({ kaijuToWin: Math.max(1, setup.kaijuToWin - 10) }, {})} disabled={setup.kaijuToWin <= 1}>-10</Choice>
            <Choice onClick={() => change({ kaijuToWin: Math.max(1, setup.kaijuToWin - 1) }, {})} disabled={setup.kaijuToWin <= 1}>-</Choice>
            <Count>{setup.kaijuToWin}</Count>
            <Choice onClick={() => change({ kaijuToWin: Math.min(MAX_KAIJU_TO_WIN, setup.kaijuToWin + 1) }, {})} disabled={setup.kaijuToWin >= MAX_KAIJU_TO_WIN}>+</Choice>
            <Choice onClick={() => change({ kaijuToWin: Math.min(MAX_KAIJU_TO_WIN, setup.kaijuToWin + 10) }, {})} disabled={setup.kaijuToWin >= MAX_KAIJU_TO_WIN}>+10</Choice>
          </Row>
          <Row>
            <Back />
            <Choice $isOn onClick={() => go("teams")}>Next</Choice>
          </Row>
        </>
      )}
      {step == "coop" && (
        <>
          {/* (a gap between the two, and above the buttons; Play the bigger: Jamie, mp playtest 3) */}
          <Title>Play the campaign together?</Title>
          <Title style={{ fontSize: "1.4cqw", marginTop: "0.4cqw" }}>Your guest will be your teammate.</Title>
          <Row style={{ marginTop: "1.6cqw" }}>
            <Back />
            <Choice $isOn onClick={() => finish({})} style={{ fontSize: "1.6cqw", padding: "0.9cqw 2.6cqw" }}>Play</Choice>
          </Row>
        </>
      )}
      {step == "teams" && (
        <>
          <Title>Teammates?</Title>
          <Row>
            <Choice $isOn={!isTeams && !!done.teams} onClick={() => { change({ teamSize: 0 }, { teams: true, count: true }); finish({ teamSize: 0 }); }}>Off</Choice>
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
          <Row>
            <Back />
            {isTeams && <Choice $isOn onClick={() => { change({}, { count: true }); finish({}); }}>Next</Choice>}
          </Row>
        </>
      )}
    </Screen>
  );
};

