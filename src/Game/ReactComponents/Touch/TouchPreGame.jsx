import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { DialogueLogPanel } from "../DialogueLogPanel";
import { AvatarBio } from "../AvatarBio";

/*
  The screens before a level on a touch screen (Jamie, 2026-11-28; mobile step 2): no side monitor, no console. The
  Agent talks from the dialogue panel on the right (as the Street's talk), and one button at its foot goes on or back.
*/

// the one button's two looks: as the choice scene's Recruit (go on) and Terminate (back, cancel)
export const PANEL_BUTTON = {
  go: "#2f7d57",
  stop: "#a01230",
  colorMs: 450, // the fade from one color to the other
  letterMs: 45 // a new word's letters, one at a time
};

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 3.4dvh 3dvh;
  font-family: gameboy;
  font-size: 5.4dvh;
  letter-spacing: 0.1em;
  color: #fbfbf0;
  border: 4px solid #101018;
  box-shadow: 0 4px 0 #101018;
  cursor: pointer;
  transition: background-color ${PANEL_BUTTON.colorMs}ms ease, opacity 200ms;
  touch-action: manipulation;
  &:active { filter: brightness(1.25); }
  &:disabled { opacity: 0.5; pointer-events: none; }
`;

// the words typed in afresh, letter by letter, each time they change (Jamie: BACK to PLAY, CANCEL to CONFIRM)
const useTypedWord = word => {
  const [shown, setShown] = useState(word);
  const last = useRef(word);
  useEffect(() => {
    if (word == last.current) return;
    last.current = word;
    let count = 0;
    setShown("");
    const timer = setInterval(() => {
      count += 1;
      setShown(word.slice(0, count));
      if (count >= word.length) clearInterval(timer);
    }, PANEL_BUTTON.letterMs);
    return () => clearInterval(timer);
  }, [word]);
  return shown;
};

// 'tone': "go" (green) or "stop" (red)
export const PanelButton = ({ text, tone, onClick, isDisabled = false }) => {
  const shown = useTypedWord(text);
  return (
    <Button data-touch-panel-button disabled={isDisabled} style={{ backgroundColor: PANEL_BUTTON[tone] }} onClick={onClick}>
      {/* (the whole word's room kept as it types, so the button doesn't jump) */}
      <span style={{ position: "relative" }}>
        <span style={{ visibility: "hidden" }}>{text}</span>
        <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "pre" }}>{shown}</span>
      </span>
    </Button>
  );
};

/*
  The Agent's panel: his line, anything else below it ('children': the vat's color picker), and the one button.
*/
export const AgentPanel = ({ text, button, children = null }) => (
  <DialogueLogPanel
    entries={[{ key: text, who: "agent", name: "Agent", text, avatar: "agent" }]}
    isWaiting={false}
    isVisible
    onContinue={() => {}}
    footer={<>{children}<PanelButton {...button} /></>}
  />
);

/*
  The avatar select's Agent (Jamie): what the side monitor showed (his "who are you", a character's file), on a screen
  behind the tanks, in the middle of the scene between the two characters. The same screen's size as the side
  monitor's (its words are sized to it), made smaller as a whole.
*/
export const AGENT_SCREEN = { width: 25.4, height: 29.1, scale: 0.62, top: 16 }; // cqw; its scale; its top, % of the scene
const screenOn = keyframes`
  from { transform: translateX(-50%) scale(${AGENT_SCREEN.scale}) scaleY(0.02); filter: brightness(3); }
  to { transform: translateX(-50%) scale(${AGENT_SCREEN.scale}); filter: none; }
`;
const ScreenBox = styled.div`
  position: absolute;
  left: 50%;
  width: ${AGENT_SCREEN.width}cqw;
  height: ${AGENT_SCREEN.height}cqw;
  transform-origin: 50% 0;
  transform: translateX(-50%) scale(${AGENT_SCREEN.scale});
  border-radius: 1.1cqw;
  overflow: hidden;
  background: #030404;
  border: 0.5cqw solid #1a1d22;
  box-shadow: 0 0 0 0.25cqw #050608, 0 0 3cqw rgba(109, 255, 160, 0.18), inset 0 0 1cqw rgba(0, 0, 0, 0.9);
  pointer-events: none;
  animation: ${screenOn} 420ms ease-out both;
`;
const ScreenGlass = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.5) 100%),
    repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.18) 0 1px, transparent 1px 3px);
`;
export const AgentScreen = ({ bioOf = undefined, isFadingOut = false, agentDelayMs = 0 }) => (
  <ScreenBox data-agent-screen style={{ top: `${AGENT_SCREEN.top}%` }}>
    <div style={{ position: "absolute", inset: 0, opacity: isFadingOut ? 0 : 1, transition: "opacity 450ms ease-out" }}>
      <AvatarBio key={bioOf || "agent"} avatar={bioOf} agentDelayMs={agentDelayMs} />
    </div>
    <ScreenGlass />
  </ScreenBox>
);
