import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  Title,
  StyledSpookyText,
  StyledSciFiText,
  StyledSpookyTextShadow
} from './StyledComponents'
import "App.css";
import kaijuGlyphs from "./data/kaijuGlyphs.json";

const LogoWrapper = styled.div`
  position: absolute;
  display: flex;
  align-self: center;
  flex-direction: column;

  width: 700px;
  height: 350px;

  margin-top: -370px;
  /* the landing sets it (Jamie, 2026-11-18: the logo, its skyline and Kaiju larger, sized to the window) */
  transform: scale(var(--logo-scale, 1));
`;

const LogoImage = styled.img`
  pointer-events: none;
  position: absolute;
  z-index: 9;
  display: flex;

  align-self: center;


  justify-content: space-between;
  width: 600px;
  height: 300px;
  translate: 0 calc(var(--logo-lift, 0px) * -1 + var(--skyline-y, 0px)); /* (the landing raises its skyline, not its Kaiju; the tuner moves it) */

  -webkit-animation-duration: 3s;
  animation-duration: 3s;

  @keyframes fadeInLogo {
    0% {
      opacity: 0;
    }
    10% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

/*
  Spotlights (Jamie, round 7): a big night's searchlights, sweeping to and fro from the skyline's base, cream white,
  fading as they rise, ending about the tallest buildings' tops; behind the title, in front of the skyline (the landing
  only). Each: its base across the skyline (logo px), its sweep (degrees either side), its time, its delay.
*/
// (length: to the tallest building's top, about logo y 82, and no higher, even upright: Jamie, round 8)
// (Jamie, 2026-11-19: they felt dull: now each a bright narrow core in a wide soft halo, a glare where it leaves the
// ground, a searchlight's flicker, an uneven sweep (lingering, then quick), added onto the skyline where they cross it.
// Their length: never above the tallest building's top, even upright)
const SPOTLIGHT = { base: 197, length: 112, core: { width: 12, strength: 0.8 }, halo: { width: 44, strength: 0.22 }, glare: 9, color: "255, 246, 222" };
// (Jamie: in twos, both pairs' bases behind the title, where the inner two first stood; quicker; each pair in step
// but mirrored: as one swings left the other swings right)
// (spread a little further apart: Jamie; still behind the title, which runs about x 176-426)
// (Jamie, 2026-11-19: the pairs broken up, each one's second beam moved inward, 'inward' px, so the two inner beams
// stand further apart than each from its old partner; still swinging mirrored with it. Then: the two groups mirror
// images of each other, in time; quicker; no stopping at the ends of a swing)
const SWEEP = { left: 205, inward: 50, right: 405, sweep: 28, seconds: 2.8, lean: 6 };
const BEAMS = [
  { x: SWEEP.left, way: 1, lean: SWEEP.lean },
  { x: SWEEP.left + SWEEP.inward, way: -1, lean: -SWEEP.lean },
  { x: SWEEP.right - SWEEP.inward, way: 1, lean: SWEEP.lean }, // (the right group: the left's mirror image)
  { x: SWEEP.right, way: -1, lean: -SWEEP.lean }
];
// steady across, turning round quickly at each end (a rounded triangle wave): never a stop
const beamSweep = keyframes`
  0.00% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.0000deg * var(--way)); }
  4.17% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.1951deg * var(--way)); }
  8.33% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.3890deg * var(--way)); }
  12.50% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.5798deg * var(--way)); }
  16.67% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.7627deg * var(--way)); }
  20.83% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.9224deg * var(--way)); }
  25.00% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 1.0000deg * var(--way)); }
  29.17% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.9224deg * var(--way)); }
  33.33% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.7627deg * var(--way)); }
  37.50% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.5798deg * var(--way)); }
  41.67% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.3890deg * var(--way)); }
  45.83% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.1951deg * var(--way)); }
  50.00% { rotate: calc(var(--lean) * 1deg + var(--sweep) * 0.0000deg * var(--way)); }
  54.17% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.1951deg * var(--way)); }
  58.33% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.3890deg * var(--way)); }
  62.50% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.5798deg * var(--way)); }
  66.67% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.7627deg * var(--way)); }
  70.83% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.9224deg * var(--way)); }
  75.00% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -1.0000deg * var(--way)); }
  79.17% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.9224deg * var(--way)); }
  83.33% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.7627deg * var(--way)); }
  87.50% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.5798deg * var(--way)); }
  91.67% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.3890deg * var(--way)); }
  95.83% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.1951deg * var(--way)); }
  100.00% { rotate: calc(var(--lean) * 1deg + var(--sweep) * -0.0000deg * var(--way)); }
`;
// (a searchlight's flicker: small, uneven)
const beamFlicker = keyframes`
  0%, 100% { opacity: 1; }
  13% { opacity: 0.86; }
  17% { opacity: 1; }
  48% { opacity: 0.93; }
  52% { opacity: 0.8; }
  56% { opacity: 1; }
  81% { opacity: 0.9; }
`;
const SpotlightBox = styled.div`
  pointer-events: none;
  position: absolute;
  z-index: 9;
  align-self: center;
  width: 600px;
  height: 300px;
  translate: 0 calc(var(--logo-lift, 0px) * -1 + var(--skyline-y, 0px));
  mix-blend-mode: plus-lighter; /* (lighting up the skyline where they cross it) */
`;
const Beam = styled.div`
  position: absolute;
  bottom: ${300 - SPOTLIGHT.base}px;
  width: ${SPOTLIGHT.halo.width}px;
  height: ${SPOTLIGHT.length}px;
  margin-left: ${-SPOTLIGHT.halo.width / 2}px;
  transform-origin: 50% 100%;
  animation: ${beamSweep} var(--seconds) linear infinite, ${beamFlicker} var(--flicker) linear infinite;
`;
// each layer: its blur on a wrapper round its clipped shape (blurred and then clipped, its edges had stayed sharp: the
// core and the halo blend now: Jamie)
const BeamLayer = styled.div`
  position: absolute;
  bottom: 0;
  left: 50%;
  height: 100%;
  width: var(--width);
  margin-left: calc(var(--width) / -2);
  filter: blur(var(--blur));
  & > div {
    width: 100%;
    height: 100%;
    clip-path: polygon(calc(50% - var(--foot)) 100%, calc(50% + var(--foot)) 100%, 100% 0, 0 0);
    background: linear-gradient(to top, rgba(${SPOTLIGHT.color}, var(--strength)), rgba(${SPOTLIGHT.color}, calc(var(--strength) * 0.45)) 45%, rgba(${SPOTLIGHT.color}, 0));
  }
`;
const BEAM_LAYERS = [
  { width: SPOTLIGHT.halo.width, foot: "6%", blur: "5px", strength: SPOTLIGHT.halo.strength * 1.3 },
  { width: SPOTLIGHT.halo.width * 0.6, foot: "8%", blur: "3px", strength: (SPOTLIGHT.halo.strength + SPOTLIGHT.core.strength) / 2 * 0.8 },
  { width: SPOTLIGHT.core.width, foot: "12%", blur: "1.6px", strength: SPOTLIGHT.core.strength * 0.9 }
];
// the glare where a pair leaves the ground
const Glare = styled.div`
  position: absolute;
  bottom: ${300 - SPOTLIGHT.base - SPOTLIGHT.glare / 2}px;
  width: ${SPOTLIGHT.glare}px;
  height: ${SPOTLIGHT.glare}px;
  margin-left: ${-SPOTLIGHT.glare / 2}px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0 20%, rgba(${SPOTLIGHT.color}, 0.55) 40%, rgba(${SPOTLIGHT.color}, 0) 70%);
  animation: ${beamFlicker} 0.9s linear infinite;
`;
const Spotlights = () => (
  <SpotlightBox data-spotlights aria-hidden="true">
    {BEAMS.map(({ x, way, lean }, k) => (
      <Beam key={k} style={{ left: `${x}px`, "--sweep": SWEEP.sweep, "--lean": lean, "--way": way, "--seconds": `${SWEEP.seconds}s`, "--flicker": `${0.7 + k * 0.17}s` }}>
        {BEAM_LAYERS.map(({ width, foot, blur, strength }, j) => (
          <BeamLayer key={j} style={{ "--width": `${width}px`, "--foot": foot, "--blur": blur, "--strength": strength }}><div /></BeamLayer>
        ))}
      </Beam>
    ))}
    {BEAMS.map(({ x }, k) => <Glare key={k} style={{ left: `${x}px` }} />)}
  </SpotlightBox>
);

/*
  The base joiner (Jamie, 2026-11-19): the skyline's own base blue carried on down a little below its buildings, solid
  until the walking Kaiju's feet are surely covered (its sprite's feet reach about 3 px below the skyline's base, a
  little more mid-step), then fading out over a few px; over the buildings' feet (Jamie: on top of the skyline), in
  front of the Kaiju. Its place and look from the landing's tuner (--base-joiner-*, logo px; LandingTuner).
*/
const BASE_JOINER = { color: "21, 38, 66", edge: 10 };
const BaseJoinerBox = styled.div`
  pointer-events: none;
  position: absolute;
  z-index: 9;
  align-self: center;
  width: 600px;
  height: 300px;
  translate: 0 calc(var(--logo-lift, 0px) * -1 + var(--skyline-y, 0px));
  &::before {
    content: "";
    position: absolute;
    left: var(--base-joiner-left, 26px);
    width: var(--base-joiner-width, 533px);
    clip-path: var(--base-joiner-shape, none); /* (its top and bottom each their own width: Jamie) */
    top: var(--base-joiner-top, 191px);
    height: var(--base-joiner-height, 23px);
    opacity: var(--base-joiner-opacity, 1);
    background: linear-gradient(to bottom, rgba(${BASE_JOINER.color}, 1) 0, rgba(${BASE_JOINER.color}, 1) var(--base-joiner-solid, 65%), rgba(${BASE_JOINER.color}, 0) 100%);
    -webkit-mask-image: linear-gradient(to right, transparent, black ${BASE_JOINER.edge}px, black calc(100% - ${BASE_JOINER.edge}px), transparent);
    mask-image: linear-gradient(to right, transparent, black ${BASE_JOINER.edge}px, black calc(100% - ${BASE_JOINER.edge}px), transparent);
  }
`;

const KaijuWrapper = styled.div`
  pointer-events: none;

  position: absolute;

  ${props => props.isSmoke ? "z-index: 9; filter: invert(1) blur(1px) drop-shadow(0px 0px 1px rgb(191, 64, 191)) opacity(.25);" :  "z-index: 8; filter: drop-shadow(0px 0px 1px rgb(191, 64, 191));" }

  /* trimmed to when it's in view (Jamie, playtest 22: it was hidden a third of the minute): the same spots where it
     fades in and out by the buildings and the same walking speed, just no long wait off past them */
  animation: fadeKaijuWalk linear 40s infinite;

  @keyframes fadeKaijuWalk {
    0% {
      opacity: 0;
      transform: scale(2.7) translate(57.6px, 67px);
    }
    6.75% {
      opacity: 1;
    }
    49.5% {
      opacity: 1;
    }
    53.25% {
      opacity: 0;
      transform: scale(2.7) translate(256px, 67px);
    }
    54.5% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(-151.8px, 67px);
    }
    61.25% {
      opacity: 1;
    }
    95% {
      opacity: 1;
    }
    98.75% {
      opacity: 0;
      transform: scale(-2.7, 2.7) translate(40.8px, 67px);
    }
    100% {
      opacity: 0;
      transform: scale(2.7) translate(57.6px, 67px);
    }
  }
  
`;


const SpriteSheet = styled.div`
  pointer-events: none;
  display: flex;

  background-color: #0b0c0e;

  ${props => props.isSmoke ?
    "background: url('spritesheet/kaiju-walk-smoke.png');"
    : "  -webkit-mask-image: url('spritesheet/kaiju-walk.png'); mask-image: url('spritesheet/kaiju-walk.png');"
  }

  ${props => props.isSmoke && "filter: hue-rotate(180deg);"}

    ${props => props.isSmoke ? "transform: scale(0.7, 0.4) translate(-90px, -165px);" : "transform: scale(0.4) translate(-130px, -165px);"}
  
  width: 180px;
  height: 231px;

  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  -webkit-transition: -webkit-transform 3s ease-in-out;

   ${props => props.isSmoke ? 'animation: smoke-flow 5s steps(10) infinite;' : 'animation: walk 5s steps(10) infinite;'}

  @keyframes walk {
    0% {
      -webkit-mask-position: 0px 0px; 
      mask-position: 0px 0px;
    }
  
    100% {
      -webkit-mask-position: -1800px 0px; 
      mask-position: -1800px 0px;
    }
  }

    @keyframes smoke-flow {
    0% {
        background-position-x: 0px;
        background-position-y: 0px;
    }
  
    100% {
      background-position-x: -1800px;
      background-position-y: 0px;
    }
  }



`;

/*
  The Kaiju's breath (Jamie, playtest 22): on each down-step of its walk it breathes out glowing purple embers, round and
  clean (not the page's pixel ones). they puff out of its mouth and drift back behind it, rising a little, and fade.
  they live in the Kaiju's own frame, so they turn round with it and trail behind whichever way it walks.
  'mouth' is in that frame (its sprite's box runs about x 2-74, y 3-96, the head top right); 'stepsAt': when in the
  5 s walk loop the head is lowest (a foot down), as shares of it.
*/
// each breath (Jamie): the embers come out together, set like a little cloud, pushed forward from the mouth and slowing to
// a stop; then they hang where they are and the Kaiju walks on through them, so in its own frame they slip back at its
// walking pace ('walkPerSecond', in its frame's units), sinking a little, and fade
// stepsAt: the head at its lowest, frames 4 and 9 of the walk's 10 (measured from kaiju-walk.png; Jamie, playtest 22)
// mouth: lower and a touch forward (Jamie: they looked to come from the nose; at the lowest frames the head is ~5 lower)
// lifeShare 0.32: 1.5x quicker (Jamie; was 0.48)
// backScale / backSpread: how fast they go back once they turn (Jamie, playtest 23: faster; were 0.85 and 26)
// streak: each ember a capsule with a fading tail, not a round dot (Jamie, playtest 23): 'length' times as long as it's
// tall going back; near round ('pushLength') while it's breathed out. subtler, then (Jamie): a short one
// flit (Jamie: an ember is light, fragile): it flutters up and down a little ('flutter', in its frame's units) as it goes
// back. a few ('spinShare') turn once counter-clockwise ('spinDegrees'), just as they start back, then not again
// (Jamie, playtest 24: not all of them, not all the time)
// whip (Jamie, 2026-11-15): the turn is whiplash, not a spin on the way back. As the Kaiju's body (head, shoulders,
// arms) passes them, they're jolted: a sharp kick back and a little up, and the few that turn flick round all at once,
// right at the turn ('endsAt': a short stretch after it, in push lengths); then they drift back without turning
const BREATH = { mouth: { x: 53, y: 33 }, loopSeconds: 5, stepsAt: [0.4, 0.9], perStep: 5, lifeShare: 0.32, pushShare: 0.1, walkPerSecond: 10, cloud: { width: 7, height: 5 }, headWidth: 11, backScale: 1.4, backSpread: 42, streak: { length: 2, pushLength: 0.6 }, spinDegrees: 360, spinShare: 1, /* all of them turn (Jamie's, 2026-11-15) */ flutter: 0.5 /* a light bob on the way back (Jamie's, 2026-11-15; was 2.5, then off) */, whip: { endsAt: 2.45, liftPx: 1.2 } };
const BREATH_LIFE_SECONDS = BREATH.loopSeconds * BREATH.lifeShare;
const BREATH_EMBERS = BREATH.stepsAt.flatMap((at, step) => Array.from({ length: BREATH.perStep }, (_, k) => {
  const random = n => ((Math.sin((step * 10 + k) * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  // a spot in a cloud: within an ellipse, thicker in the middle
  const angle = random(6) * Math.PI * 2;
  const reach = Math.sqrt(random(7));
  const cx = Math.cos(angle) * reach * BREATH.cloud.width / 2;
  const cy = Math.sin(angle) * reach * BREATH.cloud.height / 2;
  // forward, as it's breathed out: never further than a head's width from the mouth, with the cloud (Jamie)
  const push = Math.min(2 + random(2) * 3, BREATH.headWidth - cx - BREATH.cloud.width / 2);
  // the step's lurch (Jamie): as the foot lands the head dips forward and down, and the breath is thrown the same way
  const hangSeconds = BREATH_LIFE_SECONDS * (1 - BREATH.pushShare);
  return {
    key: `${step} ${k}`,
    delay: -(BREATH.loopSeconds - (at + random(1) * 0.02) * BREATH.loopSeconds), // starts at its step in the loop
    cx, cy,
    fx: cx + push, fy: cy + 2.5 + random(3) * 2, // out of the mouth down and forward
    lx: cx + push * 0.8, ly: cy - 1, // then it lifts a little as the head comes back up
    // left behind as it walks on, and (a middle way back to the first version: Jamie) drifting apart as they go: each its
    // own extra way back, some rising and some sinking
    bx: cx + push - BREATH.walkPerSecond * hangSeconds * BREATH.backScale - random(8) * BREATH.backSpread, // spread wider as they go (Jamie)
    by: cy + (random(9) - 0.6) * 10, // only a little up or down: they spread mostly back (Jamie; was 28)
    flutter: (random(10) < 0.5 ? -1 : 1) * BREATH.flutter * (0.5 + random(11) * 0.5),
    spin: random(12) < BREATH.spinShare ? -BREATH.spinDegrees : 0, // counter-clockwise, a few of them
    size: 1 + random(4) * 1.2,
    color: ["#d47bff", "#b04cff", "#f0c4ff"][Math.floor(random(5) * 3)]
  };
}));

// the ember's head is its left end (the way it goes back); its tail stretches out behind it as it picks up speed
const { pushLength } = BREATH.streak;
const breathPuff = keyframes`
  0% { transform: translate(var(--cx), var(--cy)) rotate(0deg) scale(${0.5 * pushLength}, 0.5); opacity: 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1); }
  2% { opacity: 1; }
  ${BREATH.lifeShare * BREATH.pushShare * 100}% { transform: translate(var(--fx), var(--fy)) rotate(0deg) scale(${pushLength}, 1); animation-timing-function: ease-out; }
  ${BREATH.lifeShare * BREATH.pushShare * 2 * 100}% { transform: translate(var(--lx), var(--ly)) rotate(0deg) scale(${pushLength}, 1); animation-timing-function: cubic-bezier(0.1, 0.9, 0.2, 1); }
  ${BREATH.lifeShare * BREATH.pushShare * BREATH.whip.endsAt * 100}% { transform: translate(calc(var(--lx) + (var(--bx) - var(--lx)) * 0.07), calc(var(--ly) + (var(--by) - var(--ly)) * 0.07 - ${BREATH.whip.liftPx}px)) rotate(var(--spin)) scale(1, 0.9); animation-timing-function: ease-in-out; }
  ${BREATH.lifeShare * BREATH.pushShare * 3.5 * 100}% { transform: translate(calc(var(--lx) + (var(--bx) - var(--lx)) * 0.15), calc(var(--ly) + (var(--by) - var(--ly)) * 0.15 + var(--wy))) rotate(var(--spin)) scale(1, 0.9); animation-timing-function: ease-in-out; }
  ${BREATH.lifeShare * 100 * 0.5}% { transform: translate(calc(var(--lx) + (var(--bx) - var(--lx)) * 0.45), calc(var(--ly) + (var(--by) - var(--ly)) * 0.45 - var(--wy))) rotate(var(--spin)) scale(0.95, 0.8); animation-timing-function: ease-in-out; }
  ${BREATH.lifeShare * 100 * 0.7}% { opacity: 0.7; transform: translate(calc(var(--lx) + (var(--bx) - var(--lx)) * 0.7), calc(var(--ly) + (var(--by) - var(--ly)) * 0.7 + var(--wy))) rotate(var(--spin)) scale(0.9, 0.7); animation-timing-function: ease-in-out; }
  ${BREATH.lifeShare * 100}% { transform: translate(var(--bx), var(--by)) rotate(var(--spin)) scale(0.8, 0.5); opacity: 0; }
  100% { transform: translate(var(--bx), var(--by)) rotate(var(--spin)) scale(0.8, 0.5); opacity: 0; }
`;

const BreathEmber = styled.span`
  position: absolute;
  z-index: 1;
  border-radius: 999px;
  transform-origin: 30% 50%; /* turning about its bright end, not the tail's */
  pointer-events: none;
  animation: ${breathPuff} ${BREATH.loopSeconds}s infinite;
`;

const Breath = () => BREATH_EMBERS.map(({ key, delay, cx, cy, fx, fy, lx, ly, bx, by, flutter, spin, size, color }) => (
  <BreathEmber key={key} style={{
    left: `${BREATH.mouth.x}px`, top: `${BREATH.mouth.y}px`, width: `${size * BREATH.streak.length}px`, height: `${size}px`,
    // a bright head, the tail thinning out to nothing
    background: `linear-gradient(to right, white 0%, ${color} ${100 / BREATH.streak.length}%, ${color}55 70%, transparent 100%)`,
    boxShadow: `0 0 ${size}px ${color}66`,
    animationDelay: `${delay}s`, "--cx": `${cx}px`, "--cy": `${cy}px`, "--fx": `${fx}px`, "--fy": `${fy}px`, "--lx": `${lx}px`, "--ly": `${ly}px`, "--bx": `${bx}px`, "--by": `${by}px`, "--wy": `${flutter}px`, "--spin": `${spin}deg`
  }} />
));

/*
  The title's live border (Jamie, 2026-11-19): round each letter of "Kaiju", its own outline, offset outward with a
  slight gap from the black letter, glowing neon purple; on each letter the outline has an opening (where it starts and
  ends) that travels round the letter's shape, so the border is seen snaking round it. The letters' outlines are the
  font's own (scripts/kaijuGlyphs.py -> data/kaijuGlyphs.json), placed where the browser sets the word: its baseline
  and each letter's start measured from an SVG copy of the word in the same font.
  In the word's own px (before the title's and the logo's scaling): the gap, the border's width, the opening (a share
  of each letter's outline), each letter's lap.
*/
// (Jamie: the word's own outline colour, CSS purple, glowing in it, then brighter (same hue); the opening halved three
// times; then, 2026-11-19: no longer moving round, a neon tube instead: its gaps kept still, it blinks like one now and
// then (every 'blinkSeconds'), and the first time the landing shows it flickers on, sparks cascading off it)
const BORDER = { gap: 1.2, width: 1.9, color: "#d83cd8", opening: 0.02, glow: 2.2, onSeconds: 2.4, blinkSeconds: 4 };
const neonOn = keyframes`
  0% { opacity: 0; }
  10% { opacity: 0.9; }
  12% { opacity: 0; }
  25% { opacity: 1; }
  27% { opacity: 0.1; }
  40% { opacity: 0.9; }
  42% { opacity: 0.2; }
  52% { opacity: 1; }
  54% { opacity: 0.4; }
  60%, 100% { opacity: 1; }
`;
const neonBlink = keyframes`
  0%, 90%, 100% { opacity: 1; }
  91% { opacity: 0.25; }
  92.5% { opacity: 1; }
  94% { opacity: 0.45; }
  95.5% { opacity: 1; }
`;
// the moments in the turn-on when it catches (shares of it), each throwing sparks
const SPARK_BURSTS = [0.1, 0.25, 0.4, 0.52, 0.6];
let isNeonLit = false; // (it flickers on with sparks only the first time the landing shows in a visit)
const BorderBox = styled.svg`
  position: absolute;
  overflow: visible;
  pointer-events: none;
  & .neon { animation: ${neonBlink} ${BORDER.blinkSeconds}s linear infinite; }
  & .neon.starting { animation: ${neonOn} ${BORDER.onSeconds}s steps(1, end) forwards, ${neonBlink} ${BORDER.blinkSeconds}s linear ${BORDER.onSeconds}s infinite; }
`;
const SparkCanvas = styled.canvas`
  position: absolute;
  pointer-events: none;
`;
/*
  The turn-on's sparks (too high a voltage): at each moment it catches, bursts thrown from a few spots on the
  letters' borders, bright white to yellow to purple, arcing out and falling, fading as they go.
*/
const NeonSparks = ({ spots, width, height, pad }) => {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !spots.length) return;
    const ctx = canvas.getContext("2d");
    const sparks = [];
    const start = performance.now();
    const fired = new Set();
    const colors = ["255, 255, 255", "255, 236, 160", "236, 150, 255", "200, 90, 255"];
    let last = start;
    let frameId;
    const run = now => {
      const seconds = (now - start) / 1000;
      const step = Math.min(0.05, (now - last) / 1000);
      last = now;
      SPARK_BURSTS.forEach((share, b) => {
        if (fired.has(b) || seconds < share * BORDER.onSeconds) return;
        fired.add(b);
        for (let s = 0; s < 3; s++) {
          const [x, y] = spots[Math.floor(Math.random() * spots.length)];
          for (let n = 0; n < 14; n++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
            const speed = 40 + Math.random() * 110;
            sparks.push({ x: x + pad, y: y + pad, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.6 + Math.random() * 0.8, age: 0, color: colors[Math.floor(Math.random() * colors.length)] });
          }
        }
      });
      ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);
      sparks.forEach(spark => {
        spark.age += step;
        spark.vy += 260 * step; // (falling)
        spark.x += spark.vx * step;
        spark.y += spark.vy * step;
        const left = 1 - spark.age / spark.life;
        if (left <= 0) return;
        ctx.strokeStyle = `rgba(${spark.color}, ${left})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(spark.x - spark.vx * 0.025, spark.y - spark.vy * 0.025); // (a short streak behind it)
        ctx.stroke();
      });
      if (seconds < BORDER.onSeconds + 1.6) frameId = requestAnimationFrame(run);
      else ctx.clearRect(0, 0, width + pad * 2, height + pad * 2);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [spots, width, height, pad]);
  return <SparkCanvas ref={ref} width={width + pad * 2} height={height + pad * 2} style={{ left: -pad, top: -pad }} />;
};
const KaijuCircuit = ({ wordRef }) => {
  const [box, setBox] = useState(undefined);
  const [layout, setLayout] = useState(undefined);
  const [lengths, setLengths] = useState(undefined);
  const [isStarting] = useState(() => { const first = !isNeonLit; isNeonLit = true; return first; });
  const [sparkSpots, setSparkSpots] = useState([]);
  const textRef = useRef(null);
  const pathRefs = useRef([]);
  useLayoutEffect(() => {
    const word = wordRef.current;
    if (!word) return;
    const measure = () => {
      const holder = word.offsetParent;
      if (!holder) return;
      const range = document.createRange();
      range.selectNodeContents(word);
      const text = range.getBoundingClientRect();
      const around = holder.getBoundingClientRect();
      const k = around.width / holder.offsetWidth; // (the title's own scale, and the logo's)
      const style = window.getComputedStyle(word);
      setBox({ left: (text.left - around.left) / k, top: (text.top - around.top) / k, width: text.width / k, height: text.height / k, font: style.fontFamily, size: parseFloat(style.fontSize), spacing: style.letterSpacing });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    else measure();
  }, []);
  // the baseline and each letter's start, from an SVG copy of the word set as the browser sets it
  useLayoutEffect(() => {
    if (!box || !textRef.current) return;
    const copy = textRef.current;
    const baseline = -copy.getBBox().y;
    const starts = kaijuGlyphs.letters.map((_, k) => copy.getStartPositionOfChar(k).x);
    setLayout({ baseline, starts });
  }, [box]);
  // each letter's outline length, for its opening's size and its lap
  useLayoutEffect(() => {
    if (!layout) return;
    setLengths(pathRefs.current.map(path => (path ? path.getTotalLength() : 0)));
    // the sparks' spots: points round the letters' borders, in the word's px
    if (isStarting) {
      const scale0 = box.size / kaijuGlyphs.upm;
      setSparkSpots(pathRefs.current.flatMap((path, k) => {
        if (!path) return [];
        const total = path.getTotalLength();
        return [...Array(8).keys()].map(j => {
          const point = path.getPointAtLength((total * (j + Math.random())) / 8);
          return [layout.starts[k] + point.x * scale0, layout.baseline - point.y * scale0];
        });
      }));
    }
  }, [layout]);
  if (!box) return null;
  const scale = box.size / kaijuGlyphs.upm;
  const units = px => px / scale; // (the paths are in the font's units)
  return (
    <BorderBox aria-hidden="true" width={box.width} height={box.height} style={{ left: box.left, top: box.top }}>
      <text ref={textRef} x={0} y={0} fontFamily={box.font} fontSize={box.size} letterSpacing={box.spacing} fill="none" opacity={0}>Kaiju</text>
      <defs>
        <filter id="kaiju-neon" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={BORDER.glow} result="wide" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={BORDER.glow * 0.35} result="near" />
          {/* (the wide glow twice: purple is dark, once was faint) */}
          <feMerge><feMergeNode in="wide" /><feMergeNode in="wide" /><feMergeNode in="near" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {layout && kaijuGlyphs.letters.map(({ path }, k) => (
          // (the ring only: everything within the gap of the letter, and the letter itself, masked away)
          <mask key={k} id={`kaiju-ring-${k}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={-5000} y={-5000} width={10000} height={10000}>
            <rect x={-5000} y={-5000} width={10000} height={10000} fill="white" />
            <path d={path} fill="black" stroke="black" strokeWidth={units(BORDER.gap * 2)} strokeLinejoin="round" />
          </mask>
        ))}
      </defs>
      {layout && (
        <g className={`neon${isStarting ? " starting" : ""}`} filter="url(#kaiju-neon)">
          {kaijuGlyphs.letters.map(({ path }, k) => {
            const length = lengths ? lengths[k] : 0;
            const opening = length * BORDER.opening;
            return (
              <g key={k} transform={`translate(${layout.starts[k]} ${layout.baseline}) scale(${scale} ${-scale})`}>
                <path ref={el => { pathRefs.current[k] = el; }} d={path} fill="none" stroke={BORDER.color} strokeWidth={units((BORDER.gap + BORDER.width) * 2)} strokeLinejoin="round" mask={`url(#kaiju-ring-${k})`}
                  strokeDasharray={length ? `${length - opening} ${opening}` : undefined} strokeDashoffset={length * (k / 5)} />
              </g>
            );
          })}
        </g>
      )}
      {isStarting && sparkSpots.length > 0 && (
        <foreignObject x={-SPARK_PAD} y={-SPARK_PAD} width={box.width + SPARK_PAD * 2} height={box.height + SPARK_PAD * 2} style={{ overflow: "visible" }}>
          <div style={{ position: "relative", left: SPARK_PAD, top: SPARK_PAD }}>
            <NeonSparks spots={sparkSpots} width={box.width} height={box.height} pad={SPARK_PAD} />
          </div>
        </foreignObject>
      )}
    </BorderBox>
  );
};
const SPARK_PAD = 120;

// 'joiner': the landing's (Jamie, 2026-11-18): over the skyline's bottom, grounding it in the Peninsula behind
// (scripts/landingJoiner.py); an image in the logo's own box, so it zooms with the skyline; 'spotlights': the
// landing's searchlights (also in the logo's box: MainMenu zooms them with the skyline); 'circuit': the landing's live
// border on "Kaiju"
// 'baseJoiner': the landing's (Jamie, 2026-11-19): the skyline's base blue carried down over the walking Kaiju's feet
export const Logo = ({ joiner = false, spotlights = false, circuit = false, baseJoiner = false }) => {
  const wordRef = useRef(null);
  return (<LogoWrapper>
  <Title isDescription={false} style={{ translate: "0 calc(var(--logo-lift, 0px) * -1)" }}>
    <StyledSpookyText ref={wordRef} isDescription={true}>Kaiju</StyledSpookyText>{" "}
    <StyledSciFiText>City</StyledSciFiText>
    <StyledSpookyTextShadow>Kaiju</StyledSpookyTextShadow>{" "}
    {circuit && <KaijuCircuit wordRef={wordRef} />}
  </Title>
  {/* (behind the skyline: Jamie, round 6; each part placed up or down by the landing's tuner: --joiner-* in logo px) */}
  {joiner && <LogoImage src={"/zoom-scene/landing-joiner-glow.png"} alt="" style={{ translate: "0 calc(var(--logo-lift, 0px) * -1 + var(--skyline-y, 0px) + var(--joiner-both, 0px) + var(--joiner-glow, 0px))" }} />}
  {joiner && <LogoImage src={"/zoom-scene/landing-joiner.png"} alt="" style={{ translate: "0 calc(var(--logo-lift, 0px) * -1 + var(--skyline-y, 0px) + var(--joiner-both, 0px) + var(--joiner-band, 0px))" }} />}
  <LogoImage src={"./SVG_logo.svg"} data-landing-logo />
  {/* (the spotlights behind the base joiner: their bright starts hidden by it: Jamie) */}
  {spotlights && <Spotlights />}
  {baseJoiner && <BaseJoinerBox data-base-joiner aria-hidden="true" />}
  <KaijuWrapper >
    <SpriteSheet />
    <Breath />
  </KaijuWrapper>
  <KaijuWrapper isSmoke={true}>
    <SpriteSheet isSmoke={true}/>
  </KaijuWrapper>
</LogoWrapper>);
};