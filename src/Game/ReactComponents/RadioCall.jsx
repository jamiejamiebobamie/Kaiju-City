import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { getIsClickThrough } from "Game/DataClasses/DialogueLog";
import { DialogueLogPanel } from "./DialogueLogPanel";
import { ROSTER } from "Game/DataClasses/Avatars";
import { RadarMap } from "./RadarMap";

/*
  A radio call from the Agent: its lines go to the dialogue log beside the monitor, as every conversation does,
  while the monitor shows the Peninsula on a radar (RadarMap): with the siren, the Kaiju coming for it.
  The player's choices and the Go button are on the log.
  With Click through, each line waits for a key or a click. Without it, each holds a while and the call goes on.
*/
const RADIO_LOOK = {
  minHoldMs: 5000,
  maxHoldMs: 7000,
  holdMsPerLetter: 25
};

const Page = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482900;
  background: black;
`;

const NAMES = { agent: "Agent", player: "You", teammate: "Teammate" };

const getHoldMs = text => {
  const holdMs = RADIO_LOOK.minHoldMs + text.length * RADIO_LOOK.holdMsPerLetter;
  return Math.min(holdMs, RADIO_LOOK.maxHoldMs);
};

// 'onAlarm': called once the call reaches the line about Kaiju coming, for the siren
// 'kaijuCount': the Kaiju in the fight this call sends the team to, shown on the radar once the siren goes
export const RadioCall = ({ lines, playerAvatar, teammateAvatar, isResuming, onGo, onChangePowers, onAlarm = () => {}, kaijuCount = 0 }) => {
  const [script, setScript] = useState(lines);
  const [lineIndex, setLineIndex] = useState(0);

  const line = script[lineIndex];
  const isChoice = !!line.choices;
  const isLastLine = lineIndex == script.length - 1;
  const isAlarmed = script.slice(0, lineIndex + 1).some(({ isAlarm }) => isAlarm);
  const [alarmAtMs, setAlarmAtMs] = useState(undefined);
  useEffect(() => {
    if (!isAlarmed) return;
    onAlarm();
    setAlarmAtMs(alarmAt => alarmAt ?? performance.now());
  }, [isAlarmed]);

  const nextLine = () => {
    if (isLastLine || isChoice) return;
    setLineIndex(lineIndex + 1);
  };

  // without Click through, each line holds a while and the call goes on by itself
  useEffect(() => {
    if (isChoice || getIsClickThrough()) return;
    const timeoutRef = setTimeout(nextLine, getHoldMs(line.text || ""));
    return () => clearTimeout(timeoutRef);
  }, [lineIndex, isChoice, script]);

  // a waiting line moves on with any key (Enter presses the panel's bar)
  const nextLineRef = useRef(nextLine);
  nextLineRef.current = nextLine;
  useEffect(() => {
    const handleKeyDown = ({ code, repeat }) => {
      if (!repeat && !["Enter", "NumpadEnter", "Escape"].includes(code)) nextLineRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // the button already said it: the call goes straight on to the answer
  const choose = ({ reply }) => setScript([...script.slice(0, lineIndex), ...reply, ...script.slice(lineIndex + 1)]);

  const getAvatar = speaker => speaker == "agent" ? "agent" : speaker == "teammate" ? teammateAvatar : playerAvatar;
  const entries = script.slice(0, lineIndex + 1)
    .filter(({ choices }) => !choices)
    .map(({ speaker, text }, key) => ({ key, who: speaker == "agent" ? "agent" : speaker, name: speaker == "teammate" ? ((ROSTER.find(({ id }) => id == teammateAvatar) || {}).name || NAMES.teammate) : NAMES[speaker], text, avatar: getAvatar(speaker) }));
  const actions = isChoice ? line.choices.map(choice => ({ text: choice.text, onClick: () => choose(choice) }))
    : isLastLine ? [{ text: "Go!", onClick: onGo, isEnter: true }, { text: "Change powers", onClick: () => onChangePowers(line) }]
    : [];

  // the call is on the log beside the monitor, like every conversation. the monitor shows the darkened map.
  const [frame, setFrame] = useState(null);
  useLayoutEffect(() => setFrame(document.querySelector("[data-game-frame]")), []);
  return (
    <>
      <Page>
        <RadarMap dotCount={kaijuCount} alarmAtMs={alarmAtMs} />
      </Page>
      {frame && createPortal(<DialogueLogPanel entries={entries} isWaiting={!isChoice && !isLastLine} isVisible onContinue={nextLine} actions={actions} />, frame)}
    </>
  );
};
