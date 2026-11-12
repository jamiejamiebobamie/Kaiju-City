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
  of the way down, a line either side of it from a seventh in from each edge. Purple pink, with pink
  ghosts of itself sliding off behind it and fading. Any key or a click: the logo slides off left, the words and lines
  flash white and fade, and the game goes on.
*/
// trailSeconds: 3 (was 6, livelier: Jamie)
const PRESS_KEY = { topShare: 0.68, leaveMs: 1500, trailSeconds: 3, color: "#e25cff", trailColor: "#ff5cc8" };

/*
  Embers (Jamie): glowing purple pixels drifting down all over the landing page, swaying as they fall and flickering,
  like the embers after the Erdtree burns in Elden Ring. low-res squares, set once so they don't jump about.
*/
const EMBERS = { count: 70, colors: ["#b04cff", "#d06bff", "#8a2be2", "#e59bff"] };
const EMBER_LIST = Array.from({ length: EMBERS.count }, (_, k) => {
  const random = n => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1; // the same each load
  return {
    left: `${random(1) * 160}vw`, // past the right edge too: they blow in from there
    size: [2, 3, 3, 4, 5][Math.floor(random(2) * 5)],
    color: EMBERS.colors[Math.floor(random(3) * EMBERS.colors.length)],
    seconds: 6 + random(4) * 7,
    delay: -random(5) * 13, // already blowing when the page opens
    sway: `${(random(6) - 0.5) * 70}px`,
    drift: `${-(55 + random(8) * 45)}vw`, // how far left the wind takes it on the way down
    rise: `${random(9) < 0.35 ? 8 + random(10) * 22 : 0}vh`, // a third of them lifted by the gusts, each its own amount (Jamie)
    flicker: 0.8 + random(7) * 1.6
  };
});

// blown left on a slant, in gusts: quick sweeps, then a lull where it hangs and wavers (Jamie: not snow). with a --rise,
// the gusts lift it back up a while before it sinks on
const emberFall = keyframes`
  0% { transform: translate(0, -5vh); }
  18% { transform: translate(calc(var(--drift) * 0.32), calc(14vh + var(--sway) - var(--rise))); }
  30% { transform: translate(calc(var(--drift) * 0.38), calc(24vh - var(--rise) * 0.6)); }
  52% { transform: translate(calc(var(--drift) * 0.66), calc(50vh - var(--sway) - var(--rise) * 1.2)); }
  64% { transform: translate(calc(var(--drift) * 0.72), calc(60vh - var(--rise) * 0.5)); }
  86% { transform: translate(calc(var(--drift) * 0.94), calc(88vh + var(--sway))); }
  100% { transform: translate(var(--drift), 106vh); }
`;

const emberFlicker = keyframes`
  0%, 100% { opacity: 0.9; }
  30% { opacity: 0.35; }
  55% { opacity: 1; }
  80% { opacity: 0.5; }
`;

const EmberField = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
`;

const Ember = styled.span`
  position: absolute;
  top: 0;
  image-rendering: pixelated;
  animation: ${emberFall} var(--fall) linear var(--delay) infinite, ${emberFlicker} var(--flicker) steps(3) infinite;
`;

const Embers = () => (
  <EmberField>
    {EMBER_LIST.map(({ left, size, color, seconds, delay, sway, flicker, drift, rise }, k) => (
      <Ember key={k} style={{
        left, width: `${size}px`, height: `${size}px`, background: color,
        // a short glow trailing up and right, the way it came
        boxShadow: `0 0 ${size * 2}px ${color}, ${size}px ${-size * 0.6}px ${size}px ${color}, ${size * 2.2}px ${-size * 1.3}px ${size * 1.5}px rgba(176, 76, 255, 0.35)`,
        "--fall": `${seconds}s`, "--delay": `${delay}s`, "--sway": sway, "--flicker": `${flicker}s`, "--drift": drift, "--rise": rise
      }} />
    ))}
  </EmberField>
);

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
  top: calc(100dvh * ${PRESS_KEY.topShare}); /* raised for now (was 5/6): lower again once there's more on the page (Jamie) */
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

const KeyText = styled.div`
  position: relative;
  font-family: gameboy;
  font-size: 22px;
  letter-spacing: 3px;
  white-space: nowrap;
  color: ${PRESS_KEY.color};
  text-shadow: 0 0 8px ${PRESS_KEY.color};
  /* no blink (Jamie: its dark beat was too dark); the ghost trail carries the life */
`;

// a ghost of the words, sliding off behind them and fading into the background: up right, up left, down left, down
// right, a pause at each, and round again (Jamie)
const trail = keyframes`
  0% { transform: translate(0, 0); opacity: 0.6; }
  12% { transform: translate(24px, -12px); opacity: 0.15; }
  25% { transform: translate(24px, -12px); opacity: 0; }
  25.01% { transform: translate(0, 0); opacity: 0.6; }
  37% { transform: translate(-24px, -12px); opacity: 0.15; }
  50% { transform: translate(-24px, -12px); opacity: 0; }
  50.01% { transform: translate(0, 0); opacity: 0.6; }
  62% { transform: translate(-24px, 12px); opacity: 0.15; }
  75% { transform: translate(-24px, 12px); opacity: 0; }
  75.01% { transform: translate(0, 0); opacity: 0.6; }
  87% { transform: translate(24px, 12px); opacity: 0.15; }
  100% { transform: translate(24px, 12px); opacity: 0; }
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
    <Embers />
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
