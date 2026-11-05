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
  pointer-events: auto;
`;

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

const Portrait = styled.div`
  flex-shrink: 0;
  width: 6cqw;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 0.1cqw solid ${LOG_LOOK.dim};
  background: #041a10 center top / cover no-repeat;
  image-rendering: pixelated;
  filter: ${LOG_LOOK.portraitFilter};
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

  if (!entries.length || !isVisible) return null;
  return (
    <Panel onClick={() => isWaiting && onContinue()}>
      <Scroll ref={scrollRef} onScroll={({ currentTarget: scroll }) => { isAtBottom.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 8; }}>
        {entries.map(({ key, who, name, text, avatar, chain }, index) => {
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
      {isWaiting && !actions.length && <ContinueBar data-enter onClick={event => { event.stopPropagation(); onContinue(); }}>Continue &#9654;</ContinueBar>}
      {actions.map(({ text, onClick, isEnter }) => (
        <ContinueBar key={text} data-enter={isEnter ? "" : undefined} onClick={event => { event.stopPropagation(); onClick(); }}>{text} &#9654;</ContinueBar>
      ))}
      {footer && <Footer onClick={event => event.stopPropagation()}>{footer}</Footer>}
    </Panel>
  );
};
