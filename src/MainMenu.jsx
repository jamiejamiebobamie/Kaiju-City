import React from "react";
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
import { AvatarSelection } from "./Components/AvatarSelection";

export const MainMenu = ({ handleClickGame, handleClickSettings }) => {

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
    <AvatarSelection />
  </Wrapper>
}
