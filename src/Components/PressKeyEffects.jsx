import React, { useMemo, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { getIsTouchLayout } from "Utils/device";

// (a touch screen has no keys: "Tap to start" there. Mobile step 4)
export const getPromptText = () => getIsTouchLayout() ? "Tap to start" : "Press any key";

/*
  "[Press any key]" on the landing, and its effects (Jamie, 2026-11-15), after arcade attract screens ("insert coin",
  "press start"). Four of them, each its own mock-up, or all at once ('mix') with a panel to switch each off and tune
  its numbers. Pick with ?press=<id> on the landing's address; with none, Jamie's tuned mix (no panel); ?press=mix
  shows the panel.
*/
export const PRESS_EFFECTS = [
  { id: "neon", label: "Neon (the landing's own, 2026-11-19): the city's warm light in the title's purple, breathing" },
  { id: "hud", label: "HUD lock-on: ghosts fired at a square's corners" },
  { id: "blink", label: "Classic blink: hard on/off, color-split edges and a scan line" },
  { id: "chase", label: "Marquee chase: a wave of color along the letters and the bars" },
  { id: "zoom", label: "Zoom echo: copies zoom out from the words, the words pumping in time" },
  { id: "mix", label: "All of them, each switchable and tunable" }
];

const COLORS = { purple: "#e25cff", green: "#80EF80" };

// every effect's numbers; the panel tunes them ('on' switches one off). Jamie's tuned mix (2026-11-15), the landing's
// own: the HUD ghosts faint, the words barely swaying, a near-constant blink with wide color splits, the chase on,
// no zoom
export const PRESS_DEFAULTS = {
  hud: {
    on: true,
    boxX: 150, boxY: 75, // the square's corners, from the words
    perCorner: 5, // shots at each corner
    shotGapSeconds: 0.32, // between them
    pauseSeconds: 0.6, // after the last, before it moves on
    glideSeconds: 0.35, // to the next corner
    glideShots: 1, // fired on the way
    travelSeconds: 1.25, // a shot's flight
    opacity: 0.15, // a shot's, as it leaves the words
    swayShare: 0.02, // the words' own square, of the box's size
    swayLaps: 12 // the words' laps to the shots' one (more: quicker)
  },
  blink: { on: true, onMs: 700, offMs: 32, splitPx: 32, scan: false },
  chase: { on: true, stepMs: 140, waveMs: 1100, bars: true },
  zoom: { on: false, everyMs: 700, copies: 0, scale: 1.5, pump: false }
};

// with no ?press=, the neon (Jamie, 2026-11-19: to go with the logo; the tuned mix is ?press=mix, with its panel)
export const getPressEffect = () => {
  const id = new URLSearchParams(window.location.search).get("press");
  return PRESS_EFFECTS.some(effect => effect.id == id) ? id : "neon";
};
export const getIsPressPanel = () => new URLSearchParams(window.location.search).get("press") == "mix";

// the effect's settings: one effect on, or (mix) all of them, tunable
export const usePressSettings = effect => useState(() => Object.fromEntries(Object.entries(PRESS_DEFAULTS).map(([id, values]) => [id, { ...values, on: effect == "mix" ? values.on : effect == id }])));

const KeyLine = styled.div`
  flex: 1;
  height: 2px;
  background: ${COLORS.purple};
  box-shadow: 0 0 6px ${COLORS.purple};
`;

const KeyText = styled.div`
  position: relative;
  font-family: gameboy;
  font-size: 22px;
  letter-spacing: 3px;
  white-space: nowrap;
  color: ${COLORS.purple};
  /* a neon green border round the purple words (Jamie, 2026-11-15), under the fill so the letters keep their shape */
  -webkit-text-stroke: 2px ${COLORS.green};
  paint-order: stroke fill;
  text-shadow: 0 0 8px ${COLORS.purple}, 0 0 3px ${COLORS.green};
`;

// gameboy has no brackets: these are a monospace's, as the dialogue's [ENTER]
const Bracket = styled.span`
  font-family: "Courier New", Courier, monospace;
  font-weight: bold;
  font-size: 1.4em;
  line-height: 0;
`;

export const KeyWords = () => <><Bracket>[</Bracket>{getPromptText()}<Bracket>]</Bracket></>;

// pressed (Jamie): the ghosts hold where they are and fade out quickly, and don't come back while the words go white
const Trails = styled.span`
  transition: opacity 0.35s ease-out;
  ${props => props.$isLeaving && css`
    opacity: 0;
    & > * { animation-play-state: paused; }
  `}
`;

// any element with an animation made from the settings ('$anim': its keyframes and the rest of the shorthand)
const Animated = styled.span`
  ${props => props.$anim && !props.$isStill && css`animation: ${props.$anim.frames} ${props.$anim.rest};`}
`;

const Ghost = styled(Animated)`
  position: absolute;
  left: 0;
  top: 0;
  color: ${COLORS.green};
  text-shadow: none;
  -webkit-text-stroke: 0;
`;

const Holder = styled(Animated)`
  position: relative;
  display: inline-block;
`;

/*
  1. HUD lock-on (Jamie: a fighter pilot's HUD, its squares marking where it fires): ghosts fire out of the words all
  the time, at a target that goes round a square about them: a run of shots at each corner, a pause, a quick glide on
  to the next (a shot or so on the way). The words move round a little square of their own, quicker and with no holds;
  their lap divides the shots', so each shot leaves from the words where they are.
*/
const useHud = settings => useMemo(() => {
  const { boxX, boxY, perCorner, shotGapSeconds, pauseSeconds, glideSeconds, glideShots, travelSeconds, opacity, swayShare, swayLaps } = settings;
  const corners = [{ x: boxX, y: -boxY }, { x: -boxX, y: -boxY }, { x: -boxX, y: boxY }, { x: boxX, y: boxY }];
  const stretch = Math.max(0.05, (perCorner - 1) * shotGapSeconds + pauseSeconds + glideSeconds);
  const lap = stretch * corners.length;
  const ease = share => share * share * (3 - 2 * share);
  const shots = corners.flatMap((corner, k) => {
    const start = k * stretch;
    const next = corners[(k + 1) % corners.length];
    const atCorner = [...Array(Math.max(0, Math.round(perCorner))).keys()].map(j => ({ time: start + j * shotGapSeconds, ...corner }));
    const glideStart = start + (perCorner - 1) * shotGapSeconds + pauseSeconds;
    const onTheWay = [...Array(Math.max(0, Math.round(glideShots))).keys()].map(j => {
      const share = (j + 1) / (glideShots + 1);
      return { time: glideStart + share * glideSeconds, x: corner.x + (next.x - corner.x) * ease(share), y: corner.y + (next.y - corner.y) * ease(share) };
    });
    return [...atCorner, ...onTheWay];
  });
  const swaySeconds = lap / Math.max(1, Math.round(swayLaps));
  const swayCorners = corners.map(({ x, y }) => ({ x: x * swayShare, y: y * swayShare }));
  const swayAt = time => {
    const along = ((time % swaySeconds) / swaySeconds) * swayCorners.length;
    const k = Math.floor(along) % swayCorners.length;
    const into = along - Math.floor(along);
    const from = swayCorners[k];
    const to = swayCorners[(k + 1) % swayCorners.length];
    return { x: from.x + (to.x - from.x) * ease(into), y: from.y + (to.y - from.y) * ease(into) };
  };
  const trail = keyframes`
    0% { transform: translate(var(--sx, 0px), var(--sy, 0px)); opacity: ${opacity}; }
    ${Math.min(99, (travelSeconds / lap) * 100)}% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
    100% { transform: translate(var(--dx), var(--dy)); opacity: 0; }
  `;
  const sway = keyframes`${swayCorners.map(({ x, y }, k) => `
    ${(k * 100) / swayCorners.length}% { transform: translate(${x.toFixed(2)}px, ${y.toFixed(2)}px); animation-timing-function: ease-in-out; }`).join("")}
    100% { transform: translate(${swayCorners[0].x.toFixed(2)}px, ${swayCorners[0].y.toFixed(2)}px); }
  `;
  return {
    shots: shots.map(shot => ({ ...shot, from: swayAt(shot.time) })),
    trail: { frames: trail, rest: `${lap}s ease-out infinite` },
    sway: { frames: sway, rest: `${swaySeconds}s infinite` },
    lap
  };
}, [JSON.stringify(settings)]);

/*
  2. Classic blink: the words snap on and off on a hard beat ("INSERT COIN"); at each switch-on a magenta and a cyan
  copy split off the edges for an instant, and a bright scan line runs down the letters.
*/
const useBlink = settings => useMemo(() => {
  const { onMs, offMs } = settings;
  const beatMs = Math.max(50, onMs + offMs);
  const onShare = (onMs / beatMs) * 100;
  return {
    beat: { frames: keyframes`0%, ${onShare}% { opacity: 1; } ${onShare + 0.01}%, 100% { opacity: 0; }`, rest: `${beatMs}ms steps(1) infinite` },
    split: { frames: keyframes`
      0% { transform: translate(var(--split), 0); opacity: 0.9; }
      12% { transform: translate(calc(var(--split) * 0.3), 0); opacity: 0.5; }
      25%, 100% { transform: translate(0, 0); opacity: 0; }`, rest: `${beatMs}ms ease-out infinite` },
    scan: { frames: keyframes`
      0% { top: -20%; opacity: 0.9; }
      40% { top: 110%; opacity: 0.9; }
      41%, 100% { top: 110%; opacity: 0; }`, rest: `${beatMs}ms linear infinite` }
  };
}, [JSON.stringify(settings)]);

const SplitCopy = styled(Animated)`
  position: absolute;
  left: 0;
  top: 0;
  color: var(--tint);
  text-shadow: none;
  -webkit-text-stroke: 0;
  mix-blend-mode: screen;
`;

const ScanLine = styled(Animated)`
  position: absolute;
  left: -4%;
  right: -4%;
  height: 3px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.85), transparent);
  pointer-events: none;
`;

/*
  3. Marquee chase: like the bulbs round an arcade cabinet's marquee, a wave of color runs along the letters, over and
  over, each a moment after the one before; the bars either side take the same colors (Jamie): the left one as the
  wave starts, the right one as it ends.
*/
const CHASE_COLORS = [COLORS.purple, COLORS.green, "#ffffff", "#ffd24a"];
const chaseFrames = keyframes`${CHASE_COLORS.map((color, k) => `
  ${(k * 100) / CHASE_COLORS.length}% { color: ${color}; text-shadow: 0 0 ${k == 2 ? 12 : 7}px ${color}; }`).join("")}
  100% { color: ${CHASE_COLORS[0]}; text-shadow: 0 0 7px ${CHASE_COLORS[0]}; }
`;
const barFrames = keyframes`${CHASE_COLORS.map((color, k) => `
  ${(k * 100) / CHASE_COLORS.length}% { background: ${color}; box-shadow: 0 0 6px ${color}; }`).join("")}
  100% { background: ${CHASE_COLORS[0]}; box-shadow: 0 0 6px ${CHASE_COLORS[0]}; }
`;
const ChaseBar = styled(KeyLine)`
  ${props => props.$anim && !props.$isStill && css`animation: ${props.$anim.frames} ${props.$anim.rest};`}
`;

const CHASE_TEXT = getPromptText();

/*
  4. Zoom echo: copies of the words zoom out from them and fade, one after another, as if the title rushes at the
  screen; the words themselves pump a little, in time with each one leaving.
*/
const useZoom = settings => useMemo(() => ({
  copy: { frames: keyframes`0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(${settings.scale}); opacity: 0; }`, rest: `${Math.max(50, settings.everyMs * settings.copies)}ms ease-out infinite` },
  pump: { frames: keyframes`0% { transform: scale(1.07); } 35% { transform: scale(0.99); } 100% { transform: scale(1); }`, rest: `${Math.max(50, settings.everyMs)}ms ease-out infinite` }
}), [JSON.stringify(settings)]);

// the row: a bar, the words with their effects, a bar
/*
  Neon (Jamie, 2026-11-19: to complement the logo): the words in the skyline's warm cream-yellow, outlined in the
  title's deep purple with a purple glow about them, breathing slowly brighter and dimmer, a neon tube's flicker now and
  then; a sheen runs across the letters, and as it does a spark runs out along each bar, the bars purple, fading away
  from the words.
*/
const NEON = { fill: "#f4c27a", hot: "#fff1d6", stroke: "#2e0a3e", glow: "176, 76, 255", warm: "244, 194, 122", bar: "176, 76, 255", breatheSeconds: 2.8, flickerSeconds: 7, sweepSeconds: 3.4, stepMs: 60 };
const neonBreathe = keyframes`
  0%, 100% { opacity: 0.72; text-shadow: 0 0 6px rgba(${NEON.glow}, 0.55), 0 0 14px rgba(${NEON.glow}, 0.25); }
  50% { opacity: 1; text-shadow: 0 0 8px rgba(${NEON.glow}, 0.9), 0 0 20px rgba(${NEON.glow}, 0.45), 0 0 3px rgba(${NEON.warm}, 0.6); }
`;
const NEON_SHADOW = "drop-shadow(0 0 2px rgba(0, 0, 0, 0.9))"; // (kept through the flicker: it's what sets the words off)
const neonFlicker = keyframes`
  0%, 70%, 74%, 78%, 100% { filter: ${NEON_SHADOW}; }
  71% { filter: brightness(0.35) ${NEON_SHADOW}; }
  73% { filter: brightness(1.15) ${NEON_SHADOW}; }
  76% { filter: brightness(0.55) ${NEON_SHADOW}; }
`;
const neonSheen = keyframes`
  0%, 14%, 100% { color: ${NEON.fill}; }
  6% { color: ${NEON.hot}; text-shadow: 0 0 10px rgba(${NEON.warm}, 0.9); }
`;
// (Jamie, 2026-11-19: it clashed with the pale highway under it: a soft dark plate behind the words, and a darker,
// thicker outline, so they stand out from every colour of the Peninsula)
const NeonPlate = styled.div`
  position: relative;
  &::before {
    content: "";
    position: absolute;
    inset: -14px -30px;
    border-radius: 999px;
    background: radial-gradient(ellipse at center, rgba(6, 4, 14, 0.72) 0%, rgba(6, 4, 14, 0.55) 45%, rgba(6, 4, 14, 0) 72%);
    filter: blur(3px);
    pointer-events: none;
  }
`;
const NeonText = styled.div`
  position: relative;
  font-family: gameboy;
  font-size: 22px;
  letter-spacing: 3px;
  white-space: nowrap;
  color: ${NEON.fill};
  -webkit-text-stroke: 3px ${NEON.stroke};
  paint-order: stroke fill;
  filter: ${NEON_SHADOW};
  animation: ${neonBreathe} ${NEON.breatheSeconds}s ease-in-out infinite, ${neonFlicker} ${NEON.flickerSeconds}s steps(1) infinite;
  ${props => props.$isStill && css`animation: none;`}
`;
const NeonLetter = styled.span`
  animation: ${neonSheen} ${NEON.sweepSeconds}s linear infinite;
  ${props => props.$isStill && css`animation: none;`}
`;
const sparkOut = keyframes`
  0% { left: var(--from); opacity: 0; }
  4% { opacity: 1; }
  40% { left: var(--to); opacity: 0; }
  100% { left: var(--to); opacity: 0; }
`;
const NeonBar = styled.div`
  position: relative;
  flex: 1;
  height: 2px;
  background: linear-gradient(to ${props => props.$side == "left" ? "left" : "right"}, rgba(${NEON.bar}, 0.95), rgba(${NEON.bar}, 0.35) 60%, rgba(${NEON.bar}, 0));
  box-shadow: 0 0 6px rgba(${NEON.bar}, 0.45);
  &::after {
    content: "";
    position: absolute;
    top: -2px;
    width: 18px;
    height: 6px;
    margin-left: -9px;
    border-radius: 3px;
    background: radial-gradient(ellipse, rgba(255, 241, 214, 0.95), rgba(${NEON.warm}, 0.5) 45%, rgba(${NEON.warm}, 0) 75%);
    animation: ${sparkOut} ${NEON.sweepSeconds}s ease-out var(--delay) infinite;
    ${props => props.$isStill && css`animation: none; opacity: 0;`}
  }
`;
export const NeonRow = ({ isLeaving }) => {
  const text = getPromptText();
  const lastMs = (text.length + 1) * NEON.stepMs;
  return (
    <>
      {/* (the left bar's spark leaves as the sheen starts, the right's as it ends: out from the words) */}
      <NeonBar $side="left" $isStill={isLeaving} style={{ "--from": "100%", "--to": "0%", "--delay": "0ms" }} />
      <NeonPlate>
      <NeonText $isStill={isLeaving}>
        <NeonLetter $isStill={isLeaving}><Bracket>[</Bracket></NeonLetter>
        {text.split("").map((letter, k) => (
          <NeonLetter key={k} $isStill={isLeaving} style={{ animationDelay: `${(k + 1) * NEON.stepMs}ms` }}>{letter}</NeonLetter>
        ))}
        <NeonLetter $isStill={isLeaving} style={{ animationDelay: `${lastMs}ms` }}><Bracket>]</Bracket></NeonLetter>
      </NeonText>
      </NeonPlate>
      <NeonBar $side="right" $isStill={isLeaving} style={{ "--from": "0%", "--to": "100%", "--delay": `${lastMs}ms` }} />
    </>
  );
};

export const PressKeyRow = ({ settings, isLeaving }) => {
  const { hud, blink, chase, zoom } = settings;
  const hudLook = useHud(hud);
  const blinkLook = useBlink(blink);
  const zoomLook = useZoom(zoom);
  const chaseAnim = (delayMs = 0) => ({ frames: chaseFrames, rest: `${chase.waveMs}ms steps(1) ${delayMs}ms infinite` });
  const barAnim = delayMs => ({ frames: barFrames, rest: `${chase.waveMs}ms steps(1) ${delayMs}ms infinite` });
  const lastDelayMs = -(CHASE_TEXT.length + 1) * chase.stepMs;
  const isBars = chase.on && chase.bars;

  // the words: chased letter by letter, or plain
  const letters = chase.on ? (
    <>
      <Animated $anim={chaseAnim(0)} $isStill={isLeaving}><Bracket>[</Bracket></Animated>
      {CHASE_TEXT.split("").map((letter, k) => (
        <Animated key={k} $anim={chaseAnim(-(k + 1) * chase.stepMs)} $isStill={isLeaving}>{letter == " " ? " " : letter}</Animated>
      ))}
      <Animated $anim={chaseAnim(lastDelayMs)} $isStill={isLeaving}><Bracket>]</Bracket></Animated>
    </>
  ) : <KeyWords />;

  // blinking (with its split copies and scan line), pumping, and moving round its square, each if on
  let words = <span style={{ position: "relative" }}>{letters}</span>;
  if (blink.on) {
    words = (
      <Holder $anim={blinkLook.beat} $isStill={isLeaving}>
        {!isLeaving && <SplitCopy $anim={blinkLook.split} style={{ "--tint": "#ff3df0", "--split": `-${blink.splitPx}px` }}><KeyWords /></SplitCopy>}
        {!isLeaving && <SplitCopy $anim={blinkLook.split} style={{ "--tint": "#3df6ff", "--split": `${blink.splitPx}px` }}><KeyWords /></SplitCopy>}
        {words}
        {!isLeaving && blink.scan && <ScanLine $anim={blinkLook.scan} />}
      </Holder>
    );
  }
  if (zoom.on && zoom.pump) words = <Holder $anim={zoomLook.pump} $isStill={isLeaving}>{words}</Holder>;
  if (hud.on) words = <Holder $anim={hudLook.sway}>{words}</Holder>;

  return (
    <>
      {isBars ? <ChaseBar $anim={barAnim(0)} $isStill={isLeaving} /> : <KeyLine />}
      <KeyText>
        <Trails $isLeaving={isLeaving}>
          {hud.on && hudLook.shots.map(({ time, x, y, from }, k) => (
            <Ghost key={`shot ${k}`} $anim={hudLook.trail} style={{ "--sx": `${from.x.toFixed(2)}px`, "--sy": `${from.y.toFixed(2)}px`, "--dx": `${x}px`, "--dy": `${y}px`, animationDelay: `${time - hudLook.lap}s` }}><KeyWords /></Ghost>
          ))}
          {zoom.on && [...Array(Math.max(0, Math.round(zoom.copies))).keys()].map(k => (
            <Ghost key={`zoom ${k}`} $anim={zoomLook.copy} style={{ transformOrigin: "50% 50%", animationDelay: `${-k * zoom.everyMs}ms` }}><KeyWords /></Ghost>
          ))}
        </Trails>
        {words}
      </KeyText>
      {isBars ? <ChaseBar $anim={barAnim(lastDelayMs)} $isStill={isLeaving} /> : <KeyLine />}
    </>
  );
};

/*
  The mix's panel (dev, on the landing): each effect switched on or off, and its numbers. A click or a key here does
  not start the game. "Copy" puts the settings on the clipboard, to paste back to Claude.
*/
const Panel = styled.div`
  position: fixed;
  left: 10px;
  bottom: 10px;
  z-index: 50;
  max-height: calc(100dvh - 20px);
  overflow-y: auto;
  padding: 8px 10px;
  font: 11px monospace;
  color: #bfe9c8;
  background: rgba(8, 12, 10, 0.9);
  border: 1px solid #2d5a3c;
  cursor: default;
  fieldset { margin: 4px 0; padding: 4px 6px; border: 1px solid #2d5a3c; }
  legend { color: white; }
  label { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  input[type="number"] { width: 64px; font: 11px monospace; }
  button { margin-top: 4px; font: 11px monospace; cursor: pointer; }
`;

const stop = event => event.stopPropagation();

export const PressKeyPanel = ({ settings, setSettings }) => {
  const set = (id, key, value) => setSettings(all => ({ ...all, [id]: { ...all[id], [key]: value } }));
  return (
    <Panel onClick={stop} onPointerDown={stop} onKeyDown={stop} onKeyUp={stop}>
      {Object.entries(settings).map(([id, values]) => (
        <fieldset key={id}>
          <legend>
            <label><input type="checkbox" checked={values.on} onChange={event => set(id, "on", event.target.checked)} /> {id}</label>
          </legend>
          {values.on && Object.entries(values).filter(([key]) => key != "on").map(([key, value]) => (
            <label key={key}>
              {key}
              {typeof value == "boolean"
                ? <input type="checkbox" checked={value} onChange={event => set(id, key, event.target.checked)} />
                : <input type="number" step="any" value={value} onChange={event => set(id, key, Number(event.target.value))} />}
            </label>
          ))}
        </fieldset>
      ))}
      <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(settings, null, 1))}>Copy settings</button>
      <button onClick={() => setSettings(Object.fromEntries(Object.entries(PRESS_DEFAULTS).map(([id, values]) => [id, { ...values }])))}>Reset</button>
    </Panel>
  );
};
