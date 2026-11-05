import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { PIECES_INFO } from "Utils/gameState";
import { SpeechBalloon } from "Game/ReactComponents/GameBoard/SceneElements";
import { getDialogueLine } from "Game/DataClasses/Dialogue/dialogue";

// what the Lab Tech says as the color takes (Dialogue/dialogue.json)
const VAT_PRAISE = getDialogueLine('labIntro.vatPraise');

/*
  The Lab's color screen. The avatar hangs over a vat of light. Pick a color, and irradiate them:
  they are lowered in, and come back up glowing that color.
*/
const VAT_LOOK = {
  dunkMs: 900,
  holdMs: 500,
  praiseMs: 2800, // how long the off-screen voice's words stay up
  praiseBaseWidth: 1600, // the screen width its balloon is drawn for
  praiseScale: 1.8, // and this much bigger than that
  praisePan: "-7%" // the scene slides left as they speak: they are off to the right
};

const hsvToHex = (hue, saturation, value) => {
  const getChannel = shift => {
    const k = (shift + hue / 60) % 6;
    const channel = value - value * saturation * Math.max(Math.min(k, 4 - k, 1), 0);
    return Math.round(channel * 255).toString(16).padStart(2, "0");
  };
  return `#${getChannel(5)}${getChannel(3)}${getChannel(1)}`;
};

const hexToHsv = hex => {
  const [r, g, b] = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  const hue = !range ? 0 : max == r ? ((g - b) / range + 6) % 6 : max == g ? (b - r) / range + 2 : (r - g) / range + 4;
  return { hue: Math.round(hue * 60), saturation: max ? range / max : 0, value: max };
};

// where the fluid spills over the brim of the vat, in percent of the screen
const DRIPS = [[23, 1, 9, 2.3], [31, 0.7, 14, 3.1], [38, 1.3, 7, 1.9], [47, 0.8, 16, 3.7], [56, 1.1, 10, 2.6], [63, 0.7, 13, 3.3], [71, 1.2, 8, 2.1], [76, 0.8, 12, 2.9]];
const BUBBLES = [[25, 0.9, 1.7, 0], [33, 0.6, 2.3, 0.8], [41, 1.1, 1.9, 0.3], [50, 0.7, 2.6, 1.2], [58, 1, 2.1, 0.5], [66, 0.6, 1.8, 1.5], [74, 0.9, 2.4, 0.2]];
const FOAM = Array.from({ length: 30 }, (_, n) => [21 + n * 1.97, 0.7 + (n * 7 % 5) * 0.16]);

const dripFall = keyframes`
  0% { transform: scaleY(0.25); }
  70% { transform: scaleY(1); }
  100% { transform: scaleY(0.8); }
`;

const bubbleRise = keyframes`
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(-14cqh) scale(1.1); opacity: 0; }
`;

const foamBob = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.35cqw); }
`;

const Drip = styled.div`
  position: absolute;
  top: 71%;
  transform-origin: 50% 0;
  background: var(--vat-color);
  box-shadow: inset 0.15cqw 0 0 rgba(255, 255, 255, 0.4);
  animation: ${dripFall} ease-in-out infinite alternate;
`;

const Bubble = styled.div`
  position: absolute;
  top: 70%;
  background: var(--vat-color);
  box-shadow: inset 0.12cqw 0.12cqw 0 rgba(255, 255, 255, 0.7);
  animation: ${bubbleRise} linear infinite;
`;

const Foam = styled.div`
  position: absolute;
  top: 69.6%;
  background: var(--vat-color);
  box-shadow: inset 0.1cqw 0.1cqw 0 rgba(255, 255, 255, 0.6);
  animation: ${foamBob} 1.3s ease-in-out infinite;
`;

const beamFlicker = keyframes`
  0%, 100% { opacity: 0.9; }
  40% { opacity: 1; }
  70% { opacity: 0.8; }
`;

// on the monitor's screen, like everything in the game. sizes are fractions of the screen (cqw, cqh).
const Page = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482980;
  container-type: size;
  border-radius: 1.8cqw;
  overflow: hidden;
  background: black;
  font-family: gameboy;
  color: #d9dade;
`;

const Layer = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

// straight, hard edged beams rising out of the vat
const Beams = styled.div`
  position: absolute;
  left: 22%;
  right: 22%;
  top: 42%;
  height: 36%;
  pointer-events: none;
  mix-blend-mode: screen;
  background:
    repeating-linear-gradient(90deg, var(--vat-color) 0 0.5cqw, transparent 0.5cqw 1.1cqw, var(--vat-color) 1.1cqw 1.3cqw, transparent 1.3cqw 3.2cqw);
  -webkit-mask-image: linear-gradient(to top, black 10%, transparent 100%);
  mask-image: linear-gradient(to top, black 10%, transparent 100%);
  animation: ${beamFlicker} 0.3s steps(3) infinite;
`;

const Glow = styled.div`
  position: absolute;
  left: 12%;
  right: 12%;
  top: 48%;
  height: 40%;
  pointer-events: none;
  mix-blend-mode: screen;
  background: radial-gradient(closest-side, var(--vat-color), transparent);
`;

const Hanging = styled.div`
  position: absolute;
  left: 50%;
  top: 0;
  width: 0;
  height: 60%;
  transition: transform ${VAT_LOOK.dunkMs}ms ease-in-out;
`;

const Cable = styled.div`
  position: absolute;
  left: -0.15cqw;
  bottom: 12cqw;
  width: 0.3cqw;
  height: 100cqh;
  background: linear-gradient(90deg, #1b1c20, #6a6d74, #1b1c20);
`;

const Figure = styled.div`
  position: absolute;
  left: -76px;
  bottom: -2cqw;
  width: 152px;
  height: 230px;
  transform: scale(2);
  transform-origin: 50% 100%;
  background-position: 0 -460px;
  background-repeat: no-repeat;
`;

// the room, which slides a little as the off-screen voice speaks
const Scene = styled.div`
  position: absolute;
  inset: 0;
  transition: transform 0.7s ease-in-out;
`;

const Heading = styled.div`
  position: absolute;
  top: 2cqw;
  left: 0;
  right: 0;
  font-size: 1.6cqw;
  text-align: center;
  text-shadow: 0 0 0.4cqw black;
`;

// from someone off to the right
const PraiseSpot = styled.div`
  position: absolute;
  left: 86%;
  top: 46%;
  width: 0;
  height: 0;
`;

const Panel = styled.div`
  position: absolute;
  top: 6cqw;
  right: 6cqw;
  width: 27cqw;
  z-index: 2147483640;
  display: flex;
  flex-direction: column;
  gap: 1.4cqw;
  padding: 1.4cqw;
  font-family: gameboy;
  background: linear-gradient(#3a3c42, #1c1d21);
  border: 0.15cqw solid #8d9097;
  box-shadow: 0 0 2cqw black;
`;

const Picker = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1cqw;
`;

const ColorField = styled.div`
  position: relative;
  height: 20cqw;
  cursor: crosshair;
  touch-action: none;
  background: linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent);
`;

const Cursor = styled.div`
  position: absolute;
  width: 0.7cqw;
  height: 0.7cqw;
  transform: translate(-50%, -50%);
  border: 0.12cqw solid white;
  border-radius: 50%;
  box-shadow: 0 0 0 0.08cqw black;
  pointer-events: none;
`;

const HueSlider = styled.input`
  width: 100%;
  height: 1.6cqw;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
`;

const HexInput = styled.input`
  padding: 0.5cqw;
  font-family: gameboy;
  font-size: 1.1cqw;
  color: #d9dade;
  background: #111214;
  border: 0.1cqw solid #5a5d64;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8cqw;
`;

const ActionButton = styled.button`
  padding: 1cqw;
  font-family: gameboy;
  font-size: ${props => props.$isMain ? "1.4cqw" : "1.1cqw"};
  cursor: pointer;
  color: ${props => props.$isMain ? "#0b0c0e" : "#d9dade"};
  background: ${props => props.$isMain ? "#d9dade" : "#26282c"};
  border: 0.12cqw solid #8d9097;
  flex-grow: ${props => props.$isMain ? 1 : 0};
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

export const IrradiationVat = ({ avatar, startColor, onIrradiate, onClose }) => {
  const fieldRef = useRef(null);
  const firstColor = startColor || PIECES_INFO[avatar].color; // whatever color they are now
  const [hue, setHue] = useState(() => hexToHsv(firstColor).hue);
  const [spot, setSpot] = useState(() => hexToHsv(firstColor));
  const [color, setColor] = useState(firstColor);
  const [avatarColor, setAvatarColor] = useState(startColor);
  const [isDunked, setIsDunked] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isPraising, setIsPraising] = useState(false);

  const moveSpot = ({ clientX, clientY, buttons }) => {
    if (!buttons) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const saturation = Math.max(Math.min((clientX - rect.left) / rect.width, 1), 0);
    const value = 1 - Math.max(Math.min((clientY - rect.top) / rect.height, 1), 0);
    setSpot({ saturation, value });
    setColor(hsvToHex(hue, saturation, value));
  };

  const changeHue = nextHue => {
    setHue(nextHue);
    setColor(hsvToHex(nextHue, spot.saturation, spot.value));
  };

  const irradiate = () => {
    setIsBusy(true);
    setIsDunked(true);
    setIsPraising(false);
    setTimeout(() => {
      setAvatarColor(color);
      onIrradiate(color);
      setIsDunked(false);
    }, VAT_LOOK.dunkMs + VAT_LOOK.holdMs);
    setTimeout(() => {
      setIsBusy(false);
      setIsPraising(true);
    }, VAT_LOOK.dunkMs * 2 + VAT_LOOK.holdMs);
    setTimeout(() => setIsPraising(false), VAT_LOOK.dunkMs * 2 + VAT_LOOK.holdMs + VAT_LOOK.praiseMs);
  };

  return createPortal(
    <Page style={{ "--vat-color": color }}>
      <Scene style={{ transform: isPraising ? `translateX(${VAT_LOOK.praisePan})` : "none" }}>
      <Layer src="/levels/vat-room.png" />
      <Beams />
      <Glow />
      <Hanging style={{ transform: isDunked ? "translateY(52cqh)" : "none" }}>
        <Cable />
        <Figure style={{ backgroundImage: `url(/${PIECES_INFO[avatar].spriteSheetSrc})`, filter: avatarColor ? `drop-shadow(0 0 12px ${avatarColor}) drop-shadow(0 0 3px ${avatarColor})` : "none" }} />
      </Hanging>
      <Layer src="/levels/vat-front.png" />
      {FOAM.map(([left, size], index) => (
        <Foam key={index} style={{ left: `${left}%`, width: `${size}cqw`, height: `${size}cqw`, animationDelay: `${-index * 0.17}s` }} />
      ))}
      {DRIPS.map(([left, width, height, seconds]) => (
        <Drip key={left} style={{ left: `${left}%`, width: `${width}cqw`, height: `${height}%`, animationDuration: `${seconds}s` }} />
      ))}
      {BUBBLES.map(([left, size, seconds, delay]) => (
        <Bubble key={left} style={{ left: `${left}%`, width: `${size}cqw`, height: `${size}cqw`, animationDuration: `${seconds}s`, animationDelay: `${delay}s` }} />
      ))}
      </Scene>
      <Heading>Choose Color</Heading>
      {isPraising && <PraiseSpot><SpeechBalloon name={VAT_PRAISE.name} text={VAT_PRAISE.text} x={0} y={0} isFlipped scale={(document.querySelector("[data-play-screen]") || document.body).clientWidth / VAT_LOOK.praiseBaseWidth * VAT_LOOK.praiseScale} /></PraiseSpot>}
      {createPortal(<Panel>
        <Picker>
          <ColorField
            ref={fieldRef}
            aria-label="Color"
            style={{ backgroundColor: hsvToHex(hue, 1, 1) }}
            onPointerDown={moveSpot}
            onPointerMove={moveSpot}
          >
            <Cursor style={{ left: `${spot.saturation * 100}%`, top: `${(1 - spot.value) * 100}%` }} />
          </ColorField>
          <HueSlider aria-label="Hue" type="range" min="0" max="359" value={hue} onChange={e => changeHue(Number(e.target.value))} />
          <HexInput aria-label="Hex" value={color} onChange={e => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)} />
        </Picker>
        <Actions>
          <ActionButton $isMain disabled={isBusy} onClick={irradiate}>Irradiate</ActionButton>
          <ActionButton disabled={isBusy} onClick={onClose}>Back to Lab</ActionButton>
        </Actions>
      </Panel>, document.querySelector("[data-game-frame]") || document.body)}
    </Page>,
    document.querySelector("[data-play-screen]") || document.body
  );
};
