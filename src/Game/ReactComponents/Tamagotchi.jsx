import React, { useEffect, useImperativeHandle, useState } from "react";
import styled, { keyframes } from "styled-components";

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
const TAMA = {
  color: "#ffd24a",
  glow: "0 0 0.35cqw #ffb020",
  tickMs: 100,
  nameSize: 2.1, // cqw (twice what it was: Jamie), smaller for a long name
  groundY: 0.76, // where it walks, of the LCD's height (from the top; lower: Jamie)
  kaijuHeight: 7, // cqw
  walkPerSecond: 0.05, // of the screen's width: lazy
  hurryPerSecond: 0.14, // to food
  frameMs: 220, // its walk's frames, stepped slow and choppy
  speakEveryMs: [9000, 15000], speakMs: 2600,
  poopEveryMs: [12000, 18000],
  poopGap: 0.09, // poops at least this far apart (of the screen's width)
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
const BURN = { src: "/spritesheet/burning_kaiju_sprite.png", frames: 6, frameWidth: 103, frameHeight: 155 };

const NAMES = ["Mochi", "Biscuit", "Gizmo", "Pickles", "Noodle", "Waffles", "Pudding", "Tofu", "Bubbles", "Pebble", "Sprout",
  "Nugget", "Dumpling", "Wasabi", "Peanut", "Jellybean", "Muffin", "Taco", "Bagel", "Pretzel", "Kiwi", "Mango", "Sprinkles",
  "Chomp", "Rumble", "Stompy", "Gnasher", "Scales", "Zilla Jr.", "Pancake", "Doodle", "Squish", "Bean", "Crumpet", "Fizz",
  "Snickerdoodle", "Turnip", "Marshmallow", "Kumquat", "Tater"];

const between = ([low, high]) => low + Math.random() * (high - low);
let thingId = 0;

const newPet = (generation = 1) => ({
  name: NAMES[Math.floor(Math.random() * NAMES.length)],
  generation,
  clock: 0,
  happiness: TAMA.happinessMax,
  x: 0.5, facing: "left", frame: 0, frameAt: 0,
  mode: "walk", modeUntil: 3000, targetX: 0.35, turnsLeft: 0,
  speakingUntil: 0, nextSpeakAt: 2500,
  nextPoopAt: between(TAMA.poopEveryMs),
  nextPoopCheckAt: TAMA.poopCheckMs, nextCareCheckAt: TAMA.careCheckMs, caredSinceCheck: false,
  poops: [], pellets: [], hearts: [],
  lastCareAt: -Infinity, nextUpCheckAt: 4000, petUntil: 0,
  burnAt: 0, eggUntil: 0
});

// the pet lives on between visits (this module keeps it for the page's life)
let PET = newPet();

// cared for: counts for the 30 s check, and a block of happiness back
const care = pet => ({ ...pet, caredSinceCheck: true, lastCareAt: pet.clock, happiness: Math.min(TAMA.happinessMax, pet.happiness + 1) });

const heartsFrom = (pet, count) => [...Array(count).keys()].map(k => ({ id: thingId++, x: pet.x + (k - (count - 1) / 2) * 0.05, at: pet.clock + k * 120 }));

// one step of its life
const step = pet => {
  const next = { ...pet, clock: pet.clock + TAMA.tickMs };
  const now = next.clock;
  const seconds = TAMA.tickMs / 1000;
  next.hearts = next.hearts.filter(heart => now - heart.at < TAMA.heartMs);

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
  next.pellets = next.pellets.map(pellet => ({ ...pellet, y: Math.min(TAMA.groundY, pellet.y + TAMA.pelletFallPerSecond * seconds) }));

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
  const food = next.pellets.filter(pellet => pellet.y >= TAMA.groundY - 0.01).sort((a, b) => Math.abs(a.x - next.x) - Math.abs(b.x - next.x))[0];
  const isSpeaking = now < next.speakingUntil;
  if (!isSpeaking && !food && now >= next.nextSpeakAt) {
    next.speakingUntil = now + TAMA.speakMs;
    next.nextSpeakAt = now + TAMA.speakMs + between(TAMA.speakEveryMs);
  }
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
  if (food && !isSpeaking) {
    if (walkTo(food.x, TAMA.hurryPerSecond)) {
      next.pellets = next.pellets.filter(pellet => pellet !== food);
      if (!next.pellets.length) Object.assign(next, care(next)); // the last of a feeding: a block back
      else next.caredSinceCheck = true;
    }
  } else if (!isSpeaking) {
    if (now >= next.modeUntil) {
      // lazily: mostly stop and look about, sometimes amble somewhere
      if (next.mode == "walk" || Math.random() < 0.55) {
        next.mode = "idle";
        next.turnsLeft = Math.floor(between([1, 4]));
        next.modeUntil = now + between([700, 1300]);
      } else {
        next.mode = "walk";
        next.targetX = between([0.12, 0.88]);
        next.modeUntil = now + between([3000, 6000]);
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
    return poops.length ? { ...pet, poops } : { ...care(pet), poops, hearts: [...pet.hearts, ...heartsFrom(pet, 4)] };
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
  background: radial-gradient(ellipse at 50% 45%, rgba(255, 210, 74, 0.11), rgba(255, 190, 60, 0.04) 75%);
  border: 0.12cqw solid rgba(255, 210, 74, 0.35);
  box-shadow: 0 0 0.8cqw rgba(255, 190, 60, 0.25), inset 0 0 1.2cqw rgba(255, 190, 60, 0.12);
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

const Name = styled.div`
  position: absolute;
  top: 9%; /* (a little up again: Jamie) */
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
  filter: drop-shadow(0 0 0.3cqw #ffb020);
`;

const Bubble = styled.div`
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 0.5cqw 0.8cqw;
  font-size: 1.2cqw; /* (bigger again: Jamie) */
  line-height: 1.3;
  width: max-content;
  max-width: 14cqw; /* two lines, so it fits the screen */
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

// a swirled pile, glowing brown, three stacked lumps and a curl on top (no face: Jamie)
const POOP_BROWN = "#a86a32";
const Poop = styled.div`
  position: absolute;
  width: 1.7cqw;
  height: 1.5cqw;
  transform: translate(-50%, -100%);
  opacity: 0.8;
  filter: drop-shadow(0 0 0.3cqw #c27a30);
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

const Heart = styled.div`
  position: absolute;
  font-size: 1.2cqw;
  animation: ${heartUp} ${TAMA.heartMs}ms ease-out forwards;
`;

const burn = keyframes`
  from { -webkit-mask-position: 0 0; mask-position: 0 0; }
  to { -webkit-mask-position: 100% 0; mask-position: 100% 0; }
`;

const Flames = styled.div`
  position: absolute;
  height: ${TAMA.kaijuHeight * 1.2}cqw;
  width: ${TAMA.kaijuHeight * 1.2 * BURN.frameWidth / BURN.frameHeight}cqw;
  transform: translate(-50%, -100%);
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
  text-shadow: none;
  filter: grayscale(1) sepia(1) saturate(5) hue-rotate(10deg) brightness(1.7) drop-shadow(0 0 0.3cqw #ffb020);
  animation: ${handIn} 300ms ease-out both, ${stroke} 700ms ease-in-out 300ms infinite;
`;

const Meter = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 7%; /* (a little up: Jamie) */
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
  outline: 0.08cqw solid rgba(255, 210, 74, 0.25);
`;

// 'actRef': the side monitor's buttons call actRef.current(label)
export const Tamagotchi = ({ actRef }) => {
  const [pet, setPet] = useState(PET);
  useEffect(() => {
    const tick = setInterval(() => {
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
      <Name style={{ fontSize: `${Math.min(TAMA.nameSize, 21 / pet.name.length)}cqw` }}>{pet.mode == "egg" ? "???" : pet.name.toUpperCase()}</Name>
      {pet.pellets.map(({ id, x, y: pelletY }) => <Pellet key={id} style={{ left: `${x * 100}%`, top: `${pelletY * 100}%` }} />)}
      {pet.poops.map(({ id, x }) => <Poop key={id} style={{ left: `${x * 100}%`, top: y }} />)}
      {pet.mode == "burn" && <Flames style={{ left: `${pet.x * 100}%`, top: y }} />}
      {pet.mode == "egg" && <Egg style={{ left: `${pet.x * 100}%`, top: y }} />}
      {pet.mode != "burn" && pet.mode != "egg" && (
        <Body style={{ left: `${pet.x * 100}%`, top: y, WebkitMaskImage: `url(${SHEET.src})`, maskImage: `url(${SHEET.src})`, WebkitMaskPosition: maskPosition, maskPosition }} />
      )}
      {pet.petUntil > 0 && pet.mode != "burn" && <Hand style={{ left: `${pet.x * 100}%`, top: `calc(${y} - ${TAMA.kaijuHeight * 0.75}cqw)` }}>🖐</Hand>}
      {isSpeaking && <Bubble style={{ left: `${Math.min(0.7, Math.max(0.3, pet.x)) * 100}%`, top: `calc(${y} - ${TAMA.kaijuHeight + 1.2}cqw)` }}>Pick three abilities</Bubble>}
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
