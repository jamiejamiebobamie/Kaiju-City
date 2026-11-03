import React, { useContext, useEffect } from "react";
import styled from "styled-components";
import { Wrapper, ButtonOutline, Button } from "Components/StyledComponents";
import { AvatarSelection } from "Components/AvatarSelection";
import { GlobalSettingsContext } from "Home";

/*
  The start of the game: the player is the guy or the girl, side by side as on the old landing screen.
  The other is the teammate. The choice holds for the whole campaign.
*/
const CHOICE_LOOK = {
  spacing: 340, // how far apart the two stand, in pixels
  beginScale: 1.6
};

// below the two of them, and bigger than the home screen's buttons
const BeginHolder = styled.div`
  position: fixed;
  left: 50%;
  top: calc(50dvh + 290px);
  z-index: 2;
  transform: translateX(-50%) scale(${CHOICE_LOOK.beginScale});
`;

export const AvatarChoice = ({ onChoose }) => {
  const { selectedAvatar, setSelectedAvatar } = useContext(GlobalSettingsContext);
  const player = selectedAvatar == "girl" ? "girl" : "guy";
  // only these two are offered: someone saved from before starts as the guy
  useEffect(() => {
    if (selectedAvatar != player) setSelectedAvatar(player);
  }, []);
  return <Wrapper>
    <AvatarSelection spacing={CHOICE_LOOK.spacing} />
    <BeginHolder>
      <Button onClick={() => onChoose(player, player == "guy" ? "girl" : "guy")}>
        <ButtonOutline zIndex={1} />
        Begin
      </Button>
    </BeginHolder>
  </Wrapper>;
};
