import React from "react";
import styled from "styled-components";

/*
  The avatar select's side screen (Jamie, 2026-11-16): the two candidates' files, in green, not the tamagotchi (that's
  on the picker). Hovering an avatar opens its file: its dialogue portrait, a few lines about it, and a short bio.
  All of the words are DRAFT (Claude's filler, for Jamie to rewrite): what's known is that both were soldiers the Agent
  recruited to become super-powered cyborg super soldiers.
*/
const GREEN = "#80EF80";

export const AVATAR_BIOS = {
  guy: {
    draft: true,
    file: "Subject 01",
    name: "Guy",
    lines: [
      ["Former post", "Urban recon, 3rd Response"],
      ["Augments", "Spinal relay, reactive plating"],
      ["Status", "Cleared for field trials"]
    ],
    bio: "Pulled from a collapsed overpass the night of the first landfall. The Agent signed him before the dust settled. Three surgeries and a new nervous system later, he still takes his coffee black."
  },
  girl: {
    draft: true,
    file: "Subject 02",
    name: "Girl",
    lines: [
      ["Former post", "Combat medic, harbor unit"],
      ["Augments", "Neural lattice, grip servos"],
      ["Status", "Cleared for field trials"]
    ],
    bio: "Kept a whole squad alive through the harbor attack with one kit and no backup. The Agent's offer came with a promise: never be outmatched again. Fastest sim times in the program, and she keeps the scores."
  }
};

const Screen = styled.div`
  position: absolute;
  inset: 0;
  padding: 1.4cqw 1.5cqw;
  box-sizing: border-box;
  background: black;
  color: ${GREEN};
  font-family: gameboy;
  text-shadow: 0 0 0.3cqw rgba(128, 239, 128, 0.6);
  display: flex;
  flex-direction: column;
  gap: 1cqw;
`;

const Header = styled.div`
  font-size: 0.8cqw;
  letter-spacing: 0.1cqw;
  opacity: 0.75;
`;

const Top = styled.div`
  display: flex;
  gap: 1.1cqw;
  align-items: flex-start;
`;

// as the dialogue panel shows them (Jamie): 3:4, from the top of the picture, in its green
const Portrait = styled.div`
  flex: none;
  width: 6.5cqw;
  aspect-ratio: 3 / 4;
  border: 0.12cqw solid ${GREEN};
  box-shadow: 0 0 0.5cqw rgba(128, 239, 128, 0.45);
  background: #041a10 center top / cover no-repeat;
  image-rendering: pixelated;
  filter: sepia(1) hue-rotate(75deg) saturate(1.6) brightness(1.05);
`;

const Name = styled.div`
  font-size: 1.6cqw;
  margin-bottom: 0.6cqw;
  text-transform: uppercase;
`;

const Line = styled.div`
  font-size: 0.72cqw;
  line-height: 1.5;
  span { opacity: 0.6; }
`;

const Bio = styled.div`
  font-size: 0.8cqw;
  line-height: 1.6;
`;

/*
  Nothing hovered (Jamie, playtest 27): the Agent, watching, oversized and centered, a "1984" telescreen look (hard
  green monochrome, scanlines, a dark vignette), his question in a green techno balloon below him, its tail at its
  top left pointing up and right, at him. Always there while nothing's hovered.
*/
const AGENT_CALL = { line: "who are you recruit?" }; // (Jamie's words)
const AgentFace = styled.div`
  position: absolute;
  left: 50%;
  top: -6%;
  width: 78%;
  height: 72%;
  transform: translateX(-50%);
  background-size: cover;
  background-position: center 18%;
  filter: grayscale(1) contrast(1.9) brightness(0.85) sepia(1) hue-rotate(70deg) saturate(2.4);
  -webkit-mask-image: radial-gradient(ellipse 62% 66% at 50% 42%, black 52%, transparent 100%);
  mask-image: radial-gradient(ellipse 62% 66% at 50% 42%, black 52%, transparent 100%);
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0 1px, transparent 1px 3px);
  }
`;
const AgentBalloon = styled.div`
  position: absolute;
  left: 9%;
  right: 9%;
  bottom: 9%;
  padding: 1cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.15cqw;
  letter-spacing: 0.06cqw;
  line-height: 1.5;
  text-align: center;
  color: ${GREEN};
  text-shadow: 0 0 0.4cqw rgba(128, 239, 128, 0.7);
  background: rgba(6, 30, 10, 0.85);
  border: 0.15cqw solid ${GREEN};
  border-radius: 0.3cqw;
  box-shadow: 0 0 0.8cqw rgba(128, 239, 128, 0.45), inset 0 0 0.8cqw rgba(128, 239, 128, 0.2);
  /* the tail: at the top left, up and to the right, at him */
  &::before {
    content: "";
    position: absolute;
    left: 14%;
    top: -1.5cqw;
    width: 1.7cqw;
    height: 1.5cqw;
    background: ${GREEN};
    clip-path: polygon(0 100%, 100% 0, 55% 100%);
  }
  &::after {
    content: "";
    position: absolute;
    left: calc(14% + 0.2cqw);
    top: -1.05cqw;
    width: 1.2cqw;
    height: 1.1cqw;
    background: rgba(6, 30, 10, 1);
    clip-path: polygon(0 100%, 100% 0, 55% 100%);
  }
`;

// 'avatar': the one hovered ("guy" or "girl"), or none
export const AvatarBio = ({ avatar }) => {
  const file = avatar && AVATAR_BIOS[avatar];
  if (!file) {
    return (
      <Screen>
        <AgentFace style={{ backgroundImage: "url(/levels/portraits/agent.png)" }} />
        <AgentBalloon>{AGENT_CALL.line}</AgentBalloon>
      </Screen>
    );
  }
  return (
    <Screen>
      <Header>{file.file}</Header>
      <Top>
        <Portrait style={{ backgroundImage: `url(/levels/portraits/${avatar}.png)` }} />
        <div>
          <Name>{file.name}</Name>
          {file.lines.map(([label, value]) => <Line key={label}><span>{label}:</span> {value}</Line>)}
        </div>
      </Top>
      <Bio>{file.bio}</Bio>
    </Screen>
  );
};
