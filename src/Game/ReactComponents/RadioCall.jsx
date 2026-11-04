import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

/*
  A radio call, after Metal Gear Solid 2's: a portrait either side of the words.
  Whoever is talking lights up, and the player lights up when it is their turn to choose.
  Words appear letter by letter, hold, then the next line follows. A click hurries it along.
*/
const RADIO_LOOK = {
  screenColor: "#0a1f19",
  textColor: "#4fae6c",
  speakingFilter: "sepia(1) hue-rotate(75deg) saturate(1.6) brightness(1.15)",
  quietFilter: "sepia(1) hue-rotate(75deg) saturate(1) brightness(0.35)",
  scanLineSeconds: 3.2,
  flickerSeconds: 0.18,
  letterMs: 28,
  minHoldMs: 5000,
  maxHoldMs: 7000,
  holdMsPerLetter: 25
};

const scanLineRoll = keyframes`
  from { transform: translateY(-30%); }
  to { transform: translateY(420%); }
`;

const flicker = keyframes`
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.34; }
`;

const Page = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482900;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.62)), url(/Map.gif) center / cover no-repeat, black;
  image-rendering: pixelated;
  font-family: gameboy;
`;

const Panel = styled.div`
  display: flex;
  align-items: stretch;
  gap: 1.5cqw;
  width: 42cqw;
  padding: 1.2cqw;
  background: #050f0c;
  border: 0.2cqw solid #2c5c47;
  cursor: pointer;
`;

const Screen = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 6.5cqw;
  aspect-ratio: 3 / 4;
  align-self: center;
  overflow: hidden;
  background: ${RADIO_LOOK.screenColor};
  border: 0.15cqw solid #2c5c47;
`;

const PortraitImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0;
  image-rendering: pixelated;
  transition: filter 0.2s;
`;

const ScanLines = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0 2px, transparent 2px 5px);
  animation: ${flicker} ${RADIO_LOOK.flickerSeconds}s steps(2) infinite;
`;

const RollingLine = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 25%;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgba(180, 255, 200, 0.22), transparent);
  animation: ${scanLineRoll} ${RADIO_LOOK.scanLineSeconds}s linear infinite;
`;

const Middle = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1cqw;
  min-height: 9cqw;
`;

const Words = styled.div`
  font-size: 0.95cqw;
  line-height: 1.7;
  color: ${RADIO_LOOK.textColor};
`;

const Name = styled.div`
  margin-bottom: 0.6cqw;
  font-size: 0.75cqw;
  text-transform: uppercase;
  opacity: 0.7;
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6cqw;
`;

const RadioButton = styled.button`
  padding: 0.45cqw 0.9cqw;
  font-family: gameboy;
  font-size: 0.8cqw;
  color: ${RADIO_LOOK.textColor};
  background: ${RADIO_LOOK.screenColor};
  border: 0.12cqw solid #2c5c47;
  cursor: pointer;
  &:hover {
    color: #8fe0a6;
    border-color: #4fae6c;
  }
`;

const NAMES = { agent: "Agent", player: "You", teammate: "Teammate" };

const Portrait = ({ src, isLit }) => (
  <Screen>
    <PortraitImage src={src} style={{ filter: isLit ? RADIO_LOOK.speakingFilter : RADIO_LOOK.quietFilter }} />
    <ScanLines />
    <RollingLine />
  </Screen>
);

const getHoldMs = text => {
  const holdMs = RADIO_LOOK.minHoldMs + text.length * RADIO_LOOK.holdMsPerLetter;
  return Math.min(holdMs, RADIO_LOOK.maxHoldMs);
};

export const RadioCall = ({ lines, playerAvatar, teammateAvatar, isResuming, onGo, onChangePowers }) => {
  const [script, setScript] = useState(lines);
  const [lineIndex, setLineIndex] = useState(0);
  const [letters, setLetters] = useState(isResuming ? lines[0].text.length : 0);

  const line = script[lineIndex];
  const isChoice = !!line.choices;
  const text = line.text || "";
  const isTyped = letters >= text.length;
  const isLastLine = lineIndex == script.length - 1;

  const nextLine = () => {
    if (isLastLine || isChoice) return;
    setLetters(0);
    setLineIndex(lineIndex + 1);
  };

  useEffect(() => {
    if (isChoice) return;
    const timeoutRef = isTyped ?
      setTimeout(nextLine, getHoldMs(text))
      : setTimeout(() => setLetters(letters + 1), RADIO_LOOK.letterMs);
    return () => clearTimeout(timeoutRef);
  }, [lineIndex, letters, isChoice, script]);

  // the button already said it: the call goes straight on to the answer
  const choose = (event, { reply }) => {
    event.stopPropagation();
    setScript([...script.slice(0, lineIndex), ...reply, ...script.slice(lineIndex + 1)]);
    setLetters(0);
  };

  // inside the monitor, like everything else in the game
  return (
    <Page>
      <Panel data-enter={isChoice || (isLastLine && isTyped) ? undefined : ""} onClick={() => isTyped ? nextLine() : setLetters(text.length)}>
        <Portrait src="/levels/portraits/agent.png" isLit={line.speaker == "agent"} />
        <Middle style={isChoice ? { justifyContent: "center" } : undefined}>
          {isChoice ? <Words><Name>Your turn</Name></Words> : (
            <Words>
              <Name>{NAMES[line.speaker]}</Name>
              {text.slice(0, letters)}
            </Words>
          )}
          <Buttons style={isChoice ? { flexDirection: "column", alignItems: "flex-start" } : undefined}>
            {isChoice && line.choices.map(choice => (
              <RadioButton key={choice.text} onClick={event => choose(event, choice)}>{choice.text}</RadioButton>
            ))}
            {!isChoice && isLastLine && isTyped && <RadioButton data-enter onClick={onGo}>Go!</RadioButton>}
            {!isChoice && isLastLine && isTyped && <RadioButton onClick={() => onChangePowers(line)}>Change powers</RadioButton>}
          </Buttons>
        </Middle>
        <Portrait
          src={`/levels/portraits/${line.speaker == "teammate" ? teammateAvatar : playerAvatar}.png`}
          isLit={isChoice || line.speaker == "player" || line.speaker == "teammate"}
        />
      </Panel>
    </Page>
  );
};
