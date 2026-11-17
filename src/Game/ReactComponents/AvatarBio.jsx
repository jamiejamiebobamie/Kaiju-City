import React, { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";

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
// (Jamie, playtest 28) he walks out of the shadows into a light from above, then his balloon pops in and types out;
// the feed is unstable (grain, rolling bars, now and then a tear). The walk-in plays once a visit; back to him after
// a hover, he's simply there (a quick fade)
const AGENT_TIMING = { walkMs: 1700, balloonAtMs: 1750, typeMs: 55, quickMs: 260 };
let isAgentIntroDone = false;

const spotUp = keyframes`
  0% { opacity: 0; }
  35% { opacity: 1; }
  100% { opacity: 1; }
`;
const walkIn = keyframes`
  0% { opacity: 0; filter: grayscale(1) contrast(1.9) brightness(0) sepia(1) hue-rotate(70deg) saturate(2.4) blur(0.25cqw); transform: translateX(-50%) scale(0.93); }
  45% { opacity: 0.55; filter: grayscale(1) contrast(1.9) brightness(0.35) sepia(1) hue-rotate(70deg) saturate(2.4) blur(0.12cqw); }
  100% { opacity: 1; filter: grayscale(1) contrast(1.9) brightness(0.85) sepia(1) hue-rotate(70deg) saturate(2.4) blur(0); transform: translateX(-50%) scale(1); }
`;
const quickIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
// the unstable feed: now and then a jolt sideways and a dip
const feedJitter = keyframes`
  0%, 100% { translate: 0 0; opacity: 1; }
  41% { translate: 0 0; opacity: 1; }
  42% { translate: 0.35cqw 0; opacity: 0.75; }
  43% { translate: -0.2cqw 0; opacity: 0.95; }
  44% { translate: 0 0; opacity: 1; }
  77% { translate: 0 0; }
  78% { translate: -0.45cqw 0.1cqw; opacity: 0.6; }
  79.5% { translate: 0 0; opacity: 1; }
`;
const grainShift = keyframes`
  0% { background-position: 0 0; }
  25% { background-position: 13px -7px; }
  50% { background-position: -9px 11px; }
  75% { background-position: 6px 4px; }
  100% { background-position: 0 0; }
`;
const tear = keyframes`
  0%, 70%, 100% { opacity: 0; }
  71% { opacity: 1; top: 38%; }
  73% { opacity: 0; }
  88% { opacity: 1; top: 62%; }
  89.5% { opacity: 0; }
`;

const AgentFeed = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: ${feedJitter} 3.7s steps(1) infinite;
`;
// the light from above: a soft cone falling on where he stands
const Spotlight = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 32% 70% at 50% 0%, rgba(150, 255, 150, 0.16), rgba(150, 255, 150, 0.05) 55%, transparent 80%);
  animation: ${spotUp} ${props => props.$isQuick ? AGENT_TIMING.quickMs : AGENT_TIMING.walkMs}ms ease-out both;
`;
const AgentFace = styled.div`
  position: absolute;
  left: 50%;
  top: 3%;
  width: 78%;
  height: 68%;
  transform: translateX(-50%);
  background-size: cover;
  background-position: center 4%;
  filter: grayscale(1) contrast(1.9) brightness(0.85) sepia(1) hue-rotate(70deg) saturate(2.4);
  -webkit-mask-image: radial-gradient(ellipse 62% 66% at 50% 42%, black 52%, transparent 100%);
  mask-image: radial-gradient(ellipse 62% 66% at 50% 42%, black 52%, transparent 100%);
  ${props => props.$isQuick
    ? css`animation: ${quickIn} ${AGENT_TIMING.quickMs}ms ease-out both;`
    : css`animation: ${walkIn} ${AGENT_TIMING.walkMs}ms cubic-bezier(0.3, 0.1, 0.3, 1) both;`}
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0 1px, transparent 1px 3px);
  }
`;
// grain and a slow rolling bar over the feed
const Static = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.32;
  mix-blend-mode: screen;
  background: repeating-radial-gradient(circle at 17% 33%, rgba(160, 255, 160, 0.5) 0 0.5px, transparent 0.6px 2.3px);
  background-size: 37px 29px;
  animation: ${grainShift} 0.18s steps(4) infinite;
`;
// (the whole screen's height, top to bottom: it stopped halfway, moved by its own height. Jamie, playtest 29)
const barRoll = keyframes`from { top: -30%; } to { top: 100%; }`;
const RollBar = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 30%;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgba(160, 255, 160, 0.07) 45%, rgba(160, 255, 160, 0.11) 50%, rgba(160, 255, 160, 0.07) 55%, transparent);
  animation: ${barRoll} 4.5s linear infinite;
`;
const Tear = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: 0.5cqw;
  background: linear-gradient(to right, transparent, rgba(180, 255, 180, 0.55) 20%, rgba(180, 255, 180, 0.2) 70%, transparent);
  animation: ${tear} 3.7s steps(1) infinite;
`;
/*
  Glitches (Jamie, playtest 28): now and then a few thin bands of his picture jump sideways, their colors split, for a
  moment, at random heights each time; the rest of him stays as he is
*/
const GLITCH = { everyMs: [450, 1700], showMs: [70, 180], bands: [1, 3], heightPct: [3, 11], shiftCqw: 1.4 };
const between = ([low, high]) => low + Math.random() * (high - low);
const GlitchBand = styled(AgentFace)`
  animation: none;
  pointer-events: none;
`;
const AgentGlitches = ({ isOn }) => {
  const [bands, setBands] = useState([]);
  useEffect(() => {
    if (!isOn) return;
    let timeout;
    const next = () => {
      const count = Math.round(between(GLITCH.bands));
      setBands([...Array(count)].map((_, k) => {
        const height = between(GLITCH.heightPct);
        const top = Math.random() * (100 - height);
        return { key: `${Date.now()}-${k}`, top, bottom: 100 - top - height, shift: (Math.random() - 0.5) * 2 * GLITCH.shiftCqw, hue: Math.random() < 0.5 ? 40 : 130 };
      }));
      timeout = setTimeout(() => {
        setBands([]);
        timeout = setTimeout(next, between(GLITCH.everyMs));
      }, between(GLITCH.showMs));
    };
    timeout = setTimeout(next, between(GLITCH.everyMs));
    return () => clearTimeout(timeout);
  }, [isOn]);
  return bands.map(({ key, top, bottom, shift, hue }) => (
    <GlitchBand
      key={key}
      style={{
        backgroundImage: "url(/levels/portraits/agent.png)",
        clipPath: `inset(${top}% 0 ${bottom}% 0)`,
        transform: `translateX(calc(-50% + ${shift}cqw))`,
        filter: `grayscale(1) contrast(2.2) brightness(1.1) sepia(1) hue-rotate(${hue}deg) saturate(3)`
      }}
    />
  ));
};

// a little grain on the balloon (Jamie, playtest 29), no glitches
const BalloonGrain = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0.22;
  mix-blend-mode: screen;
  background: repeating-radial-gradient(circle at 23% 41%, rgba(160, 255, 160, 0.6) 0 0.5px, transparent 0.6px 2.1px);
  background-size: 31px 23px;
  animation: ${grainShift} 0.2s steps(4) infinite;
`;

const balloonPop = keyframes`
  0% { opacity: 0; transform: scale(0.6); }
  70% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
`;
const AgentBalloon = styled.div`
  position: absolute;
  left: 9%;
  right: 9%;
  bottom: 9%;
  min-height: 2.6cqw;
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
  transform-origin: 18% 0;
  animation: ${balloonPop} 320ms ease-out both;
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

const AgentCall = () => {
  const [isQuick] = useState(isAgentIntroDone);
  const [isBalloonUp, setIsBalloonUp] = useState(isQuick);
  const [typed, setTyped] = useState(isQuick ? AGENT_CALL.line.length : 0);
  useEffect(() => {
    if (isQuick) return;
    const timeouts = [setTimeout(() => setIsBalloonUp(true), AGENT_TIMING.balloonAtMs)];
    [...AGENT_CALL.line].forEach((_, k) => timeouts.push(setTimeout(() => setTyped(k + 1), AGENT_TIMING.balloonAtMs + 250 + k * AGENT_TIMING.typeMs)));
    timeouts.push(setTimeout(() => { isAgentIntroDone = true; }, AGENT_TIMING.balloonAtMs + 250 + AGENT_CALL.line.length * AGENT_TIMING.typeMs));
    return () => timeouts.forEach(clearTimeout);
  }, []);
  return (
    <Screen>
      <AgentFeed>
        <Spotlight $isQuick={isQuick} />
        <AgentFace $isQuick={isQuick} style={{ backgroundImage: "url(/levels/portraits/agent.png)" }} />
        <AgentGlitches isOn={isBalloonUp} />
        <Static />
        <Tear />
      </AgentFeed>
      {isBalloonUp && <AgentBalloon style={isQuick ? { animation: "none" } : undefined}><BalloonGrain />{AGENT_CALL.line.slice(0, typed)}</AgentBalloon>}
      {/* the rolling bar over everything on the screen, the balloon too (Jamie, playtest 29) */}
      <RollBar />
    </Screen>
  );
};

// 'avatar': the one hovered ("guy" or "girl"), or none
export const AvatarBio = ({ avatar }) => {
  const file = avatar && AVATAR_BIOS[avatar];
  if (!file) {
    return (
      <AgentCall />
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
