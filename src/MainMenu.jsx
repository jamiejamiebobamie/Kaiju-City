import React, { useContext, useState } from "react";
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
import { AvatarRoster } from "./Game/ReactComponents/AvatarRoster";
import { IrradiationVat } from "./Game/ReactComponents/IrradiationVat";
import { getAvatarColor, getIsToolOpen, saveAvatarColor, saveTeamAvatars } from "./Game/DataClasses/Avatars";

export const MainMenu = ({ handleClickGame, handleClickSettings }) => {
  const { selectedAvatar, setSelectedAvatar, selectedTeammate, setSelectedTeammate } = useContext(GlobalSettingsContext);
  const [toolScreen, setToolScreen] = useState(undefined);

  const chooseTeam = (player, teammate) => {
    setSelectedAvatar(player);
    setSelectedTeammate(teammate);
    saveTeamAvatars(player, teammate);
  };

  // the rest are tools found in the Lab
  const toolButtons = [
    { tool: "colors", label: "Colors", onClick: () => setToolScreen("colors") },
    { tool: "abilityEditor", label: "Powers", onClick: handleClickSettings }
  ].filter(({ tool }) => getIsToolOpen(tool));

  const navButtons = (<ButtonGroup>
    <ButtonsWrapper>
      <Button onClick={handleClickGame}>
        <ButtonOutline zIndex={1} />
        New Game
      </Button>
    </ButtonsWrapper>
    <ButtonsWrapper>
      <Button onClick={handleClickSettings}>
        <ButtonOutline zIndex={1} />
        Settings
      </Button>
    </ButtonsWrapper>
    <ButtonsWrapper>
      <Button onClick={() => setToolScreen("avatars")}>
        <ButtonOutline zIndex={1} />
        Avatars
      </Button>
    </ButtonsWrapper>
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
    <Logo />
    {navButtons}
    {toolScreen == "avatars" && <AvatarRoster player={selectedAvatar} teammate={selectedTeammate} onChoose={chooseTeam} onClose={() => setToolScreen(undefined)} />}
    {toolScreen == "colors" && <IrradiationVat avatar={selectedAvatar} startColor={getAvatarColor(selectedAvatar)} onIrradiate={color => saveAvatarColor(selectedAvatar, color)} onClose={() => setToolScreen(undefined)} />}
  </Wrapper>
}
