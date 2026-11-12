import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
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

// it builds in 0.75 s, and the words start once it has.
// it comes apart as before, its strips floating up, but right to left and quicker, and in perspective:
// each strip tips back as it rises, so the ones that go highest look farthest away
const PANEL_MOTION = { buildMs: 750, pieceMs: 480, strips: 9, staggerMs: 45, blocks: 16, tiltDegrees: 6, tipDegrees: 35 };
export const BREAK_TOTAL_MS = PANEL_MOTION.pieceMs + (PANEL_MOTION.strips - 1) * PANEL_MOTION.staggerMs;

// it builds out from the screen's edge: revealed left to right
// built, it opens a little past its edges: the green bars sit outside it (BAR_GAP)
const buildOut = keyframes`
  from { clip-path: inset(-3cqw 100% -3cqw 0); }
  to { clip-path: inset(-3cqw -1cqw -3cqw -1cqw); }
`;

// and comes apart: the whole panel goes as its strips float off
const breakAway = keyframes`
  0% { opacity: 1; }
  25% { opacity: 0; }
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
    ${props => props.$isClosing ? breakAway : buildOut} ${props => props.$isClosing ? 400 : PANEL_MOTION.buildMs}ms ease-out both;
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

// coming apart: a strip floats up and away, tipping back into the distance and tilting a little, and fades
const stripFloat = keyframes`
  0% { opacity: 0.9; transform: perspective(40cqw) translate3d(0, 0, 0) rotateX(0deg) rotate(0deg); }
  100% { opacity: 0; transform: perspective(40cqw) translate3d(0, var(--rise), var(--depth)) rotateX(${PANEL_MOTION.tipDegrees}deg) rotate(var(--tilt)); }
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
  transform-origin: 50% 100%;
  animation: ${stripFloat} ${PANEL_MOTION.pieceMs}ms ease-in both;
`;

// fixed once, so the blocks and strips don't jump about between renders
const BLOCKS = Array.from({ length: PANEL_MOTION.blocks }, (_, k) => ({
  top: `${(k * 37) % 96}%`, size: `${0.5 + ((k * 7) % 5) * 0.25}cqw`, spread: `${1 + (k % 4)}cqw`, rise: `${3 + (k % 5) * 1.5}cqw`,
  delay: (k / PANEL_MOTION.blocks) * PANEL_MOTION.buildMs * 0.85
}));
const STRIPS = Array.from({ length: PANEL_MOTION.strips }, (_, k) => {
  const rise = 8 + ((k * 5) % 7) * 2; // in cqw, uneven as before
  return {
    left: `${(k / PANEL_MOTION.strips) * 100}%`, width: `${100 / PANEL_MOTION.strips + 0.3}%`,
    rise: `${-rise}cqw`, depth: `${-rise * 2.5}cqw`, // the higher it goes, the farther back
    tilt: `${((k % 3) - 1) * PANEL_MOTION.tiltDegrees}deg`,
    delay: (PANEL_MOTION.strips - 1 - k) * PANEL_MOTION.staggerMs, // right to left
    zIndex: k
  };
});

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
    {STRIPS.map(({ left, width, rise, depth, tilt, delay, zIndex }, k) => (
      <Strip key={k} style={{ left, width, zIndex, "--rise": rise, "--depth": depth, "--tilt": tilt, animationDelay: `${delay}ms` }} />
    ))}
  </Frame>
);

/*
  The words between two green bars (Jamie, playtest 21, from the UI epic): the one speaking now, their portrait and name,
  stays under the top bar. each new line rises from the bottom bar to just under them; what was said before goes on up,
  under the portrait and name, and into the top bar. scrolling back still shows it.
*/
// the bars stand off the panel, the page showing between (Jamie, playtest 22); the words run between the bars, through
// the gaps, and behind the speaker's portrait and name and the buttons, which stay over them
const BAR_GAP = 1.6; // cqw

const GreenBar = styled.div`
  position: absolute;
  left: 1.4cqw;
  right: 1.4cqw;
  ${props => props.$isTop ? `top: -${BAR_GAP}cqw;` : `bottom: -${BAR_GAP}cqw;`}
  height: 0.35cqw;
  z-index: 3;
  background: ${LOG_LOOK.green};
  box-shadow: 0 0 0.8cqw ${LOG_LOOK.green}, 0 0 0.25cqw ${LOG_LOOK.green};
`;

const Body = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`;

const Scroll = styled.div`
  position: absolute;
  top: -${BAR_GAP - 0.35}cqw;
  bottom: -${BAR_GAP - 0.35}cqw;
  left: 0;
  right: 0;
  z-index: 0;
  overflow-y: auto;
  padding: 0 1.4cqw;
  scrollbar-width: thin;
  scrollbar-color: ${LOG_LOOK.dim} transparent;
`;

// the buttons at the foot: over the words passing behind them
const BottomArea = styled.div`
  position: relative;
  z-index: 2;
  background: linear-gradient(to bottom, rgba(4, 24, 13, 0), rgba(4, 24, 13, 0.97) 0.8cqw);
  padding-top: 0.4cqw;
  &:empty { display: none; }
`;

// the one speaking now, over the words going up behind them
const Header = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0.8cqw;
  z-index: 2;
  padding: 0.8cqw 1.4cqw 0.4cqw;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(4, 28, 15, 0.98) 80%, rgba(4, 28, 15, 0));
`;

const riseFromBar = keyframes`
  from { transform: translateY(6cqw); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const Chunk = styled.div`
  margin-bottom: ${props => props.$isRepeat ? "0.8cqw" : "1.2cqw"};
  opacity: ${props => props.$isOld ? 0.6 : 1};
  transition: opacity 0.4s;
  ${props => props.$isNew ? css`animation: ${riseFromBar} 0.5s ease-out both;` : ""}
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1cqw;
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

// the key that presses a log button: orange, a color no speaker's name uses
// one option: [ENTER] rather than 1 (Jamie). gameboy has no brackets: these are a monospace's
const Bracket = styled.span`
  font-family: "Courier New", Courier, monospace;
  font-weight: bold;
`;
const EnterKey = () => <><Bracket>[</Bracket>ENTER<Bracket>]</Bracket></>;

const KeyNumber = styled.span`
  color: #c24f00;
`;

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6cqw;
  padding: 0.6cqw 1.4cqw 1.2cqw;
`;

// 'isRushed': Continue was pressed mid-line: the rest comes in a quick burst (RUSH_STEPS ticks), so it's seen to finish.
// no longer the newest line: it shows whole at once (Jamie, playtest 19: lines kept typing under the next ones)
const RUSH_STEPS = 5;
const TypedText = ({ text, isTyping, isRushed = false, onType, onDone }) => {
  const [letters, setLetters] = useState(isTyping ? 0 : text.length);
  useEffect(() => {
    if (!isTyping && letters < text.length) setLetters(text.length);
  }, [isTyping]);
  useEffect(() => {
    if (letters >= text.length) {
      onDone && onDone();
      return;
    }
    const step = isRushed ? Math.ceil((text.length - letters) / RUSH_STEPS) : 1;
    const timeoutRef = setTimeout(() => setLetters(Math.min(letters + step, text.length)), DIALOGUE.letterMs);
    return () => clearTimeout(timeoutRef);
  }, [letters, text, isRushed]);
  useLayoutEffect(() => { onType && onType(); }, [letters]);
  return <>{text.slice(0, letters)}</>;
};

/*
  'entries': { key, who, name, text, avatar, chain }. A new 'chain' (a fight in between) shows the portrait again.
  'isVisible': hidden in fights, where the HUDs take this space.
  'actions': buttons in place of Continue, for a choice ({ text, onClick, isEnter }), as in a radio call.
  'footer': anything else to choose from, stacked under the words (the Recruit or Terminate buttons).
*/
// 'onClosing': told when it starts and stops coming apart, so the HUDs can wait for it
export const DialogueLogPanel = ({ entries, isWaiting, isVisible, onContinue, actions = [], footer = null, onClosing = undefined, onBuilt = undefined }) => {
  const scrollRef = useRef(null);
  // Continue (Enter, 1, a click) while the newest line still types: it finishes the line first; the next press goes on
  // (Jamie, playtest 19)
  const newestKey = entries.length ? entries[entries.length - 1].key : undefined;
  const [doneKey, setDoneKey] = useState(undefined);
  const [rushedKey, setRushedKey] = useState(undefined);
  const handleContinue = () => {
    if (newestKey !== undefined && doneKey !== newestKey) {
      setRushedKey(newestKey);
      return;
    }
    onContinue();
  };
  // the newest line goes to just under the speaker's portrait and name, and its end stays in view as it types out,
  // unless the player has scrolled to read back (wheel or touch), till the next line
  const headerRef = useRef(null);
  const newestRef = useRef(null);
  const bottomRef = useRef(null);
  // the words' room: from under the header (measured from the scroll's own top, which is up in the gap) to over the buttons
  const getRoom = () => {
    const scroll = scrollRef.current;
    if (!scroll) return { top: 0, bottom: 0 };
    const box = scroll.getBoundingClientRect();
    const header = headerRef.current ? headerRef.current.getBoundingClientRect().bottom - box.top : 0;
    const buttons = bottomRef.current && bottomRef.current.offsetHeight ? box.bottom - bottomRef.current.getBoundingClientRect().top : 0;
    return { top: Math.max(header, 0), bottom: Math.max(buttons, 0) };
  };
  const [spacerPx, setSpacerPx] = useState(0);
  const [headerPx, setHeaderPx] = useState(0); // the words start below the header, never behind it
  const isFollowing = useRef(true);
  const followNewest = (isSmooth = false) => {
    const scroll = scrollRef.current;
    const newest = newestRef.current;
    if (!scroll || !newest || !isFollowing.current) return;
    const room = getRoom();
    const top = Math.max(newest.offsetTop - room.top, 0);
    const bottom = newest.offsetTop + newest.offsetHeight - (scroll.clientHeight - room.bottom) + 8; // a long line: its end in view
    const target = Math.max(top, bottom);
    if (Math.abs(scroll.scrollTop - target) < 2) return;
    scroll.scrollTo({ top: target, behavior: isSmooth ? "smooth" : "auto" });
  };
  const keepAtBottom = () => followNewest(false);
  // sizes: the spacer that lets the newest line reach the top, and the header's height (same values: no new render)
  // the spacer: just enough for the newest line to reach the header, no more (Jamie, playtest 22: scrolling down went on
  // past the words into nothing)
  useLayoutEffect(() => {
    const room = getRoom();
    const newest = newestRef.current ? newestRef.current.offsetHeight : 0;
    if (scrollRef.current) setSpacerPx(Math.max(scrollRef.current.clientHeight - room.top - newest, 0));
    setHeaderPx(Math.round(room.top));
  });
  useLayoutEffect(() => {
    isFollowing.current = true;
    followNewest(true);
  }, [entries.length, headerPx]);

  // where the newest speaker's run of lines starts (the same speaker, back from the newest)
  const getIsSameSpeaker = (a, b) => !!a && !!b && a.name == b.name && a.avatar == b.avatar && a.chain == b.chain;
  let headerRunStart = entries.length - 1;
  while (headerRunStart > 0 && getIsSameSpeaker(entries[headerRunStart - 1], entries[headerRunStart])) headerRunStart -= 1;

  // it builds itself when it opens, and comes apart when it closes
  const isShown = !!entries.length && isVisible;
  const [isClosing, setIsClosing] = useState(false);
  const [isBuilt, setIsBuilt] = useState(false); // the words wait for the panel to finish building
  const wasShown = useRef(false);
  useEffect(() => { onBuilt && onBuilt(isBuilt); }, [isBuilt]); // the words are showing: whoever says them can start to shake
  useEffect(() => {
    if (wasShown.current && !isShown) {
      setIsClosing(true);
      setIsBuilt(false);
      onClosing && onClosing(true);
      const timeoutRef = setTimeout(() => { setIsClosing(false); onClosing && onClosing(false); }, BREAK_TOTAL_MS + 100);
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
    <Panel onClick={() => isWaiting && handleContinue()}>
      <GreenBar $isTop />
      <Scroll ref={scrollRef} style={{ paddingTop: `${headerPx}px` }} onWheel={() => { isFollowing.current = false; }} onTouchMove={() => { isFollowing.current = false; }}>
        {isBuilt && entries.map(({ key, who, name, text, avatar, chain }, index) => {
          const last = entries[index - 1];
          const isNewest = index == entries.length - 1;
          // the newest speaker's run of lines: their portrait is the header's, not shown again in the words (playtest 22)
          const isInHeaderRun = index >= headerRunStart;
          const isRepeat = !!last && last.name == name && last.avatar == avatar && last.chain == chain;
          return (
            <Chunk key={key} ref={isNewest ? newestRef : undefined} $isOld={!isNewest} $isNew={isNewest} $isRepeat={isRepeat}>
              {/* the newest one's speaker is in the header above */}
              {!isRepeat && !isInHeaderRun && (
                <Speaker>
                  <Portrait style={{ backgroundImage: avatar ? `url(/levels/portraits/${avatar}.png)` : undefined }} />
                  <Name style={{ color: LOG_LOOK.names[who] || LOG_LOOK.names.other }}>{name}</Name>
                </Speaker>
              )}
              <Words>
                <TypedText text={text} isTyping={isNewest} isRushed={rushedKey === key} onType={keepAtBottom} onDone={() => setDoneKey(key)} />
              </Words>
            </Chunk>
          );
        })}
        <div style={{ height: `${spacerPx}px` }} />
      </Scroll>
      <Body>
        {isBuilt && entries.length > 0 && (() => {
          const { who, name, avatar } = entries[entries.length - 1];
          return (
            <Header ref={headerRef}>
              <Speaker style={{ marginBottom: 0 }}>
                <Portrait style={{ backgroundImage: avatar ? `url(/levels/portraits/${avatar}.png)` : undefined }} />
                <Name style={{ color: LOG_LOOK.names[who] || LOG_LOOK.names.other }}>{name}</Name>
              </Speaker>
            </Header>
          );
        })()}
      </Body>
      <BottomArea ref={bottomRef}>
      {isBuilt && isWaiting && !actions.length && <ContinueBar data-enter data-log-continue data-choice-key={1} onClick={event => { event.stopPropagation(); handleContinue(); }}><span>Continue &#9654;</span><KeyNumber><EnterKey /></KeyNumber></ContinueBar>}
      {isBuilt && actions.map(({ text, onClick, isEnter }, index) => (
        <ContinueBar key={text} data-enter={isEnter ? "" : undefined} data-choice-key={index + 1} onClick={event => { event.stopPropagation(); onClick(); }}><span>{text} &#9654;</span><KeyNumber>{actions.length == 1 ? <EnterKey /> : index + 1}</KeyNumber></ContinueBar>
      ))}
      {isBuilt && footer && <Footer onClick={event => event.stopPropagation()}>{footer}</Footer>}
      </BottomArea>
      <GreenBar />
    </Panel>
    </>
  );
};
