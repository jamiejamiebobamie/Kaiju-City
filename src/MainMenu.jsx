import React, { useContext, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import {
  Wrapper,
  ButtonGroup,
  ButtonsWrapper,
  ButtonOutline,
  Button,
  StyledIcon,
  StyledLink,
} from "./Components/StyledComponents";
import { Logo } from "./Components/Logo";
import { GlobalSettingsContext } from "Home";
import { IrradiationVat } from "./Game/ReactComponents/IrradiationVat";
import { getAvatarColor, getIsToolOpen, saveAvatarColor } from "./Game/DataClasses/Avatars";
import { PIECES_INFO } from "Utils/gameState";

/*
  The landing screen (Jamie, playtest 21, until the UI epic's mock-ups): the logo, and "[Press any key]" at five sixths
  of the way down, a line either side of it from a seventh in from each edge. It blinks, purple pink, with pink
  ghosts of itself sliding off behind it and fading. Any key or a click: the logo slides off left, the words and lines
  flash white and fade, and the game goes on.
*/
const PRESS_KEY = { leaveMs: 1500, trailSeconds: 6, color: "#e25cff", trailColor: "#ff5cc8" };

const SceneSlide = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: transform ${PRESS_KEY.leaveMs * 0.9}ms ease-in;
  ${props => props.$isLeaving && "transform: translateX(-120vw);"}
`;

const leaveFlash = keyframes`
  0% { opacity: 1; filter: none; }
  10% { opacity: 1; filter: brightness(4) saturate(0) drop-shadow(0 0 6px white); }
  25% { opacity: 1; filter: none; }
  40% { opacity: 1; filter: brightness(4) saturate(0) drop-shadow(0 0 6px white); }
  60% { opacity: 0.8; filter: brightness(2) saturate(0.4); }
  100% { opacity: 0; filter: none; }
`;

const PressAnyKey = styled.div`
  position: fixed;
  left: calc(100vw / 7);
  right: calc(100vw / 7);
  top: calc(100dvh * 5 / 6);
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2.5vw;
  pointer-events: none;
  ${props => props.$isLeaving && css`animation: ${leaveFlash} ${PRESS_KEY.leaveMs}ms ease-out forwards;`}
`;

const KeyLine = styled.div`
  flex: 1;
  height: 2px;
  background: ${PRESS_KEY.color};
  box-shadow: 0 0 6px ${PRESS_KEY.color};
`;

const blink = keyframes`
  0%, 55% { opacity: 1; }
  70%, 85% { opacity: 0.15; }
  100% { opacity: 1; }
`;

const KeyText = styled.div`
  position: relative;
  font-family: gameboy;
  font-size: 22px;
  letter-spacing: 3px;
  white-space: nowrap;
  color: ${PRESS_KEY.color};
  text-shadow: 0 0 8px ${PRESS_KEY.color};
  ${props => !props.$isLeaving && css`animation: ${blink} 1.4s steps(1) infinite;`}
`;

// a ghost of the words, sliding off behind them and fading into the background: up right, up left, down left, down
// right, a pause at each, and round again (Jamie)
const trail = keyframes`
  0% { transform: translate(0, 0); opacity: 0.6; }
  12% { transform: translate(18px, -9px); opacity: 0.15; }
  25% { transform: translate(18px, -9px); opacity: 0; }
  25.01% { transform: translate(0, 0); opacity: 0.6; }
  37% { transform: translate(-18px, -9px); opacity: 0.15; }
  50% { transform: translate(-18px, -9px); opacity: 0; }
  50.01% { transform: translate(0, 0); opacity: 0.6; }
  62% { transform: translate(-18px, 9px); opacity: 0.15; }
  75% { transform: translate(-18px, 9px); opacity: 0; }
  75.01% { transform: translate(0, 0); opacity: 0.6; }
  87% { transform: translate(18px, 9px); opacity: 0.15; }
  100% { transform: translate(18px, 9px); opacity: 0; }
`;

const Phantom = styled.span`
  position: absolute;
  left: 0;
  top: 0;
  color: ${PRESS_KEY.trailColor};
  text-shadow: none;
  animation: ${trail} ${PRESS_KEY.trailSeconds}s ease-out infinite;
`;

// gameboy has no brackets: these are a monospace's, as the dialogue's [ENTER]
const Bracket = styled.span`
  font-family: "Courier New", Courier, monospace;
  font-weight: bold;
  font-size: 1.4em;
  line-height: 0;
`;
const KeyWords = () => <><Bracket>[</Bracket>Press any key<Bracket>]</Bracket></>;

export const MainMenu = ({ handleClickGame, handleClickSettings }) => {
  const { selectedAvatar } = useContext(GlobalSettingsContext);
  const [toolScreen, setToolScreen] = useState(undefined);

  // the rest are tools found in the Lab
  const toolButtons = [
    // "Colors" is hidden for now (Jamie, playtest 18)
    // { tool: "colors", label: "Colors", onClick: () => setToolScreen("colors") },
    // "Powers" opens Settings, which returns later with the ability editor
    // { tool: "abilityEditor", label: "Powers", onClick: handleClickSettings }
  ].filter(({ tool }) => getIsToolOpen(tool));

  // any key or a click (Jamie, playtest 21): the scene slides off left, "[Press any key]" flashes white and fades, then on
  const [isLeaving, setIsLeaving] = useState(false);
  const isLeavingRef = useRef(false);
  useEffect(() => {
    const go = () => {
      if (isLeavingRef.current || toolScreen) return;
      isLeavingRef.current = true;
      setIsLeaving(true);
      setTimeout(handleClickGame, PRESS_KEY.leaveMs);
    };
    const onKey = event => { if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) go(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", go);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", go);
    };
  }, [toolScreen]);

  // the whole landing page clicks through: the hand cursor everywhere on it (Jamie)
  useEffect(() => {
    document.body.style.cursor = "pointer";
    return () => { document.body.style.cursor = ""; };
  }, []);

  // (the "New Game" button is gone: any key starts it. Jamie, playtest 21)
  const navButtons = (<ButtonGroup>
    {/* Settings returns with multiplayer, as a stretch goal */}
    {/* the player is the guy or the girl, chosen when a new game starts */}
    {toolButtons.map(({ label, onClick }) => (
      <ButtonsWrapper key={label}>
        <Button onClick={onClick}>
          <ButtonOutline zIndex={1} />
          {label}
        </Button>
      </ButtonsWrapper>
    ))}
    {/* <ButtonsWrapper>
      <Button>
        <ButtonOutline zIndex={1} color={"black"} />
        <StyledLink></StyledLink>
        <StyledLink
          target="_blank"
          href="https://github.com/jamiejamiebobamie/kaiju-game-flow"
          rel="noreferrer"
        >
          Code
          <StyledIcon className="fa fa-github-alt" />
        </StyledLink>
      </Button>
    </ButtonsWrapper> */}
  </ButtonGroup>);

  return <Wrapper>
    <SceneSlide $isLeaving={isLeaving}><Logo /></SceneSlide>
    {navButtons}
    <PressAnyKey $isLeaving={isLeaving}>
      <KeyLine />
      <KeyText $isLeaving={isLeaving}>
        {/* three, a moment apart: a trail */}
        {[1, 2, 3].map(n => <Phantom key={n} style={{ animationDelay: `${(n - 1) * 0.08}s`, filter: `opacity(${1 - (n - 1) * 0.3})` }}><KeyWords /></Phantom>)}
        <span style={{ position: "relative" }}><KeyWords /></span>
      </KeyText>
      <KeyLine />
    </PressAnyKey>
    {toolScreen == "colors" && <IrradiationVat avatar={selectedAvatar} startColor={getAvatarColor(selectedAvatar) || PIECES_INFO[selectedAvatar].color} onIrradiate={color => saveAvatarColor(selectedAvatar, color)} onClose={() => setToolScreen(undefined)} />}
  </Wrapper>
}
