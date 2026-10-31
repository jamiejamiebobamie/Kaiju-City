import React, { useEffect } from "react";
import styled from "styled-components";
import { useHover } from "Utils/utils";

const ICON_LOOKUP = {
  love: {
    Passive: "fa-gratipay",
    Active: "fa-heart",
    loader: "fa-spinner"
  },
  glass: {
    Passive: "fa-tencent-weibo",
    Active: "fa-ravelry",
    loader: "fa-spinner"
  },
  fire: {
    Passive: "fa-fire",
    Active: "fa-free-code-camp",
    loader: "fa-spinner"
  },
  water: {
    Passive: "fa-exclamation-triangle",
    Active: "fa-tint",
    loader: "fa-spinner"
  },
  wood: {
    Passive: "fa-tree",
    Active: "fa-leaf",
    loader: "fa-spinner"
  },
  lightning: {
    Passive: "fa-hourglass-half",
    Active: "fa-bolt",
    loader: "fa-spinner"
  },
  death: {
    Passive: "fa-heartbeat",
    Active: "fa-snapchat-ghost",
    loader: "fa-spinner"
  },
  bubble: {
    Passive: "fa-universal-access",
    Active: "fa-question-circle-o",
    loader: "fa-spinner"
  },
  metal: {
    Passive: "fa-wrench",
    Active: "fa-shield",
    loader: "fa-spinner"
  },
  ice: {
    Passive: "fa-thermometer-quarter",
    Active: "fa-snowflake-o",
    loader: "fa-spinner"
  }
};

const Wrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-self: center;
  align-items: center;
  justify-self: center;
  align-self: center;
  border-radius: 100%;
  color: ${props => (props.color ? props.color : "#db974f")};
  border-style: solid;
  border-width: thin;
  border-color: ${props => (props.color ? props.color : "#db974f")};
  min-width: 50px;
  height: 50px;
  cursor: pointer;
  }
`;
const AbilityIcon = styled.i`
  z-index: ${props => props.i};
  justify-self: center;
  align-self: center;
  transform: scale(2);
  color: ${props => (props.color ? props.color : "grey")};
`;
export const Ability = ({
  name,
  isActive,
  setDisplayString,
  displayLookup,
  element,
  isPicked,
  color
}) => {
  const [setHoverRef, hoverLookupString] = useHover();
  useEffect(() => setDisplayString(hoverLookupString), [hoverLookupString]);
  return (
    <Wrapper
      ref={setHoverRef(`${displayLookup}${isActive ? "Active" : "Passive"}`)}
      title={name}
      color={isPicked ? color : undefined}
    >
      <AbilityIcon
        color={isPicked ? color : undefined}
        className={`fa ${ICON_LOOKUP[element][isActive ? "Active" : "Passive"]
          }`}
      />
    </Wrapper>
  );
};
