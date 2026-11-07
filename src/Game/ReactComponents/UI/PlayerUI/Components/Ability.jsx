import React, { useEffect, useState } from "react";
import styled from "styled-components";

const ICON_LOOKUP = {
  wink: { active: "fa-two-hearts", passive: "fa-two-hearts", loader: "fa-spinner" },
  love: {
    passive: "fa-gratipay",
    active: "fa-plus",
    loader: "fa-spinner"
  },
  glass: {
    passive: "fa-tencent-weibo",
    active: "fa-ravelry",
    loader: "fa-spinner"
  },
  fire: {
    passive: "fa-fire",
    active: "fa-free-code-camp",
    loader: "fa-spinner"
  },
  water: {
    passive: "fa-exclamation-triangle",
    active: "fa-tint",
    loader: "fa-spinner"
  },
  wood: {
    passive: "fa-tree",
    active: "fa-leaf",
    loader: "fa-spinner"
  },
  lightning: {
    passive: "fa-hourglass-half",
    active: "fa-bolt",
    loader: "fa-spinner"
  },
  death: {
    passive: "fa-heartbeat",
    active: "fa-snapchat-ghost",
    loader: "fa-spinner"
  },
  bubble: {
    passive: "fa-universal-access",
    active: "fa-question-circle-o",
    loader: "fa-spinner"
  },
  metal: {
    passive: "fa-cutlery",
    active: "fa-shield",
    loader: "fa-spinner"
  },
  ice: {
    passive: "fa-thermometer-quarter",
    active: "fa-snowflake-o",
    loader: "fa-spinner"
  },
  kaijuFire: {
    passive: "fa-free-code-camp",
    active: "fa-free-code-camp",
    loader: "fa-spinner"
  }
};
const Wrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-self: center;
  align-items: center;
  margin-left: 10px;
  justify-self: center;
  align-self: center;
  border-radius: 100%;
  border-style: solid;
  border-color: ${props => props.color};
  min-width: 50px;
  height: 50px;
  transition: 2s;
  -webkit-animation-duration: 1s;
  animation-duration: 1s;
  /* -webkit-animation-name: fadeInRightAbility;
  animation-name: fadeInRightAbility;
  @keyframes fadeInRightAbility {
    0% {
      opacity: 0;
      transform: translateX(20px);
    }
    10% {
      opacity: 0;
      transform: translateX(20px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  } */
  ${props => props.isAnimating && "animation: rotation linear .5s;"};
  @keyframes rotation {
    0% {
      transform: rotate3d(0, 1, 0, 0deg);
    }
    50% {
      transform: rotate3d(0, 1, 0, 90deg);
    }
    100% {
      transform: rotate3d(0, 1, 0, 0deg);
    }
  }
  pointer-events: auto;

`;
const AbilityIcon = styled.i`
  color: ${props => props.color};
  z-index: ${props => props.i};
  justify-self: center;
  align-self: center;
  transform: scale(2);
  ${props =>
    props.isCoolDown && "animation: spin linear " + props.cooldownTime + "ms;"}
  animation-play-state: ${props => props.isPaused ? "paused" : "running"};
  @keyframes spin {
    5% {
      transform: scale(2) rotate(0deg);
    }
    80% {
      transform: scale(2) rotate(648deg);
      opacity: 1;
    }
    100% {
      transform: scale(4) rotate(900deg);
      opacity: 0;
    }
  }
`;
const AbilityNum = styled.div`
  display: flex;
  position: absolute;
  right: -10px;
  bottom: -3px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border-radius: 10px;
  border-radius: 100%;
  border-style: solid;
  border-thickness: thin;
  border-color: ${props => props.color};
  background-color: ${props => props.color};
  color: #152642;
  text-align: right;
  align-content: center;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

export const Ability = ({
  abilityIndex,
  playerIndex,
  abilityData,
  keyNum,
  isPaused,
  isCharacterAlive
}) => {
  const { activeName, cooldownTime, element, color, accTime, isOnCooldown: isOnCoolDown } = abilityData;
  const [isAnimating, setIsAnimating] = useState(false);
  const [isJustUsed, setIsJustUsed] = useState(false);

  /* the press: a pop, and the loader shows a moment later. the cooldown itself is the game's, from 'isOnCooldown' */
  useEffect(() => {
    if (!accTime) return;
    setIsAnimating(true);
    setIsJustUsed(true);
    const timeoutRefs = [
      setTimeout(() => setIsAnimating(false), 500),
      setTimeout(() => setIsJustUsed(false), 250)
    ];
    return () => timeoutRefs.forEach(clearTimeout);
  }, [accTime]);
  const iconLookupString = isOnCoolDown && !isJustUsed ? "loader" : "active";

  return (
    <Wrapper
      isAnimating={isAnimating}
      title={activeName}
      color={color}
    >
      {/* a new icon for each cast, so its spin starts again: an NPC that casts again the moment it can (the Mermaid's Charm
          and Heal) is never seen off cooldown, and the spin, run once, would sit still from then on */}
      <AbilityIcon
        key={accTime || 0}
        disabled={true}
        className={`fa ${ICON_LOOKUP[element][iconLookupString]}`}
        isCoolDown={isOnCoolDown}
        cooldownTime={cooldownTime}
        isPaused={isPaused}
        color={color}
      />
      {keyNum !== undefined && <AbilityNum color={color}>
        <div style={{ marginLeft: "4px" }}>{keyNum}</div>
      </AbilityNum>}
    </Wrapper>
  );
};
