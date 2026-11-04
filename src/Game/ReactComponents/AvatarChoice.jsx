import React, { useContext, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { Wrapper, ButtonOutline, Button } from "Components/StyledComponents";
import { AvatarSelection } from "Components/AvatarSelection";
import { GlobalSettingsContext } from "Home";

/*
  The start of the game: the player is the guy or the girl, side by side as on the old landing screen.
  The other is the teammate. The choice holds for the whole campaign.
*/
const CHOICE_LOOK = {
  spacing: 340, // how far apart the two stand, in pixels
  beginScale: 1.6,
  beginTop: "75dvh", // Begin sits about three quarters of the way down
  beginBelowMiddle: 290 // how far below the middle of the screen Begin was made to sit, in pixels: the two move up with it
};

// the two of them move up as far as Begin does
const RAISE = `(50dvh + ${CHOICE_LOOK.beginBelowMiddle}px - ${CHOICE_LOOK.beginTop})`;

// below the two of them, and bigger than the home screen's buttons
const BeginHolder = styled.div`
  position: fixed;
  left: 50%;
  top: ${CHOICE_LOOK.beginTop};
  z-index: 2;
  transform: translateX(-50%) scale(${CHOICE_LOOK.beginScale});
`;

const tracePulse = keyframes`
  0%, 100% { filter: brightness(0.85); }
  50% { filter: brightness(1.25) drop-shadow(0 0 4px #ffd24a); }
`;

// a frame of metal circuit board around Begin, like the ability picker's: traces glinting gold
const CircuitFrame = styled.div`
  position: relative;
  padding: 7px;
  border-radius: 6px;
  background:
    linear-gradient(rgba(20, 20, 24, 0.35), rgba(20, 20, 24, 0.35)),
    url(/circuit-board.png) center / 260px,
    linear-gradient(160deg, #3a3c42, #1c1d21 45%, #2b2d32);
  border: 2px solid #8d9097;
  box-shadow: inset 0 0 0 1px #0b0c0e, 0 0 0 1px #0b0c0e, 0 6px 14px rgba(0, 0, 0, 0.7);
  animation: ${tracePulse} 2.4s ease-in-out infinite;
`;

export const AvatarChoice = ({ onChoose }) => {
  const { selectedAvatar, setSelectedAvatar } = useContext(GlobalSettingsContext);
  const player = selectedAvatar == "girl" ? "girl" : "guy";
  // only these two are offered: someone saved from before starts as the guy
  useEffect(() => {
    if (selectedAvatar != player) setSelectedAvatar(player);
  }, []);
  return <Wrapper>
    <AvatarSelection spacing={CHOICE_LOOK.spacing} raise={RAISE} />
    <BeginHolder>
      <CircuitFrame>
        <Button onClick={() => onChoose(player, player == "guy" ? "girl" : "guy")}>
          <ButtonOutline zIndex={1} />
          Begin
        </Button>
      </CircuitFrame>
    </BeginHolder>
  </Wrapper>;
};
