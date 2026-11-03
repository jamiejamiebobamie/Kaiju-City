import React, { useContext, useEffect } from "react";
import { Wrapper, ButtonGroup, ButtonsWrapper, ButtonOutline, Button } from "Components/StyledComponents";
import { AvatarSelection } from "Components/AvatarSelection";
import { GlobalSettingsContext } from "Home";

/*
  The start of the game: the player is the guy or the girl, side by side as on the old landing screen.
  The other is the teammate. The choice holds for the whole campaign.
*/
export const AvatarChoice = ({ onChoose }) => {
  const { selectedAvatar, setSelectedAvatar } = useContext(GlobalSettingsContext);
  const player = selectedAvatar == "girl" ? "girl" : "guy";
  // only these two are offered: someone saved from before starts as the guy
  useEffect(() => {
    if (selectedAvatar != player) setSelectedAvatar(player);
  }, []);
  return <Wrapper>
    <AvatarSelection />
    <ButtonGroup>
      <ButtonsWrapper>
        <Button onClick={() => onChoose(player, player == "guy" ? "girl" : "guy")}>
          <ButtonOutline zIndex={1} />
          Begin
        </Button>
      </ButtonsWrapper>
    </ButtonGroup>
  </Wrapper>;
};
