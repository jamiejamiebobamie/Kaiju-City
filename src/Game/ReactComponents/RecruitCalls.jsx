import React, { useState } from "react";
import styled from "styled-components";
import { useKeyPress } from "Utils/utils";
import { PIECES_INFO } from "Utils/gameState";

/*
  Calling in recruits: one round button each, once per fight, on 7, 8 and 9 (number row or numpad).
  Keys only: the mouse doesn't play.
*/
export const RECRUIT_FIRST_KEY = 7;
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
  background: #111214;
  border: 0.22cqw solid #8d9097;
  border-radius: 50%;
  cursor: default;
  &:disabled {
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

export const RecruitCalls = ({ recruits, onCall, isDisabled }) => {
  const [used, setUsed] = useState([]);
  const call = avatar => {
    if (used.includes(avatar) || !onCall(avatar)) return;
    setUsed(calls => [...calls, avatar]);
  };

  useKeyPress({
    keyCodes: recruits.flatMap((_, index) => [`Digit${RECRUIT_FIRST_KEY + index}`, `Numpad${RECRUIT_FIRST_KEY + index}`]),
    keyDownCallback: code => {
      const avatar = recruits[Number(code.slice(-1)) - RECRUIT_FIRST_KEY];
      if (avatar) call(avatar);
    },
    isCharacterDead: isDisabled
  });

  return (
    // paused: they fade with everything else
    <Row style={{ opacity: isDisabled ? 0 : 1, transition: "opacity 0.3s" }}>
      {recruits.map((avatar, index) => (
        <CallButton
          key={avatar}
          aria-label={`Call ${avatar}`}
          disabled={used.includes(avatar)}
          tabIndex={-1}
          style={{ boxShadow: `0 0 0.9cqw ${PIECES_INFO[avatar].color}` }}
        >
          <Head src={`/levels/portraits/${avatar}.png`} />
          <KeyNumber>{RECRUIT_FIRST_KEY + index}</KeyNumber>
        </CallButton>
      ))}
    </Row>
  );
};
