import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { DIALOGUE } from "Game/DataClasses/DialogueLog";

/*
  The dialogue log, beside the monitor: a floating green hologram, after Disco Elysium's.
  Each line is a chunk under the last, with the speaker's CRT portrait, and the log scrolls down to the newest.
  The newest line types out. When a line waits (Click through), a Continue bar shows: a click, or any key, moves on.
*/
const LOG_LOOK = {
  green: "#6dffa0",
  dim: "rgba(109, 255, 160, 0.55)",
  names: { agent: "#6dffa0", teammate: "#ffd24a", player: "#7ec8ff", other: "#ff8fd8" },
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
  animation: ${flicker} ${LOG_LOOK.flickerSeconds}s linear infinite, ${drift} 3s linear infinite;
  transition: opacity 0.4s;
  pointer-events: auto;
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.2cqw 1.4cqw 0.6cqw;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: ${LOG_LOOK.dim} transparent;
  /* the top fades out, like a hologram's edge */
  mask-image: linear-gradient(to bottom, transparent, black 2.5cqw);
`;

const Chunk = styled.div`
  display: flex;
  gap: 0.9cqw;
  margin-bottom: 1.1cqw;
  /* the same speaker again: no portrait, and the words line up under theirs */
  padding-left: ${props => props.$isRepeat ? "5.3cqw" : "0"};
  margin-top: ${props => props.$isRepeat ? "-0.5cqw" : "0"};
  opacity: ${props => props.$isOld ? 0.6 : 1};
  transition: opacity 0.4s;
`;

const Portrait = styled.div`
  flex-shrink: 0;
  width: 4.4cqw;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 0.1cqw solid ${LOG_LOOK.dim};
  background: #041a10 center top / cover no-repeat;
  image-rendering: pixelated;
  filter: ${LOG_LOOK.portraitFilter};
`;

const Words = styled.div`
  font-size: 1.25cqw;
  line-height: 1.55;
`;

const Name = styled.span`
  text-transform: uppercase;
  margin-right: 0.5cqw;
`;

const ContinueBar = styled.button`
  margin: 0.6cqw 1.4cqw 1.2cqw;
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
`;

const TypedText = ({ text, isTyping }) => {
  const [letters, setLetters] = useState(isTyping ? 0 : text.length);
  useEffect(() => {
    if (letters >= text.length) return;
    const timeoutRef = setTimeout(() => setLetters(letters + 1), DIALOGUE.letterMs);
    return () => clearTimeout(timeoutRef);
  }, [letters, text]);
  return <>{text.slice(0, letters)}</>;
};

// 'entries': { key, who, name, text, avatar }. 'isVisible': hidden in fights, where the HUDs take this space.
// 'actions': buttons in place of Continue, for a choice ({ text, onClick, isEnter }), as in a radio call.
export const DialogueLogPanel = ({ entries, isWaiting, isVisible, onContinue, actions = [] }) => {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries.length]);

  if (!entries.length) return null;
  return (
    <Panel style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? "auto" : "none" }} onClick={() => isWaiting && onContinue()}>
      <Scroll ref={scrollRef}>
        {entries.map(({ key, who, name, text, avatar }, index) => {
          // a portrait, and the name, only when the speaker changes
          const isRepeat = index > 0 && entries[index - 1].name == name && entries[index - 1].avatar == avatar;
          return (
          <Chunk key={key} $isOld={index < entries.length - 1} $isRepeat={isRepeat}>
            {!isRepeat && <Portrait style={{ backgroundImage: avatar ? `url(/levels/portraits/${avatar}.png)` : undefined }} />}
            <Words>
              {!isRepeat && <Name style={{ color: LOG_LOOK.names[who] || LOG_LOOK.names.other }}>{name} -</Name>}
              <TypedText text={text} isTyping={index == entries.length - 1} />
            </Words>
          </Chunk>
          );
        })}
      </Scroll>
      {isWaiting && !actions.length && <ContinueBar data-enter onClick={event => { event.stopPropagation(); onContinue(); }}>Continue &#9654;</ContinueBar>}
      {actions.map(({ text, onClick, isEnter }) => (
        <ContinueBar key={text} data-enter={isEnter ? "" : undefined} onClick={event => { event.stopPropagation(); onClick(); }}>{text} &#9654;</ContinueBar>
      ))}
    </Panel>
  );
};
