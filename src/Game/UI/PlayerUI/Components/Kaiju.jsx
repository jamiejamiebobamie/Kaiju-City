import React, { useEffect } from "react";
import styled from "styled-components";
import { useHover } from "../../../../Utils/utils";
const Wrapper = styled.div`
  display: flex;
  padding-top: 10px;
  ${props =>
    props.isReversed
      ? "margin-top: -10px;"
      : "margin-bottom: -10px; padding-top: 10px;"}
  width: 70%;
  height: 60px;
  border-radius: 10px;
  overflow: hidden;
`;
const KaijuIcon = styled.i`
  min-width: 30px;
  margin-left: 10px;
  justify-self: center;
  align-self: center;
  height: 30px;
`;
export const Kaiju = ({
  kaijuArr = [
    { displayLookup: "kaijuGlass", name: "Not-Mothra" },
    { displayLookup: "kaijuFire", name: "Not-Godzilla" },
    { displayLookup: "kaijuWood", name: "Kudzu" },
    { displayLookup: "kaijuLightning", name: "Gargantula" },
    { displayLookup: "kaijuDeath", name: "Giant Mantis" },
    { displayLookup: "kaijuBubble", name: "Blimpy" },
    { displayLookup: "kaijuMetal", name: "Mechatron" }
  ],
  setDisplayString,
  isReversed
}) => {
  // const [setHoverRef, hoverLookupString] = useHover();
  // useEffect(() => setDisplayString(hoverLookupString), [hoverLookupString]);
  const kaijuIcons = kaijuArr.map((kaiju, i) => (
    <KaijuIcon
      key={i}
      className="fa fa-optin-monster"
      // ref={setHoverRef(`Kaiju`)}
      title={`Kaiju #${i + 1}`}
      alt={""}
    />
  ));
  return <Wrapper isReversed={isReversed}>{kaijuIcons}</Wrapper>;
};
