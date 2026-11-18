import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";

/*
  The side monitor's Kaiju tamagotchi (Jamie, 2026-11-15): a silly mini-game while the player hasn't picked three
  powers and isn't hovering one. All lo-fi, glowing yellow like an old LCD pet (mid-90s, early-00s).
  - The Kaiju (the game's own sprite, as a yellow silhouette, its frames stepped choppily) strolls lazily about,
    stopping often to turn left and right, and now and then says "Pick three abilities".
  - Feed: pellets (faded, flowing green) drop from the top; it goes and eats them.
  - About every 15 s it leaves a poop (a fainter yellow, so the Kaiju stays first).
  - Clean up takes away one poop a click; the last one gone, hearts float up from it. Pet: hearts too.
  - Happiness, 5 blocks, starts full: every 10 s, one off if there's a poop about; every 30 s, one off if it wasn't
    fed or petted in that time. At none, it bursts into flames; 5 s later a new one hatches from an egg, with a new name.
  - It lives on between visits to the picker (this module keeps it), and its clock runs only while it's on screen.
*/
// (green, the Agent's, as a trial: Jamie, playtest 32; was yellow #ffd24a, glow #ffb020)
const TAMA = {
  color: "#80EF80",
  glow: "0 0 0.35cqw #3cd43c",
  tickMs: 100,
  nameSize: 1.7, // cqw (a little smaller, under its "Pet Kaiju:" label: Jamie), smaller for a long name
  groundY: 0.78, // the bottom of its sprite's frame as it walks, of the LCD's height from the top (Jamie: up a little
  // again); its poops sit there too, and its bubble, hand, flames and egg go by it
  feetAbove: 0.058, // its feet, above that: a fifth of the frame up from its bottom (measured: 182 of 230)
  kaijuHeight: 7, // cqw
  walkPerSecond: 0.05, // of the screen's width: lazy
  hurryPerSecond: 0.14, // to food
  frameMs: 220, // its walk's frames, stepped slow and choppy
  speakEveryMs: [3500, 6000], speakMs: 2600, // (more often: Jamie)
  poopEveryMs: [12000, 18000],
  poopGap: 0.09, // poops at least this far apart (of the screen's width)
  cleanFlashMs: 700, // a cleaned-up poop blinks, as a Game Boy sprite does, then it's gone (Jamie)
  happinessMax: 5,
  poopCheckMs: 10000, careCheckMs: 30000,
  // back up, quickly (Jamie): a block for each care (fed, petted, all cleaned up), and every 4 s a block while it's
  // clean and was cared for in the last 30 s
  upCheckMs: 4000, caredWithinMs: 30000,
  petMs: [2000, 4000], // the hand's petting, before the hearts
  burnMs: 1300, eggMs: 5000,
  heartMs: 1400,
  pelletFallPerSecond: 0.55
};

// the in-game Kaiju's sheet: 10 frames a row; from the top, its rows face right, right (three-quarters), front, left,
// and away twice. Walking: the side views, row 3 (left) and row 0 (right; row 5 faced away: Jamie)
const SHEET = { src: "/spritesheet/kaiju_sprite2.png", frames: 10, rows: 6, frameWidth: 180, frameHeight: 230.33, rowLeft: 3, rowRight: 0 };
// the burning sheet: in the game it's drawn at 1.5 times the walk's pixel scale (0.6 to 0.4), its figure's bottom at
// 127 of its 155 (measured): so here too, standing on the Kaiju's feet (Jamie: it was too big and sat wrong)
const BURN = { src: "/spritesheet/burning_kaiju_sprite.png", frames: 6, frameWidth: 103, frameHeight: 155, scaleToWalk: 1.5, figureBottom: 127 };

// its names: 8 letters at most, so a name fits the LCD at full size (Jamie: the long ones ran off it)
const NAMES = [
  "Mochi", "Biscuit", "Gizmo", "Pickles", "Noodle", "Waffles", "Pudding", "Tofu", "Bubbles", "Pebble", "Sprout",
  "Nugget", "Dumpling", "Wasabi", "Peanut", "Muffin", "Taco", "Bagel", "Pretzel", "Kiwi", "Mango", "Chomp", "Rumble",
  "Stompy", "Gnasher", "Scales", "Pancake", "Doodle", "Squish", "Bean", "Crumpet", "Fizz", "Turnip", "Kumquat",
  "Tater"
];

// what it says (Jamie): every other line "Pick three abilities", these in turn between; a long one stays up longer
// (Jamie's, some tightened by Claude with his leave: draft)
const LINES = [
  "Your three powers determine your class.",
  "Each power has an active and a passive ability.",
  "Fire active abilities with keys 1-3.",
  "A passive works while its active is on cooldown.",
  "Hover over a power to read about it.",
  "I'm a nice Kaiju. Most want to kill you.",
  "Kaiju come from the sea to attack the city!",
  "Your teammate will help you fight!",
  "Press Play! when ready."
];
// the order (Jamie): kept for the play (this module), not per Kaiju, so a new one hatched carries on where the last left
// off; each line once, in order, then at random (never the same twice running). Every other line "Pick three abilities"
const SPOKEN = { count: 0, said: 0, last: -1 };
const getNextLine = () => {
  const isPick = SPOKEN.count % 2 == 0;
  SPOKEN.count += 1;
  if (isPick) return "Pick three abilities";
  if (SPOKEN.said < LINES.length) {
    SPOKEN.last = SPOKEN.said;
    return LINES[SPOKEN.said++];
  }
  let k = Math.floor(Math.random() * LINES.length);
  if (k == SPOKEN.last) k = (k + 1) % LINES.length;
  SPOKEN.last = k;
  return LINES[k];
};
// the bubble shrink-wrapped to its line (Jamie): as few, even lines as fit in 'maxCqw', its text's width from the
// font's (about one em a letter)
const BUBBLE = { maxCqw: 15, letterEm: 1.0, longSize: 1.12 };
const getBubbleWidth = line => {
  const size = line.length > 24 ? BUBBLE.longSize : 1.2;
  const full = line.length * size * BUBBLE.letterEm;
  const lines = Math.ceil(full / BUBBLE.maxCqw);
  // (room for the padding, both sides, so no letter meets the border)
  return Math.min(BUBBLE.maxCqw + 2, full / lines + size * 2.5 + 2);
};
const getSpeakMs = line => TAMA.speakMs + line.length * 45;

const between = ([low, high]) => low + Math.random() * (high - low);
let thingId = 0;

// one name, a mascot's (Jamie, playtest 29: "Stompy"); the next ones from the egg by their generation (NAMES kept, the
// old pool)
const MASCOT = "Stompy";
const newPet = (generation = 1) => ({
  name: generation > 1 ? `${MASCOT} Gen ${generation}` : MASCOT,
  generation,
  clock: 0,
  happiness: TAMA.happinessMax,
  x: 0.5, facing: "left", frame: 0, frameAt: 0,
  mode: "idle", modeUntil: 0, targetX: 0.5, turnsLeft: 0,
  // (Jamie, playtest 36: in the middle from the start, its hello at once, then "Pick three abilities", and only then
  // off for a wander: 'isGreeting' until the second line is done)
  speakingUntil: 0, nextSpeakAt: 200, lineCount: 0, line: "Pick three abilities", hasIntroduced: false,
  isGreeting: true, greetingEndsAt: 0,
  nextPoopAt: between(TAMA.poopEveryMs),
  nextPoopCheckAt: TAMA.poopCheckMs, nextCareCheckAt: TAMA.careCheckMs, caredSinceCheck: false,
  poops: [], pellets: [], hearts: [],
  lastCareAt: -Infinity, nextUpCheckAt: 4000, petUntil: 0,
  burnAt: 0, eggUntil: 0
});

// the pet lives on between visits (this module keeps it for the page's life)
let PET = newPet();

// held: its clock stops while something's over it (the Controls card) or the tab is hidden (Jamie: it got unhappy
// while he was away)
// held still for any of its reasons (the controls card; its screen cut off, Jamie playtest 34): its clock stops
const holds = new Set();
let isHeld = false;
export const holdTamagotchi = (held, reason = "controls") => {
  if (held) holds.add(reason);
  else holds.delete(reason);
  isHeld = holds.size > 0;
};
// has it said hello yet (this visit's pet): the picker waits for its first "Pick three abilities" until it has
export const getHasTamagotchiIntroduced = () => PET.hasIntroduced;
// met already (a power picked as the picker opens: Jamie, playtest 35): no hello
export const markTamagotchiIntroduced = () => { PET = { ...PET, hasIntroduced: true, isGreeting: false }; };

// cared for: counts for the 30 s check, and a block of happiness back
const care = pet => ({ ...pet, caredSinceCheck: true, lastCareAt: pet.clock, happiness: Math.min(TAMA.happinessMax, pet.happiness + 1) });

const heartsFrom = (pet, count) => [...Array(count).keys()].map(k => ({ id: thingId++, x: pet.x + (k - (count - 1) / 2) * 0.05, at: pet.clock + k * 120 }));

// one step of its life
const step = pet => {
  const next = { ...pet, clock: pet.clock + TAMA.tickMs };
  const now = next.clock;
  const seconds = TAMA.tickMs / 1000;
  next.hearts = next.hearts.filter(heart => now - heart.at < TAMA.heartMs);
  next.cleaned = (next.cleaned || []).filter(poop => now - poop.at < TAMA.cleanFlashMs);

  // burning, then an egg, then a new one
  if (next.mode == "burn") {
    if (now - next.burnAt > TAMA.burnMs) return { ...next, mode: "egg", eggUntil: now + TAMA.eggMs, poops: [], pellets: [] };
    return next;
  }
  if (next.mode == "egg") {
    if (now >= next.eggUntil) {
      const born = newPet(next.generation + 1);
      return { ...born, hearts: heartsFrom({ ...born, clock: 0 }, 3) };
    }
    return next;
  }

  // food falls to the ground
  next.pellets = next.pellets.map(pellet => ({ ...pellet, y: Math.min((TAMA.groundY - TAMA.feetAbove), pellet.y + TAMA.pelletFallPerSecond * seconds) }));

  // happiness: poop left about, or no care
  if (now >= next.nextPoopCheckAt) {
    if (next.poops.length) next.happiness -= 1;
    next.nextPoopCheckAt = now + TAMA.poopCheckMs;
  }
  if (now >= next.nextCareCheckAt) {
    if (!next.caredSinceCheck) next.happiness -= 1;
    next.caredSinceCheck = false;
    next.nextCareCheckAt = now + TAMA.careCheckMs;
  }
  if (now >= next.nextUpCheckAt) {
    if (!next.poops.length && now - next.lastCareAt < TAMA.caredWithinMs) next.happiness = Math.min(TAMA.happinessMax, next.happiness + 1);
    next.nextUpCheckAt = now + TAMA.upCheckMs;
  }
  if (next.happiness <= 0) return { ...next, happiness: 0, mode: "burn", burnAt: now };

  // being petted: it stands still for the hand; when the hand goes, the hearts, and a block back
  if (next.petUntil) {
    if (now < next.petUntil) return next;
    return { ...care(next), petUntil: 0, modeUntil: now, hearts: [...next.hearts, ...heartsFrom(next, 3)] };
  }

  // a poop, behind it, never on another (Jamie): the nearest clear spot behind it; none clear, it holds on
  if (now >= next.nextPoopAt) {
    const behind = next.facing == "left" ? 1 : -1;
    const spots = [...Array(24).keys()].map(k => next.x + behind * (0.07 + k * 0.035)).concat([...Array(24).keys()].map(k => next.x - behind * (0.07 + k * 0.035)));
    const spot = spots.find(x => x >= 0.08 && x <= 0.92 && next.poops.every(poop => Math.abs(poop.x - x) >= TAMA.poopGap));
    if (spot !== undefined) next.poops = [...next.poops, { id: thingId++, x: spot }];
    next.nextPoopAt = now + between(TAMA.poopEveryMs);
  }

  // what it does: eat if there's food down, else speak now and then, else stroll and stop and turn
  const food = next.pellets.filter(pellet => pellet.y >= (TAMA.groundY - TAMA.feetAbove) - 0.01).sort((a, b) => Math.abs(a.x - next.x) - Math.abs(b.x - next.x))[0];
  const walkTo = (x, perSecond) => {
    const gap = x - next.x;
    next.facing = gap < 0 ? "left" : "right";
    next.x += Math.sign(gap) * Math.min(Math.abs(gap), perSecond * seconds);
    if (now - next.frameAt >= TAMA.frameMs) {
      next.frame = (next.frame + 1) % SHEET.frames;
      next.frameAt = now;
    }
    return Math.abs(x - next.x) < 0.01;
  };
  // its line: only from the middle of the screen, so the bubble stays inside the LCD (Jamie): when it's time, it
  // walks back to the middle first, then says it
  let isSpeaking = now < next.speakingUntil;
  const isDueToSpeak = !isSpeaking && !food && now >= next.nextSpeakAt;
  if (isDueToSpeak && walkTo(0.5, TAMA.walkPerSecond * 1.6)) {
    // its first words, first time out or new from its egg: who it is (Jamie), before anything else
    const isHello = !next.hasIntroduced;
    const isGreetingPick = !isHello && next.isGreeting; // (the line straight after the hello: always the pick)
    next.line = isHello ? `I'm ${MASCOT}!` : isGreetingPick ? "Pick three abilities" : getNextLine(); // (no generation number in it: Jamie, playtest 34; was "Hi, I am ..., your virtual Kaiju!")
    next.hasIntroduced = true;
    // (its hello up twice as long, so it's seen: Jamie, playtest 29)
    next.speakingUntil = now + getSpeakMs(next.line) * (isHello ? 2 : 1);
    // (after the hello, "Pick three abilities" straight away: the picker's pendants wait for it. Jamie, playtest 34)
    next.nextSpeakAt = next.speakingUntil + (isHello ? 500 : between(TAMA.speakEveryMs));
    if (isGreetingPick) next.greetingEndsAt = next.speakingUntil;
    next.frame = 0;
    isSpeaking = true;
  }
  if (next.isGreeting && next.greetingEndsAt && now >= next.greetingEndsAt) next.isGreeting = false;
  if (isDueToSpeak) {
    // (on its way to the middle)
  } else if (next.isGreeting && !isSpeaking && !food) {
    walkTo(0.5, TAMA.walkPerSecond * 1.6); // (greeting: it stays in the middle)
  } else if (food && !isSpeaking) {
    if (walkTo(food.x, TAMA.hurryPerSecond)) {
      next.pellets = next.pellets.filter(pellet => pellet !== food);
      if (!next.pellets.length) Object.assign(next, care(next)); // the last of a feeding: a block back
      else next.caredSinceCheck = true;
    }
  } else if (!isSpeaking) {
    if (now >= next.modeUntil) {
      // lazily: stop and look about now and then, but amble more, over to the far side (Jamie: it gets to both sides)
      if (next.mode == "walk" && Math.random() < 0.6) {
        next.mode = "idle";
        next.turnsLeft = Math.floor(between([1, 4]));
        next.modeUntil = now + between([700, 1300]);
      } else {
        next.mode = "walk";
        next.targetX = next.x < 0.5 ? between([0.62, 0.88]) : between([0.12, 0.38]);
        next.modeUntil = now + between([5000, 9000]);
      }
    }
    if (next.mode == "walk") {
      if (walkTo(next.targetX, TAMA.walkPerSecond)) next.modeUntil = now;
    } else if (next.mode == "idle" && next.turnsLeft > 0 && now >= next.modeUntil - 200) {
      // a turn the other way, and a beat
      next.facing = next.facing == "left" ? "right" : "left";
      next.turnsLeft -= 1;
      next.frame = 0;
      next.modeUntil = now + between([600, 1200]);
    }
  }
  return next;
};

// the buttons on the side monitor's top border
const act = (pet, label) => {
  if (pet.mode == "burn" || pet.mode == "egg") return pet;
  if (label == "Feed") {
    const pellets = [...Array(3).keys()].map(() => ({ id: thingId++, x: between([0.12, 0.88]), y: 0.08 + Math.random() * 0.05 }));
    return { ...pet, pellets: [...pet.pellets, ...pellets] };
  }
  // a hand comes and pets it a few seconds; the hearts come after (Jamie)
  if (label == "Pet") return pet.petUntil ? pet : { ...pet, petUntil: pet.clock + between(TAMA.petMs), mode: "idle", modeUntil: pet.clock + 99999 };
  if (label == "Clean up") {
    if (!pet.poops.length) return pet;
    const poops = pet.poops.slice(1);
    // (it blinks a moment where it was, then goes)
    const cleaned = [...(pet.cleaned || []), { ...pet.poops[0], at: pet.clock }];
    return poops.length ? { ...pet, poops, cleaned } : { ...care(pet), poops, cleaned, hearts: [...pet.hearts, ...heartsFrom(pet, 4)] };
  }
  return pet;
};

// the side screen around it: black (Jamie, as a tamagotchi's case)
const Screen = styled.div`
  position: absolute;
  inset: 0;
  background: black;
`;

// the backlit LCD: a softly lit square holding the name, the Kaiju and the meter (Jamie)
const Lcd = styled.div`
  position: absolute;
  inset: 6% 7%;
  overflow: hidden;
  border-radius: 0.6cqw;
  color: ${TAMA.color};
  font-family: gameboy;
  text-shadow: ${TAMA.glow};
  background: radial-gradient(ellipse at 50% 45%, rgba(128, 239, 128, 0.11), rgba(110, 220, 110, 0.04) 75%);
  border: 0.12cqw solid rgba(128, 239, 128, 0.35);
  box-shadow: 0 0 0.8cqw rgba(110, 220, 110, 0.25), inset 0 0 1.2cqw rgba(110, 220, 110, 0.12);
  /* an old LCD's dot grid over it all */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(to right, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 4px);
  }
`;

// "Pet Kaiju:" over the name, smaller than it (Jamie)
const NameLabel = styled.div`
  position: absolute;
  top: 4%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.8cqw;
  letter-spacing: 0.1cqw;
  opacity: 0.8;
`;

const Name = styled.div`
  position: absolute;
  top: 10%;
  left: 0;
  right: 0;
  text-align: center;
  letter-spacing: 0.12cqw;
  white-space: nowrap;
`;

// the Kaiju: the sheet's shape, filled yellow
const Body = styled.div`
  position: absolute;
  height: ${TAMA.kaijuHeight}cqw;
  width: ${TAMA.kaijuHeight * SHEET.frameWidth / SHEET.frameHeight}cqw;
  transform: translate(-50%, -100%);
  background: ${TAMA.color};
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: ${SHEET.frames * 100}% ${SHEET.rows * 100}%;
  mask-size: ${SHEET.frames * 100}% ${SHEET.rows * 100}%;
  filter: drop-shadow(0 0 0.3cqw #3cd43c);
`;

const Bubble = styled.div`
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 0.65cqw 1cqw;
  /* (a long line only a touch smaller now, easier to read; the bubble grows up over the name if it must, above it:
     Jamie, playtest 32; was 0.95) */
  font-size: ${props => props.$isLong ? BUBBLE.longSize : 1.2}cqw;
  z-index: 5;
  line-height: 1.3;
  text-wrap: balance;
  text-align: center;
  background: #050402;
  border: 0.14cqw solid ${TAMA.color};
  box-shadow: ${TAMA.glow};
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -0.7cqw;
    width: 0.5cqw;
    height: 0.55cqw;
    transform: translateX(-50%);
    background: ${TAMA.color};
    clip-path: polygon(0 0, 100% 0, 30% 100%);
  }
`;

// food: yellow like the rest of the LCD (one-color screens: Claude's suggestion, Jamie unsure; was faded green #80EF80)
const FOOD_COLOR = TAMA.color;
const pelletGlow = keyframes`
  from { opacity: 0.55; box-shadow: 0 0 0.2cqw ${FOOD_COLOR}; }
  to { opacity: 0.9; box-shadow: 0 0 0.45cqw ${FOOD_COLOR}; }
`;

const Pellet = styled.div`
  position: absolute;
  width: 0.5cqw;
  height: 0.5cqw;
  transform: translate(-50%, -100%);
  background: ${FOOD_COLOR};
  animation: ${pelletGlow} 0.6s ease-in-out infinite alternate;
`;

// a swirled pile, three stacked lumps and a curl on top (no face: Jamie); the Kaiju's yellow (Jamie: all one color)
const POOP_BROWN = TAMA.color;
// cleaned up: on and off, hard, as an old handheld's sprite blinks, then gone
const poopBlink = keyframes`
  0%, 24%, 50%, 74% { visibility: visible; }
  12%, 37%, 62%, 87%, 100% { visibility: hidden; }
`;
const Poop = styled.div`
  position: absolute;
  width: 1.7cqw;
  height: 1.5cqw;
  transform: translate(-50%, -100%);
  filter: drop-shadow(0 0 0.3cqw #3cd43c);
  ${props => props.$isCleaned && css`animation: ${poopBlink} ${TAMA.cleanFlashMs}ms steps(1, end) forwards;`}
  background:
    radial-gradient(ellipse 50% 32% at 50% 82%, ${POOP_BROWN} 98%, transparent),
    radial-gradient(ellipse 36% 26% at 50% 55%, ${POOP_BROWN} 98%, transparent),
    radial-gradient(ellipse 22% 20% at 50% 32%, ${POOP_BROWN} 98%, transparent),
    radial-gradient(ellipse 10% 14% at 58% 14%, ${POOP_BROWN} 98%, transparent);
`;

const heartUp = keyframes`
  0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(-50%, -5cqw) scale(1.1); opacity: 0; }
`;

// (a symbol's emoji look made one flat yellow: the glyph clear, its shadow in the color)
const Heart = styled.div`
  position: absolute;
  font-size: 1.2cqw;
  color: transparent;
  text-shadow: 0 0 0 ${TAMA.color}, 0 0 0.35cqw #3cd43c;
  animation: ${heartUp} ${TAMA.heartMs}ms ease-out forwards;
`;

const burn = keyframes`
  from { -webkit-mask-position: 0 0; mask-position: 0 0; }
  to { -webkit-mask-position: 100% 0; mask-position: 100% 0; }
`;

const BURN_HEIGHT = BURN.frameHeight * (TAMA.kaijuHeight / SHEET.frameHeight) * BURN.scaleToWalk; // cqw
const Flames = styled.div`
  position: absolute;
  height: ${BURN_HEIGHT}cqw;
  width: ${BURN_HEIGHT * BURN.frameWidth / BURN.frameHeight}cqw;
  transform: translate(-50%, -${(BURN.figureBottom / BURN.frameHeight) * 100}%);
  background: ${TAMA.color};
  -webkit-mask: url(${BURN.src}) no-repeat;
  mask: url(${BURN.src}) no-repeat;
  -webkit-mask-size: ${BURN.frames * 100}% 100%;
  mask-size: ${BURN.frames * 100}% 100%;
  animation: ${burn} ${TAMA.burnMs}ms steps(${BURN.frames - 1}) forwards;
  filter: drop-shadow(0 0 0.5cqw #ff8a20);
`;

const wobble = keyframes`
  0%, 70%, 100% { transform: translate(-50%, -100%) rotate(0deg); }
  78% { transform: translate(-50%, -100%) rotate(-10deg); }
  86% { transform: translate(-50%, -100%) rotate(9deg); }
  94% { transform: translate(-50%, -100%) rotate(-5deg); }
`;

const Egg = styled.div`
  position: absolute;
  width: 3cqw;
  height: 3.8cqw;
  border: 0.18cqw solid ${TAMA.color};
  border-radius: 50% 50% 46% 46% / 60% 60% 40% 40%;
  box-shadow: ${TAMA.glow}, inset ${TAMA.glow};
  animation: ${wobble} 1.2s ease-in-out infinite;
  /* a zig-zag crack */
  &::after {
    content: "";
    position: absolute;
    left: 15%;
    right: 15%;
    top: 42%;
    height: 0.6cqw;
    background: ${TAMA.color};
    clip-path: polygon(0 50%, 15% 0, 30% 60%, 45% 10%, 60% 70%, 75% 20%, 90% 70%, 100% 40%, 100% 60%, 90% 90%, 75% 40%, 60% 90%, 45% 30%, 30% 80%, 15% 20%, 0 70%);
  }
`;

// the petting hand: lo-fi yellow, come from above, stroking back and forth over the Kaiju's head
const stroke = keyframes`
  0% { transform: translate(-80%, -100%) rotate(-12deg); }
  50% { transform: translate(-20%, -85%) rotate(8deg); }
  100% { transform: translate(-80%, -100%) rotate(-12deg); }
`;
const handIn = keyframes`
  from { opacity: 0; margin-top: -3cqw; }
  to { opacity: 1; margin-top: 0; }
`;
const Hand = styled.div`
  position: absolute;
  font-size: 2.4cqw;
  line-height: 1;
  color: transparent;
  text-shadow: 0 0 0 ${TAMA.color};
  filter: drop-shadow(0 0 0.3cqw #3cd43c);
  animation: ${handIn} 300ms ease-out both, ${stroke} 700ms ease-in-out 300ms infinite;
`;

const Meter = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4%; /* (a little up, then a little down again: Jamie) */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8cqw;
`;

const MeterFace = styled.span`
  font-family: "Segoe UI Symbol", "DejaVu Sans", sans-serif;
  font-size: 1.6cqw;
  line-height: 1;
`;

const MeterBox = styled.div`
  display: flex;
  gap: 0.3cqw;
  padding: 0.3cqw;
  border: 0.14cqw solid ${TAMA.color};
  box-shadow: ${TAMA.glow};
`;

const Block = styled.div`
  width: 0.9cqw;
  height: 1.5cqw;
  background: ${props => props.$isOn ? TAMA.color : "transparent"};
  box-shadow: ${props => props.$isOn ? TAMA.glow : "none"};
  outline: 0.08cqw solid rgba(128, 239, 128, 0.25);
`;

// 'actRef': the side monitor's buttons call actRef.current(label)
// 'onPickThree': told each time it says "Pick three abilities" (the picker's pendants flash: Jamie, playtest 32)
export const Tamagotchi = ({ actRef, onPickThree = undefined }) => {
  const [pet, setPet] = useState(PET);
  const onPickThreeRef = useRef(onPickThree);
  onPickThreeRef.current = onPickThree;
  useEffect(() => {
    if (pet.clock < pet.speakingUntil && /pick three/i.test(pet.line || "") && onPickThreeRef.current) onPickThreeRef.current();
  }, [pet.speakingUntil]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (isHeld || document.hidden) return;
      PET = step(PET);
      setPet(PET);
    }, TAMA.tickMs);
    return () => clearInterval(tick); // off screen: its clock stops, and it waits here as it was
  }, []);
  useImperativeHandle(actRef, () => label => {
    PET = act(PET, label);
    setPet(PET);
  }, []);

  const y = `${TAMA.groundY * 100}%`;
  const isSpeaking = pet.clock < pet.speakingUntil && pet.mode != "burn" && pet.mode != "egg";
  const row = pet.facing == "left" ? SHEET.rowLeft : SHEET.rowRight;
  const maskPosition = `${(pet.frame / (SHEET.frames - 1)) * 100}% ${(row / (SHEET.rows - 1)) * 100}%`;
  return (
    <Screen>
      <Lcd>
      {/* its name: an egg's is not known yet (Jamie): "???" until it hatches with its own */}
      <NameLabel>Pet Kaiju:</NameLabel>
      {/* the name first; "Gen #" after it, smaller (Jamie, playtest 32: the name has primacy) */}
      <Name style={{ fontSize: `${Math.min(TAMA.nameSize, 14 / MASCOT.length)}cqw` }}>{pet.mode == "egg" ? "???" : (
        <>{MASCOT.toUpperCase()}{pet.generation > 1 && <span style={{ fontSize: "0.5em", marginLeft: "0.6em", verticalAlign: "0.15em" }}>GEN {pet.generation}</span>}</>
      )}</Name>
      {pet.pellets.map(({ id, x, y: pelletY }) => <Pellet key={id} style={{ left: `${x * 100}%`, top: `${pelletY * 100}%` }} />)}
      {pet.poops.map(({ id, x }) => <Poop key={id} style={{ left: `${x * 100}%`, top: y }} />)}
      {(pet.cleaned || []).map(({ id, x }) => <Poop key={id} $isCleaned style={{ left: `${x * 100}%`, top: y }} />)}
      {pet.mode == "burn" && <Flames style={{ left: `${pet.x * 100}%`, top: `${(TAMA.groundY - TAMA.feetAbove) * 100}%` }} />}
      {pet.mode == "egg" && <Egg style={{ left: "50%" /* (in the middle, where the new one comes out: Jamie, playtest 29) */, top: `${(TAMA.groundY - TAMA.feetAbove) * 100}%` }} />}
      {pet.mode != "burn" && pet.mode != "egg" && (
        <Body style={{ left: `${pet.x * 100}%`, top: y, WebkitMaskImage: `url(${SHEET.src})`, maskImage: `url(${SHEET.src})`, WebkitMaskPosition: maskPosition, maskPosition }} />
      )}
      {pet.petUntil > 0 && pet.mode != "burn" && <Hand style={{ left: `${pet.x * 100}%`, top: `calc(${y} - ${TAMA.kaijuHeight * 0.75}cqw)` }}>🖐</Hand>}
      {isSpeaking && <Bubble $isLong={pet.line.length > 24} style={{ left: "50%", top: `calc(${y} - ${TAMA.kaijuHeight + 1.2}cqw)`, width: `${getBubbleWidth(pet.line)}cqw` }}>{pet.line}</Bubble>}
      {pet.hearts.filter(({ at }) => pet.clock >= at).map(({ id, x }) => (
        <Heart key={id} style={{ left: `${x * 100}%`, top: `calc(${y} - ${TAMA.kaijuHeight}cqw)` }}>♥</Heart>
      ))}
      <Meter>
        <MeterFace>☹</MeterFace>
        <MeterBox>{[...Array(TAMA.happinessMax).keys()].map(k => <Block key={k} $isOn={k < pet.happiness} />)}</MeterBox>
        <MeterFace>☺</MeterFace>
      </Meter>
      </Lcd>
    </Screen>
  );
};

// (for its test)
export const TAMAGOTCHI_RULES = { TAMA, step, act, newPet };
