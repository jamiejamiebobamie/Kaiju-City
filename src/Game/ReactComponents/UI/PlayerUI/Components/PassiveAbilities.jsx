import React from "react";
import styled from "styled-components";
import { PassiveAbility } from './PassiveAbility';

const Wrapper = styled.div`
  display: flex;
  align-self: center;
  justify-content: center;
  position: absolute;
  top: 86px;
  right: 85px;
  width: 50px;
  height: 50px;
  transform: rotate(90deg);
  margin-top: -20px;
`;

export const PassiveAbilities = ({
  isTeammate,
  abilities = []
}) => {

  const passiveAbilityIcons = abilities.map((_, i) => {
    const j = abilities.length - 1 - i;
    const a = abilities[j];
    return (
      <PassiveAbility
        key={i}
        i={i}
        element={a.element}
        passiveName={a.passiveName}
        color={a.color}
        isOnCooldown={a.isPassiveApplied}
        isTeammate={isTeammate}
        accTime={a.accTime}
      />
    )
  });
  return <Wrapper>{passiveAbilityIcons}</Wrapper>;
};
