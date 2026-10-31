import React, { useState } from "react";
import { Logo } from "./Logo";
import styled from "styled-components";

const Bar = styled.div`
  width: 100%;
  height: 125px;
  margin-bottom: -50px;
`;

export const NavBar = ({ isLogoDisplayed, handleClickHome }) => {
  return (
    <Bar>
      {isLogoDisplayed && (
        <Logo handleClickHome={handleClickHome} isNavBar={true} />
      )}
    </Bar>
  );
};
