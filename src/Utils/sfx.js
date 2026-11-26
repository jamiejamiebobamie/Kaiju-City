/*
  The game's sound effects (Jamie, 2026-11-25): every one made in code with Web Audio, as the unlock ding was, so none
  needs a file or the asset loader. Reviewed first in the dev tool at /sounds (SoundReview); the approved ones are then
  played in the game with playSfx(id).

  Each sound is a function of a 'kit' (makeKit): tone, noise, bell, voice, and echo / reverb / crush rooms to send them
  through, all timed in seconds from the sound's start.
*/

import { AUDIO_LEVEL, getAudio, getAudioNodes, setAudioVolume } from "./audio";
import { getSoundVolume, noteHeard } from "./soundVolumes";

// (the review page's volume: the same as the game's, 0 to 1)
export const SFX_VOLUME = {
  get value() { return AUDIO_LEVEL.volume; },
  set value(share) { setAudioVolume(share); }
};

const NOISE_BUFFERS = {};
export const getNoiseBuffer = (ctx, color) => {
  if (NOISE_BUFFERS[color]) return NOISE_BUFFERS[color];
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let k = 0; k < length; k++) {
    const white = Math.random() * 2 - 1;
    if (color == "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[k] = last * 3.5;
    } else data[k] = white;
  }
  return (NOISE_BUFFERS[color] = buffer);
};

const makeKit = (ctx, out) => {
  const t0 = ctx.currentTime + 0.03;
  const at = s => t0 + s;

  const envelope = (param, start, dur, peak, attack, hold) => {
    const a = Math.min(attack, dur * 0.6);
    const h = Math.max(Math.min(hold, dur - a - 0.02), 0);
    param.setValueAtTime(0.0001, at(start));
    param.linearRampToValueAtTime(peak, at(start + a));
    if (h) param.setValueAtTime(peak, at(start + a + h));
    param.exponentialRampToValueAtTime(0.0001, at(start + dur));
  };
  // a ramp of a frequency: to a number by the end, or through [[value, seconds in], ...]
  const ramp = (param, from, to, start, dur, isLinear) => {
    param.setValueAtTime(from, at(start));
    if (Array.isArray(to)) to.forEach(([value, when]) => param.exponentialRampToValueAtTime(Math.max(value, 1), at(start + when)));
    else if (to) isLinear ? param.linearRampToValueAtTime(to, at(start + dur)) : param.exponentialRampToValueAtTime(Math.max(to, 1), at(start + dur));
  };
  const wobble = (param, start, dur, { rate, depth }) => {
    const lfo = ctx.createOscillator();
    const amount = ctx.createGain();
    lfo.frequency.value = rate;
    amount.gain.value = depth;
    lfo.connect(amount).connect(param);
    lfo.start(at(start));
    lfo.stop(at(start + dur + 0.05));
  };
  // a tremolo gain stage: depth 0..1
  const tremolo = (start, dur, trem, dest) => {
    if (!trem) return dest;
    const stage = ctx.createGain();
    stage.gain.value = 1 - trem.depth / 2;
    wobble(stage.gain, start, dur, { rate: trem.rate, depth: trem.depth / 2 });
    stage.connect(dest);
    return stage;
  };

  const tone = ({ f, to, type = "sine", start = 0, dur = 0.2, gain = 0.2, attack = 0.005, hold = 0, out: dest = out, isLinear = false, vib, trem, detune = 0, filter }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    ramp(osc.frequency, f, to, start, dur, isLinear);
    if (vib) wobble(osc.frequency, start, dur, vib);
    const level = ctx.createGain();
    envelope(level.gain, start, dur, gain, attack, hold);
    let chain = osc;
    if (filter) {
      const shape = ctx.createBiquadFilter();
      shape.type = filter.type || "lowpass";
      ramp(shape.frequency, filter.f, filter.to, start, dur);
      shape.Q.value = filter.q || 1;
      chain = chain.connect(shape);
    }
    chain.connect(level).connect(tremolo(start, dur, trem, dest));
    osc.start(at(start));
    osc.stop(at(start + dur + 0.05));
  };

  const noise = ({ start = 0, dur = 0.3, gain = 0.2, attack = 0.005, hold = 0, type = "bandpass", f = 1000, to, q = 1, color = "white", out: dest = out, trem, sweep }) => {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx, color);
    source.loop = true;
    const shape = ctx.createBiquadFilter();
    shape.type = type;
    shape.Q.value = q;
    ramp(shape.frequency, f, to, start, dur);
    if (sweep) wobble(shape.frequency, start, dur, sweep);
    const level = ctx.createGain();
    envelope(level.gain, start, dur, gain, attack, hold);
    source.connect(shape).connect(level).connect(tremolo(start, dur, trem, dest));
    source.start(at(start), Math.random() * 2);
    source.stop(at(start + dur + 0.05));
  };

  // a struck bell or bar: inharmonic partials, the higher dying sooner
  const bell = ({ f, start = 0, dur = 1.2, gain = 0.15, partials = [1, 2.76, 5.4, 8.93], type = "sine", out: dest = out }) => {
    partials.forEach((ratio, k) => tone({ f: f * ratio, type, start, dur: dur / (1 + k * 0.6), gain: gain / (1 + k * 0.9), attack: 0.002, out: dest }));
  };

  // a voice-ish sound: a buzz through two formants ('ah' by default)
  const voice = ({ f, to, start = 0, dur = 0.5, gain = 0.25, formants = [800, 1150], vib = { rate: 6, depth: 8 }, attack = 0.03, out: dest = out }) => {
    const mix = ctx.createGain();
    mix.gain.value = 1;
    formants.forEach((formant, k) => {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = formant;
      band.Q.value = 6;
      const level = ctx.createGain();
      level.gain.value = k ? 0.6 : 1;
      mix.connect(band).connect(level).connect(dest);
    });
    tone({ f, to, type: "sawtooth", start, dur, gain: gain * 3, attack, vib, out: mix });
  };

  // rooms to send sounds through
  const echo = ({ delay = 0.25, feedback = 0.4, wet = 0.45 } = {}) => {
    const input = ctx.createGain();
    const line = ctx.createDelay(2);
    const back = ctx.createGain();
    const level = ctx.createGain();
    line.delayTime.value = delay;
    back.gain.value = feedback;
    level.gain.value = wet;
    input.connect(out);
    input.connect(line);
    line.connect(back).connect(line);
    line.connect(level).connect(out);
    return input;
  };
  const reverb = ({ seconds = 2, decay = 3, wet = 0.5 } = {}) => {
    const input = ctx.createGain();
    const room = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let k = 0; k < length; k++) data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / length, decay);
    }
    room.buffer = impulse;
    const level = ctx.createGain();
    level.gain.value = wet;
    input.connect(out);
    input.connect(room).connect(level).connect(out);
    return input;
  };
  // grit: a soft clip
  const crush = (amount = 20, dest = out) => {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let k = 0; k < 1024; k++) {
      const x = (k / 1023) * 2 - 1;
      curve[k] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.connect(dest);
    return shaper;
  };

  return { ctx, out, tone, noise, bell, voice, echo, reverb, crush };
};

const random = (min, max) => min + Math.random() * (max - min);
const NOTE = name => {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[letter] + (sharp ? 1 : 0) + (Number(octave) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
};

// - - - the sounds' parts shared between several - - -

const thump = (k, { start = 0, f = 90, gain = 0.5, dur = 0.15 } = {}) => {
  k.tone({ f, to: f * 0.5, start, dur, gain });
  k.noise({ start, dur: dur * 0.6, gain: gain * 0.5, type: "lowpass", f: 500 });
};
const whoosh = (k, { start = 0, dur = 0.7, f = 300, to = 2500, gain = 0.3 } = {}) => {
  k.noise({ start, dur, gain, attack: dur * 0.5, type: "bandpass", f, to, q: 1.2 });
};
const crackle = (k, { start = 0, dur = 1, count = 30, gain = 0.12, f = 3000 } = {}) => {
  for (let n = 0; n < count; n++) k.noise({ start: start + random(0, dur), dur: random(0.005, 0.02), gain: gain * random(0.4, 1), type: "bandpass", f: f * random(0.6, 1.6), q: 3 });
};
const explosion = (k, { start = 0, gain = 0.8, dur = 1.6 } = {}) => {
  const grit = k.crush(8);
  k.noise({ start, dur, gain, color: "brown", type: "lowpass", f: 1400, to: 90, out: grit });
  k.noise({ start, dur: dur * 0.4, gain: gain * 0.4, type: "lowpass", f: 3000, to: 300 });
  k.tone({ f: 70, to: 28, start, dur: dur * 0.8, gain: gain * 0.9 });
  crackle(k, { start: start + 0.05, dur: dur * 0.6, count: 25, gain: 0.08 });
};
const blips = (k, { base, type = "square", count = 10, gap = 0.075, spread = 0.25, gain = 0.07, out, vib }) => {
  for (let n = 0; n < count; n++) {
    if (n % 4 == 3) continue; // (a gap now and then, as between words)
    k.tone({ f: base * (1 + random(-spread, spread)), type, start: n * gap, dur: gap * 0.7, gain, out, vib });
  }
};
const scream = (k, { start = 0, f = 700, peak = 1300, end = 500, dur = 1.1, gain = 0.25, out } = {}) => {
  k.voice({ f, to: [[peak, dur * 0.25], [end, dur]], start, dur, gain, formants: [900, 1400], vib: { rate: 9, depth: 40 }, out });
  k.noise({ start, dur, gain: gain * 0.25, type: "bandpass", f: 2500, q: 2, attack: 0.05 });
};

// a power's passive: a short, soft glint in the power's own color
const passive = (k, { f, type = "triangle", isRough = false }) => {
  k.tone({ f, type, dur: 0.35, gain: 0.07, attack: 0.03 });
  k.tone({ f: f * 1.5, type, start: 0.08, dur: 0.4, gain: 0.05, attack: 0.03 });
  if (isRough) k.noise({ dur: 0.3, gain: 0.04, f: f * 4, q: 4, attack: 0.03 });
};

/*
  Every sound for review: 'group', 'name', and 'context' (where it plays and why), as /sounds shows them.
  (Not the landing's: Jamie, 2026-11-25. The shelved final battle's are out too.)
*/
export const SOUNDS = [
  // - - - the monitor, avatar select, picker, HUD - - -
  { id: "boot-patter", group: "Monitor and menus", name: "Boot patter", context: "The monitor's boot: the green matrix text cascading down before the start screen. Tiny data ticks, like an old terminal.", play: k => {
    for (let n = 0; n < 46; n++) k.tone({ f: random(1700, 3400), type: "square", start: random(0, 2.4), dur: 0.014, gain: 0.04 });
    [0.4, 1.1, 1.9].forEach(start => k.tone({ f: 880, type: "square", start, dur: 0.05, gain: 0.03 }));
  } },
  { id: "crt-on", group: "Monitor and menus", name: "CRT on", context: "The monitor switching on (boot, after Quit, and the Play! hand-off): a thunk, a burst of static and the tube's faint high whine.", play: k => {
    thump(k, { f: 70, gain: 0.45 });
    k.noise({ start: 0.02, dur: 0.45, gain: 0.18, type: "highpass", f: 2500 });
    k.tone({ f: 7600, start: 0.05, dur: 1.4, gain: 0.012, attack: 0.4, hold: 0.6 });
  } },
  { id: "crt-off", group: "Monitor and menus", name: "CRT off", context: "The monitor switching off (Quit, the pull out to the room): the picture collapsing to a line, a falling zip, then a tick.", play: k => {
    k.tone({ f: 1400, to: 50, dur: 0.28, gain: 0.12 });
    k.noise({ dur: 0.2, gain: 0.1, type: "highpass", f: 3000, to: 600 });
    k.noise({ start: 0.3, dur: 0.02, gain: 0.15, f: 2500, q: 2 });
  } },
  { id: "ui-hover", group: "Monitor and menus", name: "Hover tick", context: "The pointer or the arrow keys moving onto a button, an avatar or a power in the picker.", play: k => {
    k.tone({ f: 2400, type: "triangle", dur: 0.035, gain: 0.05 });
  } },
  { id: "ui-click", group: "Monitor and menus", name: "Click", context: "Pressing any on-screen button (Single Player, Back, Settings).", play: k => {
    k.tone({ f: 1200, type: "square", dur: 0.025, gain: 0.05 });
    k.tone({ f: 180, to: 110, dur: 0.07, gain: 0.18 });
  } },
  { id: "side-button", group: "Monitor and menus", name: "Side monitor button", context: "The side monitor's round plastic buttons and the Play/Back console: a chunky plastic press and release.", play: k => {
    k.noise({ dur: 0.025, gain: 0.3, f: 3000, q: 3 });
    k.noise({ start: 0.09, dur: 0.03, gain: 0.18, f: 1300, q: 3 });
  } },
  { id: "lcd-beep", group: "Monitor and menus", name: "LCD beep", context: "The side monitor's LCD labels changing: a digital-watch beep.", play: k => {
    k.tone({ f: 3100, type: "square", dur: 0.08, gain: 0.04 });
  } },
  { id: "bio-type", group: "Monitor and menus", name: "Bio typewriter", context: "The avatar bios typing out on the side screen as you hover Guy or Girl: soft ticks, a little uneven.", play: k => {
    let start = 0;
    for (let n = 0; n < 18; n++) {
      k.noise({ start, dur: 0.012, gain: 0.12, f: random(2500, 4200), q: 3 });
      k.tone({ f: 160, start, dur: 0.02, gain: 0.05 });
      start += random(0.045, 0.085) + (n % 6 == 5 ? 0.12 : 0);
    }
  } },
  { id: "tama-chirp", group: "Tamagotchi Stompy", name: "Stompy chirp", context: "Stompy on the side monitor's tamagotchi hopping about or noticing you: a little 8-bit chirp.", play: k => {
    k.tone({ f: 1400, to: 2200, type: "square", dur: 0.07, gain: 0.05 });
    k.tone({ f: 1800, to: 2700, type: "square", start: 0.1, dur: 0.07, gain: 0.05 });
  } },
  { id: "tama-poop", group: "Tamagotchi Stompy", name: "Stompy poop", context: "Stompy's poop appearing with its flash: a falling blip and a plop.", play: k => {
    k.tone({ f: 420, to: 150, type: "square", dur: 0.18, gain: 0.05 });
    k.tone({ f: 300, to: 110, start: 0.2, dur: 0.1, gain: 0.15 });
  } },
  { id: "tama-happy", group: "Tamagotchi Stompy", name: "Stompy happy", context: "Stompy happy (fed, cleaned, played with): a rising 8-bit arpeggio.", play: k => {
    ["C6", "E6", "G6", "C7"].forEach((note, n) => k.tone({ f: NOTE(note), type: "square", start: n * 0.07, dur: 0.09, gain: 0.04 }));
  } },
  { id: "tama-sad", group: "Tamagotchi Stompy", name: "Stompy sad", context: "Stompy unhappy or hungry: three slow falling notes with a wobble.", play: k => {
    [600, 500, 400].forEach((f, n) => k.tone({ f, type: "square", start: n * 0.25, dur: 0.24, gain: 0.04, vib: { rate: 7, depth: 12 } }));
  } },
  { id: "lock-in", group: "Monitor and menus", name: "Power lock-in", context: "Picking a power in the picker: a heavy mechanical clunk, a slot locking shut.", play: k => {
    k.noise({ dur: 0.08, gain: 0.4, type: "lowpass", f: 900 });
    k.tone({ f: 95, to: 50, dur: 0.13, gain: 0.45 });
    k.tone({ f: 2400, type: "square", start: 0.01, dur: 0.015, gain: 0.04 });
  } },
  { id: "combo-ding", group: "Monitor and menus", name: "Combo complete", context: "The third power picked, so the combo is complete and Play lights up: a bright three-note bell chord.", play: k => {
    ["C6", "E6", "G6"].forEach((note, n) => k.bell({ f: NOTE(note), start: n * 0.06, dur: 1.4, gain: 0.08, partials: [1, 2, 3.01, 4.2] }));
  } },
  { id: "class-sting", group: "Monitor and menus", name: "Class reveal", context: "Your class name being revealed for the combo: a short brassy swell with a cymbal.", play: k => {
    ["D3", "A3", "D4", "F#4"].forEach(note => k.tone({ f: NOTE(note), type: "sawtooth", dur: 1.5, gain: 0.06, attack: 0.15, hold: 0.6, filter: { f: 300, to: 3200 }, detune: random(-6, 6) }));
    k.noise({ dur: 1.6, gain: 0.08, type: "highpass", f: 6000, attack: 0.3 });
  } },
  { id: "play-confirm", group: "Monitor and menus", name: "Play!", context: "Pressing Play!: a quick rising confirm with a low punch underneath.", play: k => {
    ["C5", "G5", "C6"].forEach((note, n) => k.tone({ f: NOTE(note), type: "square", start: n * 0.05, dur: 0.12, gain: 0.05 }));
    thump(k, { start: 0.1, f: 110, gain: 0.35 });
  } },
  { id: "side-fly-off", group: "Monitor and menus", name: "Side units fly off", context: "On Play! the side monitor and console fly off screen: a whoosh.", play: k => whoosh(k, { dur: 0.7 }) },
  { id: "drone-jets-in", group: "HUD drones", name: "Drone jets in", context: "A HUD drone flying in with its jets: a jet hiss swelling in and settling to a hover hum.", play: k => {
    k.noise({ dur: 1.4, gain: 0.2, f: 1400, to: 700, q: 1, attack: 0.6, hold: 0.3 });
    k.tone({ f: 190, to: 170, type: "sawtooth", dur: 1.4, gain: 0.04, attack: 0.5, hold: 0.5, filter: { f: 600 }, trem: { rate: 18, depth: 0.5 } });
  } },
  { id: "drone-jets-out", group: "HUD drones", name: "Drone jets out", context: "A HUD drone leaving: jets roaring up and away.", play: k => {
    k.noise({ dur: 1, gain: 0.22, f: 600, to: 1800, q: 1, attack: 0.15 });
    k.tone({ f: 170, to: 260, type: "sawtooth", dur: 0.9, gain: 0.04, attack: 0.1, filter: { f: 700 } });
  } },
  { id: "drone-jostle", group: "HUD drones", name: "Drone jostle", context: "A HUD drone knocked about (you're hit): two metal knocks and a jet stutter.", play: k => {
    k.bell({ f: 620, dur: 0.25, gain: 0.08 });
    k.bell({ f: 540, start: 0.11, dur: 0.25, gain: 0.07 });
    k.noise({ dur: 0.5, gain: 0.12, f: 1100, q: 1, trem: { rate: 22, depth: 1 } });
  } },
  { id: "drone-malfunction", group: "HUD drones", name: "Drone malfunction", context: "A HUD drone malfunctioning (low health): its jet sputtering, sparks and a sick warble.", play: k => {
    k.noise({ dur: 1.6, gain: 0.18, f: 900, q: 1, trem: { rate: 9, depth: 1 }, hold: 1 });
    crackle(k, { dur: 1.5, count: 22, gain: 0.12, f: 4000 });
    k.tone({ f: 800, to: 220, type: "square", dur: 1.5, gain: 0.03, vib: { rate: 11, depth: 60 } });
  } },
  { id: "drone-fall-explode", group: "HUD drones", name: "Drone falls and explodes", context: "A HUD drone dying: a falling whistle, then a fireball.", play: k => {
    k.tone({ f: 1500, to: 280, dur: 1, gain: 0.07, attack: 0.05 });
    explosion(k, { start: 1, gain: 0.4, dur: 1.4 });
  } },
  { id: "lights-tubes", group: "Monitor and menus", name: "Room lights on", context: "The room's tube lights coming on one by one (the lights-on sequence): a relay clunk, a flicker buzz, then a steady hum.", play: k => {
    [0, 0.4, 0.7, 1.2].forEach((start, n) => {
      k.noise({ start, dur: 0.05, gain: 0.3, type: "lowpass", f: 700 });
      k.tone({ f: 2600, type: "square", start, dur: 0.01, gain: 0.04 });
      k.tone({ f: 120, type: "sawtooth", start: start + 0.03, dur: 0.35, gain: 0.05, filter: { type: "bandpass", f: 900, q: 3 }, trem: { rate: 13 + n * 3, depth: 1 } });
      k.tone({ f: 120, type: "sawtooth", start: start + 0.35, dur: 2.2 - start, gain: 0.012, attack: 0.05, hold: 1.5 - start, filter: { type: "bandpass", f: 700, q: 3 } });
    });
  } },
  { id: "holo-shimmer", group: "Monitor and menus", name: "Hologram dome", context: "The hologram dome shimmering up: high sparkling partials over a soft rising pad.", play: k => {
    for (let n = 0; n < 14; n++) k.tone({ f: random(2000, 5200), start: random(0, 1.2), dur: random(0.4, 0.9), gain: 0.015, attack: 0.1, trem: { rate: random(5, 12), depth: 1 } });
    k.tone({ f: 330, to: 440, type: "triangle", dur: 2, gain: 0.05, attack: 0.8, hold: 0.6 });
    k.tone({ f: 495, to: 660, type: "triangle", dur: 2, gain: 0.03, attack: 0.8, hold: 0.6 });
  } },

  // - - - in a fight - - -
  { id: "footsteps", group: "Fighting", name: "Footsteps", context: "A person walking (you, the teammate, recruits, Agents): soft, quick steps. Would be quiet, under everything else.", play: k => {
    [0, 0.3, 0.6, 0.9].forEach((start, n) => k.noise({ start, dur: 0.07, gain: 0.22, type: "lowpass", f: n % 2 ? 650 : 520 }));
  } },
  { id: "kaiju-stomp", group: "Fighting", name: "Kaiju stomp", context: "A Kaiju's footstep: a deep thud with a little debris.", play: k => {
    [0, 0.75].forEach(start => {
      k.noise({ start, dur: 0.6, gain: 0.6, color: "brown", type: "lowpass", f: 320 });
      k.tone({ f: 55, to: 34, start, dur: 0.5, gain: 0.6 });
      crackle(k, { start: start + 0.03, dur: 0.25, count: 8, gain: 0.05, f: 2000 });
    });
  } },
  { id: "cast-ice", group: "Powers (cast)", name: "Ice Slice (Ice)", context: "Casting Ice Slice: a cold swish and crystal pings as the ice spreads.", play: k => {
    k.noise({ dur: 0.45, gain: 0.18, type: "highpass", f: 6500, to: 2200, attack: 0.02 });
    for (let n = 0; n < 9; n++) k.bell({ f: random(2400, 4800), start: random(0.02, 0.5), dur: 0.5, gain: 0.04, partials: [1, 2.4] });
  } },
  { id: "cast-fire", group: "Powers (cast)", name: "Wildfire (Fire)", context: "Casting Wildfire: a fire whoosh catching, a low roar and crackle.", play: k => {
    k.noise({ dur: 0.7, gain: 0.3, f: 350, to: 1500, q: 0.8, attack: 0.12 });
    k.noise({ start: 0.1, dur: 1.2, gain: 0.2, color: "brown", type: "lowpass", f: 500, attack: 0.1 });
    crackle(k, { start: 0.15, dur: 1.1, count: 35, gain: 0.1 });
  } },
  { id: "cast-water", group: "Powers (cast)", name: "Tidal Wave (Water)", context: "Casting Tidal Wave: a wave rising and crashing, with bubbles.", play: k => {
    k.noise({ dur: 1.4, gain: 0.35, color: "brown", type: "lowpass", f: 250, to: [[1600, 0.6], [300, 1.4]], attack: 0.5 });
    k.noise({ start: 0.55, dur: 0.8, gain: 0.15, type: "highpass", f: 2500, attack: 0.05 });
    for (let n = 0; n < 8; n++) k.tone({ f: random(300, 600), to: random(900, 1400), start: random(0.6, 1.3), dur: 0.06, gain: 0.05 });
  } },
  { id: "cast-wood", group: "Powers (cast)", name: "Overgrowth (Wood)", context: "Casting Overgrowth: wood creaking as it grows, leaves rustling.", play: k => {
    k.tone({ f: 70, to: 150, type: "sawtooth", dur: 1.1, gain: 0.08, attack: 0.1, filter: { type: "bandpass", f: 500, q: 4 }, trem: { rate: 14, depth: 1 } });
    k.noise({ dur: 1.1, gain: 0.12, f: 3500, q: 1.5, attack: 0.2, trem: { rate: 7, depth: 0.8 } });
    [0.3, 0.75].forEach(start => k.noise({ start, dur: 0.04, gain: 0.25, type: "lowpass", f: 900 }));
  } },
  { id: "cast-lightning", group: "Powers (cast)", name: "Discharge (Lightning)", context: "Casting Discharge: a sharp crack and an electric buzz with arcing crackle.", play: k => {
    k.noise({ dur: 0.05, gain: 0.5, type: "highpass", f: 1500 });
    k.tone({ f: 120, type: "sawtooth", dur: 0.8, gain: 0.06, trem: { rate: 30, depth: 1 }, filter: { f: 2500 } });
    crackle(k, { dur: 0.8, count: 40, gain: 0.14, f: 5000 });
  } },
  { id: "cast-death", group: "Powers (cast)", name: "Haunt (Death)", context: "Casting Haunt: a ghostly wail sliding up and away, breathy, with an echo.", play: k => {
    const room = k.echo({ delay: 0.22, feedback: 0.45 });
    k.tone({ f: 300, to: [[520, 0.5], [240, 1.3]], dur: 1.3, gain: 0.08, attack: 0.2, vib: { rate: 5, depth: 18 }, out: room });
    k.noise({ dur: 1.2, gain: 0.07, f: 900, q: 4, sweep: { rate: 0.8, depth: 400 }, attack: 0.3, out: room });
  } },
  { id: "cast-bubble", group: "Powers (cast)", name: "Dispel (Bubble)", context: "Casting Dispel: a bloop and a run of bubble pops as the statuses wash away.", play: k => {
    k.tone({ f: 200, to: 800, dur: 0.18, gain: 0.15 });
    for (let n = 0; n < 9; n++) k.tone({ f: random(500, 900), to: random(1200, 2000), start: 0.15 + n * random(0.05, 0.09), dur: 0.05, gain: 0.08 });
  } },
  { id: "cast-metal", group: "Powers (cast)", name: "Aegis (Metal)", context: "Casting Aegis: a shield clanging into place with a ringing hum.", play: k => {
    k.bell({ f: 520, dur: 1.6, gain: 0.14, partials: [1, 2.38, 3.63, 5.29] });
    k.noise({ dur: 0.06, gain: 0.3, f: 2500, q: 1 });
    k.tone({ f: 260, dur: 1.4, gain: 0.03, attack: 0.1, trem: { rate: 6, depth: 0.6 } });
  } },
  { id: "cast-glass", group: "Powers (cast)", name: "Escape (Glass, the Teleport)", context: "Casting Escape: a warping rise as the portal opens, glassy shimmer, a pop on arrival.", play: k => {
    k.tone({ f: 200, to: 2200, dur: 0.5, gain: 0.08, vib: { rate: 20, depth: 40 } });
    for (let n = 0; n < 6; n++) k.bell({ f: random(3000, 5500), start: random(0.1, 0.5), dur: 0.4, gain: 0.03, partials: [1, 2.2] });
    k.tone({ f: 900, to: 300, start: 0.55, dur: 0.08, gain: 0.15 });
  } },
  { id: "cast-love", group: "Powers (cast)", name: "Charm (Love)", context: "Casting Charm: a sweet, wobbly rising arpeggio with sparkles.", play: k => {
    ["E5", "G#5", "B5", "E6"].forEach((note, n) => k.tone({ f: NOTE(note), type: "triangle", start: n * 0.09, dur: 0.5, gain: 0.07, vib: { rate: 6, depth: 10 } }));
    for (let n = 0; n < 6; n++) k.tone({ f: random(3500, 6000), start: random(0.3, 0.7), dur: 0.1, gain: 0.02 });
  } },
  { id: "cast-heal", group: "Powers (cast)", name: "Heal", context: "Healing (a heal tile or heal power): soft chimes rising, warm and long.", play: k => {
    ["C5", "E5", "G5", "C6"].forEach((note, n) => k.tone({ f: NOTE(note), start: n * 0.12, dur: 1.3, gain: 0.07, attack: 0.08 }));
  } },
  ...[["Ice", 1568], ["Fire", 392, "sawtooth"], ["Water", 523], ["Wood", 330], ["Lightning", 1175, "square"], ["Death", 262], ["Bubble", 784], ["Metal", 698], ["Glass", 1319], ["Love", 659]].map(([element, f, type]) => ({
    id: `passive-${element.toLowerCase()}`, group: "Powers (passive)", name: `${element} passive`, context: `A ${element} passive going off (eg. a buff or a range boost): a short, soft glint in ${element}'s own pitch, quieter than its cast.`,
    play: k => passive(k, { f, type: type || "triangle", isRough: type == "sawtooth" || type == "square" })
  })),
  { id: "hit", group: "Fighting", name: "Hit", context: "Anyone taking a hit (the \"-1\"): a short thwack.", play: k => {
    k.noise({ dur: 0.06, gain: 0.45, f: 1100, q: 1 });
    k.tone({ f: 170, to: 80, dur: 0.11, gain: 0.4 });
  } },
  { id: "ko", group: "Fighting", name: "Knocked out", context: "A fighter going down (out of health): a falling tone and a thud.", play: k => {
    k.tone({ f: 440, to: 110, type: "square", dur: 0.5, gain: 0.05 });
    thump(k, { start: 0.5, f: 80, gain: 0.45, dur: 0.2 });
  } },
  { id: "ragdoll-flop", group: "Fighting", name: "Ragdoll flop", context: "A ragdoll landing and bouncing (KOs, the train hitting someone): three thuds, each softer.", play: k => {
    [[0, 0.5], [0.18, 0.3], [0.3, 0.15]].forEach(([start, gain]) => {
      k.noise({ start, dur: 0.08, gain, type: "lowpass", f: 600 });
      k.tone({ f: 110, to: 70, start, dur: 0.1, gain });
    });
  } },
  { id: "last-blow-boom", group: "Fighting", name: "Last blow (slow motion)", context: "The fight's last blow, as the game goes into slow motion: a long, deep, sinking boom.", play: k => {
    k.tone({ f: 48, to: 24, dur: 2.6, gain: 0.8 });
    k.noise({ dur: 2.6, gain: 0.5, color: "brown", type: "lowpass", f: 500, to: 70 });
    k.noise({ dur: 0.15, gain: 0.3, f: 1200, q: 1 });
  } },
  { id: "tile-fire", group: "Tile statuses", name: "Burning tiles", context: "Tiles on fire, near the camera: a low roar with crackle. Would loop quietly while fire is on screen.", play: k => {
    k.noise({ dur: 3, gain: 0.15, color: "brown", type: "lowpass", f: 500, attack: 0.3, hold: 2.2 });
    crackle(k, { dur: 3, count: 70, gain: 0.08 });
  } },
  { id: "tile-water", group: "Tile statuses", name: "Wet tiles", context: "Wet tiles: slow lapping water and the odd drip. Would loop quietly.", play: k => {
    k.noise({ dur: 3, gain: 0.2, color: "brown", type: "lowpass", f: 700, attack: 0.3, hold: 2.2, trem: { rate: 0.7, depth: 0.8 } });
    [0.5, 1.4, 2.3].forEach(start => k.tone({ f: 1100, to: 1900, start, dur: 0.05, gain: 0.05 }));
  } },
  { id: "tile-electric", group: "Tile statuses", name: "Electrified tiles", context: "Electrified tiles: a mains buzz with sudden crackles. Would loop quietly.", play: k => {
    k.tone({ f: 60, type: "sawtooth", dur: 3, gain: 0.09, attack: 0.1, hold: 2.6, filter: { type: "bandpass", f: 400, q: 2 } });
    crackle(k, { dur: 3, count: 25, gain: 0.12, f: 5500 });
  } },
  { id: "tile-ghost", group: "Tile statuses", name: "Ghost tiles", context: "Haunted tiles and the ghost rings: a whispery, drifting breath with a low throb. Would loop quietly.", play: k => {
    k.noise({ dur: 3, gain: 0.12, f: 1200, q: 8, sweep: { rate: 0.4, depth: 600 }, attack: 0.5, hold: 1.8 });
    k.tone({ f: 110, dur: 3, gain: 0.06, attack: 0.5, hold: 1.8, trem: { rate: 1.5, depth: 0.9 } });
  } },
  { id: "unlock-ding", group: "Stings and story", name: "Unlock ding (now in the game)", context: "Unlocking something: the two square-wave notes the game plays today. Keep it, or take the one below.", play: k => {
    [[880, 0], [1320, 0.12]].forEach(([f, start]) => k.tone({ f, type: "square", start, dur: 0.35, gain: 0.08, attack: 0.002 }));
  } },
  { id: "unlock-ding-new", group: "Stings and story", name: "Unlock ding (another take)", context: "Unlocking something, another take: a bell pair with a sparkle, softer than the square waves.", play: k => {
    k.bell({ f: NOTE("A5"), dur: 1, gain: 0.1, partials: [1, 2, 3.01] });
    k.bell({ f: NOTE("E6"), start: 0.12, dur: 1.2, gain: 0.1, partials: [1, 2, 3.01] });
    for (let n = 0; n < 5; n++) k.tone({ f: random(4000, 7000), start: 0.15 + random(0, 0.3), dur: 0.08, gain: 0.02 });
  } },
  { id: "turn-tone", group: "Stings and story", name: "Turn change", context: "From the old list: a tone for a change of turn. The fights are real-time, so this may have nowhere to go; tell me if there's a moment you'd want it for (eg. a phase change in a boss fight).", play: k => {
    k.tone({ f: 660, type: "triangle", dur: 0.15, gain: 0.08 });
    k.tone({ f: 990, type: "triangle", start: 0.13, dur: 0.25, gain: 0.08 });
  } },
  { id: "objective", group: "Stings and story", name: "New objective", context: "A new objective showing: two notes up, a soft notice.", play: k => {
    k.tone({ f: NOTE("G5"), type: "triangle", dur: 0.2, gain: 0.08 });
    k.tone({ f: NOTE("D6"), type: "triangle", start: 0.12, dur: 0.45, gain: 0.08 });
  } },
  { id: "win", group: "Stings and story", name: "Win", context: "Winning a fight: a short 8-bit fanfare.", play: k => {
    ["C5", "E5", "G5", "C6"].forEach((note, n) => k.tone({ f: NOTE(note), type: "square", start: n * 0.11, dur: 0.12, gain: 0.05 }));
    ["C5", "E5", "G5", "C6"].forEach(note => k.tone({ f: NOTE(note), type: "square", start: 0.5, dur: 0.9, gain: 0.03, hold: 0.4 }));
  } },
  { id: "lose", group: "Stings and story", name: "Lose", context: "Losing a fight: a slow, falling minor line.", play: k => {
    ["G4", "F#4", "F4", "E4"].forEach((note, n) => k.tone({ f: NOTE(note), type: "sawtooth", start: n * 0.35, dur: n == 3 ? 1.4 : 0.34, gain: 0.1, filter: { f: 1200 }, vib: n == 3 ? { rate: 5, depth: 4 } : undefined }));
  } },
  { id: "permadeath-retry", group: "Stings and story", name: "Permadeath retry", context: "The permadeath retry screen hitting: a reverse whoosh sucked into a heavy impact with a metal ring.", play: k => {
    k.noise({ dur: 0.8, gain: 0.25, f: 500, to: 3000, q: 1, attack: 0.78 });
    k.tone({ f: 55, to: 30, start: 0.8, dur: 1.4, gain: 0.7 });
    k.noise({ start: 0.8, dur: 0.6, gain: 0.4, color: "brown", type: "lowpass", f: 800, to: 100 });
    k.bell({ f: 220, start: 0.8, dur: 2, gain: 0.08, partials: [1, 2.76, 5.4] });
  } },
  { id: "blip-guy", group: "Dialogue", name: "Talk blips: Guy", context: "Dialogue lines typing out, the player as Guy: a mid square-wave blip per letter (each speaker has their own pitch and tone).", play: k => blips(k, { base: 230 }) },
  { id: "blip-girl", group: "Dialogue", name: "Talk blips: Girl", context: "Dialogue lines, the player as Girl: a higher square blip.", play: k => blips(k, { base: 350 }) },
  { id: "blip-punk", group: "Dialogue", name: "Talk blips: Punk Guy", context: "Punk Guy talking: a gritty, low sawtooth blip.", play: k => blips(k, { base: 160, type: "sawtooth", gain: 0.09 }) },
  { id: "blip-ghost", group: "Dialogue", name: "Talk blips: Ghost Girl", context: "Ghost Girl talking: a wavering sine blip with an echo.", play: k => blips(k, { base: 560, type: "sine", gain: 0.09, vib: { rate: 7, depth: 15 }, out: k.echo({ delay: 0.18, feedback: 0.35 }) }) },
  { id: "blip-mermaid", group: "Dialogue", name: "Talk blips: Mermaid", context: "The Mermaid talking: a soft, bubbly triangle blip.", play: k => blips(k, { base: 440, type: "triangle", gain: 0.1, spread: 0.4 }) },
  { id: "blip-agent", group: "Dialogue", name: "Talk blips: Agent", context: "Agents talking: a flat, low, robotic blip, every syllable the same pitch.", play: k => blips(k, { base: 130, spread: 0.02 }) },
  { id: "radio-static", group: "Dialogue", name: "Radio static", context: "Dialogue over the radio (the radar radio map, calls from the Lab): a squelch, static under the voice, and a squelch off.", play: k => {
    k.tone({ f: 1800, type: "square", dur: 0.05, gain: 0.03 });
    k.noise({ start: 0.05, dur: 1.3, gain: 0.08, f: 1800, q: 0.7, hold: 1.1 });
    crackle(k, { start: 0.05, dur: 1.3, count: 18, gain: 0.08 });
    k.tone({ f: 1400, type: "square", start: 1.4, dur: 0.05, gain: 0.03 });
  } },

  // - - - the levels - - -
  { id: "peninsula-city", group: "Peninsula", name: "City", context: "The Peninsula map: the city's low traffic hum with a far siren rising and falling.", play: k => {
    k.noise({ dur: 4, gain: 0.15, color: "brown", type: "lowpass", f: 300, attack: 0.5, hold: 2.8 });
    k.tone({ f: 620, to: [[900, 0.8], [620, 1.6], [900, 2.4], [620, 3.2]], dur: 3.6, gain: 0.025, attack: 0.6, filter: { f: 1500 } });
  } },
  { id: "street-traffic", group: "Street", name: "Car passing", context: "The Street: a car driving past.", play: k => {
    k.noise({ dur: 2.6, gain: 0.3, f: 500, to: [[900, 1.2], [350, 2.6]], q: 0.8, attack: 1.2 });
    k.tone({ f: 95, to: [[105, 1.2], [70, 2.6]], type: "sawtooth", dur: 2.6, gain: 0.05, attack: 1.2, filter: { f: 400 } });
  } },
  { id: "street-greeting", group: "Street", name: "Greeting", context: "The Street's greeting (meeting the teammate): a friendly two-note hello under the first line.", play: k => {
    k.tone({ f: NOTE("E5"), type: "triangle", dur: 0.15, gain: 0.09 });
    k.tone({ f: NOTE("A5"), type: "triangle", start: 0.14, dur: 0.3, gain: 0.09 });
  } },
  { id: "train-crossing-bell", group: "Subway", name: "Train warning bell", context: "The Subway: the crossing lights flashing before a train (the warning stage), a bell ringing about twice a second.", play: k => {
    for (let n = 0; n < 6; n++) k.bell({ f: 760, start: n * 0.45, dur: 0.5, gain: 0.1, partials: [1, 2.4, 4.1] });
  } },
  { id: "train-arrival", group: "Subway", name: "Train arriving", context: "The Subway: a train coming through, a rumble building with wheels clacking over joints and a horn.", play: k => {
    k.noise({ dur: 3.5, gain: 0.45, color: "brown", type: "lowpass", f: 200, to: 600, attack: 2.5 });
    for (let n = 0; n < 8; n++) [0, 0.09].forEach(offset => k.noise({ start: 0.8 + n * 0.33 + offset, dur: 0.04, gain: 0.08 + n * 0.02, type: "lowpass", f: 1500 }));
    [311, 370].forEach(f => k.tone({ f, type: "sawtooth", start: 1.2, dur: 0.9, gain: 0.05, attack: 0.05, hold: 0.6, filter: { f: 1400 } }));
  } },
  { id: "train-brakes", group: "Subway", name: "Train brakes", context: "The Subway: the train braking, a metal squeal and an air hiss.", play: k => {
    k.tone({ f: 2900, to: 2600, dur: 1.8, gain: 0.03, attack: 0.2, hold: 1, vib: { rate: 9, depth: 30 } });
    k.noise({ start: 1.4, dur: 0.9, gain: 0.15, type: "highpass", f: 3500, attack: 0.02 });
  } },
  { id: "train-doors", group: "Subway", name: "Train doors", context: "The Subway: the doors' chime and the pneumatic hiss.", play: k => {
    k.bell({ f: NOTE("E5"), dur: 0.8, gain: 0.09, partials: [1, 2, 3] });
    k.bell({ f: NOTE("C5"), start: 0.35, dur: 1, gain: 0.09, partials: [1, 2, 3] });
    k.noise({ start: 0.9, dur: 0.6, gain: 0.15, type: "highpass", f: 3000, attack: 0.02 });
  } },
  { id: "subway-echo", group: "Subway", name: "Station echo", context: "The Subway's echo: every sound there (here a hit and two steps) sent through a big tiled room.", play: k => {
    const room = k.reverb({ seconds: 2.4, decay: 2.5, wet: 0.7 });
    k.noise({ dur: 0.06, gain: 0.4, f: 1100, q: 1, out: room });
    k.tone({ f: 170, to: 80, dur: 0.11, gain: 0.35, out: room });
    [0.6, 0.9].forEach(start => k.noise({ start, dur: 0.07, gain: 0.25, type: "lowpass", f: 600, out: room }));
  } },
  { id: "rooftop-wind", group: "Rooftop", name: "Wind", context: "The Rooftop: wind gusting across the roof. Would loop quietly.", play: k => {
    k.noise({ dur: 4, gain: 0.25, f: 600, q: 1.5, sweep: { rate: 0.35, depth: 300 }, attack: 0.8, hold: 2.4, trem: { rate: 0.3, depth: 0.7 } });
  } },
  { id: "rooftop-scream", group: "Rooftop", name: "Ghost Girl's scream", context: "The Rooftop: Ghost Girl's scream as she teleports. Made in code, so it sounds synthetic; a recorded voice would be better if you want it to sound real.", play: k => {
    const room = k.echo({ delay: 0.2, feedback: 0.4 });
    scream(k, { out: room });
    k.tone({ f: 1800, to: 120, start: 1, dur: 0.35, gain: 0.08, vib: { rate: 25, depth: 60 } });
  } },
  { id: "ghost-rings", group: "Rooftop", name: "Ghost rings", context: "The Rooftop: the ghost rings closing in, a beating hum that swells with each ring.", play: k => {
    [0, 1, 2].forEach(n => {
      k.tone({ f: 220, start: n * 0.9, dur: 1.2, gain: 0.07, attack: 0.4 });
      k.tone({ f: 223.5, start: n * 0.9, dur: 1.2, gain: 0.07, attack: 0.4 });
      k.tone({ f: 330 + n * 40, start: n * 0.9, dur: 1, gain: 0.03, attack: 0.4, vib: { rate: 6, depth: 6 } });
    });
  } },
  { id: "aquarium-hum", group: "Aquarium", name: "Underwater hum", context: "The Aquarium: the tanks' deep hum and rising bubbles. Would loop quietly.", play: k => {
    k.noise({ dur: 4, gain: 0.2, color: "brown", type: "lowpass", f: 250, attack: 0.6, hold: 2.6 });
    k.tone({ f: 68, dur: 4, gain: 0.08, attack: 0.6, hold: 2.6, trem: { rate: 0.5, depth: 0.5 } });
    for (let n = 0; n < 10; n++) k.tone({ f: random(250, 500), to: random(700, 1100), start: random(0.3, 3.5), dur: 0.05, gain: 0.03 });
  } },
  { id: "glass-crack", group: "Aquarium", name: "Glass cracking", context: "The Aquarium: the tank glass starting to crack: sharp ticks and a stressed creak.", play: k => {
    [0, 0.05, 0.08, 0.5, 0.53, 0.9].forEach(start => k.noise({ start, dur: 0.012, gain: 0.35, type: "highpass", f: 4000 }));
    k.tone({ f: 3100, to: 2500, start: 0.1, dur: 0.9, gain: 0.015, attack: 0.3 });
  } },
  { id: "glass-shatter", group: "Aquarium", name: "Glass shatters", context: "The Aquarium: the tank glass shattering: a burst, then a long rain of tinkling shards.", play: k => {
    k.noise({ dur: 0.3, gain: 0.5, type: "highpass", f: 2000 });
    for (let n = 0; n < 40; n++) k.bell({ f: random(2500, 8000), start: random(0.02, 1.4) * random(0.3, 1), dur: random(0.15, 0.4), gain: 0.03, partials: [1, 2.7] });
  } },
  { id: "flood", group: "Aquarium", name: "Flood", context: "The Aquarium: the water pouring out of the broken tank.", play: k => {
    k.noise({ dur: 3.2, gain: 0.4, color: "brown", type: "lowpass", f: 400, to: 1200, attack: 0.3, hold: 1.8 });
    k.noise({ dur: 3.2, gain: 0.15, type: "bandpass", f: 2500, q: 0.6, attack: 0.3, hold: 1.8, trem: { rate: 4, depth: 0.4 } });
  } },
  { id: "stop-scream", group: "Aquarium", name: "\"Stop!!!\" scream", context: "The Aquarium: the Mermaid's \"Stop!!!\": three hard bursts of voice. Made in code, so it's a synthetic voice; a recorded one would sound more real.", play: k => {
    [0, 0.32, 0.64].forEach((start, n) => k.voice({ f: 520 + n * 60, to: 460 + n * 60, start, dur: 0.26, gain: 0.3, formants: [700, 1200], vib: { rate: 12, depth: 25 }, attack: 0.01 }));
  } },
  { id: "sea-creature", group: "Aquarium", name: "Sea creature", context: "The Aquarium: a sea creature appearing or moving on a tile, a muffled bloop.", play: k => {
    k.tone({ f: 150, to: 420, dur: 0.25, gain: 0.2, filter: { f: 700 } });
    k.tone({ f: 500, to: 1000, start: 0.22, dur: 0.06, gain: 0.05 });
  } },
  { id: "mermaid-heal", group: "Aquarium", name: "Mermaid heal", context: "The Aquarium: the Mermaid healing upstairs, a quick harp glissando with a shimmer.", play: k => {
    ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"].forEach((note, n) => k.tone({ f: NOTE(note), type: "triangle", start: n * 0.05, dur: 0.9, gain: 0.05 }));
    k.tone({ f: NOTE("E7"), start: 0.4, dur: 1, gain: 0.015, attack: 0.2, trem: { rate: 8, depth: 1 } });
  } },
  { id: "lab-machinery", group: "Lab", name: "Machinery", context: "The Lab: machines humming, with a clank and a servo now and then. Would loop quietly.", play: k => {
    k.tone({ f: 50, type: "sawtooth", dur: 4, gain: 0.07, attack: 0.4, hold: 3, filter: { f: 300 } });
    [0.8, 2.6].forEach(start => k.bell({ f: 340, start, dur: 0.3, gain: 0.06 }));
    k.tone({ f: 600, to: 900, type: "square", start: 1.5, dur: 0.6, gain: 0.015, filter: { f: 1200 } });
  } },
  { id: "vat-bubbling", group: "Lab", name: "Vat bubbling", context: "The Lab: the irradiation vat bubbling. Would loop quietly.", play: k => {
    for (let n = 0; n < 28; n++) k.tone({ f: random(90, 220), to: random(300, 600), start: random(0, 3), dur: random(0.05, 0.1), gain: 0.12, filter: { f: 900 } });
    k.noise({ dur: 3, gain: 0.06, color: "brown", type: "lowpass", f: 400, attack: 0.3, hold: 2.2 });
  } },
  { id: "vat-dip-scream", group: "Lab", name: "Vat dip scream", context: "The Lab: the dip into the vat, a falling scream cut off by a splash. Synthetic voice; a recording would sound more real.", play: k => {
    scream(k, { f: 800, peak: 1000, end: 320, dur: 0.9 });
    k.noise({ start: 0.9, dur: 0.8, gain: 0.45, color: "brown", type: "lowpass", f: 1500, to: 200 });
    k.noise({ start: 0.9, dur: 0.4, gain: 0.2, type: "highpass", f: 2500 });
  } },
  { id: "trap-clang", group: "Lab", name: "Trap clang", context: "The Lab: the trap slamming shut, a heavy metal clang that rings on.", play: k => {
    k.noise({ dur: 0.1, gain: 0.5, type: "lowpass", f: 2500 });
    k.bell({ f: 180, dur: 2.5, gain: 0.2, partials: [1, 2.41, 4.32, 6.68] });
    thump(k, { f: 70, gain: 0.5, dur: 0.3 });
  } },
  { id: "escape-siren", group: "Lab", name: "Escape siren", context: "The Lab escape: the alarm whooping.", play: k => {
    [0, 0.8, 1.6].forEach(start => k.tone({ f: 450, to: 1000, type: "sawtooth", start, dur: 0.75, gain: 0.09, attack: 0.02, hold: 0.55, filter: { f: 2000 } }));
  } },
  { id: "sewer-drips", group: "Sewers", name: "Drips", context: "The Sewers: water dripping in a long tunnel. Would loop quietly.", play: k => {
    const room = k.reverb({ seconds: 2.8, decay: 2.2, wet: 0.8 });
    [0.2, 0.9, 1.3, 2.2, 3.1].forEach(start => k.tone({ f: random(1000, 1500), to: random(1900, 2600), start, dur: 0.04, gain: 0.12, out: room }));
    k.noise({ dur: 4, gain: 0.05, color: "brown", type: "lowpass", f: 300, attack: 0.6, hold: 2.6 });
  } },
  { id: "door-glow", group: "Sewers", name: "Door glow", context: "The Sewers: the glowing door humming, a warm chord with a high shimmer.", play: k => {
    [110, 165, 220].forEach(f => k.tone({ f, dur: 3, gain: 0.05, attack: 0.6, hold: 1.6, trem: { rate: 2, depth: 0.4 } }));
    k.tone({ f: 1760, dur: 3, gain: 0.01, attack: 0.8, hold: 1.4, trem: { rate: 7, depth: 1 } });
  } },
];

/*
  The game's single takes of approved sounds that were reviewed as a run (Jamie approved the runs): one footstep, one
  stomp, one blip, one tick. Not shown at /sounds.
*/
const VARIANTS = [
  { id: "footsteps-one", play: k => k.noise({ dur: 0.07, gain: 0.22, type: "lowpass", f: random(500, 680) }) },
  { id: "kaiju-stomp-one", play: k => {
    k.noise({ dur: 0.6, gain: 0.6, color: "brown", type: "lowpass", f: 320 });
    k.tone({ f: 55, to: 34, dur: 0.5, gain: 0.6 });
    crackle(k, { start: 0.03, dur: 0.25, count: 8, gain: 0.05, f: 2000 });
  } },
  { id: "bio-tick", play: k => {
    k.noise({ dur: 0.012, gain: 0.12, f: random(2500, 4200), q: 3 });
    k.tone({ f: 160, dur: 0.02, gain: 0.05 });
  } },
  { id: "boot-tick", play: k => k.tone({ f: random(1700, 3400), type: "square", dur: 0.014, gain: 0.04 }) },
  ...[["guy", 230, "square", 0.07], ["girl", 350, "square", 0.07], ["punk", 160, "sawtooth", 0.09], ["ghost", 560, "sine", 0.09], ["mermaid", 440, "triangle", 0.1], ["agent", 130, "square", 0.07], ["other", 280, "triangle", 0.08]].map(([who, base, type, gain]) => ({
    id: `blip-${who}-one`,
    play: k => k.tone({ f: base * (1 + (who == "agent" ? 0 : random(-0.25, 0.25))), type, dur: 0.05, gain, vib: who == "ghost" ? { rate: 7, depth: 15 } : undefined, out: who == "ghost" ? k.echo({ delay: 0.18, feedback: 0.35 }) : undefined })
  })),
  { id: "drip-one", play: k => {
    const room = k.reverb({ seconds: 2.8, decay: 2.2, wet: 0.8 });
    k.tone({ f: random(1000, 1500), to: random(1900, 2600), dur: 0.04, gain: 0.12, out: room });
  } },
  { id: "bubble-one", play: k => k.tone({ f: random(90, 220), to: random(300, 600), dur: random(0.05, 0.1), gain: 0.12, filter: { f: 900 } }) },
  { id: "crackle-one", play: k => crackle(k, { dur: 0.6, count: 6, gain: 0.08 }) },
  { id: "spark-one", play: k => crackle(k, { dur: 0.4, count: 5, gain: 0.1, f: 5500 }) },
  { id: "sea-bubble-one", play: k => k.tone({ f: random(250, 500), to: random(700, 1100), dur: 0.05, gain: 0.04 }) },
  { id: "car-pass", play: SOUNDS.find(sound => sound.id == "street-traffic").play },
  { id: "lab-clank", play: k => k.bell({ f: 340, dur: 0.3, gain: 0.06 }) }
];
const BY_ID = Object.fromEntries([...SOUNDS, ...VARIANTS].map(sound => [sound.id, sound]));

// a sound into a given context (an OfflineAudioContext, to check one renders and how loud it is)
export const playSfxInto = (id, ctx, dest) => BY_ID[id].play(makeKit(ctx, dest));

/*
  A sound, now ('gain': this time's loudness, 1 as reviewed). The same sound again within 'minGapMs' is skipped, so a
  burst of events (ten hits in one frame, every tile catching fire) isn't ten sounds on top of each other; and never
  more than MAX_VOICES at once.
*/
const SFX_LIMITS = { minGapMs: 45, maxVoices: 14, voiceMs: 1500 };

// the reviewed sounds heard lately, newest first (the dev panel's, to approve or redo one in the game: Jamie, 2026-11-26);
// a single take counts as the sound it was taken from
const REVIEWED_IDS = new Set(SOUNDS.map(sound => sound.id));
const getReviewedId = id => REVIEWED_IDS.has(id) ? id : ({ "footsteps-one": "footsteps", "kaiju-stomp-one": "kaiju-stomp", "boot-tick": "boot-patter", "bio-tick": "bio-type", "car-pass": "street-traffic" })[id]
  || (/^blip-(guy|girl|punk|ghost|mermaid|agent)-one$/.test(id) ? id.replace(/-one$/, "") : undefined);
const recentSfx = [];
const recentListeners = new Set();
const noteRecent = id => {
  const reviewedId = getReviewedId(id);
  if (!reviewedId) return;
  const at = recentSfx.indexOf(reviewedId);
  if (at == 0) return;
  if (at > 0) recentSfx.splice(at, 1);
  recentSfx.unshift(reviewedId);
  recentSfx.length = Math.min(recentSfx.length, 12);
  recentListeners.forEach(listener => listener());
};
export const getRecentSfx = () => [...recentSfx];
export const onRecentSfx = listener => { recentListeners.add(listener); return () => recentListeners.delete(listener); };
export const getSoundName = id => (SOUNDS.find(sound => sound.id == id) || { name: id }).name;
export { getReviewedId };
const lastPlayedAt = {};
let voices = [];
export const playSfx = (id, { gain = 1, minGapMs = SFX_LIMITS.minGapMs } = {}) => {
  const sound = BY_ID[id];
  if (!sound) return;
  const ctx = getAudio();
  const nodes = getAudioNodes();
  if (!ctx || !nodes) return;
  const now = performance.now();
  if (now - (lastPlayedAt[id] || -Infinity) < minGapMs) return;
  voices = voices.filter(at => now - at < SFX_LIMITS.voiceMs);
  if (voices.length >= SFX_LIMITS.maxVoices) return;
  lastPlayedAt[id] = now;
  voices.push(now);
  noteRecent(id);
  // (its volume in this scene, as set in the Sound (dev) panel: soundVolumes.js)
  const key = `sfx:${getReviewedId(id) || id}`;
  noteHeard(key);
  try {
    const level = ctx.createGain();
    level.gain.value = gain * getSoundVolume(key);
    level.connect(nodes.sfx);
    sound.play(makeKit(ctx, level));
    setTimeout(() => level.disconnect(), 6000);
  } catch { /* (no sound) */ }
};
