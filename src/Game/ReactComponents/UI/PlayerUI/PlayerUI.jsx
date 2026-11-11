import React, { useState, useEffect } from "react";
import styled, { css, keyframes } from "styled-components";
import { Abilities } from "./Components/Abilities";
import { HealthBar } from "./Components/HealthBar";
import { PassiveAbilities } from "./Components/PassiveAbilities";
import { FloatingEffect } from 'Game/ReactComponents/Game';
import { BlinkFadeEffect } from 'Components/AvatarSelection';

/*
  Where a HUD's contents sit on its metal plate.
  'scale' sizes the contents to the plate, and x and y move them onto its sockets.
*/
const HUD_LAYOUT = {
  player: { width: 381, height: 168, scale: 0.9, x: 19, y: 6 },
  teammate: { width: 284, height: 127, scale: 0.675, x: 11, y: 0 }
};

const HudFrame = styled.div`
  position: relative;
  align-self: flex-end;
  margin-bottom: 12px;
`;

const Wrapper = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 400px;
  height: 170px;
  transform-origin: 0 0;
  pointer-events: none; // only the HUD's own buttons take clicks. the rest of it passes them to the board.
`;

// the metal plate behind and around a HUD
const HudPlate = styled.div`
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  pointer-events: none;
  ${props => props.isBackground && "z-index: -1; filter: brightness(0.5) drop-shadow(-2px 2px 10px black) hue-rotate(275deg);"}
`;

// health won sparring (Jamie): the portrait's rim pulses red a while
const portraitReward = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px #ff2a3c, 0 0 8px 2px #ff2a3c; }
  50% { box-shadow: 0 0 0 4px #ff5c6c, 0 0 22px 8px #ff0020; }
`;

const PlayerBorder = styled.div`
  position: absolute;
  right: 20px;
  ${props => props.$isReward && css`animation: ${portraitReward} 0.9s ease-in-out infinite;`}

  ${props => (props.isReversed ? "bottom: 20px;" : "top: 29px;")}

  ${props => props.isBlue ? "width: 125px;height: 125px;" : "width: 120px; height: 120px;"}
  zindex: 1;
  border-radius: 100%;
  overflow: hidden;
`;

const PlayerPicture = styled.div`

  position: absolute;

  background: url(${props => props.src});

  background-position: ${props => props.isBlue ? "3px 0px" : "0px 0px"};
  width: 97%;
  height: 97%;

  ${props =>
    props.isBlue
      ? "filter: drop-shadow(20px -15px 25px blue);"
      : "filter: drop-shadow(20px -15px 25px salmon);"}
`;

const PlayerPictureBackground = styled.div`
    position: absolute;
    z-index: -1;

    filter: opacity(.8) hue-rotate(
        ${props => props.isBlue ? "148deg" : "301deg"}
      );

    pointer-events: none;
    background: url(spritesheet/horizontal_circuit_disc_sprite.png) center center;
    width: 592px;
    height: 359px;
    animation: 4s steps(9) 0s infinite normal none running playSpriteSheet;
    transform: ${props => props.isBlue ? "scale(0.3, 0.45) translate(-776px, -274px)" : "scale(0.3, 0.45) translate(-785px, -274px);"};
`;

const ModifierList = styled.ul`
    position: absolute;
    // scale(.75)
    transform: translate(${props => props.translation ? props.translation : `173px, -98px`});
    display: flex;
    flex-direction: column;
    list-style-type: none;
`;

const ModifierListitem = styled.li`
    padding: 10px;
    ${props => props.translateX&& `transform: translate(${props.translateX});`}
    opacity: ${props => props.modIsApplied ? 0 : 1};
    -webkit-transition-duration: 1s;
    transition-duration: 1s;
    transition-property: opacity;
    position: absolute;
    background: url(${props => props.noModSrc});
    background-repeat: no-repeat;
    background-position: center;

    pointer-events: none;
    width: 372px;
    height: 229px;


  &::before {
    content: "";
    position: absolute;
    width: 372px;
    height: 229px;
    pointer-events: none;

    background: url(${props => props.modSrc});
    background-repeat: no-repeat;
    background-position: center;

    opacity: ${props => (props.modIsApplied ? 1 : 0)};
    -webkit-transition-duration: 1s;
    transition-duration: 1s;
    transition-property: opacity;
  }

  opacity: ${props => props.notInLoadOut ? 0 : 1};

`;

const ModifierValue = styled.span`
  border-bottom: solid 5px;
  border-color: ${props => props.color};
  color: ${props => props.color};
  font-size: 35px;
  padding: 7px 7px 7px ${props => props.modIsApplied ? "7px" : "17px"};
  margin-right: ${props => props.modIsApplied ? "17px" : "7px"};
    position: absolute;

`;

const ModifierLabel = styled.span`
  color: ${props => props.color};
  fonst-size: 20px;
    position: absolute;

`;

export const PlayerUI = ({
  pd,
  setDisplayString,
  playerIndex,
  isTeammate,
  isRecruit = false,
  percentZoom,
  isPaused
}) => {
  const {
    gender,
    livesModifier,
    moveSpeedModifier,
    numTilesModifier,
    tileCountModifier
  } = pd;

  // modifiers
  const [inLoadOut, setInLoadOut] = useState({});
  useEffect(() => {
    const dict = {
      livesModifier,
      moveSpeedModifier,
      numTilesModifier,
      tileCountModifier
    };
    const loadout = Object.keys(dict)
                          .reduce(
                            (acc, k) => pd.abilities.reduce(
                                      (_acc, a) => ({ ..._acc, [k]: !!_acc[k] || !!a[k] })
                                      , acc)
                            , { ...dict });
    setInLoadOut(loadout);
  }, []);

  const modifierListItemSrcImgPaths = [
    {
      modSrc: 'GameUI_Pieces/modifiers_ui/1-mod.png',
      noModSrc: 'GameUI_Pieces/modifiers_ui/1-noMod.png',
    },
    {
      modSrc: 'GameUI_Pieces/modifiers_ui/2-mod.png',
      noModSrc: 'GameUI_Pieces/modifiers_ui/2-noMod.png'
    },
    {
      modSrc: 'GameUI_Pieces/modifiers_ui/3-mod.png',
      noModSrc: 'GameUI_Pieces/modifiers_ui/3-noMod.png',
    },
    {

      modSrc: 'GameUI_Pieces/modifiers_ui/4-mod.png',
      noModSrc: 'GameUI_Pieces/modifiers_ui/4-noMod.png',
    }
  ];

  const modifierListItem = (i, inLoadOut, color, label, value, animDelay, translateX) => (
    <ModifierListitem
      modSrc={modifierListItemSrcImgPaths[i].modSrc}
      noModSrc={modifierListItemSrcImgPaths[i].noModSrc}
      modIsApplied={value != 0}
      notInLoadOut={false}//!inLoadOut}
      translateX={translateX}>
      <FloatingEffect
        styles={`position: relative; display: flex; flex-direction: column; ${isTeammate ? `animation-delay: ${animDelay}s;` : `animation-delay: ${animDelay}s;`}`}
        duration={isTeammate ? "5" : "5.5"}>
        <ModifierLabel color={color}>{label}</ModifierLabel>
        <ModifierValue modIsApplied={value != 0} color={color}>{value > 0 ? `+${value}` : value}</ModifierValue>
      </FloatingEffect>
    </ModifierListitem>);
  const modifierDisplay = <BlinkFadeEffect high={90} low={75}>
    <ModifierList translation={isTeammate ? `173px, -98px` : undefined}>
      {modifierListItem(0, true/*!!inLoadOut['livesModifier']*/, '#8dde86ff', 'Health', livesModifier, Math.sin(0))}
      {modifierListItem(1, true/*!!inLoadOut['moveSpeedModifier']*/, '#86d8deff', 'Speed', moveSpeedModifier, Math.sin(Math.PI))}
      {modifierListItem(2, true/*!!inLoadOut['tileCountModifier']*/, '#d4d07bff', 'Range', tileCountModifier, Math.sin(2*Math.PI), "-47px")}
      {modifierListItem(3, true/*!!inLoadOut['numTilesModifier']*/, '#d4aa7bff', 'Area', numTilesModifier, Math.sin(3*Math.PI))}
    </ModifierList>
  </BlinkFadeEffect>;

  const plateName = isTeammate ? 'TeammateArea' : 'PlayerArea';
  const layout = isTeammate ? HUD_LAYOUT.teammate : HUD_LAYOUT.player;

  const _playerUI = (
    <HudFrame style={{ width: `${layout.width}px`, height: `${layout.height}px` }}>
    <HudPlate isBackground={true} style={{ backgroundImage: `url(/GameUI_Pieces/${plateName}_Background.png)` }} />
    <HudPlate style={{ backgroundImage: `url(/GameUI_Pieces/${plateName}_Overlay.png)` }} />
    <Wrapper style={{ transform: `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})` }}>
      {/* {modifierDisplay} */}
      {isTeammate ? (
        <> {/* teammate's UI */}
          <Abilities
            abilities={pd.abilities}
            setDisplayString={setDisplayString}
            isReversed={true}
            isWithoutKeys={!pd.isControlled}
            playerIndex={playerIndex}
            isCharacterAlive={!pd.isDead}
            isPaused={isPaused}
          />
          <HealthBar
            health={pd.lives}
            isDead={pd.isDead}
            healthModifier={pd.livesModifier}
            setDisplayString={setDisplayString}
            isTeammate={true}
          />
        </>
      ) : (
        <> {/* player's UI */}
          <HealthBar
            health={pd.lives}
            isDead={pd.isDead}
            healthModifier={pd.livesModifier}
            setDisplayString={setDisplayString}
          />
          <Abilities
            isLarge={true}
            isWithoutKeys={pd.isControlled === false}
            abilities={pd.abilities}
            setDisplayString={setDisplayString}
            playerIndex={playerIndex}
            isCharacterAlive={!pd.isDead}
            isPaused={isPaused}
          />
        </>
      )}
      <PlayerBorder isBlue={gender == "guy" ? true : false} isReversed={isTeammate ? true : false} $isReward={!!pd.isRewardPulse}>
        <PlayerPicture
          src={gender == "guy" ? "player_avatar.png" : gender == "girl" ? "teammate_avatar.png" : `/levels/portraits/hud-${gender}.png`}
          className="fa fa-user-circle"
          isBlue={gender == "guy" ? true : false}
        />
        <PlayerPictureBackground isBlue={gender == "guy" ? true : false} />
      </PlayerBorder>
      <PassiveAbilities
        setDisplayString={setDisplayString}
        isTeammate={isTeammate}
        abilities={pd.abilities}
      />
    </Wrapper>
    </HudFrame>
  );
  return <FloatingEffect
    styles={`display: flex; flex-direction: column; ${isTeammate ? "animation-delay: 3s;" : "animation-delay: 2s;"}`}
    duration={isTeammate ? "5" : "5.5"}>
    {_playerUI}
  </FloatingEffect>;
};
