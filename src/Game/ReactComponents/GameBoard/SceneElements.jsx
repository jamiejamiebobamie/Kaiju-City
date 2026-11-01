import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { getSortZIndex } from "Game/DataClasses/Levels/levels";

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

// over everything, including the HUDs and the edges of the screen
const ScreenFlash = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2147483647;
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
const KaijuPart = ({ element, activePhases, style }) => {
  const { src, width, height, seconds, delaySeconds = 0, touchPhase, brightPhase, flashColor, glowColor } = element;
  const isTouched = !!touchPhase && activePhases.includes(touchPhase);
  const isBright = !!brightPhase && activePhases.includes(brightPhase);
  const [isGone, setIsGone] = useState(false);
  useEffect(() => setIsGone(false), [isTouched]);

  const layerStyle = {
    backgroundImage: `url(${src})`,
    "--frame-width": `${width}px`,
    width: `${width}px`,
    height: `${height}px`
  };
  const glowSize = Math.max(width, height) * PART_CRESCENDO.glowSize;

  const getPart = () => {
    if (isBright) {
      return <>
        <PartGlowSwell style={{
          width: `${glowSize}px`,
          height: `${glowSize}px`,
          background: `radial-gradient(circle, ${glowColor} 0%, ${glowColor} 25%, transparent 70%)`
        }} />
        <PartCrescendoFrames style={layerStyle} />
      </>;
    }
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
      {isTouched && !!flashColor && createPortal(<ScreenFlash style={{ background: flashColor }} />, document.body)}
    </>
  );
};

// a recruit's glowing outline comes on when they touch a Kaiju part
const NpcElement = styled(ImageElement)`
  transform: translateX(-50%);
  transition: filter 0.8s;
`;

const SPEECH_LOOK = {
  pixel: 4, // the size of one art pixel, in scene pixels
  cornerSteps: 3,
  outlineColor: "#101018",
  fillColor: "#fbfbf0",
  labelColor: "#ffe600",
  width: 290
};

const speechPop = keyframes`
  0% { transform: translate(-22%, -100%) scale(0.6); }
  60% { transform: translate(-22%, -100%) scale(1.08); }
  100% { transform: translate(-22%, -100%) scale(1); }
`;

const SpeechBubbleElement = styled.div`
  position: absolute;
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
  font-size: 15px;
  line-height: 1.5;
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

// after Jet Set Radio Future's comic balloons, drawn in pixels
const SpeechBubble = ({ element, style }) => {
  const { lines, seconds, x, y } = element;
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setLineIndex(index => (index + 1) % lines.length), seconds * 1000);
    return () => clearInterval(interval);
  }, [lines, seconds]);

  const { pixel, outlineColor, fillColor } = SPEECH_LOOK;
  const getLayer = (background, shape) => <SpeechLayer style={{ background, clipPath: shape }} />;
  return (
    <SpeechBubbleElement key={lineIndex} style={{ left: `${x}px`, top: `${y - 32}px`, zIndex: style.zIndex, width: `${SPEECH_LOOK.width}px`, height: "auto" }}>
      {getLayer(outlineColor, getPixelBox(0))}
      {getLayer(fillColor, getPixelBox(pixel))}
      <SpeechTail>
        {getLayer(outlineColor, getPixelTail(0))}
        {getLayer(fillColor, getPixelTail(pixel))}
      </SpeechTail>
      <SpeechLabel>Agent</SpeechLabel>
      <SpeechContent>{lines[lineIndex]}</SpeechContent>
    </SpeechBubbleElement>
  );
};

export const SceneElements = ({ level, activePhases, isPaused }) => (
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
      if (type == "sequence") return <SequenceCanvas key={id} element={element} isActive={isActive} isPaused={isPaused} style={style} />;
      if (type == "whiteout") {
        return <WhiteoutElement key={id} style={{
          ...style,
          opacity: isActive ? 1 : 0,
          transition: isActive ? `opacity ${PART_CRESCENDO.whiteoutSeconds}s ease-in ${PART_CRESCENDO.whiteoutDelaySeconds}s` : "none"
        }} />;
      }
      if (!isActive) return null;

      const spriteStyle = {
        ...style,
        backgroundImage: `url(${src})`,
        backgroundSize: sheetFrames ? `${sheetFrames * width}px ${height}px` : undefined,
        transform: flip == -1 ? "scaleX(-1)" : undefined,
        "--from-x": `${-firstFrame * width}px`,
        "--to-x": `${-(firstFrame + frames) * width}px`
      };

      if (type == "npc") {
        if (activePhases.includes(element.hidePhase)) return null;
        const isGlowing = activePhases.includes(element.glowPhase);
        return <NpcElement key={id} src={src} style={{
          ...style,
          width: "auto",
          top: `${y - height}px`,
          filter: isGlowing ? `drop-shadow(0 0 4px ${element.glowColor}) drop-shadow(0 0 10px ${element.glowColor})` : "none"
        }} />;
      }
      if (type == "speech") return <SpeechBubble key={id} element={element} style={style} />;
      if (type == "part") return <KaijuPart key={id} element={element} activePhases={activePhases} style={style} />;
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
