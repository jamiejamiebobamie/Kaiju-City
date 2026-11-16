import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { GlobalSettingsContext } from "Home";
import { SpeedBlurFilter, slideAway } from "Components/SlideAway";
import { Doodads } from "Components/AvatarSelection";
import { ScaleToFit } from "Components/CrtPower";
import { PICKER_FIGURE } from "./AbilityPicker";

/*
  The start of the game (Jamie, playtest 21; the UI epic's mock-ups will restyle it): the guy and the girl, side by
  side in the middle of the screen, "Choose your character" under them, and 1 and 2 to pick with the keys.
  Picked: "Player" and "Teammate" show under them with a lock-in flash (white, quick at first, then slower, then
  still), and after a beat the two slide off left, as the landing screen does. The other is the teammate. The choice
  holds for the whole campaign.
*/
const CHOICE = {
  lockInMs: 1500, // the labels' flash, before the slide
  doodadFadeInMs: 120, // the doodads' fade in on hover
  doodadFadeOutMs: 250, // and out, on hover out and on a pick
  slideMs: 1100,
  colors: { guy: "#55AAff", girl: "#fa8072" },
  textColor: "#e25cff"
};
const AVATARS = [
  // 'figureOffset': how far the figure stands from its frame's middle (measured on the sheets), so the green grid is
  // centered on them, not on the frame
  { id: "guy", sheet: "spritesheet/player.png", key: "1", figureOffset: 4 },
  { id: "girl", sheet: "spritesheet/teammate.png", key: "2", figureOffset: -4 }
];

// inside the Kaiju-Vision screen (Jamie, 2026-11-14), on a square design scaled to fit it
const DESIGN_SIZE = 640; // (was 900: smaller here is bigger on the screen. Jamie: larger in the monitor)

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 28px;
`;

// leaving: a parallax (Jamie, playtest 22): the two of them nearest, fastest; their labels behind, slower; both blurring
const leaveLayer = (distance, isLeaving) => isLeaving && css`animation: ${slideAway(distance)} ${CHOICE.slideMs}ms ease-in forwards;`;

const Row = styled.div`
  display: flex;
  gap: 160px;
`;

const Choice = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0;
  background: none;
  border: 0;
  cursor: ${props => props.$isLocked ? "default" : "pointer"};
`;

const idle = keyframes`
  from { background-position: 0 1380px; }
  to { background-position: 0 0; }
`;

// the sprite and, behind it, the old home screen's art: on hover the three doodads and the circuit-disc grid, all
// glowing green (Jamie, 2026-11-12: "just want to see")
const SpriteBox = styled.div`
  position: relative;
  top: -18px; /* up, their heads to Jamie's line in the tanks (about 21 screen pixels) */
  width: 152px;
  height: 230px;
  ${props => leaveLayer("-170vw", props.$isLeaving)}
`;

const DoodadHolder = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`;

// the sprite sheet's standing frame; hovered, its idle animation (as on the old screen)
const Sprite = styled.div`
  position: relative;
  width: 152px;
  height: 230px;
  background: url(${props => props.$sheet});
  background-position: 0 -460px;
  filter: url(#underwater) drop-shadow(0 0 3px ${props => props.$color}); /* in the tank's water (Jamie) */
  ${props => !props.$isLocked && css`${Choice}:hover & { animation: ${idle} 1.2s steps(6) -0.4s infinite; }`}
  /* picked: facing front, glowing brighter (the idle cycle turns them round) */
  ${props => props.$isChosen && css`filter: url(#underwater) drop-shadow(0 0 8px ${props.$color}) drop-shadow(0 0 3px white);`}
`;

/*
  Hovered, the number goes the doodads' green and is electrified (Jamie, 2026-11-12): its glow crackles, and now and
  then it throws a few sparks that arc out and fall.
*/
const SPARKS = {
  color: "#80EF80",
  sparkColor: "#ffb020", // the sparks: yellow-orange, against the green number (Jamie; was electric blue #2fc8ff)
  pulseColor: "#e6ffe6", // the number's pulse, up to a brighter greenish white (Jamie)
  pulseMs: 1400, // one way
  lifeMs: 1000 // a spark's flight (shorter than the wait between bursts, so one burst is over before the next)
};

const numberCrackle = keyframes`
  0%, 100% { text-shadow: 0 0 4px ${SPARKS.color}, 0 0 9px ${SPARKS.color}; filter: brightness(1); }
  12% { text-shadow: 0 0 2px ${SPARKS.color}; filter: brightness(0.75); }
  16% { text-shadow: 0 0 6px white, 0 0 14px ${SPARKS.color}; filter: brightness(1.6); }
  20% { text-shadow: 0 0 4px ${SPARKS.color}, 0 0 9px ${SPARKS.color}; filter: brightness(1); }
  57% { text-shadow: 0 0 3px ${SPARKS.color}, 0 0 6px ${SPARKS.color}; filter: brightness(0.9); }
  61% { text-shadow: 0 0 7px white, 0 0 16px ${SPARKS.color}; filter: brightness(1.5); translate: 1px 0; }
  64% { text-shadow: 0 0 4px ${SPARKS.color}, 0 0 9px ${SPARKS.color}; translate: 0 0; }
`;

const numberPulse = keyframes`
  from { color: ${SPARKS.color}; }
  to { color: ${SPARKS.pulseColor}; }
`;

const KeyNumber = styled.span`
  position: relative;
  display: inline-block;
  font-family: gameboy;
  font-size: 18px;
  color: #c9c3d6;
  transition: color 120ms;
  visibility: ${props => props.$isHidden ? "hidden" : "visible"};
  ${props => props.$isElectric && css`
    /* kept readable (Jamie): a thin dark outline, and the sparks behind it ('isolation' keeps them in here) */
    isolation: isolate;
    -webkit-text-stroke: 1px #06210a;
    paint-order: stroke fill;
    color: ${SPARKS.color};
    animation: ${numberCrackle} 0.9s steps(1) infinite, ${numberPulse} ${SPARKS.pulseMs}ms ease-in-out infinite alternate;
  `}
`;

/*
  A spark flies like a welder's or a grinder's (Jamie, 2026-11-15): thrown hard across and slowing, often up in an arc
  first ('--arc', its height), then pulled down, faster and faster, as by gravity; shrinking and fading at the end.
  '--dx': how far across in all, '--dy': how far down by the end.
*/
const SPARK_STEPS = [0, 0.05, 0.12, 0.2, 0.3, 0.42, 0.56, 0.7, 0.85, 1];
const sparkFall = keyframes`${SPARK_STEPS.map(time => {
  const across = 1 - Math.pow(1 - time, 3); // out fast, slowing
  const arc = 6.75 * time * Math.pow(1 - time, 2); // up and back down, highest a third of the way in
  const fall = time * time; // gravity
  const opacity = time < 0.65 ? 1 : 1 - (time - 0.65) / 0.35;
  return `${(time * 100).toFixed(1)}% { transform: translate(calc(var(--dx) * ${across.toFixed(3)}), calc(var(--arc, 0px) * ${(-arc).toFixed(3)} + var(--dy) * ${fall.toFixed(3)})) scale(${(1 - 0.65 * time).toFixed(2)}); opacity: ${opacity.toFixed(2)}; }`;
}).join("\n")}`;

const Spark = styled.span`
  position: absolute;
  left: 50%;
  top: 92%; /* from the number's bottom edge, so they fall away from it */
  z-index: -1; /* behind the number */
  width: 3px;
  height: 3px;
  margin: -1.5px;
  border-radius: 50%;
  background: #fff4c2;
  box-shadow: 0 0 3px 1px ${SPARKS.sparkColor}, 0 0 7px 2px ${SPARKS.sparkColor};
  pointer-events: none;
  animation: ${sparkFall} ${SPARKS.lifeMs}ms linear forwards;
`;

const between = ([low, high]) => low + Math.random() * (high - low);
const pick = share => Math.random() < share;
let sparkId = 0; // across hovers, so a spark still falling keeps its key

/*
  The number's sparks and the grid's are on one timer (Jamie): a burst at a time, from one or the other, and the next
  only once it is over. (The grid's spots: in the sprite box's pixels, the grid as the doodads draw it, measured.)
*/
const SPARK_TIMER = { everyMs: [1300, 3000], firstMs: [300, 900], numberShare: 0.3 };

// the number's: off its foot, thrown either way, some arcing up
const NUMBER_SPARKS = { perBurst: [2, 5], acrossPx: [20, 70], fallPx: [110, 180], arcShare: 0.5, arcPx: [8, 22] };

// the grid's: only off its edges, flung outward onto the black, never across the figure (Jamie). Off the top, nearly
// always an arc up first; off the sides, sometimes
const GRID_SPARKS = {
  perBurst: [4, 8],
  acrossPx: [70, 190],
  fallPx: [150, 260],
  scatterPx: 10,
  grid: { left: 34, top: 42, right: 120, bottom: 191 },
  edges: [{ side: "left", share: 0.38 }, { side: "right", share: 0.38 }, { side: "top", share: 0.24 }],
  arcs: { top: { share: 0.85, px: [30, 75] }, side: { share: 0.45, px: [10, 38] } }
};

// a spot on one of the grid's edges, and which way is out from there
const getGridEdgeSpot = offsetX => {
  const { grid, edges } = GRID_SPARKS;
  let roll = Math.random();
  const { side } = edges.find(({ share }) => (roll -= share) < 0) || edges[0];
  const middle = (grid.left + grid.right) / 2;
  if (side == "top") {
    const x = between([grid.left, grid.right]);
    return { x: x + offsetX, y: grid.top, side, out: x < middle ? -1 : 1 };
  }
  return { x: (side == "left" ? grid.left : grid.right) + offsetX, y: between([grid.top, grid.bottom - 30]), side, out: side == "left" ? -1 : 1 };
};

const makeNumberBurst = () => Array.from({ length: Math.round(between(NUMBER_SPARKS.perBurst)) }, () => ({
  id: sparkId++,
  source: "number",
  dx: (pick(0.5) ? -1 : 1) * between(NUMBER_SPARKS.acrossPx),
  dy: between(NUMBER_SPARKS.fallPx),
  arc: pick(NUMBER_SPARKS.arcShare) ? between(NUMBER_SPARKS.arcPx) : 0
}));

const makeGridBurst = offsetX => {
  const spot = getGridEdgeSpot(offsetX);
  const arcs = spot.side == "top" ? GRID_SPARKS.arcs.top : GRID_SPARKS.arcs.side;
  return Array.from({ length: Math.round(between(GRID_SPARKS.perBurst)) }, () => {
    const scatterX = between([0, GRID_SPARKS.scatterPx]);
    const scatterY = (Math.random() * 2 - 1) * GRID_SPARKS.scatterPx;
    return {
      id: sparkId++,
      source: "grid",
      // the scatter kept to the outside of its edge
      left: spot.side == "top" ? spot.x + (Math.random() * 2 - 1) * GRID_SPARKS.scatterPx : spot.x + spot.out * scatterX,
      top: spot.side == "top" ? spot.y - Math.abs(scatterY) : spot.y + scatterY,
      dx: spot.out * between(GRID_SPARKS.acrossPx),
      dy: between(GRID_SPARKS.fallPx),
      arc: pick(arcs.share) ? between(arcs.px) : 0
    };
  });
};

const useSparkBursts = (isOn, offsetX) => {
  const [sparks, setSparks] = useState([]);
  useEffect(() => {
    if (!isOn) return;
    let timeout;
    const burst = () => {
      const born = pick(SPARK_TIMER.numberShare) ? makeNumberBurst() : makeGridBurst(offsetX);
      setSparks(all => [...all, ...born]);
      setTimeout(() => setSparks(all => all.filter(spark => !born.includes(spark))), SPARKS.lifeMs);
      timeout = setTimeout(burst, between(SPARK_TIMER.everyMs));
    };
    timeout = setTimeout(burst, between(SPARK_TIMER.firstMs));
    return () => clearTimeout(timeout);
  }, [isOn]);
  return sparks;
};

const getSparkStyle = ({ dx, dy, arc }) => ({ "--dx": `${dx}px`, "--dy": `${dy}px`, "--arc": `${arc}px` });

const GridSparks = ({ sparks }) => sparks.filter(({ source }) => source == "grid").map(spark => (
  <Spark key={spark.id} style={{ left: `${spark.left}px`, top: `${spark.top}px`, ...getSparkStyle(spark) }} />
));

const ElectricNumber = ({ isElectric, isHidden, sparks, children }) => (
  <KeyNumber $isHidden={isHidden} $isElectric={isElectric && !isHidden}>
    {children}
    {sparks.filter(({ source }) => source == "number").map(spark => <Spark key={spark.id} style={getSparkStyle(spark)} />)}
  </KeyNumber>
);

// locked in: a white flash on the way in, quick at first, then slower, then still (no words for it: Jamie)
const lockIn = keyframes`
  0% { opacity: 0; color: white; text-shadow: 0 0 12px white; }
  6% { opacity: 1; color: white; text-shadow: 0 0 12px white; }
  14% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  22% { color: white; text-shadow: 0 0 12px white; }
  34% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  50% { color: white; text-shadow: 0 0 12px white; }
  72% { color: var(--color); text-shadow: 0 0 6px var(--color); }
  100% { opacity: 1; color: var(--color); text-shadow: 0 0 6px var(--color); }
`;

const Label = styled.span`
  min-height: 22px;
  font-family: gameboy;
  font-size: 18px;
  text-transform: uppercase;
  color: var(--color);
  opacity: 0;
  ${props => props.$isShown && !props.$isLeaving && css`animation: ${lockIn} ${CHOICE.lockInMs}ms linear forwards;`}
  ${props => props.$isLeaving && css`opacity: 1;`} /* (stays: it rides the camera's move to the picker now: Jamie) */
`;

const Prompt = styled.div`
  margin-top: 40px; /* a little lower (Jamie) */
  font-family: gameboy;
  font-size: 20px;
  letter-spacing: 2px;
  color: ${CHOICE.textColor};
  text-shadow: 0 0 8px ${CHOICE.textColor};
  visibility: ${props => props.$isHidden ? "hidden" : "visible"};
`;

/*
  On to the power picker, on the same monitor (Jamie): everything but the chosen avatar slides off left, and the
  chosen one slides (and grows) to where the picker's figure stands, so the picker comes in round it. The figures'
  spots in their sprite frames, measured: the middle, the top of the head, the feet.
*/
const FIGURE_SPOTS = { guy: { middle: 81, head: 47, feet: 186 }, girl: { middle: 72.5, head: 49, feet: 182 } };
const FRAME_WIDTH = 152;

const getHandOver = box => {
  const spot = FIGURE_SPOTS[box.dataset.avatar];
  const screen = box.closest("[data-play-screen]");
  if (!spot || !screen) return undefined;
  const now = box.getBoundingClientRect();
  const k = now.width / FRAME_WIDTH; // the box's pixels, on screen
  const area = screen.getBoundingClientRect();
  const stage = Math.min(area.width, area.height); // the picker's square stage, fitted to the screen
  const target = { x: area.left + (area.width - stage) / 2 + PICKER_FIGURE.x * stage, y: area.top + (area.height - stage) / 2 + PICKER_FIGURE.headY * stage };
  const scale = (PICKER_FIGURE.height * stage) / ((spot.feet - spot.head) * k);
  return {
    transformOrigin: `${spot.middle}px ${spot.head}px`,
    transform: `translate(${(target.x - (now.left + spot.middle * k)) / k}px, ${(target.y - (now.top + spot.head * k)) / k}px) scale(${scale})`
  };
};

// each one's name beside its number (Jamie): "Guy" and "Girl" in purple, glowing up on hover; gone once chosen
const NumberRow = styled.span`
  position: relative;
  top: -42px; /* up, on the tank's base, as if a display on it (Jamie) */
  display: flex;
  align-items: baseline;
  gap: 14px;
`;

const AvatarName = styled.span`
  font-family: gameboy;
  font-size: 18px;
  text-transform: uppercase;
  color: ${CHOICE.textColor};
  text-shadow: 0 0 4px ${CHOICE.textColor};
  opacity: 0.8;
  transition: text-shadow 160ms, opacity 160ms, color 160ms;
  visibility: ${props => props.$isHidden ? "hidden" : "visible"};
  ${props => props.$isHovered && css`
    opacity: 1;
    color: #f2a6ff;
    text-shadow: 0 0 6px ${CHOICE.textColor}, 0 0 14px ${CHOICE.textColor}, 0 0 2px white;
  `}
`;

const ChoiceAvatar = ({ id, sheet, keyName, figureOffset, chosen, isLeaving, onChoose, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  const boxRef = useRef(null);
  const [handOver, setHandOver] = useState(undefined);
  const isHandedOver = isLeaving && chosen == id;
  useLayoutEffect(() => {
    if (isHandedOver && boxRef.current) setHandOver(getHandOver(boxRef.current));
  }, [isHandedOver]);
  const [doodadOpacity, setDoodadOpacity] = useState(0);
  const sparks = useSparkBursts(isHovered && !chosen, figureOffset);
  return (
    <Choice $isLocked={!!chosen} onClick={onChoose} onMouseEnter={() => { setIsHovered(true); onHover(id); }} onMouseLeave={() => { setIsHovered(false); onHover(undefined); }} aria-label={id}>
      {/* (no slide of its own: the whole avatar select rides the camera's move to the picker, which brings the chosen one
          to where the picker's stands: Jamie) */}
      <SpriteBox ref={boxRef} data-avatar={id} $isLeaving={false}>
        {/* the grid's sparks under everything here: the grid, the three readouts and the figure (Jamie) */}
        <GridSparks sparks={sparks} />
        <DoodadHolder>
          <Doodads hasPrompt={false} show={isHovered && !chosen} persistDisc={false} hasDisc={false} isDrifting fadeInMs={CHOICE.doodadFadeInMs} fadeOutMs={CHOICE.doodadFadeOutMs} globalTranslation={`${figureOffset}px, 0px`} opacity={doodadOpacity} setOpacity={setDoodadOpacity} />
        </DoodadHolder>
        <Sprite $sheet={sheet} $color={CHOICE.colors[id]} $isChosen={chosen == id} $isLocked={!!chosen} />
      </SpriteBox>
      <NumberRow>
        <ElectricNumber isElectric={isHovered} isHidden={!!chosen} sparks={sparks}>{keyName}</ElectricNumber>
        <AvatarName $isHovered={isHovered} $isHidden={false}>{id}</AvatarName>
      </NumberRow>
      <Label $isShown={!!chosen} $isLeaving={isLeaving} style={{ "--color": CHOICE.colors[id] }}>{chosen ? (chosen == id ? "Player" : "Teammate") : ""}</Label>
    </Choice>
  );
};

// 'isReady': the monitor is on, so a pick can be made (not while it is still dead or warming up)
// 'onHover': which one is under the mouse (the backdrop lights it up more)
// 'onHandOver': the chosen one, as it starts its slide to the picker (the backdrop goes with it)
export const AvatarChoice = ({ onChoose, isReady = true, onHover = (_id) => {}, onHandOver = (_id) => {} }) => {
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  const { setSelectedAvatar } = useContext(GlobalSettingsContext);
  const [chosen, setChosen] = useState(undefined);
  const [isLeaving, setIsLeaving] = useState(false);
  const chosenRef = useRef(undefined);

  const choose = player => {
    if (chosenRef.current || !isReadyRef.current) return;
    chosenRef.current = player;
    setChosen(player);
    setSelectedAvatar(player);
    const teammate = player == "guy" ? "girl" : "guy";
    setTimeout(() => {
      setIsLeaving(true);
      onHandOver(player);
    }, CHOICE.lockInMs);
    setTimeout(() => onChoose(player, teammate), CHOICE.lockInMs + CHOICE.slideMs);
  };

  // 1 or 2 picks, as the numbers under them say
  useEffect(() => {
    const onKey = ({ code, repeat }) => {
      if (repeat) return;
      const avatar = AVATARS.find(({ key }) => code == `Digit${key}` || code == `Numpad${key}`);
      if (avatar) choose(avatar.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ScaleToFit width={DESIGN_SIZE} height={DESIGN_SIZE}>
      <Screen>
        <SpeedBlurFilter />
        <Row>
          {AVATARS.map(({ id, sheet, key, figureOffset }) => (
            <ChoiceAvatar key={id} id={id} sheet={sheet} keyName={key} figureOffset={figureOffset} chosen={chosen} isLeaving={isLeaving} onChoose={() => choose(id)} onHover={onHover} />
          ))}
        </Row>
        <Prompt $isHidden={!!chosen}>Choose your character</Prompt>
      </Screen>
    </ScaleToFit>
  );
};
