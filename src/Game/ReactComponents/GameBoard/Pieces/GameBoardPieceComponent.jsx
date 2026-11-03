import React, { useEffect, useState } from "react";
import styled from "styled-components";

const Wrapper = styled.i.attrs(({ zIndex, charLocation, isVisible, pieceScale }) => ({
  style: {
    transform: `scale(${pieceScale})`,
    transformOrigin: "0 0",
    zIndex: (zIndex || 0) + 20001,
    left: `${charLocation.x + 3.5}px`,
    top: `${charLocation.y}px`,
    display: isVisible ? "flex" : "none"
  }
}))`
  position: absolute;
  color: ${props => props.color};
  pointer-events: none;
`;

const HealthBarWrapper = styled.div`
  display: ${props => (props.lives > 0 ? "flex" : "none")};
  width: 40px;
  justify-content: center;
  margin-top: -70px;
  margin-left: -15px;
`;

const Bar = styled.div`
  display: ${props => (props.lives > 0 ? "flex" : "none")};
  width: 7px;
  height: 3px;
  margin: 1px;
  margin-top: -5px;
  align-self: center;
  border-radius: 3px;
  border-style: solid;
  border-width: thin;
  background: linear-gradient(45deg, #d22b2b, #880808);
  border-color: #880808;
  pointer-events: none;
  margin-top: -15px;
`;

// a single frame in place of the run cycle, sized to match it
const FallingFrame = styled.img`
  position: absolute;
  left: 2px;
  top: 12px;
  width: 43px;
  height: 53px;
  pointer-events: none;
  image-rendering: pixelated;
`;

const SpriteSheet = styled.div`
  position: relative;
  pointer-events: none;

  ${props => `background: url(${props.spriteSheetSrc});`}

  ${props => props.avatar == 'kaiju' ?
    `transform: scale(0.4) translate(-169px, -169px); height: 230.33px; width: 180px;`
    : `transform: scale(.4) translate(-130px, -165px); height: 200px; width: 152px;`
  }

  ${props => `filter: drop-shadow(0 0 20px ${props.color});`}
  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  -webkit-transition: -webkit-transform 3s ease-in-out;
  ${props => `animation: ${props.anim} 1s steps(10) infinite;`};


    &::before {
    content: "";
    position: absolute;
    height: 230.33px;
    width: 180px;
    pointer-events: none;

    background: url("spritesheet/kaiju_sprite_FIRE1.png");
    background-position: center;

    ${props => `animation: ${props.anim} 1s steps(10) infinite;`};

    opacity: ${props => (props.isGoingToSpewFire ? 1 : 0)};
    transition: opacity 0.5s ease-in-out;
  }

  @keyframes upRight {
    from {
      background-position-x: -152px;
      background-position-y: 0px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 0px;
    }
  }
  @keyframes up {
    from {
      background-position-x: -152px;
      background-position-y: 220px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 220px;
    }
  }
  @keyframes upLeft {
    from {
      background-position-x: -152px;
      background-position-y: 440px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 440px;
    }
  }
  @keyframes downLeft {
    from {
      background-position-x: -152px;
      background-position-y: 660px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 660px;
    }
  }
  @keyframes down {
    from {
      background-position-x: -152px;
      background-position-y: 880px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 880px;
    }
  }
  @keyframes downRight {
    from {
      background-position-x: -152px;
      background-position-y: 1100px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 1100px;
    }
  }

  @keyframes idleupRight {
    from {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 0px;
    }
  }
  @keyframes idleup {
    from {
      background-position-x: 0px;
      background-position-y: 220px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 220px;
    }
  }
  @keyframes idleupLeft {
    from {
      background-position-x: 0px;
      background-position-y: 440px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 440px;
    }
  }
  @keyframes idledownLeft {
    from {
      background-position-x: 0px;
      background-position-y: 660px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 660px;
    }
  }
  @keyframes idledown {
    from {
      background-position-x: 0px;
      background-position-y: 880px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 880px;
    }
  }
  @keyframes idledownRight {
    from {
      background-position-x: 0px;
      background-position-y: 1100px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 1100px;
    }
  }


  @keyframes upRightKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 0px;
    }
  }
  @keyframes upKaiju  {
    from {
      background-position-x: 0px;
      background-position-y: 230.33px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 230.33px;
    }
  }
  @keyframes upLeftKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 460.66px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 460.66px;
    }
  }
  @keyframes downLeftKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 691px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 691px;
    }
  }
  @keyframes downKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 921.33px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 921.33px;
    }
  }
  @keyframes downRightKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 1151.66px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 1151.66px;
    }
  }

`;
const Character = styled.div`
    margin-left: -20px;
    margin-top: -45px;
    width: 50px;
    height: 75px;
    position: absolute;
    z-index: 1;
  pointer-events: none;
  animation-iteration-count: 2s;
  ${props => props.isDamaged && "animation: shake 0.5s;"};
  @keyframes shake {
    0% {
      transform: translate(1px, 1px) rotate(0deg);
    }
    10% {
      transform: translate(-1px, -2px) rotate(-1deg);
    }
    20% {
      transform: translate(-3px, 0px) rotate(1deg);
    }
    30% {
      transform: translate(3px, 2px) rotate(0deg);
    }
    40% {
      transform: translate(1px, -1px) rotate(1deg);
    }
    50% {
      transform: translate(-1px, 2px) rotate(-1deg);
    }
    60% {
      transform: translate(-3px, 1px) rotate(0deg);
    }
    70% {
      transform: translate(3px, 1px) rotate(-1deg);
    }
    80% {
      transform: translate(-1px, -1px) rotate(1deg);
    }
    90% {
      transform: translate(1px, 2px) rotate(0deg);
    }
    100% {
      transform: translate(1px, -2px) rotate(-1deg);
    }
  }
}
`;
const ModiferText = styled.p`
  position: absolute;
  margin-top: -30px;
  z-index: 20002;
  opacity: 0;
  font-size: ${props => (props.fontSize ? `${props.fontSize}px` : "17px")};
  ${Math.random() > 0.5
    ? `margin-left: ${Math.random() * 10}px`
    : `margin-right: ${Math.random() * 10}px`};
  color: ${props => props.color};
  ${props => props.doNotAnimate ? 'opacity: 1;' : `animation-timing-function: ease-in;
  -webkit-animation-duration: 2s;
  animation-duration: 2s;
  -webkit-animation-name: textRise;
  animation-name: textRise;`}
  @keyframes textRise {
    0% {
      opacity: 0;
      transform: translateY(0px);
    }
    10% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-30px);
    }
  }
`;

export const GameBoardPieceComponent = ({
  zIndex,
  charLocation,
  avatar,
  color,
  isVisible,
  isHealed,
  isCharmed, // future feature...
  isTeleported,
  isFalling,
  dir,
  spriteSheetSrc,
  lives,
  isGoingToSpewFire,
  isShowHealthBarOnComponent,
  facingDir,
  pieceScale,
  isQuiet = false // the Recruit or Terminate choice: no shaking, and no numbers
}) => {
  const [modifierText, setModifierText] = useState([]);
  const [isDamaged, setIsDamaged] = useState(null);
  const [isHealedLocal, setIsHealedLocal] = useState(false);
  const [isHealedCached, setIsHealedCached] = useState(isHealed);
  const [isTeleportedLocal, setIsTeleportedLocal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const getAnim = () => {
    if (avatar == 'kaiju') return dir == 'idle' ? 'downKaiju' : `${dir}Kaiju`;
    return dir == 'idle' ? `idle${facingDir}` : dir;
  };
  const anim = getAnim();
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (isHealed === isHealedCached && !isDamaged && !isQuiet) {
        setIsDamaged(true);
        setModifierText(prevText => [
          ...prevText,
          <ModiferText key={Math.random()} color={"#FF383B"}>
            {"-1"}
          </ModiferText>
        ]);
        setTimeout(() => setIsDamaged(null), 2000);
      }
    }
  }, [lives]);
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (!isHealedLocal && !isQuiet) {
        setIsHealedLocal(true);
        setTimeout(() => setIsHealedLocal(false), 2000);
        setModifierText(prevText => [
          ...prevText,
          <ModiferText key={Math.random()} color={"#9FEA4F"}>
            {"+1"}
          </ModiferText>
        ]);
      }
    }
    setIsHealedCached(isHealed);
  }, [isHealed]);
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (!isTeleportedLocal) {
        setIsTeleportedLocal(true);
        setTimeout(() => setIsTeleportedLocal(false), 2000);
        setModifierText(prevText => [
          ...prevText,
          <ModiferText key={Math.random()} fontSize={13} color={"#9338E9"}>
            Zip!
          </ModiferText>
        ]);
      }
    }
  }, [isTeleported]);

  const bars = !isShowHealthBarOnComponent ? undefined : Array(lives).fill(0).map((_, i) => <Bar lives={lives} key={i} />)
  return (
    <Wrapper zIndex={zIndex} isVisible={isVisible} charLocation={charLocation} pieceScale={pieceScale}>
      {!isQuiet && modifierText}
      <HealthBarWrapper lives={lives}>{bars}</HealthBarWrapper>
      <Character isDamaged={isDamaged && !isQuiet}>
        {isFalling ? <FallingFrame src="/levels/npcs/agentFalling.png" /> : <SpriteSheet
          avatar={avatar}
          spriteSheetSrc={spriteSheetSrc}
          isGoingToSpewFire={isGoingToSpewFire} // Kaiju-only
          lives={lives}
          anim={anim}
          color={color}
        />}
      </Character>
    </Wrapper>
  );
};

