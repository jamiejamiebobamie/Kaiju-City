import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { DIALOGUE } from "Game/DataClasses/DialogueLog";

/*
  The dialogue log, beside the monitor: a floating green hologram, after Disco Elysium's.
  Each line is a chunk under the last, and the log keeps scrolled down to the newest as it types out.
  When the speaker changes, their CRT portrait and name head the chunk, as a block of their own above the words.
  When a line waits (Click through), a Continue bar shows: a click, or any key, moves on.
*/
const LOG_LOOK = {
  green: "#6dffa0",
  dim: "rgba(109, 255, 160, 0.55)",
  names: { agent: "#e6f3ff", teammate: "#ffd24a", player: "#7ec8ff", other: "#ff8fd8" }, // the Agent in silver: green on green was hard to read
  portraitFilter: "sepia(1) hue-rotate(75deg) saturate(1.6) brightness(1.05)",
  flickerSeconds: 4.3
};

const flicker = keyframes`
  0%, 100% { opacity: 0.96; }
  47% { opacity: 0.96; }
  48% { opacity: 0.8; }
  49% { opacity: 0.98; }
  73% { opacity: 0.9; }
`;

const drift = keyframes`
  from { background-position: 0 0; }
  to { background-position: 0 6cqw; }
`;

// slow enough to see it build; the words start once it has. it breaks apart strip by strip, right to left.
const PANEL_MOTION = { buildMs: 1500, breakMs: 650, stripStaggerMs: 90, blocks: 18, strips: 9 };
const BREAK_TOTAL_MS = PANEL_MOTION.breakMs + (PANEL_MOTION.strips - 1) * PANEL_MOTION.stripStaggerMs;

// it builds out from the screen's edge: revealed left to right
const buildOut = keyframes`
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
`;

// and comes apart: the whole panel goes as its strips float off
const breakAway = keyframes`
  0% { opacity: 1; }
  8% { opacity: 0; }
  100% { opacity: 0; }
`;

const Panel = styled.div`
  position: absolute;
  top: 6cqw;
  bottom: 6cqw;
  right: 6cqw;
  width: 27cqw;
  z-index: 2147483640;
  display: flex;
  flex-direction: column;
  font-family: gameboy;
  color: ${LOG_LOOK.green};
  background:
    repeating-linear-gradient(to bottom, rgba(109, 255, 160, 0.05) 0 1px, transparent 1px 4px),
    linear-gradient(to right, rgba(4, 30, 16, 0.72), rgba(4, 22, 12, 0.5));
  border-left: 0.15cqw solid ${LOG_LOOK.dim};
  box-shadow: -0.4cqw 0 1.6cqw rgba(60, 255, 140, 0.18), inset 0.4cqw 0 1.2cqw rgba(60, 255, 140, 0.08);
  text-shadow: 0 0 0.4cqw rgba(109, 255, 160, 0.7);
  animation: ${flicker} ${LOG_LOOK.flickerSeconds}s linear infinite, ${drift} 3s linear infinite,
    ${props => props.$isClosing ? breakAway : buildOut} ${props => props.$isClosing ? PANEL_MOTION.breakMs : PANEL_MOTION.buildMs}ms ease-out both;
  pointer-events: ${props => props.$isClosing ? "none" : "auto"};
`;

// the frame the panel's own pieces build and break inside of
const Frame = styled.div`
  position: absolute;
  top: 6cqw;
  bottom: 6cqw;
  right: 6cqw;
  width: 27cqw;
  z-index: 2147483641;
  pointer-events: none;
`;

// the building edge: it sweeps right with the reveal, throwing off glowing blocks
const sweep = keyframes`
  from { left: 0%; opacity: 1; }
  85% { opacity: 1; }
  to { left: 100%; opacity: 0; }
`;

const BuildEdge = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.2cqw;
  background: ${LOG_LOOK.green};
  box-shadow: 0 0 1cqw ${LOG_LOOK.green};
  animation: ${sweep} ${PANEL_MOTION.buildMs}ms ease-out both;
`;

// each block springs out from the edge, spreads right, then drifts up as a ghost and is gone
const blockLife = keyframes`
  0% { opacity: 0; transform: translate(0, 0) scale(0.4); }
  20% { opacity: 1; transform: translate(var(--spread), 0) scale(1); }
  100% { opacity: 0; transform: translate(calc(var(--spread) * 1.6), calc(-1 * var(--rise))) scale(0.7); }
`;

const Block = styled.span`
  position: absolute;
  left: 0;
  width: var(--size);
  height: var(--size);
  background: rgba(109, 255, 160, 0.35);
  border: 0.08cqw solid ${LOG_LOOK.green};
  box-shadow: 0 0 0.6cqw rgba(109, 255, 160, 0.7);
  animation: ${blockLife} 0.9s ease-out both;
`;

// coming apart: tall strips break off and float up, fading
const stripFloat = keyframes`
  0% { opacity: 0.9; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(var(--rise)) rotate(var(--tilt)); }
`;

const Strip = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  background:
    repeating-linear-gradient(to bottom, rgba(109, 255, 160, 0.08) 0 1px, transparent 1px 4px),
    rgba(4, 30, 16, 0.6);
  border-left: 0.08cqw solid rgba(109, 255, 160, 0.4);
  box-shadow: inset 0 0 0.8cqw rgba(60, 255, 140, 0.15);
  animation: ${stripFloat} ${PANEL_MOTION.breakMs}ms ease-in both;
`;

// fixed once, so the blocks and strips don't jump about between renders
const BLOCKS = Array.from({ length: PANEL_MOTION.blocks }, (_, k) => ({
  top: `${(k * 37) % 96}%`, size: `${0.5 + ((k * 7) % 5) * 0.25}cqw`, spread: `${1 + (k % 4)}cqw`, rise: `${3 + (k % 5) * 1.5}cqw`,
  delay: (k / PANEL_MOTION.blocks) * PANEL_MOTION.buildMs * 0.85
}));
const STRIPS = Array.from({ length: PANEL_MOTION.strips }, (_, k) => ({
  left: `${(k / PANEL_MOTION.strips) * 100}%`, width: `${100 / PANEL_MOTION.strips + 0.3}%`,
  rise: `${-(8 + ((k * 5) % 7) * 2)}cqw`, tilt: `${((k % 3) - 1) * 3}deg`, delay: (PANEL_MOTION.strips - 1 - k) * PANEL_MOTION.stripStaggerMs // the right-hand strip goes first
}));

const BuildEffect = () => (
  <Frame>
    <BuildEdge>
      {BLOCKS.map(({ top, size, spread, rise, delay }, k) => (
        <Block key={k} style={{ top, "--size": size, "--spread": spread, "--rise": rise, animationDelay: `${delay}ms` }} />
      ))}
    </BuildEdge>
  </Frame>
);

const BreakEffect = () => (
  <Frame>
    {STRIPS.map(({ left, width, rise, tilt, delay }, k) => (
      <Strip key={k} style={{ left, width, "--rise": rise, "--tilt": tilt, animationDelay: `${delay}ms` }} />
    ))}
  </Frame>
);

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.2cqw 1.4cqw 0.6cqw;
  scrollbar-width: thin;
  scrollbar-color: ${LOG_LOOK.dim} transparent;
  /* the top fades out, like a hologram's edge */
  mask-image: linear-gradient(to bottom, transparent, black 2.5cqw);
`;

const Chunk = styled.div`
  margin-bottom: ${props => props.$isRepeat ? "0.8cqw" : "1.2cqw"};
  opacity: ${props => props.$isOld ? 0.6 : 1};
  transition: opacity 0.4s;
`;

// the speaker: portrait and name, a block of their own
const Speaker = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.9cqw;
  margin-bottom: 0.6cqw;
`;

const portraitFlicker = keyframes`
  0%, 100% { opacity: 1; }
  31% { opacity: 1; }
  32% { opacity: 0.55; }
  34% { opacity: 1; }
  68% { opacity: 0.85; }
  70% { opacity: 1; }
`;

const scanLine = keyframes`
  from { top: -20%; }
  to { top: 110%; }
`;

// a CRT feed: it flickers, and a bright line rolls slowly down it
const Portrait = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 6cqw;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 0.1cqw solid ${LOG_LOOK.dim};
  background: #041a10 center top / cover no-repeat;
  image-rendering: pixelated;
  filter: ${LOG_LOOK.portraitFilter};
  animation: ${portraitFlicker} 3.7s steps(1) infinite;
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 18%;
    background: linear-gradient(to bottom, transparent, rgba(200, 255, 220, 0.35), transparent);
    animation: ${scanLine} 3.2s linear infinite;
  }
`;

const Name = styled.div`
  font-size: 1.15cqw;
  text-transform: uppercase;
  text-shadow: 0 0 0.3cqw black, 0 0 0.5cqw currentColor;
`;

const Words = styled.div`
  font-size: 1.25cqw;
  line-height: 1.55;
`;

const ContinueBar = styled.button`
  margin: 0.6cqw 1.4cqw 0;
  padding: 0.55cqw 1cqw;
  font-family: gameboy;
  font-size: 1.1cqw;
  letter-spacing: 0.15cqw;
  text-align: left;
  color: #04140b;
  background: ${LOG_LOOK.green};
  border: none;
  cursor: pointer;
  box-shadow: 0 0 0.9cqw rgba(109, 255, 160, 0.6);
  &:hover {
    background: #a8ffc6;
  }
  &:last-child {
    margin-bottom: 1.2cqw;
  }
`;

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6cqw;
  padding: 0.6cqw 1.4cqw 1.2cqw;
`;

const TypedText = ({ text, isTyping, onType }) => {
  const [letters, setLetters] = useState(isTyping ? 0 : text.length);
  useEffect(() => {
    if (letters >= text.length) return;
    const timeoutRef = setTimeout(() => setLetters(letters + 1), DIALOGUE.letterMs);
    return () => clearTimeout(timeoutRef);
  }, [letters, text]);
  useLayoutEffect(() => { onType && onType(); }, [letters]);
  return <>{text.slice(0, letters)}</>;
};

/*
  'entries': { key, who, name, text, avatar, chain }. A new 'chain' (a fight in between) shows the portrait again.
  'isVisible': hidden in fights, where the HUDs take this space.
  'actions': buttons in place of Continue, for a choice ({ text, onClick, isEnter }), as in a radio call.
  'footer': anything else to choose from, stacked under the words (the Recruit or Terminate buttons).
*/
export const DialogueLogPanel = ({ entries, isWaiting, isVisible, onContinue, actions = [], footer = null }) => {
  const scrollRef = useRef(null);
  // it keeps to the bottom as lines come and type out, unless the player has scrolled up to read back
  const isAtBottom = useRef(true);
  const keepAtBottom = () => {
    const scroll = scrollRef.current;
    if (scroll && isAtBottom.current) scroll.scrollTop = scroll.scrollHeight;
  };
  useLayoutEffect(() => {
    isAtBottom.current = true;
    keepAtBottom();
  }, [entries.length]);

  // it builds itself when it opens, and comes apart when it closes
  const isShown = !!entries.length && isVisible;
  const [isClosing, setIsClosing] = useState(false);
  const [isBuilt, setIsBuilt] = useState(false); // the words wait for the panel to finish building
  const wasShown = useRef(false);
  useEffect(() => {
    if (wasShown.current && !isShown) {
      setIsClosing(true);
      setIsBuilt(false);
      const timeoutRef = setTimeout(() => setIsClosing(false), BREAK_TOTAL_MS + 200);
      wasShown.current = isShown;
      return () => clearTimeout(timeoutRef);
    }
    wasShown.current = isShown;
    if (!isShown) return;
    setIsClosing(false);
    const timeoutRef = setTimeout(() => setIsBuilt(true), PANEL_MOTION.buildMs);
    return () => clearTimeout(timeoutRef);
  }, [isShown]);

  if (!isShown && !isClosing) return null;
  if (isClosing) return <><Panel $isClosing /><BreakEffect /></>;
  return (
    <>
    <BuildEffect />
    <Panel onClick={() => isWaiting && onContinue()}>
      <Scroll ref={scrollRef} onScroll={({ currentTarget: scroll }) => { isAtBottom.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 8; }}>
        {isBuilt && entries.map(({ key, who, name, text, avatar, chain }, index) => {
          const last = entries[index - 1];
          const isRepeat = !!last && last.name == name && last.avatar == avatar && last.chain == chain;
          return (
            <Chunk key={key} $isOld={index < entries.length - 1} $isRepeat={isRepeat}>
              {!isRepeat && (
                <Speaker>
                  <Portrait style={{ backgroundImage: avatar ? `url(/levels/portraits/${avatar}.png)` : undefined }} />
                  <Name style={{ color: LOG_LOOK.names[who] || LOG_LOOK.names.other }}>{name}</Name>
                </Speaker>
              )}
              <Words>
                <TypedText text={text} isTyping={index == entries.length - 1} onType={keepAtBottom} />
              </Words>
            </Chunk>
          );
        })}
      </Scroll>
      {isBuilt && isWaiting && !actions.length && <ContinueBar data-enter data-choice-key={1} onClick={event => { event.stopPropagation(); onContinue(); }}>(1) Continue &#9654;</ContinueBar>}
      {isBuilt && actions.map(({ text, onClick, isEnter }, index) => (
        <ContinueBar key={text} data-enter={isEnter ? "" : undefined} data-choice-key={index + 1} onClick={event => { event.stopPropagation(); onClick(); }}>({index + 1}) {text} &#9654;</ContinueBar>
      ))}
      {isBuilt && footer && <Footer onClick={event => event.stopPropagation()}>{footer}</Footer>}
    </Panel>
    </>
  );
};
