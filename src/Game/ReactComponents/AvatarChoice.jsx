import React, { useContext, useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { GlobalSettingsContext } from "Home";
import { SpeedBlurFilter, slideAway } from "Components/SlideAway";
import { Doodads } from "Components/AvatarSelection";

/*
  The start of the game (Jamie, playtest 21; the UI epic's mock-ups will restyle it): the guy and the girl, side by
  side in the middle of the screen, "Choose your character" under them, and 1 and 2 to pick with the keys.
  Picked: "Player" and "Teammate" show under them with a lock-in flash (white, quick at first, then slower, then
  still), and after a beat the two slide off left, as the landing screen does. The other is the teammate. The choice
  holds for the whole campaign.
*/
const CHOICE = {
  lockInMs: 1500, // the labels' flash, before the slide
  slideMs: 1100,
  colors: { guy: "#55AAff", girl: "#fa8072" },
  textColor: "#e25cff"
};
const AVATARS = [
  // 'figureOffset': how far the figure stands from its frame's middle (measured on the sheets), so the green grid is
  // centered on them, not on the frame
  { id: "guy", sheet: "spritesheet/player.png", key: "1", figureOffset: 4 },
  { id: "girl", sheet: "spritesheet/teammate.png", key: "2", figureOffset: -4 }
];

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 28px;
`;

// leaving: a parallax (Jamie, playtest 22): the two of them nearest, fastest; their labels behind, slower; both blurring
const leaveLayer = (distance, isLeaving) => isLeaving && css`animation: ${slideAway(distance)} ${CHOICE.slideMs}ms ease-in forwards;`;

const Row = styled.div`
  display: flex;
  gap: 160px;
`;

const Choice = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0;
  background: none;
  border: 0;
  cursor: ${props => props.$isLocked ? "default" : "pointer"};
`;

const idle = keyframes`
  from { background-position: 0 1380px; }
  to { background-position: 0 0; }
`;

// the sprite and, behind it, the old home screen's art: on hover the three doodads and the circuit-disc grid, all
// glowing green (Jamie, 2026-11-12: "just want to see")
const SpriteBox = styled.div`
  position: relative;
  width: 152px;
  height: 230px;
  ${props => leaveLayer("-170vw", props.$isLeaving)}
`;

const DoodadHolder = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`;

// the sprite sheet's standing frame; hovered, its idle animation (as on the old screen)
const Sprite = styled.div`
  position: relative;
  width: 152px;
  height: 230px;
  background: url(${props => props.$sheet});
  background-position: 0 -460px;
  filter: drop-shadow(0 0 3px ${props => props.$color});
  ${props => !props.$isLocked && css`${Choice}:hover & { animation: ${idle} 1.2s steps(6) -0.4s infinite; }`}
  /* picked: facing front, glowing brighter (the idle cycle turns them round) */
  ${props => props.$isChosen && css`filter: drop-shadow(0 0 8px ${props.$color}) drop-shadow(0 0 3px white);`}
`;

const KeyNumber = styled.span`
  font-family: gameboy;
  font-size: 18px;
  color: #c9c3d6;
  visibility: ${props => props.$isHidden ? "hidden" : "visible"};
`;

// locked in: a white flash on the way in, quick at first, then slower, then still (no words for it: Jamie)
const lockIn = keyframes`
  0% { opacity: 0; color: white; text-shadow: 0 0 12px white; }
  6% { opacity: 1; color: white; text-shadow: 0 0 12px white; }
  14% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  22% { color: white; text-shadow: 0 0 12px white; }
  34% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  50% { color: white; text-shadow: 0 0 12px white; }
  72% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  100% { opacity: 1; color: var(--color); text-shadow: 0 0 6px var(--color); }
`;

const Label = styled.span`
  min-height: 22px;
  font-family: gameboy;
  font-size: 18px;
  text-transform: uppercase;
  color: var(--color);
  opacity: 0;
  ${props => props.$isShown && !props.$isLeaving && css`animation: ${lockIn} ${CHOICE.lockInMs}ms linear forwards;`}
  ${props => props.$isLeaving && css`opacity: 1; animation: ${slideAway("-110vw")} ${CHOICE.slideMs}ms ease-in forwards;`}
`;

const Prompt = styled.div`
  font-family: gameboy;
  font-size: 20px;
  letter-spacing: 2px;
  color: ${CHOICE.textColor};
  text-shadow: 0 0 8px ${CHOICE.textColor};
  visibility: ${props => props.$isHidden ? "hidden" : "visible"};
`;

const ChoiceAvatar = ({ id, sheet, keyName, figureOffset, chosen, isLeaving, onChoose }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [doodadOpacity, setDoodadOpacity] = useState(0);
  return (
    <Choice $isLocked={!!chosen} onClick={onChoose} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} aria-label={id}>
      <SpriteBox $isLeaving={isLeaving}>
        <DoodadHolder>
          <Doodads hasPrompt={false} show={isHovered && !chosen} persistDisc={false} hasDisc={false} globalTranslation={`${figureOffset}px, 0px`} opacity={doodadOpacity} setOpacity={setDoodadOpacity} />
        </DoodadHolder>
        <Sprite $sheet={sheet} $color={CHOICE.colors[id]} $isChosen={chosen == id} $isLocked={!!chosen} />
      </SpriteBox>
      <KeyNumber $isHidden={!!chosen}>{keyName}</KeyNumber>
      <Label $isShown={!!chosen} $isLeaving={isLeaving} style={{ "--color": CHOICE.colors[id] }}>{chosen ? (chosen == id ? "Player" : "Teammate") : ""}</Label>
    </Choice>
  );
};

export const AvatarChoice = ({ onChoose }) => {
  const { setSelectedAvatar } = useContext(GlobalSettingsContext);
  const [chosen, setChosen] = useState(undefined);
  const [isLeaving, setIsLeaving] = useState(false);
  const chosenRef = useRef(undefined);

  const choose = player => {
    if (chosenRef.current) return;
    chosenRef.current = player;
    setChosen(player);
    setSelectedAvatar(player);
    const teammate = player == "guy" ? "girl" : "guy";
    setTimeout(() => setIsLeaving(true), CHOICE.lockInMs);
    setTimeout(() => onChoose(player, teammate), CHOICE.lockInMs + CHOICE.slideMs);
  };

  // 1 or 2 picks, as the numbers under them say
  useEffect(() => {
    const onKey = ({ code, repeat }) => {
      if (repeat) return;
      const avatar = AVATARS.find(({ key }) => code == `Digit${key}` || code == `Numpad${key}`);
      if (avatar) choose(avatar.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Screen>
      <SpeedBlurFilter />
      <Row>
        {AVATARS.map(({ id, sheet, key, figureOffset }) => (
          <ChoiceAvatar key={id} id={id} sheet={sheet} keyName={key} figureOffset={figureOffset} chosen={chosen} isLeaving={isLeaving} onChoose={() => choose(id)} />
        ))}
      </Row>
      <Prompt $isHidden={!!chosen}>Choose your character</Prompt>
    </Screen>
  );
};
