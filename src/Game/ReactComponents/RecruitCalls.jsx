import React, { useState } from "react";
import styled from "styled-components";
import { useKeyPress } from "Utils/utils";
import { PIECES_INFO } from "Utils/gameState";

/*
  A mock-up of calling in recruits: one round button each, once per fight.
  The numbers carry on after the powers' numbers. Pressing one only marks it used for now.
*/
const Row = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1cqw;
  transform: translateX(-50%);
  z-index: 2147483640;
  display: flex;
  gap: 1cqw;
`;

const CallButton = styled.button`
  position: relative;
  width: 4.6cqw;
  height: 4.6cqw;
  padding: 0;
  overflow: visible;
  cursor: pointer;
  background: #111214;
  border: 0.22cqw solid #8d9097;
  border-radius: 50%;
  &:disabled {
    cursor: default;
    filter: grayscale(1) brightness(0.45);
  }
`;

const Head = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 8%;
  image-rendering: pixelated;
`;

const KeyNumber = styled.div`
  position: absolute;
  right: -0.3cqw;
  bottom: -0.3cqw;
  width: 1.7cqw;
  height: 1.7cqw;
  line-height: 1.7cqw;
  border-radius: 50%;
  font-family: gameboy;
  font-size: 0.9cqw;
  color: #0b0c0e;
  background: #d9dade;
`;

export const RecruitCalls = ({ recruits, firstNumber, isDisabled }) => {
  const [used, setUsed] = useState([]);
  const call = avatar => setUsed(calls => [...calls, avatar]);

  useKeyPress({
    keyCodes: recruits.map((_, index) => `Digit${firstNumber + index}`),
    keyDownCallback: code => {
      const avatar = recruits[Number(code.slice(-1)) - firstNumber];
      if (avatar) call(avatar);
    },
    isCharacterDead: isDisabled
  });

  return (
    <Row>
      {recruits.map((avatar, index) => (
        <CallButton
          key={avatar}
          aria-label={`Call ${avatar}`}
          disabled={used.includes(avatar)}
          style={{ boxShadow: `0 0 0.9cqw ${PIECES_INFO[avatar].color}` }}
          onClick={() => call(avatar)}
        >
          <Head src={`/levels/portraits/${avatar}.png`} />
          <KeyNumber>{firstNumber + index}</KeyNumber>
        </CallButton>
      ))}
    </Row>
  );
};
