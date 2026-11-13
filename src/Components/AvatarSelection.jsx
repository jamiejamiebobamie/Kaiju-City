import React, { useState, useEffect, useRef, useContext } from "react";
import { GlobalSettingsContext } from 'Home';
import { useHover } from "Utils/utils";
import styled from "styled-components";

const AvatarSelectionWrapper = styled.div`
    position: absolute;
    flex-direction: column;
    z-index: 1;
    width: 100dvw;
    height: 300px;
    margin-top: 200px;
    align-self: center;
    display: flex;
    justify-content: space-around;

    background-color: #141518;
    border-color: #26282c;
    border-width: 1px;
    border-style: solid;
    border-bottom: 1px solid #26282c;
`;

const SpriteSheet = styled.div`
  cursor: pointer;
  ${props => !props.anim && "pointer-events: none;"}

  ${props =>
    props.gender == 'guy'
      ? 'background: url("spritesheet/player.png");'
      : 'background: url("spritesheet/teammate.png");'}

  height: 230px;
  width: 152px;

  position: absolute;
  z-index: 109;

  ${props => `filter: drop-shadow(0 0 2px color-mix(in srgb, #80EF80 calc(${props.opacity} * 100%), ${props.gender == 'guy' ? "#55AAff" : "#fa8072"}));`}

  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  transition-property: drop-shadow;
  // -webkit-transition: -webkit-transform 3s ease-in-out;

  background-position: 0 -460px;

  &:hover{
    ${props => `animation: ${props.anim} 1.2s steps(6) -.4s infinite;`}
  }
  
  @keyframes cycleThroughIdleAnims {
    to {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    from {
      background-position-x: 0px;
      background-position-y: 1380px;
    }
  }  
`;

const SpritesWrapper = styled.div`

    transform: translate(-66px, -100px);
    display: flex;
    width: 100%;
    align-self: center;
    justify-content: space-around;

    // the two stand 'spacing' apart: half the width, with space-around
    max-width: ${props => props.spacing * 2}px;
`;

const CenteredLabelsContainer = styled.div`
    display: flex;
    width: 100%;
    justify-content: center;
`;

const LabelContainer = styled.div`

    position: absolute;
    ${props => `z-index: ${props.zIndex};`}
    
    display: flex;
    align-self: center;
    width: ${props => props.spacing + 120}px;

    ${props => props.labelContent == 'Player' ? "justify-content: flex-end;" : "justify-content: flex-start;"}

    transition-property: transform, color;
    transition-duration: 1s;

    color: ${props => props.selectedGender == 'guy' && props.labelContent == 'Player' || props.selectedGender == 'girl' && props.labelContent == 'Teammate' ? "#55AAff" : "#fa8072"};
`;

const SlidingLabel = styled.span`
    display: flex;
    flex-direction: column;
    justify-content: center;

    transition-property: transform;
    transition-duration: 1s;

    ${props => props.selectedGender == 'guy' ? props.labelContent == 'Player' ? "" : "" : props.labelContent == 'Player' ? `transform: translateX(${-props.spacing}px)` : `transform: translateX(${props.spacing}px)`}
`;

const StyledIcon = styled.i`
    align-self: center;
    ${props => props.rotate && `transform: translateY(20px) rotate(${props.rotate}deg);`}
`;

const UpDownAnim = styled.div`
    animation: up-down 1s linear infinite;

    @keyframes up-down {
        0%, 100% {
            transform: translate(0px, 0px);
        }
        50% {
            transform: translate(0px, -10px);
        }
    }
`;

const TopRightBottomLeftAnim = styled.div`
    animation: top-left-bottom-right 1s linear infinite;

    @keyframes top-left-bottom-right {
        0%, 100% {
            transform: translate(0px, 0px);
        }
        50% {
            transform: translate(5px, 5px);
        }
    }
`;

export const BlinkFadeEffect = styled.div`
  animation: blink-fade-${props => `${props.time ? props.time : 5}-${props.low ? props.low : 3}-${props.high ? props.high : 59}`} ${props => props.time ? props.time / 100 : .05}s linear infinite;

  @keyframes blink-fade-${props => `${props.time ? props.time : 5}-${props.low ? props.low : 3}-${props.high ? props.high : 59}`} {
    0% {
      ${props => `opacity: ${props.low ? props.low / 100 : .3};`}
    }
    20% {
      ${props => `opacity: ${props.high ? props.high / 100 : .59};`}
    }
    80% {
      ${props => `opacity: ${props.high ? props.high / 100 : .59};`}
    }
    100% {
      ${props => `opacity: ${props.low ? props.low / 100 : .3};`}
    }   
  }
`;

const DoodadSpriteSheet = styled.div`
  position: absolute;
  ${props => props.zIndex && `z-index: ${props.zIndex};`}
  pointer-events: none;
  ${props => `background: url(${props.src});`}

  width: 344px;
  height: 256px;

  filter: drop-shadow(0 0 5px #80EF80);

  animation: cycleThroughDoodad 1s steps(4) infinite;

  @keyframes cycleThroughDoodad {
    0% {
      background-position-x: 0px;
      background-position-y: 0px;
    }                         
    100% {
      background-position-x: -1376px;
      background-position-y: 0px;
    }
  }  
`;

const GreenGraphDoodad = styled.div`
  position: absolute;

  opacity: .8;

  ${props => props.zIndex && `z-index: ${props.zIndex};`}
  pointer-events: none;
  background: url('GreenGraph.png');

  width: 123px;
  height: 194px;

  filter: drop-shadow(0 0 5px #80EF80);

  transition: transform 1.5s;
  ${props => `transform: scale(${props.scale}) translate(${props.translation});`}

  /* 'isStatic' (the character select, Jamie 2026-11-12): a bad TV signal. It crackles with snow, blurs and
     brightens in fits, and shivers a pixel in place ('translate' adds to the transform above) */
  ${props => props.$isStatic && `
    animation: gridStaticShiver 1.1s steps(1) infinite;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.28) 0 1px, transparent 1px 3px);
    }
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.6 0 0 0 0 1 0 0 0 0 0.6 0 0 0 2.2 -1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
      mix-blend-mode: screen;
      opacity: 0.3;
      animation: gridStaticSnow 0.24s steps(1) infinite;
    }
    @keyframes gridStaticShiver {
      0% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      14% { translate: 1px 0; filter: drop-shadow(0 0 5px #80EF80) blur(1.1px) brightness(1.35); }
      18% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.3px); }
      41% { translate: -1px 1px; filter: drop-shadow(0 0 4px #80EF80) blur(0.8px) brightness(0.8); }
      45% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      68% { translate: 2px 0; filter: drop-shadow(0 0 6px #80EF80) blur(1.5px) brightness(1.6); }
      71% { translate: -1px -1px; filter: drop-shadow(0 0 5px #80EF80) blur(0.6px); }
      75% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      90% { translate: 0 1px; filter: drop-shadow(0 0 5px #80EF80) blur(0.9px) brightness(1.15); }
    }
    @keyframes gridStaticSnow {
      0% { background-position: 0 0; opacity: 0.3; }
      25% { background-position: -37px 21px; opacity: 0.45; }
      50% { background-position: 19px -43px; opacity: 0.22; }
      75% { background-position: -11px 57px; opacity: 0.5; }
    }
  `}
`;

const AlignSelfCenter = styled.div`
    display: flex;
    flex-direction: column;
    align-self: center;
`;

const DoodadsWrapper = styled.div`
    position: absolute;
    ${props => `transform: translate(${props.translation});`}
`;

const StyledMsg = styled.div`
    position: absolute;
    filter: none !important;

    align-self: flex-start;

    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    width: 100%;
    max-width: 1250px;

    ${props => `color: ${props.color ? props.color : '#D1001C'};`}

    ${props => props.color && `filter: drop-shadow(0 0 5px ${props.color});`} 

    ${props => `transform: rotate(${props.rotate});`}
`;

const PopupMsg = styled.span`
    display: flex;
    width: 250px;
    text-align: end;
    font-size: 16px;

    ${props => props.textAlign && `text-align: ${props.textAlign};`}
    ${props => props.fontSize && `font-size: ${props.fontSize};`}

    margin-left: -20px;
`;

const FadeInOutEffect = styled.div`
    transition: opacity ${props => props.ms || 1000}ms;
    ${props => `opacity: ${props.opacity};`} 
`;

const DoodadTransform = styled.div`
  transition: transform ${props => props.ms || 1500}ms ${props => props.$ease || 'ease-out'}, filter 220ms;
  ${props => `transform: scale(${props.scale}) translate(${props.translation});`}
  ${props => props.$isFlash && `filter: brightness(1.9);`}
`;

/*
  A doodad's blink out (Jamie, 2026-11-12): an old TV switched off, so it reads as meant. The picture squashes to a
  bright horizontal line, the line shrinks to a dot, a sparkle flares on the dot and fades, then black. Back on, the
  same the other way, quicker. 'origin': the middle of the doodad's art on its sheet.
*/
const CRT = { offMs: 520, onMs: 240 };

const CrtScreen = styled.div`
  position: absolute;
  width: 344px;
  height: 256px;
  transform-origin: ${props => props.$origin};
  ${props => props.$isOff && `animation: crtOff ${CRT.offMs}ms ease-in forwards;`}
  ${props => props.$isReturning && `animation: crtOn ${CRT.onMs}ms ease-out both;`}

  @keyframes crtOff {
    0% { transform: scale(1, 1); filter: brightness(1); opacity: 1; }
    35% { transform: scale(1.04, 0.03); filter: brightness(3); opacity: 1; }
    62% { transform: scale(0.02, 0.03); filter: brightness(4); opacity: 1; }
    72%, 100% { transform: scale(0, 0); opacity: 0; }
  }
  @keyframes crtOn {
    0% { transform: scale(0.02, 0.03); filter: brightness(4); opacity: 1; }
    45% { transform: scale(1.04, 0.03); filter: brightness(3); }
    100% { transform: scale(1, 1); filter: brightness(1); }
  }
`;

/*
  The doodads as a phantom signal (Jamie, 2026-11-12: cyberpunk tech, a Phantom Dust feel), all in one svg filter
  per doodad, kept to the art's own shape:
  - noise that only darkens: the green goes to black in specks, never to white (4 seeds, swapped like the grid's snow)
  - a voltage line: now and then a bright line of current runs down the art, and the art kinks sideways where it is
  - a CRT bar: a faint green band rolls down the art, round and round
  A little see-through, too. The doodads' timings differ, so they don't zap together.
*/
const DOODAD_SIGNAL = {
  opacity: 0.8,
  seeds: 4,
  snowMs: 240, // the noise's crackle, as the grid's
  noiseDark: 0.9, // how far the specks go toward black (0: none)
  zapEveryMs: [2300, 3100, 3900], // a voltage line's run, per doodad (bars, heartbeat, vertices)
  zapRunMs: 380, // its trip down the art
  zapKinkPx: 22, // how far the art kinks across (in the art's pixels; on screen, x0.45)
  barEveryMs: [3400, 4100, 3700], // the CRT bar's roll down, per doodad
  barOpacity: 0.22
};
const ART = { width: 344, height: 256 }; // a doodad's frame on its sheet

const DoodadSignalFilter = ({ doodad, seed }) => {
  const zapDur = `${DOODAD_SIGNAL.zapEveryMs[doodad] / 1000}s`;
  const zapEnd = (DOODAD_SIGNAL.zapRunMs / DOODAD_SIGNAL.zapEveryMs[doodad]).toFixed(3);
  const zapAt = offset => <animate attributeName="y" values={`${-30 + offset};${ART.height + 20 + offset};${ART.height + 20 + offset}`} keyTimes={`0;${zapEnd};1`} dur={zapDur} repeatCount="indefinite" />;
  return (
    <filter id={`doodadSignal${doodad}_${seed}`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
      {/* the voltage line's kink: jagged noise in a band that runs down, on a neutral (no shift) gray */}
      <feFlood floodColor="rgb(128,128,128)" result="neutral" />
      <feTurbulence type="turbulence" baseFrequency="0.012 0.35" numOctaves="1" seed={seed + 1} result="jag" />
      <feFlood floodColor="white" x="-60" width={ART.width + 120} height="16" result="band">{zapAt(0)}</feFlood>
      <feComposite in="jag" in2="band" operator="in" result="jagBand" />
      <feMerge result="kinkMap"><feMergeNode in="neutral" /><feMergeNode in="jagBand" /></feMerge>
      <feDisplacementMap in="SourceGraphic" in2="kinkMap" scale={DOODAD_SIGNAL.zapKinkPx} xChannelSelector="R" yChannelSelector="G" result="art" />
      {/* the noise: specks toward black only, so it stays green and black */}
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={seed + 1} result="noise" />
      <feColorMatrix in="noise" values={`${-DOODAD_SIGNAL.noiseDark} 0 0 0 1.25  ${-DOODAD_SIGNAL.noiseDark} 0 0 0 1.25  ${-DOODAD_SIGNAL.noiseDark} 0 0 0 1.25  0 0 0 0 1`} result="specks" />
      <feBlend in="art" in2="specks" mode="multiply" result="speckled" />
      <feComposite in="speckled" in2="art" operator="in" result="noisyArt" />
      {/* the CRT bar */}
      <feFlood floodColor="#80EF80" floodOpacity={DOODAD_SIGNAL.barOpacity} x="-60" width={ART.width + 120} height="70" result="bar">
        <animate attributeName="y" values={`-70;${ART.height}`} dur={`${DOODAD_SIGNAL.barEveryMs[doodad] / 1000}s`} repeatCount="indefinite" />
      </feFlood>
      <feComposite in="bar" in2="art" operator="in" result="barOnArt" />
      {/* the current itself: a bright line on the art where the kink is, with a glow */}
      <feFlood floodColor="#e6ffe6" x="-60" width={ART.width + 120} height="3" result="line">{zapAt(7)}</feFlood>
      <feComposite in="line" in2="art" operator="in" result="lineOnArt" />
      <feGaussianBlur in="lineOnArt" stdDeviation="2.5" result="lineGlow" />
      <feMerge>
        <feMergeNode in="noisyArt" />
        <feMergeNode in="barOnArt" />
        <feMergeNode in="lineGlow" />
        <feMergeNode in="lineOnArt" />
      </feMerge>
    </filter>
  );
};

const DoodadSignalFilters = () =>
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    {[0, 1, 2].map(doodad => [...Array(DOODAD_SIGNAL.seeds).keys()].map(seed =>
      <DoodadSignalFilter key={`${doodad}_${seed}`} doodad={doodad} seed={seed} />
    ))}
  </svg>;

const Grainy = styled.div`
  position: absolute;
  width: ${ART.width}px;
  height: ${ART.height}px;
  ${props => props.$isOn && `
    opacity: ${DOODAD_SIGNAL.opacity};
    animation: doodadSignal${props.$doodad} ${DOODAD_SIGNAL.snowMs}ms steps(1) infinite;
    @keyframes doodadSignal${props.$doodad} {
      0% { filter: url(#doodadSignal${props.$doodad}_0); }
      25% { filter: url(#doodadSignal${props.$doodad}_1); }
      50% { filter: url(#doodadSignal${props.$doodad}_2); }
      75% { filter: url(#doodadSignal${props.$doodad}_3); }
    }
  `}
`;

const CrtSparkle = styled.div`
  position: absolute;
  left: ${props => props.$x}px;
  top: ${props => props.$y}px;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0;
  ${props => props.$isOff && `animation: crtSparkle ${CRT.offMs}ms linear forwards;`}

  /* a bright dot, with a star's thin rays across it */
  &::before, &::after {
    content: '';
    position: absolute;
    left: -40px;
    top: -2px;
    width: 80px;
    height: 4px;
    background: radial-gradient(closest-side, white, #80EF80 45%, transparent);
  }
  &::after { transform: rotate(90deg); }
  box-shadow: 0 0 8px 6px white, 0 0 22px 12px #80EF80;

  @keyframes crtSparkle {
    0%, 55% { opacity: 0; transform: scale(0.2) rotate(0deg); }
    66% { opacity: 1; transform: scale(1.3) rotate(25deg); }
    100% { opacity: 0; transform: scale(0) rotate(70deg); }
  }
`;

export const CircuitDiscSpriteSheet = styled.div`
  position: absolute;

  ${props => props.zIndex && `z-index: ${props.zIndex};`}

  transform: translate(-220px, 0px) scale(.8, .4);

  ${props => `filter:${props.persistDisc ?
    props.isRed ?
      ' drop-shadow(0 0 5px #fa8072) contrast(40%) saturate(300%)'
      : ' drop-shadow(0px 0px 5px #55aaff) contrast(40%) saturate(300%)'
    : ' drop-shadow(0 0 5px #80EF80) contrast(40%) saturate(300%)'};`}

  pointer-events: none;
  background: url(spritesheet/horizontal_circuit_disc_sprite.png);

  width: 592px;
  height: 359px;

  animation: playSpriteSheet 2s steps(9) infinite;

  @keyframes playSpriteSheet {
    0% {
      background-position-x: 0px;
      background-position-y: 0px;
    }                         
    100% {
      background-position-x: -5328px;
      background-position-y: 0px;
    }
  }  
`;

const PopupSpan = ({ color, msg, textAlign, fontSize }) =>
  <StyledMsg color={color}>
    <BlinkFadeEffect>
      <PopupMsg
        textAlign={textAlign}
        fontSize={fontSize}
      >{!!msg ? msg : 'Click'}
        <br />
          <UpDownAnim>
          <StyledIcon className='fa fa-caret-down' rotate={0} />
          </UpDownAnim>
      </PopupMsg>
    </BlinkFadeEffect>
  </StyledMsg>

const useOpacityEffect = ({ show, opacity, setOpacity, activeInterval, fadeInMs, fadeOutMs }) => useEffect(() => {
  const FADE_SPEED = 100; // 1 seconds to fade in or out
  // a quick fade: straight to 1 or 0, and the css transition (fadeInMs, fadeOutMs) does the fade
  if (show ? fadeInMs : fadeOutMs) {
    clearInterval(activeInterval.current);
    setOpacity(show ? 1 : 0);
    return;
  }
  if (!show && opacity > 0) {
    clearInterval(activeInterval.current);
    activeInterval.current = setInterval(() => {
      setOpacity(o => {
        if (o <= 0) clearInterval(activeInterval.current);
        return o > 0 ? o - .1 : 0
      });
    }, FADE_SPEED);
  } else if (show && opacity < 1) {
    clearInterval(activeInterval.current);
    activeInterval.current = setInterval(() => {
      setOpacity(o => {
        if (o >= 1) clearInterval(activeInterval.current);
        return o >= 1 ? 1 : o + .1
      });
    }, FADE_SPEED);
  }
}, [show]);

const useTranslationEffect = ({ STARTING_POSTIONS, show, setTranslations, activeInterval, accumulator }) => {
  const TRANSLATION_RANGE = 25; // max range // 25
  useEffect(() => {
    activeInterval.current = setInterval(() => {
      if (!show) {
        clearInterval(activeInterval.current);
        accumulator.current = 60;
      }
      setTranslations(ts => ts.map((t, i) => {
        if (i >= STARTING_POSTIONS.length) return t;

        // try to update 1-2 doodad(s) at a time
        // const mod = i + 4;
        // const shouldUpdate = accumulator.current % mod == 0;

        // accumulator.current += 3;

        // if (!shouldUpdate) return t;

        // if (shouldUpdate) {
        const start = STARTING_POSTIONS[i];
        const dx = Math.abs(t.x - start.x);
        const dy = Math.abs(t.y - start.y);

        if (dx > TRANSLATION_RANGE && dy > TRANSLATION_RANGE) {
          return start;
        } else {
          const negX = Math.random() > .5;
          const negY = Math.random() > .5;
          // i == 3 is the green graph doodad. restrict this doodad's movement
          const x = Math.random() * (i == 3 ? TRANSLATION_RANGE / 5 : TRANSLATION_RANGE);
          const y = Math.random() * (i == 3 ? TRANSLATION_RANGE / 5 : TRANSLATION_RANGE);
          return { x: start.x + (negX ? -x : x), y: start.y + (negY ? -y : y) };
        }
        // }
      }));
    }, 500);
  }, [show]);
}

// 'hasDisc': false leaves out the circuit disc on the floor (the character select, Jamie 2026-11-12)
/*
  Shown, the three doodads jump about their places (not the green graph), cut to the quick, uneven beat of a
  title sequence (Jamie, 2026-11-12, after Batman Beyond's intro), a flash on a jump and now and then a blink out.
  Never still (Jamie): on every beat each one moves, and each move lasts until the next beat. One or two jump (quick
  off the mark, then easing slowly the rest of the way); the others drift a little, slowly.
  Their pointer lines never reach the green graph: a move is held back 'gapPx' from its edge.
*/
const DRIFT = {
  // a middle ground between the slow 1.5 s drift and the frantic cuts (Jamie, 2026-11-12: "a bit crazy")
  beatsMs: [300, 300, 600, 240, 240, 900, 300, 600, 1100], // the rhythm, round and round
  jumpEase: 'cubic-bezier(0.15, 0.85, 0.3, 1)', // a jump: most of the way at once, then a slow ease in
  rangePx: 32, // how far one jumps from its place (in the doodad's own pixels; on screen, x0.45)
  driftPx: 8, // how far the others drift on a beat
  maxMoving: 2, // doodads jumping on one beat
  flashChance: 0.18,
  offChance: 0.06, // a jumping doodad switching off like a TV (CRT, above)
  offHoldMs: 260, // black, after the switch off, before the next beat brings it back
  gapPx: 6, // on screen, between a pointer line's end and the green graph
  count: 3
};
// where each doodad's pointer line ends on its sprite sheet (x, the furthest across its 4 frames): bars, heartbeat, vertices
const POINTER_TIPS_X = [176, 171, 175];
const GREEN_GRAPH = { width: 123, height: 194 };

// x held back so the pointer line's end stays clear of the green graph (it's left or right of it from the start)
const keepOffGraph = (x, start, tipX, graph) => {
  const graphLeft = GREEN_GRAPH.width / 2 + graph.scaleX * (graph.x - GREEN_GRAPH.width / 2);
  const graphRight = GREEN_GRAPH.width / 2 + graph.scaleX * (graph.x + GREEN_GRAPH.width / 2);
  const screenX = tx => start.scaleX * (tipX + tx); // transform: scale() translate(), from the top left
  const isLeft = screenX(start.x) < graphLeft;
  const limit = isLeft ? graphLeft - DRIFT.gapPx : graphRight + DRIFT.gapPx;
  const isClear = isLeft ? screenX(x) <= limit : screenX(x) >= limit;
  return isClear ? x : limit / start.scaleX - tipX;
};

const useDriftEffect = ({ isOn, starts, setTranslations }) => useEffect(() => {
  if (!isOn) {
    setTranslations(starts);
    return;
  }
  let beat = 0;
  let timeout;
  const cut = () => {
    const moving = 1 + Math.floor(Math.random() * DRIFT.maxMoving); // one or two jump on a beat
    // a fair shuffle (sort with a random compare favoured the first two: the bottom left one jumped least)
    const order = [0, 1, 2];
    for (let k = order.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [order[k], order[r]] = [order[r], order[k]];
    }
    order.length = moving;
    const offs = order.filter(() => Math.random() < DRIFT.offChance);
    const beatMs = DRIFT.beatsMs[beat++ % DRIFT.beatsMs.length];
    const ms = offs.length ? Math.max(beatMs, CRT.offMs + DRIFT.offHoldMs) : beatMs; // the switch off seen through, and a beat of black
    const within = (value, start) => Math.max(start - DRIFT.rangePx, Math.min(start + DRIFT.rangePx, value));
    const picks = starts.map(() => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, isFlash: Math.random() < DRIFT.flashChance }));
    setTranslations(ts => ts.map((t, i) => {
      if (i >= DRIFT.count) return t;
      const start = starts[i];
      const isJump = order.includes(i);
      const reach = isJump ? DRIFT.rangePx : DRIFT.driftPx;
      const from = isJump ? start : t; // a jump goes anywhere about its place; a drift, from where it is
      const x = within(from.x + picks[i].x * reach, start.x);
      const isOff = offs.includes(i);
      return {
        ...t,
        x: keepOffGraph(x, start, POINTER_TIPS_X[i], starts[3]),
        y: within(from.y + picks[i].y * reach, start.y),
        ms,
        ease: isJump ? DRIFT.jumpEase : 'linear',
        isFlash: isJump && !isOff && picks[i].isFlash,
        isOff,
        isReturning: !!t.isOff && !isOff // switched back on
      };
    }));
    timeout = setTimeout(cut, ms);
  };
  cut();
  return () => clearTimeout(timeout);
}, [isOn]);

// 'isDrifting': the doodads jump about while shown, and the green graph is a staticky TV picture.
// 'fadeInMs', 'fadeOutMs': quicker fades than the 1 s ones
export const Doodads = ({ persistDisc, show, globalTranslation, isRed, opacity, setOpacity, hasPrompt = true, hasDisc = true, isDrifting = false, fadeInMs = undefined, fadeOutMs = undefined }) => {

  const { isAvatarChangedOnce } = useContext(GlobalSettingsContext);
  const STARTING_POSTIONS = [
    { x: -130, y: 30, scaleX: 0.45, scaleY: 0.45 },
    { x: 120, y: -310, scaleX: 0.45, scaleY: -0.45 },
    { x: -220, y: -400, scaleX: -0.45, scaleY: -0.45 },
    { x: 22, y: 25, scaleX: .7, scaleY: .77 }
  ];
  const activeOpacityInterval = useRef();
  const activeTranslationInterval = useRef();
  const accumulator = useRef(60);

  const [translations, setTranslations] = useState(STARTING_POSTIONS);

  // turning-off for now...
  // useTranslationEffect({ STARTING_POSTIONS, show, setTranslations, activeInterval: activeTranslationInterval, accumulator });
  useOpacityEffect({ show, opacity, setOpacity, activeInterval: activeOpacityInterval, fadeInMs, fadeOutMs });
  useDriftEffect({ isOn: isDrifting && show, starts: STARTING_POSTIONS, setTranslations });

  return <DoodadsWrapper translation={globalTranslation}>
    {hasPrompt &&
      !isAvatarChangedOnce &&
      !persistDisc &&
      <FadeInOutEffect opacity={1 - opacity}>
        <PopupSpan
          msg={'Click to change avatar'}
          color={'rgb(196 193 106)'}
          textAlign={'start'}
          fontSize={'13px'}
        />
      </FadeInOutEffect>}
    <FadeInOutEffect opacity={opacity} ms={show ? fadeInMs : fadeOutMs}>
      {hasPrompt && <PopupSpan
        msg={'Click to change avatar'}
        color={'#80EF80'}
        textAlign={'start'}
        fontSize={'13px'}
      />}
      {isDrifting && <DoodadSignalFilters />}
      <BlinkFadeEffect high={69} low={40}>
        <DoodadTransform scale={`${STARTING_POSTIONS[0].scaleX}, ${STARTING_POSTIONS[0].scaleY}`} translation={`${translations[0].x}px, ${translations[0].y}px`} ms={isDrifting ? translations[0].ms : undefined} $ease={isDrifting ? translations[0].ease : undefined} $isFlash={translations[0].isFlash}>
          <CrtScreen $origin="105px 133px" $isOff={translations[0].isOff} $isReturning={translations[0].isReturning}>
            <Grainy $isOn={isDrifting} $doodad={0}>
              <DoodadSpriteSheet
                src={"spritesheet/doo_dad_bars.png"}
                zIndex={110}
              />
            </Grainy>
          </CrtScreen>
          <CrtSparkle $x={105} $y={133} $isOff={translations[0].isOff} />
        </DoodadTransform>
        <DoodadTransform scale={`${STARTING_POSTIONS[1].scaleX}, ${STARTING_POSTIONS[1].scaleY}`} translation={`${translations[1].x}px, ${translations[1].y}px`} ms={isDrifting ? translations[1].ms : undefined} $ease={isDrifting ? translations[1].ease : undefined} $isFlash={translations[1].isFlash}>
          <CrtScreen $origin="240px 183px" $isOff={translations[1].isOff} $isReturning={translations[1].isReturning}>
            <Grainy $isOn={isDrifting} $doodad={1}>
              <DoodadSpriteSheet
                src={"spritesheet/doo_dad_heartbeat.png"}
                zIndex={111}
              />
            </Grainy>
          </CrtScreen>
          <CrtSparkle $x={240} $y={183} $isOff={translations[1].isOff} />
        </DoodadTransform>
        <DoodadTransform scale={`${STARTING_POSTIONS[2].scaleX}, ${STARTING_POSTIONS[2].scaleY}`} translation={`${translations[2].x}px, ${translations[2].y}px`} ms={isDrifting ? translations[2].ms : undefined} $ease={isDrifting ? translations[2].ease : undefined} $isFlash={translations[2].isFlash}>
          <CrtScreen $origin="243px 75px" $isOff={translations[2].isOff} $isReturning={translations[2].isReturning}>
            <Grainy $isOn={isDrifting} $doodad={2}>
              <DoodadSpriteSheet
                src={"spritesheet/doo_dad_vertices.png"}
                zIndex={112}
              />
            </Grainy>
          </CrtScreen>
          <CrtSparkle $x={243} $y={75} $isOff={translations[2].isOff} />
        </DoodadTransform>
        <GreenGraphDoodad $isStatic={isDrifting} scale={`${STARTING_POSTIONS[3].scaleX}, ${STARTING_POSTIONS[3].scaleY}`} translation={`${translations[3].x}px, ${translations[3].y}px`} zIndex={108} />
      </BlinkFadeEffect>
      {hasDisc && <BlinkFadeEffect high={20} low={59} time={400}><CircuitDiscSpriteSheet isRed={!!isRed} zIndex={107} /></BlinkFadeEffect>}
      {persistDisc && <BlinkFadeEffect high={59} low={30}><CircuitDiscSpriteSheet isRed={!!isRed} zIndex={106} /></BlinkFadeEffect>}
    </FadeInOutEffect>
    {persistDisc && <BlinkFadeEffect high={59} low={30}><CircuitDiscSpriteSheet persistDisc={true} isRed={!!isRed} zIndex={105} /></BlinkFadeEffect>}
  </DoodadsWrapper>
};

const Sprite = ({ gender, onClick, selectedAvatar, globalTranslation }) => {

  const [setHoverRef, hoverLookupString] = useHover();
  const [opacity, setOpacity] = useState(0);

  return (<div>
    <SpriteSheet
      ref={setHoverRef(gender)}
      onClick={onClick}
      gender={gender}
      anim={gender == selectedAvatar ? "" : 'cycleThroughIdleAnims'}
      opacity={opacity}
    />
    <Doodads
      opacity={opacity}
      setOpacity={setOpacity}
      isRed={gender == 'girl'}
      persistDisc={gender == selectedAvatar}
      globalTranslation={globalTranslation}
      show={hoverLookupString == gender && selectedAvatar != gender} />
  </div>);
}

// 'spacing': how far apart the two stand, in pixels
// 'raise': css length to move the band up by, from where it sits
export const AvatarSelection = ({ spacing = 650, raise = undefined }) => {
  const { selectedAvatar, setSelectedAvatar, setIsAvatarChangedOnce } = useContext(GlobalSettingsContext);

  return <AvatarSelectionWrapper style={raise ? { marginTop: `calc(200px - ${raise})` } : undefined}>
    <SpritesWrapper spacing={spacing}>
      <Sprite
        gender={'girl'}
        onClick={() => {
          setIsAvatarChangedOnce(true);
          setSelectedAvatar('girl');
        }}
        selectedAvatar={selectedAvatar}
        globalTranslation={"-5px, 0px"}
      />
      <Sprite
        gender={'guy'}
        onClick={() => setSelectedAvatar('guy')}
        selectedAvatar={selectedAvatar}
        globalTranslation={"5px, 0px"}
      />
    </SpritesWrapper>
    <CenteredLabelsContainer>
      {/* default is "girl" = "Teammate", "guy" = "Player" */}
      <LabelContainer labelContent={"Teammate"} zIndex={3} selectedGender={selectedAvatar} spacing={spacing}>
        <SlidingLabel
          spacing={spacing}
          selectedGender={selectedAvatar}
          labelContent={"Teammate"}
        >
          <BlinkFadeEffect high={59} low={30}>
            <UpDownAnim>
              <AlignSelfCenter>
                <StyledIcon className="fa fa-caret-up" />
              </AlignSelfCenter>
            </UpDownAnim>
            Teammate
          </BlinkFadeEffect>
        </SlidingLabel>
      </LabelContainer>
      <LabelContainer labelContent={"Player"} zIndex={4} selectedGender={selectedAvatar} spacing={spacing}>
        <SlidingLabel
          spacing={spacing}
          selectedGender={selectedAvatar}
          labelContent={"Player"}
        >
          <BlinkFadeEffect high={59} low={30}>
            <UpDownAnim>
              <AlignSelfCenter>
                <StyledIcon className="fa fa-caret-up" />
              </AlignSelfCenter>
            </UpDownAnim>
            Player
          </BlinkFadeEffect>
        </SlidingLabel>
      </LabelContainer>
    </CenteredLabelsContainer>
  </AvatarSelectionWrapper>
}