import React, { useState, useContext, useEffect, useMemo, useRef } from "react";
import styled, { css, keyframes } from "styled-components";
import { GlobalSettingsContext } from 'Home';
import { getSciFiClass } from "../DataClasses/sciFiClasses";
import { getIsSkillOpen, OUT_OF_PLAY_POWERS } from "../DataClasses/Avatars";
import { PIECES_INFO } from "Utils/gameState";

/*
  The ability picker (Jamie, UI epic, 2026-11-14). On black: the player's avatar on the left, and around it, like a
  halo, a pendant for every power that is open (locked ones are not shown). The pendants run from -65 degrees (low on
  the avatar's right) over the head to 245 (low on its left), 1.5 avatar-heights from the upper torso. From each, a
  circuit trace runs in and down to behind the avatar, in the style of the old circuit disc: out from the middle,
  one bend, a ring pad at the end.
  A pendant and its trace have three looks: neither picked nor hovered (dim), hovered (lit, white rim), picked (its
  color, glowing, with beads of light running down the trace to the avatar like fiber optics).
  On the right: the hovered power's active (left-aligned, on top) and passive (right-aligned, below), each with its
  icon by its title; with three picked and nothing hovered, the class, its three icons by its name; otherwise,
  "Choose 3 powers".
  Keys: the arrows move round the halo, Space or Enter picks or drops.
  Laid out on a 1600 x 900 stage, scaled to the screen.
*/
const PICK_COUNT = 3;

const STAGE = { width: 1600, height: 900 };
const LOOK = {
  figureHeight: 250, // the avatar, head to feet
  torso: { x: 470, y: 470 }, // the upper torso: the halo's middle
  headDrop: 0.28, // the upper torso, down from the top of the head (of the figure's height)
  haloStartDegrees: -65, // low on the avatar's right (0 is right, counter-clockwise)
  haloEndDegrees: 245, // low on its left
  pendantSize: 78,
  bendAt: 0.55, // where a trace bends, of the halo's radius from the middle
  endSpread: 0.13, // the traces' ends behind the avatar, spread across (of the figure's height)
  endDrop: 0.06, // and how far below the upper torso
  beadMs: 1700, // a bead's run from the pendant to the avatar
  colors: { trace: "#1f3a29", traceHover: "#7fae8c", stub: "#15281c", pad: "#2d5a3c" }
};
const HALO_RADIUS = 1.5 * LOOK.figureHeight;

// where each avatar's figure stands in its sprite sheet frame (152 x 230, measured): its middle and its head
const FRAME = { width: 152, height: 230, rows: 6, standingRow: 2 };
const FIGURES = {
  guy: { sheet: "spritesheet/player.png", middle: 81, head: 47, feet: 186 },
  girl: { sheet: "spritesheet/teammate.png", middle: 72.5, head: 49, feet: 182 }
};

// stage units to css
const pctX = x => `${(x / STAGE.width) * 100}%`;
const pctY = y => `${(y / STAGE.height) * 100}%`;
const unit = n => `${(n / STAGE.height) * 100}cqh`;

const polar = (degrees, radius) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: LOOK.torso.x + radius * Math.cos(radians), y: LOOK.torso.y - radius * Math.sin(radians) };
};

/*
  A trace from a pendant, jagged like a circuit board's (Jamie): radially in, with a sideways jog on the way, to the
  bend; then down to its end behind the avatar in a staircase of straight and 45 degree runs.
*/
const JAG = { jogPx: 16, jogAt: 0.35, steps: 3 };

const getTrace = (degrees, index, count) => {
  const start = polar(degrees, HALO_RADIUS - LOOK.pendantSize / 2 - 10);
  const bend = polar(degrees, HALO_RADIUS * LOOK.bendAt);
  const across = count > 1 ? 1 - (2 * index) / (count - 1) : 0; // the right end of the halo ends on the right
  const end = { x: LOOK.torso.x + across * LOOK.endSpread * LOOK.figureHeight, y: LOOK.torso.y + LOOK.endDrop * LOOK.figureHeight };
  // the jog: off to one side at 45 degrees, then on in, parallel
  const inward = { x: (bend.x - start.x), y: (bend.y - start.y) };
  const length = Math.hypot(inward.x, inward.y);
  const along = { x: inward.x / length, y: inward.y / length };
  const side = (index % 2 ? 1 : -1) * JAG.jogPx;
  const across90 = { x: -along.y * side, y: along.x * side };
  const jogFrom = { x: start.x + inward.x * JAG.jogAt, y: start.y + inward.y * JAG.jogAt };
  const jogTo = { x: jogFrom.x + along.x * Math.abs(side) + across90.x, y: jogFrom.y + along.y * Math.abs(side) + across90.y };
  const bent = { x: bend.x + across90.x, y: bend.y + across90.y };
  const points = [start, jogFrom, jogTo, bent];
  // the staircase down: each step a straight run on the longer axis, then a 45 degree run
  const dx = end.x - bent.x;
  const dy = end.y - bent.y;
  const minor = Math.min(Math.abs(dx), Math.abs(dy));
  const major = Math.max(Math.abs(dx), Math.abs(dy)) - minor;
  const isVertical = Math.abs(dy) >= Math.abs(dx);
  let at = { ...bent };
  for (let step = 0; step < JAG.steps; step++) {
    const straight = major / JAG.steps;
    at = isVertical ? { x: at.x, y: at.y + Math.sign(dy) * straight } : { x: at.x + Math.sign(dx) * straight, y: at.y };
    points.push(at);
    const slant = minor / JAG.steps;
    at = { x: at.x + Math.sign(dx) * slant, y: at.y + Math.sign(dy) * slant };
    points.push(at);
  }
  return { start, end, d: `M ${points.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}` };
};

// the board around the halo, between the pendants: short dim traces with ring pads, as on the old disc (no meaning)
const getStubs = angles => {
  const stubs = [];
  const gaps = angles.slice(1).map((angle, k) => [angles[k], angle]);
  gaps.push([LOOK.haloEndDegrees, LOOK.haloStartDegrees + 360]); // the gap under the avatar
  gaps.forEach(([from, to], k) => [1 / 3, 2 / 3].forEach((share, j) => {
    const degrees = from + (to - from) * share;
    const inner = HALO_RADIUS * (0.62 + 0.06 * ((k + j) % 3));
    const outer = HALO_RADIUS * (0.8 + 0.05 * ((k * 2 + j) % 3));
    const a = polar(degrees, inner);
    const b = polar(degrees, outer);
    const turn = ((k + j) % 2 ? 1 : -1) * 14; // a short kink at the outer end
    const c = polar(degrees + turn * (360 / (2 * Math.PI * outer)) * 1.4, outer + 14);
    stubs.push({ key: `${k}-${j}`, d: `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y}`, pad: c });
  }));
  return stubs;
};

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  color: #d9dade;
`;

const Stage = styled.div`
  position: relative;
  width: min(100vw, calc(100vh * ${STAGE.width / STAGE.height}));
  aspect-ratio: ${STAGE.width} / ${STAGE.height};
  container-type: size;
`;

const Board = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
`;

const beadRun = keyframes`
  from { stroke-dashoffset: 2; }
  to { stroke-dashoffset: -100; }
`;

// a bead of light running from the pendant down to the avatar
const Bead = styled.path`
  fill: none;
  stroke: white;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 2 300;
  animation: ${beadRun} ${LOOK.beadMs}ms linear infinite;
`;

const Avatar = styled.div`
  position: absolute;
  background-repeat: no-repeat;
  background-size: auto ${FRAME.rows * 100}%;
  background-position: 0 ${(FRAME.standingRow / (FRAME.rows - 1)) * 100}%;
  image-rendering: pixelated;
  pointer-events: none;
`;

const PENDANT_LOOKS = {
  idle: css`
    border-color: #2c3a31;
    background: radial-gradient(circle at 40% 35%, #161c18, #050706 70%);
    i { opacity: 0.35; filter: saturate(0.4); }
  `,
  hovered: css`
    border-color: #e9f3ec;
    background: radial-gradient(circle at 40% 35%, #222a25, #070908 70%);
    box-shadow: 0 0 ${unit(10)} rgba(255, 255, 255, 0.35);
    transform: translate(-50%, -50%) scale(1.08);
    i { opacity: 1; }
  `
};

// a pendant: a round bezel with its power's icon, hung on its trace
const Pendant = styled.button`
  position: absolute;
  width: ${unit(LOOK.pendantSize)};
  height: ${unit(LOOK.pendantSize)};
  padding: 0;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${unit(34)};
  border: ${unit(4)} solid;
  border-radius: 50%;
  outline: none;
  cursor: pointer;
  transition: transform 120ms, box-shadow 160ms, border-color 160ms;
  i { transition: opacity 160ms; }
  ${props => props.$isHovered ? PENDANT_LOOKS.hovered : PENDANT_LOOKS.idle}
  ${props => props.$isPicked && css`
    border-color: ${props.$color};
    background: radial-gradient(circle at 40% 35%, color-mix(in srgb, ${props.$color} 35%, black), #050706 72%);
    box-shadow: 0 0 ${unit(16)} ${props.$color}, inset 0 0 ${unit(10)} color-mix(in srgb, ${props.$color} 60%, transparent);
    i { opacity: 1; filter: brightness(1.25) drop-shadow(0 0 ${unit(4)} ${props.$color}); }
    ${props.$isHovered && css`border-color: white; box-shadow: 0 0 ${unit(22)} ${props.$color}, 0 0 ${unit(6)} white;`}
  `}
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

// picked: a light that circles the pendant's outside, round and round
const Orbit = styled.span`
  position: absolute;
  inset: -22%;
  border-radius: 50%;
  pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0deg 220deg, ${props => props.$color} 310deg, white 345deg, transparent 360deg);
  -webkit-mask: radial-gradient(closest-side, transparent 74%, black 80%, black 88%, transparent 100%);
  mask: radial-gradient(closest-side, transparent 74%, black 80%, black 88%, transparent 100%);
  animation: ${spin} 1.8s linear infinite;
  filter: blur(${unit(1)});
`;

const sheenSweep = keyframes`
  0% { transform: rotate(-90deg); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: rotate(270deg); opacity: 0; }
`;

const lockFlash = keyframes`
  0% { opacity: 0.95; transform: scale(0.85); }
  100% { opacity: 0; transform: scale(1.35); }
`;

// the moment it's picked, "locked in" (Jamie): a white flash, and a sheen that slides round the pendant's rim
const LockIn = styled.span`
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  pointer-events: none;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg 300deg, rgba(255, 255, 255, 0.9) 345deg, white 352deg, transparent 360deg);
    -webkit-mask: radial-gradient(closest-side, transparent 80%, black 86%, black 96%, transparent 100%);
    mask: radial-gradient(closest-side, transparent 80%, black 86%, black 96%, transparent 100%);
    animation: ${sheenSweep} 520ms cubic-bezier(0.3, 0.6, 0.4, 1) forwards;
  }
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, white, ${props => props.$color} 45%, transparent 70%);
    animation: ${lockFlash} 380ms ease-out forwards;
  }
`;

// dev only: which powers hang in the halo, to see how it looks with more or fewer (Jamie)
const DevPanel = styled.div`
  position: absolute;
  left: ${pctX(16)};
  top: ${pctY(16)};
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  font: 11px monospace;
  color: #9fbfa8;
  background: rgba(10, 16, 12, 0.85);
  border: 1px solid #2d5a3c;
  label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
`;

const Info = styled.div`
  position: absolute;
  left: ${pctX(930)};
  top: ${pctY(150)};
  width: ${pctX(600)};
  height: ${pctY(560)};
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${unit(40)};
  font-size: ${unit(20)};
  line-height: 1.55;
`;

const Part = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${unit(10)};
  text-align: ${props => props.$align};
  align-items: ${props => props.$align == "right" ? "flex-end" : "flex-start"};
`;

const TITLE_SIZE = 36;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${unit(28)};
  font-family: gameboy;
  font-size: ${unit(TITLE_SIZE)};
  color: white;
`;

// the class's three icons, over its name (Jamie): spaced apart, and half the name's height above it
const IconGroup = styled.div`
  display: flex;
  gap: ${unit(30)};
  margin-bottom: ${unit(TITLE_SIZE / 2 - 10)}; /* (the part's own gap makes up the rest) */
`;

const ClassText = styled.div`
  padding-left: ${unit(48)};
`;

const Icon = styled.i`
  font-size: ${unit(46)};
  filter: drop-shadow(0 0 ${unit(5)} currentColor);
`;

const TINT = { turnDegrees: 28, saturation: 0.7, lightness: 80 };
const getTint = (color, turn) => `hsl(from ${color} calc(h + ${turn}) calc(s * ${TINT.saturation}) ${TINT.lightness}%)`;
// the class: the three colors mixed, made light
const getClassTint = colors => !colors.length ? '#d9dade' : `color-mix(in oklab, ${colors.reduce((mix, color, k) => k ? `color-mix(in oklab, ${mix}, ${color} ${Math.round(100 / (k + 1))}%)` : color)} 45%, #eef0f4)`;

const Effect = styled.div`
  color: ${props => props.$color};
  filter: brightness(1.2);
`;

const Prompt = styled.div`
  align-self: center;
  font-family: gameboy;
  font-size: ${unit(30)};
  letter-spacing: ${unit(2)};
  color: #e25cff;
  text-shadow: 0 0 ${unit(8)} #e25cff;
`;

const Buttons = styled.div`
  position: absolute;
  right: ${pctX(70)};
  bottom: ${pctY(50)};
  display: flex;
  gap: ${unit(14)};
`;

const MetalButton = styled.button`
  padding: ${unit(12)} ${unit(26)};
  font-family: gameboy;
  font-size: ${unit(18)};
  cursor: pointer;
  color: #d9dade;
  background: linear-gradient(#3a3d43, #16171a);
  border: ${unit(2)} solid #8d9097;
  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
`;

export const AbilityPicker = ({
  handleClickHome,
  pickedAbilities,
  setPickedAbilities,
  handleClickPlay,
  playLabel = undefined, // from the Lab, the button says where it goes
  onBack = undefined,
  isTeammate = undefined, // (no longer shown: there's always a teammate now)
  setIsTeammate = undefined
}) => {
  const { settingsManager, selectedAvatar } = useContext(GlobalSettingsContext);
  const [hovered, setHovered] = useState(undefined); // the index of the hovered (or key-chosen) pendant
  // every power in play; the halo shows the open ones only (Jamie: locked ones are hidden)
  const [allPowers] = useState(() => {
    settingsManager.initAbilityStatusData();
    return Object.values(settingsManager.getAbilityAndTileStatusData()).filter(({ element }) => !OUT_OF_PLAY_POWERS.includes(element));
  });
  // dev: shown or hidden by hand, over whether it's open
  const [devShown, setDevShown] = useState({});
  const [isDevOpen, setIsDevOpen] = useState(false);
  const powers = useMemo(() => allPowers.filter(({ element }) => devShown[element] ?? getIsSkillOpen(element)), [allPowers, devShown]);
  useEffect(() => setHovered(undefined), [powers.length]);
  const [lockIns, setLockIns] = useState({}); // each power's count of being picked, to play its lock-in again

  const angles = useMemo(() => powers.map((_, k) => powers.length > 1
    ? LOOK.haloStartDegrees + (k * (LOOK.haloEndDegrees - LOOK.haloStartDegrees)) / (powers.length - 1)
    : 90), [powers]);
  const traces = useMemo(() => angles.map((degrees, k) => getTrace(degrees, k, angles.length)), [angles]);
  const stubs = useMemo(() => getStubs(angles), [angles]);

  const getIsPicked = power => pickedAbilities.includes(power.getElementUppercase());

  const togglePower = power => {
    const element = power.getElementUppercase();
    const isPicked = pickedAbilities.includes(element);
    if (!isPicked && pickedAbilities.length >= PICK_COUNT) return;
    const picked = (isPicked ? pickedAbilities.filter(other => other != element) : [...pickedAbilities, element]).sort((a, b) => a.localeCompare(b));
    if (!isPicked) setLockIns(counts => ({ ...counts, [element]: (counts[element] || 0) + 1 }));
    setPickedAbilities(picked);
    settingsManager.setSortedPlayerChosenAbilityElementsString(picked);
  };

  // keys: the arrows go round the halo (left toward its left end, right toward its right), Space or Enter picks
  const keyState = useRef({});
  keyState.current = { hovered, powers, togglePower };
  useEffect(() => {
    const onKey = event => {
      const { hovered, powers, togglePower } = keyState.current;
      if (!powers.length) return;
      if (event.key == "ArrowLeft" || event.key == "ArrowUp") {
        setHovered(hovered === undefined ? 0 : Math.min(powers.length - 1, hovered + 1));
      } else if (event.key == "ArrowRight" || event.key == "ArrowDown") {
        setHovered(hovered === undefined ? 0 : Math.max(0, hovered - 1));
      } else if ((event.key == " " || event.key == "Enter") && hovered !== undefined) {
        togglePower(powers[hovered]);
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isReady = pickedAbilities.length == PICK_COUNT;
  const playerClass = isReady ? getSciFiClass(pickedAbilities) : undefined;
  const pickedPowers = powers.filter(getIsPicked);

  const figure = FIGURES[selectedAvatar] || FIGURES.guy;
  const scale = LOOK.figureHeight / (figure.feet - figure.head);
  const headTop = LOOK.torso.y - LOOK.headDrop * LOOK.figureHeight;
  const avatarColor = (PIECES_INFO[selectedAvatar] || PIECES_INFO.guy).color;

  const getInfo = () => {
    const power = hovered !== undefined ? powers[hovered] : undefined;
    if (power) {
      return (
        <>
          <Part $align="left">
            <TitleRow><Icon className={`fa ${power.activeIcon}`} style={{ color: power.color }} />{power.activeName}</TitleRow>
            <div style={{ color: getTint(power.color, -TINT.turnDegrees) }}>{power.activeDesc}</div>
            {power.activeEffect1 && <Effect $color={power.color}>{power.activeEffect1}</Effect>}
          </Part>
          <Part $align="right">
            <TitleRow>{power.passiveName}<Icon className={`fa ${power.passiveIcon}`} style={{ color: power.color }} /></TitleRow>
            <div style={{ color: getTint(power.color, TINT.turnDegrees) }}>{power.passiveDesc}</div>
            {power.passiveEffect1 && <Effect $color={power.color}>{power.passiveEffect1}</Effect>}
          </Part>
        </>
      );
    }
    if (playerClass) {
      return (
        <Part $align="left">
          <IconGroup>
            {pickedPowers.map(({ element, activeIcon, color }) => <Icon key={element} className={`fa ${activeIcon}`} style={{ color }} />)}
          </IconGroup>
          <TitleRow>{playerClass[0]}</TitleRow>
          <ClassText style={{ color: getClassTint(pickedPowers.map(({ color }) => color)) }}>{playerClass[1]}</ClassText>
        </Part>
      );
    }
    return <Prompt>Choose {PICK_COUNT} powers</Prompt>;
  };

  return (
    <Backdrop>
      <Stage>
        <Board viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="pickerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* the board: dim stubs between the pendants */}
          {stubs.map(({ key, d, pad }) => (
            <g key={key}>
              <path d={d} fill="none" stroke={LOOK.colors.stub} strokeWidth="2" />
              <circle cx={pad.x} cy={pad.y} r="5" fill="none" stroke={LOOK.colors.stub} strokeWidth="2" />
            </g>
          ))}
          {/* each pendant's trace, unpicked first so the lit ones lie on top */}
          {traces.map((trace, k) => ({ trace, k, power: powers[k] }))
            .sort((a, b) => Number(getIsPicked(a.power)) - Number(getIsPicked(b.power)))
            .map(({ trace, k, power }) => {
              const isPicked = getIsPicked(power);
              const isHovered = hovered === k;
              const stroke = isPicked ? power.color : isHovered ? LOOK.colors.traceHover : LOOK.colors.trace;
              return (
                <g key={power.element} filter={isPicked || isHovered ? "url(#pickerGlow)" : undefined}>
                  <path d={trace.d} fill="none" stroke={stroke} strokeWidth={isPicked ? 3.5 : 2.5} strokeLinejoin="round" />
                  <circle cx={trace.start.x} cy={trace.start.y} r="6" fill="black" stroke={stroke} strokeWidth="2.5" />
                  <circle cx={trace.end.x} cy={trace.end.y} r="6" fill="none" stroke={isPicked ? power.color : LOOK.colors.pad} strokeWidth="2.5" />
                  {isPicked && [0, 0.5].map(lag => (
                    <Bead key={lag} d={trace.d} pathLength="100" style={{ animationDelay: `${-lag * LOOK.beadMs}ms`, filter: `drop-shadow(0 0 4px ${power.color})` }} />
                  ))}
                </g>
              );
            })}
        </Board>
        <Avatar
          style={{
            left: pctX(LOOK.torso.x - figure.middle * scale),
            top: pctY(headTop - figure.head * scale),
            width: pctX(FRAME.width * scale),
            height: pctY(FRAME.height * scale),
            backgroundImage: `url(/${figure.sheet})`,
            filter: `drop-shadow(0 0 ${unit(6)} ${avatarColor})`
          }}
        />
        {powers.map((power, k) => {
          const at = polar(angles[k], HALO_RADIUS);
          return (
            <Pendant
              key={power.element}
              aria-label={power.activeName}
              aria-pressed={getIsPicked(power)}
              style={{ left: pctX(at.x), top: pctY(at.y) }}
              $color={power.color}
              $isPicked={getIsPicked(power)}
              $isHovered={hovered === k}
              onClick={() => togglePower(power)}
              onMouseEnter={() => setHovered(k)}
              onMouseLeave={() => setHovered(undefined)}
            >
              {getIsPicked(power) && <Orbit $color={power.color} />}
              {getIsPicked(power) && lockIns[power.getElementUppercase()] && <LockIn key={lockIns[power.getElementUppercase()]} $color={power.color} />}
              <i className={`fa ${power.activeIcon}`} style={{ color: power.color }} />
            </Pendant>
          );
        })}
        <Info>{getInfo()}</Info>
        {import.meta.env.DEV && (
          <DevPanel>
            <label><input type="checkbox" checked={isDevOpen} onChange={() => setIsDevOpen(!isDevOpen)} />dev: powers in the halo ({powers.length})</label>
            {isDevOpen && allPowers.map(({ element, activeName }) => (
              <label key={element}>
                <input type="checkbox" checked={devShown[element] ?? getIsSkillOpen(element)} onChange={event => setDevShown(shown => ({ ...shown, [element]: event.target.checked }))} />
                {activeName || element}{getIsSkillOpen(element) ? '' : ' (locked)'}
              </label>
            ))}
          </DevPanel>
        )}
        <Buttons>
          <MetalButton disabled={!isReady} onClick={handleClickPlay}>{playLabel || "Play!"}</MetalButton>
          {!onBack && <MetalButton onClick={handleClickHome}>Back</MetalButton>}
        </Buttons>
      </Stage>
    </Backdrop>
  );
};
