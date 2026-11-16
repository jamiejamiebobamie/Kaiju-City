import React, { useContext, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { SpeedBlurFilter, slideAway } from "./Components/SlideAway";
import { getIsPressPanel, getPressEffect, PressKeyPanel, PressKeyRow, usePressSettings } from "./Components/PressKeyEffects";
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
// trailSeconds 5 (slower again: Jamie, playtest 22); confirmMs: the confirm's blinks, white and slow fade, which runs on
// under the clouds as they come
const PRESS_KEY = { topShare: 0.68, leaveMs: 1500, confirmMs: 750, /* (gone by the zoom's middle: Jamie; was 2800) */ trailSeconds: 6.5, color: "#e25cff", trailColor: "#80EF80" }; // the trail: the character select's green (Jamie, 2026-11-14; was pink #ff5cc8)

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

/*
  Leaving (Jamie, playtest 22): a parallax, each layer sliding off left at its own speed as if at its own depth, nearer
  ones faster: the title, then the skyline, then the Kaiju behind it, then the embers. once moving, a sideways speed
  blur (#speedBlur, a blur along x only).
*/
const SLIDE = { ms: PRESS_KEY.leaveMs * 0.9, title: "-170vw", skyline: "-120vw", kaiju: "-90vw", embers: "-45vw" };
// the logo's own layers: its title, the skyline image, the Kaiju walking behind the buildings
const layerSlide = (distance, isOn) => isOn && css`animation: ${slideAway(distance)} ${SLIDE.ms}ms ease-in forwards;`;

/*
  Leaving (Jamie, 2026-11-15: trying something new): an extreme zoom into one of the city's buildings, the cloud
  transition at its end. Later, with Jamie's pictures: the clouds part on a closer city, a lit apartment window, and the
  camera goes in through it to the room that holds the Kaiju-Vision monitor (the player plays in an apartment in this
  city). The skyline zooms toward the pink dot Jamie marked ('spot': shares across and down the skyline picture,
  found from its building lights); the title and the walking Kaiju still slide off left in parallax (Jamie).
*/
const CITY_ZOOM = { ms: PRESS_KEY.leaveMs, scale: 18, spot: { x: 0.692, y: 0.413 } };
const zoomIntoCity = keyframes`
  from { transform: scale(1); filter: blur(0); }
  70% { filter: blur(0); }
  to { transform: scale(${CITY_ZOOM.scale}); filter: blur(1.5px); }
`;

const SceneSlide = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  /* the title and the Kaiju slide off left in parallax; the skyline zooms into the city (the embers fade) */
  & > div > :first-child { ${props => layerSlide(SLIDE.title, props.$isLeaving)} }
  & img { ${props => props.$isLeaving && css`
    transform-origin: ${CITY_ZOOM.spot.x * 100}% ${CITY_ZOOM.spot.y * 100}%;
    animation: ${zoomIntoCity} ${CITY_ZOOM.ms}ms cubic-bezier(0.6, 0, 0.9, 0.35) forwards;
  `} }
  /* the Kaiju keeps its walk and its own glow: it slides by 'translate' alone */
  & > div > :nth-child(n + 3) { ${props => props.$isLeaving && css`transition: translate ${SLIDE.ms}ms ease-in; translate: ${SLIDE.kaiju} 0;`} }
`;

const EmberSlide = styled.div`
  position: fixed;
  inset: 0;
  pointer-events: none;
  transition: opacity ${CITY_ZOOM.ms * 0.4}ms ease-out;
  ${props => props.$isLeaving && css`opacity: 0;`}
`;

// confirmed (Jamie, playtest 22): two slow blinks, then white, then it fades
const WHITE = "brightness(4) saturate(0) drop-shadow(0 0 6px white)";
const leaveFlash = keyframes`
  0% { opacity: 1; filter: none; }
  7% { opacity: 0; filter: none; }
  14% { opacity: 1; filter: none; }
  21% { opacity: 0; filter: none; }
  28% { opacity: 1; filter: ${WHITE}; }
  55% { opacity: 1; filter: ${WHITE}; }
  100% { opacity: 0; filter: ${WHITE}; }
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
  ${props => props.$isLeaving && css`animation: ${leaveFlash} ${PRESS_KEY.confirmMs}ms linear forwards;`}
`;

// back from the monitor at the end of the game (Jamie, 2026-11-14): the view shifts right, so the landing slides in
// from the right
const LANDING_SHIFT_MS = 950;
const landingShiftIn = keyframes`
  from { transform: translateX(105%); }
  to { transform: translateX(0); }
`;

const ShiftingWrapper = styled(Wrapper)`
  ${props => props.$isShiftingIn && css`animation: ${landingShiftIn} ${LANDING_SHIFT_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1) both;`}
`;

export const MainMenu = ({ handleClickGame, handleClickSettings }) => {
  const { selectedAvatar, isLandingShifting, setIsLandingShifting } = useContext(GlobalSettingsContext);
  const [isShiftingIn] = useState(!!isLandingShifting);
  useEffect(() => {
    if (!isShiftingIn) return;
    const settled = setTimeout(() => setIsLandingShifting(false), LANDING_SHIFT_MS);
    return () => clearTimeout(settled);
  }, []);
  const [toolScreen, setToolScreen] = useState(undefined);
  // "[Press any key]"'s effect, picked with ?press= (Jamie's mock-ups); 'mix' has a panel to switch and tune them
  const [pressEffect] = useState(getPressEffect);
  const [pressSettings, setPressSettings] = usePressSettings(pressEffect);

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

  return <ShiftingWrapper $isShiftingIn={isShiftingIn}>
    <SpeedBlurFilter />
    <EmberSlide $isLeaving={isLeaving}><Embers /></EmberSlide>
    <SceneSlide $isLeaving={isLeaving}><Logo /></SceneSlide>
    {navButtons}
    <PressAnyKey $isLeaving={isLeaving}>
      <PressKeyRow settings={pressSettings} isLeaving={isLeaving} />
    </PressAnyKey>
    {getIsPressPanel() && <PressKeyPanel settings={pressSettings} setSettings={setPressSettings} />}
    {toolScreen == "colors" && <IrradiationVat avatar={selectedAvatar} startColor={getAvatarColor(selectedAvatar) || PIECES_INFO[selectedAvatar].color} onIrradiate={color => saveAvatarColor(selectedAvatar, color)} onClose={() => setToolScreen(undefined)} />}
  </ShiftingWrapper>
}
