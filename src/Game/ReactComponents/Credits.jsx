import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

/*
  The end of the game: after "You saved the city!", the credits rise from below the screen to above it,
  then "Thank you for playing!", then back to the landing screen.
  DRAFT credits (Jamie to review): names and wording are placeholders where marked.
*/
export const CREDITS = [
  { heading: "Kaiju City" },
  { heading: "Created by", lines: ["Jamie McCrory"] },
  { heading: "Game design, story and direction", lines: ["Jamie McCrory"] },
  { heading: "Programming", lines: ["Jamie McCrory", "with Claude Code (Anthropic)"] },
  { heading: "Peninsula map art", lines: ["Commissioned on Fiverr (artist name to add)"] },
  { heading: "Sea creature icons", lines: ["Game Icons, game-icons.net", "CC BY 3.0, creativecommons.org/licenses/by/3.0"] },
  { heading: "Icons", lines: ["Font Awesome"] },
  { heading: "Thanks to", lines: ["everyone who playtested"] }
];

export const CREDITS_TIMING = {
  titleMs: 3500, // "You saved the city!" holds this long before the credits start
  rollSeconds: 26, // from off the bottom to off the top
  thanksMs: 3500 // "Thank you for playing!", then the landing screen
};

const rise = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(-100%); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Cover = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483000;
  background: black;
  overflow: hidden;
  animation: ${fadeIn} 1.2s ease-out;
  container-type: inline-size;
`;

// it starts just below the screen, and rises until it is just above it
const Roll = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5cqw;
  padding-bottom: 100cqh;
  animation: ${rise} ${CREDITS_TIMING.rollSeconds}s linear forwards;
  font-family: gameboy;
  text-align: center;
  color: #f2f2f2;
`;

const Heading = styled.div`
  font-size: 2.2cqw;
  color: #ffd23b;
  text-transform: uppercase;
  letter-spacing: 0.2cqw;
`;

const Line = styled.div`
  font-size: 1.6cqw;
  margin-top: 1cqw;
`;

const Thanks = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: gameboy;
  font-size: 4cqw;
  color: #ff2a4d;
  text-transform: uppercase;
  animation: ${fadeIn} 1s ease-out;
`;

export const Credits = ({ onDone }) => {
  const [isThanks, setIsThanks] = useState(false);
  useEffect(() => {
    const thanks = setTimeout(() => setIsThanks(true), CREDITS_TIMING.rollSeconds * 1000);
    const done = setTimeout(onDone, CREDITS_TIMING.rollSeconds * 1000 + CREDITS_TIMING.thanksMs);
    return () => {
      clearTimeout(thanks);
      clearTimeout(done);
    };
  }, []);
  return (
    <Cover>
      {!isThanks && (
        <Roll>
          {CREDITS.map(({ heading, lines = [] }) => (
            <div key={heading}>
              <Heading>{heading}</Heading>
              {lines.map(line => <Line key={line}>{line}</Line>)}
            </div>
          ))}
        </Roll>
      )}
      {isThanks && <Thanks>Thank you for playing!</Thanks>}
    </Cover>
  );
};
