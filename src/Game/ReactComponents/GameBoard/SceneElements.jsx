import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { getSortZIndex } from "Game/DataClasses/Levels/levels";
import { getSpeechMs, SPEECH_TIMING } from "Game/DataClasses/speechTiming";

/*
  Moving art in a level. Each level's 'sceneElements', in levels.ts, hold the look-and-feel numbers.
*/
const PART_TRANSFORM = {
  seconds: 3.4,
  swaps: 26, // how many times it changes frame, faster and faster
  brightness: 4,
  scale: 1.12,
  flashSeconds: 1.5 // the screen's flash fades over this long
};

// the sewer's finale: every part transforms at once, and its glow swells until the scene fades to white
const PART_CRESCENDO = {
  seconds: 7,
  glowSize: 1.5, // as a multiple of the part's longest side
  glowScale: 3,
  brightness: 2.5,
  whiteoutDelaySeconds: 5,
  whiteoutSeconds: 3
};

const spriteFrames = keyframes`
  from { background-position-x: var(--from-x); }
  to { background-position-x: var(--to-x); }
`;

const lightPulse = keyframes`
  0%, 100% { opacity: var(--low-opacity); }
  50% { opacity: var(--high-opacity); }
`;

// uneven, so it catches the eye the way a steady pulse doesn't
const unevenPulse = keyframes`
  0%, 100% { opacity: var(--low-opacity); }
  12% { opacity: var(--high-opacity); }
  20% { opacity: calc(var(--low-opacity) + 0.2); }
  34% { opacity: var(--high-opacity); }
  58% { opacity: var(--low-opacity); }
  64% { opacity: calc(var(--high-opacity) - 0.15); }
  70% { opacity: calc(var(--low-opacity) + 0.1); }
  84% { opacity: var(--high-opacity); }
`;

// a slow rise out of the dark, a held breath, a slow fall, then a long rest
const hauntingFade = keyframes`
  0%, 20%, 100% { opacity: var(--low-opacity); }
  52%, 62% { opacity: var(--high-opacity); }
`;

const fishLeap = keyframes`
  0% { opacity: 0; transform: translate(var(--from-x), var(--from-y)) scale(0.5); }
  12% { opacity: 1; }
  55% { transform: translate(calc(var(--from-x) * 0.4), calc(var(--from-y) * 0.4 - 50px)) scale(0.85); }
  100% { opacity: 1; transform: translate(0, 0) scale(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const mothFlutter = keyframes`
  0%, 100% { transform: translate(0, 0) scaleX(var(--flip)); }
  25% { transform: translate(14px, -9px) scaleX(var(--flip)); }
  45% { transform: translate(-7px, -15px) scaleX(calc(var(--flip) * -1)); }
  70% { transform: translate(-12px, 6px) scaleX(calc(var(--flip) * -1)); }
  85% { transform: translate(8px, 9px) scaleX(var(--flip)); }
`;

// the part flips between its frames, faster and faster, including its single color frame
const getTransformFrames = () => {
  const stops = Array.from({ length: PART_TRANSFORM.swaps }, (_, swap) => {
    const percent = (1 - (1 - swap / PART_TRANSFORM.swaps) ** 2) * 100;
    return `${percent.toFixed(2)}% { background-position-x: calc(var(--frame-width) * ${-(swap % 3)}); }`;
  });
  return keyframes`${stops.join("\n")}`;
};
const transformFrames = getTransformFrames();

const transformSwell = keyframes`
  0% { filter: brightness(1); transform: scale(1); opacity: 1; }
  88% { filter: brightness(${PART_TRANSFORM.brightness}); transform: scale(${PART_TRANSFORM.scale}); opacity: 1; }
  100% { filter: brightness(${PART_TRANSFORM.brightness * 2}); transform: scale(${PART_TRANSFORM.scale * 1.1}); opacity: 0; }
`;

const flashPercent = (PART_TRANSFORM.seconds * 0.9 / (PART_TRANSFORM.seconds + PART_TRANSFORM.flashSeconds)) * 100;
const screenFlash = keyframes`
  0% { opacity: 0; }
  ${flashPercent - 3}% { opacity: 0; }
  ${flashPercent}% { opacity: 1; }
  100% { opacity: 0; }
`;

const crescendoSwell = keyframes`
  from { filter: brightness(1); }
  to { filter: brightness(${PART_CRESCENDO.brightness}); }
`;

const glowSwell = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(${PART_CRESCENDO.glowScale}); }
`;

const ImageElement = styled.img`
  position: absolute;
  pointer-events: none;
`;

const FadingImageElement = styled(ImageElement)`
  animation-name: ${fadeIn};
  animation-fill-mode: both;
`;

const SpriteElement = styled.div`
  position: absolute;
  pointer-events: none;
  background-repeat: no-repeat;
  animation-name: ${spriteFrames};
  animation-iteration-count: infinite;
`;

const MothElement = styled.div`
  position: absolute;
  pointer-events: none;
  background-repeat: no-repeat;
  animation-name: ${spriteFrames}, ${mothFlutter};
  animation-duration: var(--wing-seconds), var(--flutter-seconds);
  animation-timing-function: steps(var(--frames)), ease-in-out;
  animation-iteration-count: infinite;
`;

const PulsingImageElement = styled(ImageElement)`
  animation-name: ${props => props.$isHaunting ? hauntingFade : props.$isUneven ? unevenPulse : lightPulse};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
`;

const LightElement = styled.div`
  position: absolute;
  pointer-events: none;
  animation: ${lightPulse} ease-in-out infinite;
`;

const FishLeap = styled.div`
  position: absolute;
  pointer-events: none;
  animation: ${fishLeap} 0.8s ease-out both;
`;

const CanvasElement = styled.canvas`
  position: absolute;
  pointer-events: none;
`;

const PartFrame = styled.div`
  position: absolute;
  pointer-events: none;
  transition: filter 4s ease-in;
`;

const PartLayer = styled.div`
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
`;

const PartGlow = styled(PartLayer)`
  animation-name: ${lightPulse};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  --low-opacity: 0;
  --high-opacity: 1;
`;

const PartTransforming = styled(PartLayer)`
  animation-name: ${transformFrames}, ${transformSwell};
  animation-duration: ${PART_TRANSFORM.seconds}s;
  animation-timing-function: step-end, linear;
  animation-fill-mode: forwards;
`;

const PartCrescendoFrames = styled(PartLayer)`
  animation-name: ${transformFrames}, ${crescendoSwell};
  animation-duration: ${PART_CRESCENDO.seconds}s;
  animation-timing-function: step-end, ease-in;
  animation-fill-mode: forwards;
`;

const PartGlowSwell = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  mix-blend-mode: screen;
  animation: ${glowSwell} ${PART_CRESCENDO.seconds}s ease-in forwards;
`;

// over the whole monitor screen, and only the screen: everything in the game stays inside it
const ScreenFlash = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482995;
  border-radius: 1.8cqw;
  pointer-events: none;
  opacity: 0;
  animation: ${screenFlash} ${PART_TRANSFORM.seconds + PART_TRANSFORM.flashSeconds}s linear forwards;
`;

// reaches past the scene so it also covers the part glows that spill over the edges
const WhiteoutElement = styled.div`
  position: absolute;
  pointer-events: none;
  background: white;
  box-shadow: 0 0 0 100vmax white;
`;

const loadImage = src => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.src = src;
});

// plays 'enter', repeats 'loop' while active, then plays 'exit'. one canvas, as large images swap cleanly on it.
const SequenceCanvas = ({ element, isActive, isPaused, style }) => {
  const canvasRef = useRef(null);
  const isActiveRef = useRef(isActive);
  const isPausedRef = useRef(isPaused);
  isActiveRef.current = isActive;
  isPausedRef.current = isPaused;
  const { enter, loop, exit, fps, width, height, startDelayMs = 0 } = element;

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    let frameRef;
    let isCancelled = false;
    Promise.all([enter, loop, exit].map(srcs => Promise.all(srcs.map(loadImage)))).then(([enterFrames, loopFrames, exitFrames]) => {
      if (isCancelled) return;
      let part = "off";
      let frame = 0;
      let lastFrameMs = 0;
      let activeSinceMs = undefined;

      const show = image => {
        ctx.clearRect(0, 0, width, height);
        if (image) ctx.drawImage(image, 0, 0, width, height);
      };

      const step = nowMs => {
        if (!isActiveRef.current) activeSinceMs = undefined;
        else if (activeSinceMs === undefined) activeSinceMs = nowMs;

        if (part == "off" && activeSinceMs !== undefined && nowMs - activeSinceMs >= startDelayMs) {
          part = "enter";
          frame = 0;
        } else if ((part == "enter" || part == "loop") && !isActiveRef.current) {
          part = "exit";
          frame = 0;
        }
        if (part == "enter") {
          show(enterFrames[frame++]);
          if (frame == enterFrames.length) { part = "loop"; frame = 0; }
        } else if (part == "loop") {
          show(loopFrames[frame]);
          frame = (frame + 1) % loopFrames.length;
        } else if (part == "exit") {
          show(exitFrames[frame++]);
          if (frame > exitFrames.length) part = "off";
        }
      };

      const tick = nowMs => {
        if (!isPausedRef.current && nowMs - lastFrameMs >= 1000 / fps) {
          lastFrameMs = nowMs;
          step(nowMs);
        }
        frameRef = requestAnimationFrame(tick);
      };
      frameRef = requestAnimationFrame(tick);
    });
    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameRef);
    };
  }, [element]);

  return <CanvasElement ref={canvasRef} width={width} height={height} style={style} />;
};

/*
  A glowing Kaiju part. Its first two frames fade through each other.
  Touched, it runs through all of its frames, flares, and is gone.
*/
// 'isSettled': drawn fresh partway through the fight (the split screen's second view): a part already touched is just gone, with no flash
// 'isCopy': a piece of it drawn over a foreground layer (overFront): the screen flashes once, for the part itself
const KaijuPart = ({ element, activePhases, style, isSettled = false, isCopy = false }) => {
  const { src, width, height, seconds, delaySeconds = 0, touchPhase, brightPhase, flashColor, glowColor } = element;
  const isTouched = !!touchPhase && activePhases.includes(touchPhase);
  const isBright = !!brightPhase && activePhases.includes(brightPhase);
  const [isGone, setIsGone] = useState(isSettled && isTouched);
  useEffect(() => setIsGone(isSettled && isTouched), [isTouched]);

  const layerStyle = {
    backgroundImage: `url(${src})`,
    "--frame-width": `${width}px`,
    width: `${width}px`,
    height: `${height}px`
  };
  const glowSize = Math.max(width, height) * PART_CRESCENDO.glowSize;

  const getPart = () => {
    if (isBright) return <PartCrescendoFrames style={layerStyle} />;
    if (isTouched) return <PartTransforming style={layerStyle} onAnimationEnd={e => e.animationName == transformSwell.getName() && setIsGone(true)} />;
    return <>
      <PartLayer style={layerStyle} />
      <PartGlow style={{
        ...layerStyle,
        backgroundPositionX: `${-width}px`,
        animationDuration: `${seconds}s`,
        animationDelay: `${delaySeconds}s`,
        animationPlayState: style.animationPlayState
      }} />
    </>;
  };

  return (
    <>
      {!isGone && <PartFrame style={style}>{getPart()}</PartFrame>}
      {/* the glows go one layer up, over every part: so each part fades into the others' light, the last one too (Sewer 2's claw) */}
      {isBright && (
        <PartFrame style={{ ...style, zIndex: (style.zIndex || 0) + 1 }}>
          <PartGlowSwell style={{
            width: `${glowSize}px`,
            height: `${glowSize}px`,
            background: `radial-gradient(circle, ${glowColor} 0%, ${glowColor} 25%, transparent 70%)`
          }} />
        </PartFrame>
      )}
      {isTouched && !isSettled && !isCopy && !!flashColor && createPortal(<ScreenFlash style={{ background: flashColor }} />, document.querySelector("[data-play-screen]") || document.body)}
    </>
  );
};

// a sweeper swaps between the broom's two poses, to one side and then the other
const SWEEP_LOOK = {
  poses: ['/levels/npcs/hazmatBroomLeft.png', '/levels/npcs/hazmatBroomRight.png'],
  // where the boots are in each pose's image, in its pixels: each pose is placed by them, so the feet stay put as they swap
  poseFeet: {
    '/levels/npcs/hazmatBroomLeft.png': { width: 64, height: 103, feetX: 44.5, feetY: 93 },
    '/levels/npcs/hazmatBroomRight.png': { width: 63, height: 110, feetX: 19, feetY: 91 }
  },
  strokeSeconds: 0.55 // each pose is held this long
};

const sweepSwap = keyframes`
  0%, 49.9% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

// a recruit's glowing outline comes on when they touch a Kaiju part
const NpcElement = styled(ImageElement)`
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  transition: filter 0.8s;
`;

// each pose is on for one stroke and off for the next. the second starts a stroke later, so only one shows at a time.
const SweepPoseElement = styled(NpcElement)`
  animation: ${sweepSwap} ${SWEEP_LOOK.strokeSeconds * 2}s step-end infinite;
`;

const SPEECH_LOOK = {
  pixel: 4, // the size of one art pixel, in scene pixels
  cornerSteps: 3,
  outlineColor: "#101018",
  fillColor: "#fbfbf0",
  labelColor: "#ffe600",
  width: 470,
  tailOffset: 59, // from where the balloon is placed to the tip of its tail
  flippedTailOffset: 103
};

const speechPop = keyframes`
  0% { transform: translate(-22%, -100%) scale(0.6); }
  60% { transform: translate(-22%, -100%) scale(1.08); }
  100% { transform: translate(-22%, -100%) scale(1); }
`;

// placed and sized from outside: the pop inside of it has its own transform
const SpeechAnchor = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  transform-origin: 0 0;
`;

const SpeechBubbleElement = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: ${SPEECH_LOOK.width}px;
  pointer-events: none;
  transform-origin: 22% 100%;
  animation: ${speechPop} 0.24s steps(3) both;
`;

const SpeechLayer = styled.div`
  position: absolute;
  inset: 0;
`;

const SpeechContent = styled.div`
  position: relative;
  padding: 26px 20px 20px;
  font-family: gameboy;
  font-size: 27px;
  line-height: 1.45;
  text-transform: uppercase;
  color: ${SPEECH_LOOK.outlineColor};
`;

const SpeechLabel = styled.div`
  position: absolute;
  left: 14px;
  top: -14px;
  padding: 5px 9px;
  font-family: gameboy;
  font-size: 13px;
  color: ${SPEECH_LOOK.outlineColor};
  background: ${SPEECH_LOOK.labelColor};
  border: ${SPEECH_LOOK.pixel}px solid ${SPEECH_LOOK.outlineColor};
`;

const SpeechTail = styled.div`
  position: absolute;
  left: 44px;
  top: calc(100% - ${SPEECH_LOOK.pixel}px);
  width: 36px;
  height: 32px;
`;

// a shape with stair-stepped corners, like pixel art. 'inset' pulls it in from the box it fills.
const getPixelBox = inset => {
  const { pixel, cornerSteps } = SPEECH_LOOK;
  const near = value => `${inset + value}px`;
  const far = value => `calc(100% - ${inset + value}px)`;
  const stair = Array.from({ length: cornerSteps }, (_, step) => [
    [step * pixel, (cornerSteps - step) * pixel],
    [(step + 1) * pixel, (cornerSteps - step) * pixel]
  ]).flat();
  stair.push([cornerSteps * pixel, 0]);
  const corner = (getX, getY, points) => points.map(([x, y]) => `${getX(x)} ${getY(y)}`);
  return `polygon(${[
    ...corner(near, near, stair),
    ...corner(far, near, [...stair].reverse()),
    ...corner(far, far, stair),
    ...corner(near, far, [...stair].reverse())
  ].join(", ")})`;
};

// a stepped wedge pointing down at whoever is talking
const getPixelTail = inset => {
  const steps = [[0, 0], [100, 0], [100, 25], [75, 25], [75, 50], [50, 50], [50, 75], [25, 75], [25, 100], [0, 100]];
  return `polygon(${steps.map(([x, y]) => `calc(${x}% ${x > 50 ? "-" : "+"} ${inset}px) calc(${y}% ${y > 50 ? "-" : "+"} ${inset}px)`).join(", ")})`;
};

// the letters still to come take up their space, so the words don't jump to a new line as they type
const TypedText = ({ text }) => {
  const [letterCount, setLetterCount] = useState(0);

  useEffect(() => {
    setLetterCount(0);
    const interval = setInterval(() => setLetterCount(count => {
      if (count >= text.length) clearInterval(interval);
      return count + 1;
    }), SPEECH_TIMING.typeMsPerLetter);
    return () => clearInterval(interval);
  }, [text]);

  return <>{text.slice(0, letterCount)}<span style={{ visibility: "hidden" }}>{text.slice(letterCount)}</span></>;
};

// where a balloon reaches on screen, from the spot its tail points at, in screen pixels at 'screenScale'.
// the camera uses it to keep the whole balloon in the shot.
const SPEECH_FIT = { lineChars: 15, linePx: 39, paddingPx: 46, popShift: 0.22 };
export const getSpeechScreenBox = ({ text, lines, isFlipped = false }, screenScale) => {
  const { width, tailOffset, flippedTailOffset } = SPEECH_LOOK;
  if (!text) text = lines.reduce((longest, line) => line.length > longest.length ? line : longest, "");
  const height = SPEECH_FIT.paddingPx + Math.ceil(text.length / SPEECH_FIT.lineChars) * SPEECH_FIT.linePx;
  const left = (isFlipped ? flippedTailOffset + 80 - width : tailOffset) - width * SPEECH_FIT.popShift;
  return { left: left * screenScale, right: (left + width) * screenScale, top: (-32 - height) * screenScale, bottom: -32 * screenScale };
};

// after Jet Set Radio Future's comic balloons, drawn in pixels
// soft edges: the element fades out over its last 'px' on every side, so a cut-out blends into the scene around it
const getFeatherMask = px => {
  const fade = side => `linear-gradient(to ${side}, transparent 0, black ${px}px, black calc(100% - ${px}px), transparent 100%)`;
  const mask = `${fade("right")}, ${fade("bottom")}`;
  return { WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: "source-in", maskComposite: "intersect" };
};

export const SpeechBalloon = ({ name, text, x, y, zIndex, scale = 1, isFlipped = false }) => {
  const { pixel, outlineColor, fillColor, tailOffset, flippedTailOffset } = SPEECH_LOOK;
  const getLayer = (background, shape) => <SpeechLayer style={{ background, clipPath: shape }} />;
  return (
    <SpeechAnchor style={{ left: `${x + (isFlipped ? flippedTailOffset : tailOffset) * scale}px`, top: `${y - 32 * scale}px`, zIndex, transform: `scale(${scale})` }}>
      <SpeechBubbleElement key={text} style={isFlipped ? { left: `${80 - SPEECH_LOOK.width}px` } : undefined}>
        {getLayer(outlineColor, getPixelBox(0))}
        {getLayer(fillColor, getPixelBox(pixel))}
        {/* flipped, the tail is mirrored too: it leans out to the right, toward a speaker off that side */}
        <SpeechTail style={isFlipped ? { left: "auto", right: "44px", transform: "scaleX(-1)" } : undefined}>
          {getLayer(outlineColor, getPixelTail(0))}
          {getLayer(fillColor, getPixelTail(pixel))}
        </SpeechTail>
        <SpeechLabel>{name}</SpeechLabel>
        <SpeechContent><TypedText text={text} /></SpeechContent>
      </SpeechBubbleElement>
    </SpeechAnchor>
  );
};

// words a page at a time: each page held for as long as it takes to read, then round again
export const PagedSpeechBalloon = ({ lines, ...props }) => {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timeoutRef = setTimeout(() => setLineIndex((lineIndex + 1) % lines.length), getSpeechMs(lines[lineIndex]));
    return () => clearTimeout(timeoutRef);
  }, [lines, lineIndex]);

  return <SpeechBalloon {...props} text={lines[lineIndex % lines.length]} />;
};

const SpeechBubble = ({ element, style }) => {
  const { lines, x, y } = element;
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timeoutRef = setTimeout(() => setLineIndex((lineIndex + 1) % lines.length), getSpeechMs(lines[lineIndex]));
    return () => clearTimeout(timeoutRef);
  }, [lines, lineIndex]);

  if (style.opacity === 0) return null; // paused: only the word "Paused" shows
  return <SpeechBalloon name={element.name || "Agent"} text={lines[lineIndex]} x={x} y={y} zIndex={style.zIndex} />;
};

const doorPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 4px #101018, 0 0 12px white; }
  50% { box-shadow: 0 0 0 4px #101018, 0 0 30px white; }
`;

const DoorElement = styled.button`
  position: absolute;
  pointer-events: none;
  border: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  transform: translate(-50%, -100%);
  font-family: gameboy;
  font-size: 16px;
  white-space: nowrap;
  color: #101018;
  background: ${SPEECH_LOOK.fillColor};
  animation: ${doorPulse} 1.6s ease-in-out infinite;
`;

const DoorIcon = styled.i`
  font-size: 38px;
`;

const WALKER_LOOK = {
  cellWidth: 1673 / 11,
  cellHeight: 230,
  feetX: 77, // the middle of the feet, in a cell
  feetY: 180,
  figureHeight: 138,
  rightRow: 1,
  leftRow: 3,
  frames: 10,
  fps: 10
};

const WalkerSprite = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  transform-origin: 0 0;
`;

// runs along its route and idles at each spot that isn't marked to pass through.
// moved here each frame, as its size and its place in the draw order change with the depth of the scene.
const WalkerElement = ({ element, level, isPaused }) => {
  const { src, route, runSpeed, idleSeconds } = element;
  const ref = useRef(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    const { cellWidth, cellHeight, feetX, feetY, figureHeight, rightRow, leftRow, frames, fps } = WALKER_LOOK;
    // each leg: run to the next spot, at a steady speed, then idle there unless it is passed through
    const legs = route.map((start, k) => {
      const end = route[(k + 1) % route.length];
      const runSeconds = Math.hypot(end[0] - start[0], end[1] - start[1]) / runSpeed;
      return { start, end, runSeconds, seconds: runSeconds + (end[3] ? 0 : idleSeconds) };
    });
    const loopSeconds = legs.reduce((total, { seconds }) => total + seconds, 0);
    let frameRef;
    const draw = nowMs => {
      frameRef = requestAnimationFrame(draw);
      if (isPausedRef.current || !ref.current) return;
      let legTime = (nowMs / 1000) % loopSeconds;
      let legIndex = 0;
      while (legIndex < legs.length - 1 && legTime >= legs[legIndex].seconds) {
        legTime -= legs[legIndex].seconds;
        legIndex += 1;
      }
      const { start, end, runSeconds } = legs[legIndex];
      const isRunning = legTime < runSeconds;
      const progress = Math.min(legTime / runSeconds, 1);
      const [x, y, height] = start.map((value, n) => value + (end[n] - value) * progress);
      const frame = isRunning ? 1 + Math.floor((nowMs / 1000) * fps) % frames : 0;
      const scale = height / figureHeight;
      ref.current.style.transform = `translate(${x - feetX * scale}px, ${y - feetY * scale}px) scale(${scale})`;
      ref.current.style.backgroundPosition = `${-frame * cellWidth}px ${-(end[0] > start[0] ? rightRow : leftRow) * cellHeight}px`;
      ref.current.style.zIndex = getSortZIndex(level, y);
    };
    frameRef = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef);
  }, [element, level]);

  return <WalkerSprite ref={ref} style={{ width: `${WALKER_LOOK.cellWidth}px`, height: `${WALKER_LOOK.cellHeight}px`, backgroundImage: `url(${src})`, zIndex: getSortZIndex(level, route[0][1]) }} />;
};

const hotspotPulse = keyframes`
  0%, 100% { filter: drop-shadow(0 0 2px white); }
  50% { filter: drop-shadow(0 0 9px white) drop-shadow(0 0 3px white); }
`;

const HotspotOutline = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  image-rendering: pixelated;
  animation: ${hotspotPulse} 1.6s ease-in-out infinite;
`;

const HotspotElement = styled.button`
  position: absolute;
  padding: 0;
  cursor: pointer;
  background: none;
  border: 0;
`;

// a label is kept inside the scene: a tank at the art's very edge would push half of it off
const LABEL_LETTER_PX = 16; // the pixel font at 18px, with its spacing and the plate's padding
const getLabelX = (x, label = "", worldWidth) => {
  const half = (label.length * LABEL_LETTER_PX + 24) / 2 + 8;
  return Math.min(Math.max(x, half), worldWidth - half);
};

// the pieces start at 20001 (GameBoardPieceComponent): just under them
const HOTSPOT_OUTLINE_Z = 20000;

// a walking scene's hotspots in view, in order: each has a number, and its number key clicks it (Jamie)
export const getActiveHotspots = (level, activePhases) => (level.sceneElements || []).filter(({ type, phase, hidePhase }) =>
  type == "hotspot" && (!phase || activePhases.includes(phase)) && !(hidePhase && activePhases.includes(hidePhase)));

// a map site's one word (MAP_LABELS): small, light, outlined, readable over the map
const MapLabel = styled.div`
  position: absolute;
  transform: translate(-50%, ${props => props.$isOver ? "-100%" : "0"});
  pointer-events: none;
  font-family: gameboy;
  font-size: 11px;
  text-transform: uppercase;
  white-space: nowrap;
  color: #f2f6ff;
  text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black, 0 0 4px black;
`;

const HotspotKey = styled.span`
  display: inline-block;
  margin-right: 8px;
  padding: 0 5px;
  color: #101018;
  background: #ffd23f;
  box-shadow: 1px 1px 0 black;
`;

const HotspotLabel = styled.div`
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: gameboy;
  font-size: 18px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
  color: white;
  /* on a dark plate, so it reads over the bright lab */
  padding: 4px 8px;
  background: rgba(8, 10, 14, 0.82);
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 2px 2px 0 black;
  text-shadow: 2px 2px 0 black;
`;

// 'isDialogueLog': a scene's speech goes to the log beside the monitor instead
export const SceneElements = ({ level, activePhases, isPaused, onHotspot, isDialogueLog = false, isSettled = false }) => (
  <>
    {level.sceneElements.map(element => {
      const {
        id, type, src, phase, x, y, width, height, zIndex, fps, frames, firstFrame = 0, sheetFrames,
        seconds, delaySeconds = 0, lowOpacity, highOpacity, flip = 1, flutterSeconds, blend, dimPhase, fadeSeconds,
        sortY, comesFrom, appearSeconds
      } = element;
      const isActive = !phase || activePhases.includes(phase);
      const isDimmed = !!dimPhase && activePhases.includes(dimPhase);
      const style = {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: isPaused ? 0 : undefined,
        mixBlendMode: blend,
        animationPlayState: isPaused ? "paused" : "running",
        zIndex: sortY !== undefined ? getSortZIndex(level, sortY) : zIndex
      };

      // always mounted: a train has to play its way out after its phase ends
      if (type == "sequence") return <SequenceCanvas key={id} element={element} isActive={isActive} isPaused={isPaused} style={element.featherPx ? { ...style, ...getFeatherMask(element.featherPx) } : style} />;
      if (type == "whiteout") {
        return <WhiteoutElement key={id} style={{
          ...style,
          opacity: isActive ? 1 : 0,
          transition: isActive ? `opacity ${PART_CRESCENDO.whiteoutSeconds}s ease-in ${PART_CRESCENDO.whiteoutDelaySeconds}s` : "none"
        }} />;
      }
      if (!isActive || activePhases.includes(element.hidePhase)) return null;

      const spriteStyle = {
        ...style,
        backgroundImage: `url(${src})`,
        backgroundSize: sheetFrames ? `${sheetFrames * width}px ${height}px` : undefined,
        transform: flip == -1 ? "scaleX(-1)" : undefined,
        "--from-x": `${-firstFrame * width}px`,
        "--to-x": `${-(firstFrame + frames) * width}px`
      };

      if (type == "npc") {
        const isGlowing = activePhases.includes(element.glowPhase);
        const npcStyle = {
          ...style,
          width: "auto",
          top: `${y - height}px`,
          filter: isGlowing ? `drop-shadow(0 0 4px ${element.glowColor}) drop-shadow(0 0 10px ${element.glowColor})` : "none"
        };
        if (!element.isSweeping) return <NpcElement key={id} src={src} style={npcStyle} />;
        // the sweepers start on different poses, so they don't sweep in step
        const otherPose = SWEEP_LOOK.poses.find(pose => pose != src) || src;
        return (
          <React.Fragment key={id}>
            {[src, otherPose].map((pose, k) => {
              const { width, height, feetX, feetY } = SWEEP_LOOK.poseFeet[pose];
              const scale = element.height / feetY; // the figure stands as tall as its spot says, top of the head to the boots
              return (
              <SweepPoseElement key={pose} src={pose} style={{
                ...npcStyle,
                left: `${x - feetX * scale}px`,
                top: `${y - feetY * scale}px`,
                width: `${width * scale}px`,
                height: `${height * scale}px`,
                transform: "none",
                animationDelay: `${-k * SWEEP_LOOK.strokeSeconds}s`,
                animationPlayState: isPaused ? "paused" : "running"
              }} />
              );
            })}
          </React.Fragment>
        );
      }
      if (type == "walker") return <WalkerElement key={id} element={element} level={level} isPaused={isPaused} />;
      if (type == "hotspot") {
        return (
          <React.Fragment key={id}>
            {/* the outline is under everyone standing in the scene; its label stays over them */}
            <HotspotOutline src={element.outline} style={{ zIndex: HOTSPOT_OUTLINE_Z }} />
            <HotspotLabel style={{ left: `${getLabelX(x + width / 2, element.label, level.world.width)}px`, top: `${element.labelY || y - 14}px`, zIndex: style.zIndex }}>
              <span><HotspotKey>{getActiveHotspots(level, activePhases).indexOf(element) + 1}</HotspotKey>{element.label}</span>
              <i className="fa fa-caret-down" />
            </HotspotLabel>
            <HotspotElement
              data-scene-button
              aria-label={element.label}
              style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, zIndex: style.zIndex, transform: `rotate(${element.rotate || 0}deg)` }}
              onClick={() => onHotspot(element.action)}
            />
          </React.Fragment>
        );
      }
      // a map site's word, under (or over) its icon
      if (type == "mapLabel") return <MapLabel key={id} $isOver={element.isOver} style={{ left: `${x}px`, top: `${y}px`, zIndex: style.zIndex }}>{element.text}</MapLabel>;
      if (type == "door") {
        // a sign, not a button: the team has to walk there
        return <DoorElement key={id} as="div" style={{ left: `${x}px`, top: `${y}px`, zIndex: style.zIndex }}><DoorIcon className="fa fa-sign-out" />{element.label}</DoorElement>;
      }
      if (type == "speech") return isDialogueLog ? null : <SpeechBubble key={id} element={element} style={style} />;
      if (type == "part") {
        const part = <KaijuPart key={id} element={element} activePhases={activePhases} style={style} isSettled={isSettled} />;
        if (!element.overFront) return part;
        // where the part overlaps a foreground layer, a copy of that piece of it is drawn over the layer (one or several)
        const fronts = Array.isArray(element.overFront) ? element.overFront : [element.overFront];
        return (
          <React.Fragment key={id}>
            {part}
            {fronts.map(({ box: [left, top, right, bottom], sortY: frontSortY }, k) => {
              const clipPath = `inset(${top - y}px ${x + width - right}px ${y + height - bottom}px ${left - x}px)`;
              return <KaijuPart key={k} element={element} activePhases={activePhases} isSettled={isSettled} isCopy style={{ ...style, zIndex: getSortZIndex(level, frontSortY), clipPath, pointerEvents: "none" }} />;
            })}
          </React.Fragment>
        );
      }
      if (type == "moth") {
        return <MothElement key={id} style={{
          ...spriteStyle,
          transform: undefined,
          "--frames": frames,
          "--flip": flip,
          "--wing-seconds": `${frames / fps}s`,
          "--flutter-seconds": `${flutterSeconds}s`,
          animationDelay: `${delaySeconds}s`
        }} />;
      }
      if (type == "sprite") {
        const sprite = <SpriteElement key={id} style={{
          ...spriteStyle,
          ...(comesFrom ? { left: 0, top: 0, zIndex: undefined } : {}),
          animationDuration: `${frames / fps}s`,
          animationDelay: `${delaySeconds}s`,
          animationTimingFunction: `steps(${frames})`
        }} />;
        if (!comesFrom) return sprite;
        return <FishLeap key={id} style={{
          ...style,
          animationDelay: `${appearSeconds}s`,
          "--from-x": `${comesFrom.x - x - width / 2}px`,
          "--from-y": `${comesFrom.y - y - height / 2}px`
        }}>{sprite}</FishLeap>;
      }
      if (type == "pulse") {
        return <PulsingImageElement key={id} src={src} $isUneven={element.isUneven} $isHaunting={element.isHaunting} style={{
          ...style,
          filter: isDimmed ? "grayscale(0.85) brightness(0.65)" : undefined,
          "--low-opacity": isDimmed ? lowOpacity * 0.5 : lowOpacity,
          "--high-opacity": isDimmed ? highOpacity * 0.5 : highOpacity,
          animationDuration: `${seconds}s`,
          animationDelay: `${delaySeconds}s`
        }} />;
      }
      if (type == "light") {
        return <LightElement key={id} style={{
          ...style,
          background: `radial-gradient(closest-side, ${element.color}, transparent)`,
          "--low-opacity": lowOpacity,
          "--high-opacity": highOpacity,
          animationDuration: `${seconds}s`,
          animationDelay: `${delaySeconds}s`
        }} />;
      }
      if (fadeSeconds) {
        return <FadingImageElement key={id} src={src} style={{ ...style, animationDuration: `${fadeSeconds}s`, animationDelay: `${delaySeconds}s` }} />;
      }
      return <ImageElement key={id} src={src} style={style} />;
    })}
  </>
);
