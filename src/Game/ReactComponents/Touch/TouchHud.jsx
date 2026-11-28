import React, { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { ICON_LOOKUP as PASSIVE_ICONS } from "Utils/gameState";
import { ACTIVE_ICONS, LOADER_ICON, getSmokeBox } from "Game/ReactComponents/UI/Hud/Hud";
import { HUD_LOOK } from "Game/ReactComponents/UI/Hud/hudSpec";
import { VOLUME_LEVEL, stepVolume } from "Game/ReactComponents/GameBoard/PlayWindow";
import { DEVICE_KINDS, getDeviceKind, getIsDeviceForced, setDeviceOverride, getIsTuning } from "Utils/device";
import { TICKER, TOUCH_LAYOUTS, TOUCH_LAYOUT_IDS } from "./touchLayouts";

/*
  The touch HUD (Jamie, 2026-11-28; mobile): the game fills the screen, and over it a virtual stick on the left, the
  powers on the right, the health and the passives, the objective running across the top, and one menu button. All
  clear "Liquid Glass". Placed from touchLayouts.js.
*/

// ---- the look: Liquid Glass, clear, the scene showing through it bent and brightened ----
export const LIQUID_GLASS = css`
  background:
    radial-gradient(120% 90% at 30% 12%, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.07) 42%, rgba(255, 255, 255, 0.02) 70%, rgba(255, 255, 255, 0.12));
  -webkit-backdrop-filter: blur(9px) saturate(1.7) brightness(1.1);
  backdrop-filter: blur(9px) saturate(1.7) brightness(1.1);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    inset 0 1.5px 1px rgba(255, 255, 255, 0.6),
    inset 0 -3px 8px rgba(0, 0, 0, 0.22),
    inset 0 0 14px rgba(255, 255, 255, 0.08),
    0 6px 18px rgba(0, 0, 0, 0.35);
`;

// the same glass without the live blur of what's behind it (Jamie, mobile playtest 1: the game slowed on an iPhone; each
// blur is redone every frame as the game moves under it). For the small pieces: the knob, the capsules, the passives
export const LIQUID_GLASS_LITE = css`
  background:
    radial-gradient(120% 90% at 30% 12%, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.1) 42%, rgba(200, 220, 255, 0.06) 70%, rgba(255, 255, 255, 0.16)),
    rgba(20, 26, 38, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    inset 0 1.5px 1px rgba(255, 255, 255, 0.6),
    inset 0 -3px 8px rgba(0, 0, 0, 0.22),
    0 4px 12px rgba(0, 0, 0, 0.35);
`;

// a thing's place: its middle at (x, y) of the safe area, 'size' of its height across (round things)
const placeRound = ({ x, y, size }) => ({
  left: `${x * 100}cqw`,
  top: `${y * 100}cqh`,
  width: `${size * 100}cqh`,
  height: `${size * 100}cqh`
});

// the whole screen, inside the notch and the rounded corners; its own size for what's placed in it
const Layer = styled.div`
  position: fixed;
  inset: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  z-index: 2147483600;
  pointer-events: none;
  container-type: size;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
`;

const Round = styled.div`
  position: absolute;
  translate: -50% -50%;
  border-radius: 50%;
  box-sizing: border-box;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
const Group = styled.div`
  display: contents;
  & > * { animation: ${fadeIn} 300ms ease-out both; }
`;

// ---- the stick ----
const STICK = { deadZone: 0.22, hitScale: 1.35 };
const SECTOR_DIRS = ["right", "up right", "up", "up left", "left", "down left", "down", "down right"];
// the knob's push (x right, y down, each -1 to 1) as one of the eight directions the keys give
export const getStickDir = (x, y) => {
  if (Math.hypot(x, y) < STICK.deadZone) return "idle";
  const angle = (Math.atan2(-y, x) * 180) / Math.PI;
  return SECTOR_DIRS[((Math.round(angle / 45) % 8) + 8) % 8];
};

const StickBase = styled(Round)`
  pointer-events: auto;
  touch-action: none;
  ${LIQUID_GLASS}
  background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 55%, rgba(255, 255, 255, 0.12));
  border: 2px solid rgba(255, 255, 255, 0.55);
  /* (the hit area round it: a thumb that lands just outside the ring still takes the stick) */
  &::before {
    content: "";
    position: absolute;
    inset: ${-((STICK.hitScale - 1) / 2) * 100}%;
    border-radius: 50%;
  }
`;
const StickKnob = styled(Round)`
  ${LIQUID_GLASS_LITE}
  background: radial-gradient(110% 90% at 35% 25%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.4) 55%, rgba(255, 255, 255, 0.28));
  transition: ${props => props.$isHeld ? "none" : "transform 160ms ease-out"};
  pointer-events: none;
`;

const Joystick = ({ spot, onDir }) => {
  const baseRef = useRef(null);
  const pointer = useRef(undefined);
  const lastDir = useRef("idle");
  const [push, setPush] = useState({ x: 0, y: 0 });
  const send = dir => {
    if (dir == lastDir.current) return;
    lastDir.current = dir;
    onDir(dir);
  };
  // (let go when it goes: no direction left held)
  useEffect(() => () => { if (lastDir.current != "idle") onDir("idle"); }, []);
  const follow = ({ clientX, clientY }) => {
    const box = baseRef.current.getBoundingClientRect();
    const radius = box.width / 2;
    let x = (clientX - (box.left + radius)) / radius;
    let y = (clientY - (box.top + radius)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setPush({ x, y });
    send(getStickDir(x, y));
  };
  const release = event => {
    if (event.pointerId != pointer.current) return;
    pointer.current = undefined;
    setPush({ x: 0, y: 0 });
    send("idle");
  };
  const travel = ((spot.size - spot.knob) / 2) * 100; // cqh the knob's middle may move
  return (
    <>
      <StickBase
        ref={baseRef}
        aria-label="Move"
        style={placeRound(spot)}
        onPointerDown={event => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer.current = event.pointerId;
          follow(event);
        }}
        onPointerMove={event => event.pointerId == pointer.current && follow(event)}
        onPointerUp={release}
        onPointerCancel={release}
      />
      <StickKnob $isHeld={pointer.current !== undefined} style={{ ...placeRound({ x: spot.x, y: spot.y, size: spot.knob }), transform: `translate(${push.x * travel}cqh, ${push.y * travel}cqh)` }} />
    </>
  );
};

// ---- a power ----
const PowerGlass = styled(Round)`
  pointer-events: auto;
  touch-action: none;
  ${LIQUID_GLASS}
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  transition: transform 90ms ease-out, filter 150ms;
  ${props => props.$isPressed && css`transform: scale(0.9);`}
  ${props => props.$isWaiting && css`filter: saturate(0.5) brightness(0.8);`}
`;
// the power's color, a ring inside the glass (the mock-ups)
const PowerRing = styled.div`
  position: absolute;
  inset: 9%;
  border-radius: 50%;
  border: solid var(--color);
  border-width: var(--ring);
  background: radial-gradient(circle, rgba(6, 10, 18, 0.55), rgba(6, 10, 18, 0.3));
  box-shadow: 0 0 calc(var(--ring) * 1.4) var(--color), inset 0 0 calc(var(--ring) * 1.2) var(--color);
`;
const PowerIcon = styled.i`
  position: relative;
  color: var(--color);
  filter: drop-shadow(0 0 0.6cqh var(--color));
`;
const sweep = keyframes`
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -100; }
`;
// the cooldown: a dark wedge over it that sweeps away
const CooldownSweep = styled.svg`
  position: absolute;
  inset: 9%;
  width: 82%;
  height: 82%;
  transform: rotate(-90deg) scaleY(-1);
  pointer-events: none;
  circle {
    animation: ${sweep} linear forwards;
  }
`;
const PowerButton = ({ spot, ability, isPaused, onPress }) => {
  const { element, color, cooldownTime, accTime, isOnCooldown, activeName } = ability;
  const [isPressed, setIsPressed] = useState(false);
  const sizeCqh = spot.size * 100;
  return (
    <PowerGlass
      aria-label={activeName || element}
      $isPressed={isPressed}
      $isWaiting={isOnCooldown}
      style={{ ...placeRound(spot), "--color": color, "--ring": `${sizeCqh * 0.07}cqh` }}
      onPointerDown={event => {
        event.preventDefault();
        setIsPressed(true);
        if (navigator.vibrate) navigator.vibrate(8);
        onPress();
      }}
      onPointerUp={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
    >
      <PowerRing />
      <PowerIcon className={`fa ${isOnCooldown ? LOADER_ICON : ACTIVE_ICONS[element] || "fa-circle"}`} style={{ fontSize: `${sizeCqh * 0.34}cqh` }} />
      {isOnCooldown && (
        <CooldownSweep key={accTime || 0} viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(0, 0, 0, 0.55)" strokeWidth="50" pathLength="100" strokeDasharray="100" style={{ animationDuration: `${cooldownTime}ms`, animationPlayState: isPaused ? "paused" : "running" }} />
        </CooldownSweep>
      )}
    </PowerGlass>
  );
};

// ---- the health: glass capsules, filled red ----
const HealthRow = styled.div`
  position: absolute;
  translate: 0 -50%;
  display: flex;
  align-items: center;
  gap: 2.5%;
`;
const Capsule = styled.div`
  flex: 1 1 0;
  height: 100%;
  border-radius: 999px;
  ${LIQUID_GLASS_LITE}
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    inset: 14% 4%;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--from), var(--to));
    box-shadow: 0 0 1cqh var(--from);
  }
`;
const HealthCount = styled.span`
  font-family: gameboy;
  color: #ffe0e0;
  text-shadow: 1px 1px 0 black, 0 0 4px #ff2a3c;
  white-space: nowrap;
`;
const HEALTH_SHOWN = 6; // more than this: one capsule and its count
const Health = ({ spot, lives = 0, modifier = 0 }) => {
  const { from, to, bonus, lost } = HUD_LOOK.health;
  const shown = Math.max(0, modifier > 0 ? lives + modifier : lives);
  const colorsOf = index => modifier > 0 && index + 1 > lives ? bonus
    : modifier < 0 && index + 1 > lives + modifier ? lost
    : [from, to];
  const style = { left: `${spot.left * 100}cqw`, width: `${(spot.right - spot.left) * 100}cqw`, top: `${spot.y * 100}cqh`, height: `${spot.size * 100}cqh` };
  if (shown > HEALTH_SHOWN) {
    return (
      <HealthRow style={{ ...style, justifyContent: "flex-end" }}>
        <Capsule style={{ flex: "0 0 22%", "--from": from, "--to": to }} />
        <HealthCount style={{ fontSize: `${spot.size * 70}cqh` }}>x{lives + modifier}</HealthCount>
      </HealthRow>
    );
  }
  // (four or fewer keep their mock-up width, the lost ones gone from the left, so the row stays against the right edge)
  return (
    <HealthRow style={{ ...style, justifyContent: "flex-end" }}>
      {Array.from({ length: Math.max(shown, 0) }, (_, index) => {
        const [a, b] = colorsOf(index);
        return <Capsule key={index} style={{ flex: shown <= 4 ? "0 0 23%" : "1 1 0", "--from": a, "--to": b }} />;
      })}
    </HealthRow>
  );
};

// ---- a passive: a glass dot, dim until it has worked; its smoke rising each time it works ----
const PassiveDot = styled(Round)`
  ${LIQUID_GLASS_LITE}
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  color: var(--color);
  filter: brightness(${props => props.$isLit ? 1 : HUD_LOOK.passiveDim});
  transition: filter 0.2s;
  &::before {
    content: "";
    position: absolute;
    inset: 12%;
    border-radius: 50%;
    background: var(--color);
    opacity: ${props => props.$isLit ? 0.85 : 0.45};
  }
  i { position: relative; color: #152642; }
`;
const smokePlay = keyframes`
  0% { opacity: 1; -webkit-mask-position: 0 0; mask-position: 0 0; }
  90% { opacity: 1; }
  100% { opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }
`;
const Smoke = styled.div`
  position: absolute;
  background: var(--color);
  -webkit-mask: url(${HUD_LOOK.smoke.src}) 0 0 / ${HUD_LOOK.smoke.frames * 100}% 100% no-repeat;
  mask: url(${HUD_LOOK.smoke.src}) 0 0 / ${HUD_LOOK.smoke.frames * 100}% 100% no-repeat;
  pointer-events: none;
  animation: ${smokePlay} ${HUD_LOOK.smoke.ms}ms steps(${HUD_LOOK.smoke.frames - 1}) forwards;
`;
// (the smoke's box, as shares of the dot)
const SMOKE_BOX = getSmokeBox({ x: 0, y: 0, width: 100, height: 100 });
const Passive = ({ spot, ability }) => {
  const { element, color, isPassiveApplied, accTime, passiveName } = ability;
  const [smokeKey, setSmokeKey] = useState(0);
  useEffect(() => {
    if (!isPassiveApplied) return;
    setSmokeKey(key => Math.abs(key) + 1);
    const done = setTimeout(() => setSmokeKey(key => -Math.abs(key)), HUD_LOOK.smoke.ms + 50);
    return () => clearTimeout(done);
  }, [isPassiveApplied, accTime]);
  return (
    <PassiveDot $isLit={!!isPassiveApplied} aria-label={passiveName || element} style={{ ...placeRound(spot), "--color": color, fontSize: `${spot.size * 50}cqh` }}>
      <i className={`fa ${PASSIVE_ICONS[element] || "fa-circle"}`} />
      {smokeKey > 0 && <Smoke key={smokeKey} style={{ left: `${SMOKE_BOX.x}%`, top: `${SMOKE_BOX.y}%`, width: `${SMOKE_BOX.width}%`, height: `${SMOKE_BOX.height}%`, "--color": color }} />}
    </PassiveDot>
  );
};

// ---- the objective: smoke that condenses into the words, holds, and drifts apart, now and then ----
const SmokeLine = styled.div`
  position: absolute;
  translate: 0 -50%;
  display: flex;
  justify-content: center;
  align-items: center;
  white-space: pre;
  pointer-events: none;
`;
const SmokeLetter = styled.span`
  display: inline-block;
  font-family: gameboy;
  letter-spacing: 0.2em;
  color: #71ff71;
  text-shadow: 0 0 0.6cqh #2dff6a, 0 0 1.4cqh rgba(45, 255, 106, 0.6), 1px 1px 0 black;
`;
const condense = keyframes`
  from { opacity: 0; filter: blur(var(--blur)); transform: translate(var(--from-x), var(--from-y)) scale(1.7); }
  to { opacity: 1; filter: blur(0); transform: none; }
`;
const dissipate = keyframes`
  from { opacity: 1; filter: blur(0); transform: none; }
  to { opacity: 0; filter: blur(var(--blur)); transform: translate(var(--to-x), var(--to-y)) scale(1.8); }
`;
const Puff = styled(SmokeLetter)`
  animation:
    ${condense} var(--condense-ms) cubic-bezier(0.2, 0.7, 0.3, 1) var(--delay) both,
    ${dissipate} var(--fade-ms) ease-in var(--fade-delay) forwards;
`;
// a steady random number for each letter of each showing
const getJitter = (seed, k, salt) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
};
const Ticker = ({ spot, text, isPaused }) => {
  const [run, setRun] = useState(0);
  const holdMs = TICKER.holdMs + (text || "").length * TICKER.msPerChar;
  const showMs = TICKER.condenseMs + holdMs + TICKER.fadeMs;
  // at once for new words, then again each gap after the last has gone
  useEffect(() => {
    if (!text) return;
    setRun(count => count + 1);
    const interval = setInterval(() => setRun(count => count + 1), showMs + TICKER.gapMs);
    return () => clearInterval(interval);
  }, [text, showMs]);
  if (!text || !run) return null;
  const sizeCqh = spot.size * 100;
  const letters = [...text];
  return (
    <SmokeLine key={run} style={{ left: `${spot.left * 100}cqw`, width: `${(spot.right - spot.left) * 100}cqw`, top: `${spot.y * 100}cqh`, height: `${sizeCqh * 1.4}cqh` }}>
      {letters.map((letter, k) => {
        const spread = TICKER.scatter * sizeCqh;
        const jitter = salt => getJitter(run, k, salt) * 2 - 1;
        // (the middle first, out to the ends, a little at random)
        const fromMiddle = Math.abs(k - (letters.length - 1) / 2) / Math.max(1, letters.length / 2);
        const delay = (fromMiddle * 0.35 + getJitter(run, k, 5) * 0.25) * TICKER.condenseMs * 0.6;
        const fadeDelay = TICKER.condenseMs + holdMs + getJitter(run, k, 6) * TICKER.fadeMs * 0.3;
        return (
          <Puff key={k} style={{
            fontSize: `${sizeCqh}cqh`,
            lineHeight: `${sizeCqh * 1.4}cqh`,
            "--blur": `${sizeCqh * 0.35}cqh`,
            "--from-x": `${jitter(1) * spread}cqh`,
            "--from-y": `${jitter(2) * spread * 0.6}cqh`,
            "--to-x": `${jitter(3) * spread * 1.3}cqh`,
            "--to-y": `${-(0.4 + getJitter(run, k, 4)) * spread}cqh`,
            "--condense-ms": `${TICKER.condenseMs * 0.7}ms`,
            "--fade-ms": `${TICKER.fadeMs * 0.7}ms`,
            "--delay": `${delay}ms`,
            "--fade-delay": `${fadeDelay}ms`,
            animationPlayState: isPaused ? "paused" : "running"
          }}>{letter == " " ? " " : letter}</Puff>
        );
      })}
    </SmokeLine>
  );
};

// ---- the menu: one button, a glass sheet with Resume, Controls, the volume and Quit ----
const MenuButton = styled(Round)`
  pointer-events: auto;
  ${LIQUID_GLASS}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14%;
  span {
    width: 46%;
    height: 7%;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
  }
`;
const Shade = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2147483610;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 200ms ease-out both;
`;
const Sheet = styled.div`
  ${LIQUID_GLASS}
  border-radius: 6cqh;
  padding: 4cqh 5cqh;
  display: flex;
  flex-direction: column;
  gap: 2.6cqh;
  min-width: 46cqh;
  max-height: 86cqh;
  overflow-y: auto;
  font-family: gameboy;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
`;
export const GlassButton = styled.button`
  ${LIQUID_GLASS}
  border-radius: 999px;
  padding: 2.4cqh 4cqh;
  font-family: gameboy;
  font-size: 4.2cqh;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  touch-action: manipulation;
  &:active { transform: scale(0.96); }
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3cqh;
  font-size: 3.6cqh;
  select { font-size: 3.2cqh; max-width: 60cqh; }
`;
const VolumeMeter = styled.div`
  flex: 1;
  height: 2.2cqh;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
  div { height: 100%; background: linear-gradient(to right, #2dff6a, #c8ff6a); }
`;

const Menu = ({ onClose, onControls, onQuit, canPause, layoutId, onLayout }) => {
  const [volume, setVolume] = useState(VOLUME_LEVEL.value);
  const step = by => {
    stepVolume(by);
    setVolume(VOLUME_LEVEL.value);
  };
  return (
    <Shade onPointerDown={event => event.target == event.currentTarget && onClose()}>
      <Sheet>
        <GlassButton onClick={onClose}>{canPause ? "Resume" : "Back"}</GlassButton>
        {/* (no Controls on touch: Jamie, 2026-11-28) */}
        <Row>
          <GlassButton aria-label="Volume down" style={{ padding: "1.6cqh 3.4cqh" }} onClick={() => step(-1)}>-</GlassButton>
          <VolumeMeter><div style={{ width: `${(volume / VOLUME_LEVEL.steps) * 100}%` }} /></VolumeMeter>
          <GlassButton aria-label="Volume up" style={{ padding: "1.6cqh 3.4cqh" }} onClick={() => step(1)}>+</GlassButton>
        </Row>
        <GlassButton onClick={() => { onClose(); onQuit(); }}>Quit</GlassButton>
        {getIsTuning() && (
          <>
            <Row>
              HUD
              <select value={layoutId} onChange={event => onLayout(event.target.value)}>
                {TOUCH_LAYOUT_IDS.map(id => <option key={id} value={id}>{TOUCH_LAYOUTS[id].name}</option>)}
              </select>
            </Row>
            <DeviceSelect />
          </>
        )}
      </Sheet>
    </Shade>
  );
};

// dev: lay the game out as a phone, a tablet or a desktop ("auto": as detected)
export const DeviceSelect = () => (
  <Row>
    Device
    <select value={getIsDeviceForced() ? getDeviceKind() : "auto"} onChange={event => setDeviceOverride(event.target.value)}>
      <option value="auto">Auto</option>
      {DEVICE_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
    </select>
  </Row>
);

/*
  'pd': the one played as (GameBoardPieceBase.getUiState), or none; 'isHudShowing': its health, powers and passives;
  'isStickShowing': the stick (it walks in a walking level too); 'isPowersShowing': the powers (none in a walking level);
  'objective': the words to run across the top; 'onDir' the stick's direction ('idle', 'up', 'up left'...); 'onPower'
  a power's index pressed; 'menu' { isOpen, onOpen, onClose, onControls, onQuit, canPause }.
*/
export const TouchHud = ({ layoutId, onLayout, pd, isPaused, isHudShowing, isStickShowing, isPowersShowing, objective, onDir, onPower, menu }) => {
  const layout = TOUCH_LAYOUTS[layoutId] || TOUCH_LAYOUTS[TOUCH_LAYOUT_IDS[0]];
  const abilities = (pd && pd.abilities) || [];
  const extras = abilities.slice(3);
  const isAlive = pd && !pd.isDead;
  return (
    <Layer data-touch-hud>
      {!menu.isOpen && <MenuButton aria-label="Menu" style={{ ...placeRound(layout.menu), pointerEvents: "auto" }} onClick={menu.onOpen}><span /><span /><span /></MenuButton>}
      <Ticker spot={layout.ticker} text={objective} isPaused={isPaused} />
      {isStickShowing && <Group><Joystick spot={layout.joystick} onDir={onDir} /></Group>}
      {isHudShowing && isAlive && (
        <Group>
          <Health spot={layout.health} lives={pd.lives} modifier={pd.livesModifier} />
          {abilities.slice(0, layout.passives.length).map((ability, k) => <Passive key={k} spot={layout.passives[k]} ability={ability} />)}
          {isPowersShowing && abilities.slice(0, layout.powers.length).map((ability, k) => (
            <PowerButton key={k} spot={layout.powers[k]} ability={ability} isPaused={isPaused} onPress={() => onPower(k)} />
          ))}
          {/* a Kaiju's powers past the three (the final fight): a row of smaller ones across the top right */}
          {isPowersShowing && extras.map((ability, k) => {
            const { x, right, y, size } = layout.extras;
            const step = extras.length > 1 ? (right - x) / (extras.length - 1) : 0;
            return <PowerButton key={`extra ${k}`} spot={{ x: x + step * k, y, size }} ability={ability} isPaused={isPaused} onPress={() => onPower(k + 3)} />;
          })}
        </Group>
      )}
      {menu.isOpen && <Menu {...menu} layoutId={layoutId} onLayout={onLayout} />}
    </Layer>
  );
};

// ---- a phone held upright: turn it sideways (Jamie: landscape only on phones) ----
const turn = keyframes`
  0%, 30% { transform: rotate(0deg); }
  60%, 100% { transform: rotate(-90deg); }
`;
const RotateCover = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: #000;
  color: #71ff71;
  font-family: gameboy;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6vw;
  text-align: center;
  font-size: 4.6vw;
  padding: 10vw;
  text-shadow: 0 0 6px #2dff6a;
`;
const PhoneShape = styled.div`
  width: 18vw;
  height: 32vw;
  border: 1.2vw solid #71ff71;
  border-radius: 3vw;
  box-shadow: 0 0 12px #2dff6a;
  animation: ${turn} 2.2s ease-in-out infinite alternate;
`;
export const RotatePrompt = () => (
  <RotateCover>
    <PhoneShape />
    Turn your phone sideways to play
  </RotateCover>
);
