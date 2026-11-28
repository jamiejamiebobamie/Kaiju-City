/*
  The game's music (Jamie, 2026-11-26): every theme written in code as note patterns (musicThemes.js) and played by this
  little sound-chip-style player, in either of two styles:
  - 'chip': 8-bit, as an old console's chip: pulse-wave lead and chords, triangle bass, noise drums;
  - 'synth': not 8-bit: a sawtooth lead with an echo, soft pads, a deep bass, punchier drums in a room;
  - 'synthwave' (Jamie, 2026-11-28: the music re-themed as 80s synthwave): detuned saw leads with a long echo, brass
    stabs, wide chorused pads under it all, a rolling or pumping bass, plucky arpeggios, a punchy kick, the gated-reverb
    snare and big toms, in a large hall. Each theme can have its own synthwave take ('synthwave' in musicThemes.js:
    tempo, bass, harmony, drums, voices).
  Each theme's style is Jamie's pick at /music (musicReview.json); 'synthwave' until then (was 'chip').

  playMusic(id) crossfades to a theme (looping); setMusicIntensity(1) brings in a theme's tense layer (the ghost rings,
  the flood); { isLight: true } is a lighter take (training and sparring: no chords, fewer drums); playMusicSting(id)
  plays a theme's opening bars over the music, turned down under it (an Agent showing).
*/
import { AUDIO_LEVEL, getAudio, getAudioNodes, onAudioUnlock } from "./audio";
import { getNoiseBuffer } from "./sfx";
import { getSoundVolume, noteHeard, onSoundVolumes } from "./soundVolumes";
import { THEMES, DRUMS } from "./musicThemes";
import REVIEW from "../Game/ReactComponents/MusicReview/musicReview.json";

export const MUSIC_STYLES = ["chip", "synth", "synthwave"];
// Jamie's verdicts, notes and picked styles (the dev panel adds to them in the game: MusicReview's save)
export const MUSIC_REVIEW = { ...REVIEW };
// dev (Jamie, 2026-11-26): every theme in one style, to hear it in the game: 'chip', 'synth', or undefined (each its pick)
export const MUSIC_STYLE_OVERRIDE = { value: undefined };
export const getThemeStyle = id => MUSIC_STYLE_OVERRIDE.value || (MUSIC_REVIEW[id] && MUSIC_REVIEW[id].style) || "synthwave";
// a theme as a style plays it: synthwave's own take over the theme's ('synthwave' in musicThemes.js)
export const getStyledTheme = (theme, style) => (style == "synthwave" && theme.synthwave ? { ...theme, ...theme.synthwave } : theme);

// - - - notes and chords - - -

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const getMidi = name => {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`not a note: ${name}`);
  return 12 * (Number(match[3]) + 1) + LETTERS[match[1]] + (match[2] == "#" ? 1 : match[2] == "b" ? -1 : 0);
};
const getFrequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
const CHORD_SHAPES = {
  "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], m7b5: [0, 3, 6, 10],
  sus4: [0, 5, 7], sus2: [0, 2, 7], aug: [0, 4, 8], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14], 5: [0, 7, 12]
};
export const getChord = token => {
  const match = /^([A-G][#b]?)(maj7|m7b5|m7|m6|m|7|dim|sus4|sus2|aug|6|add9|5)?$/.exec(token);
  if (!match) throw new Error(`not a chord: ${token}`);
  const rootClass = (getMidi(`${match[1]}4`) - 60 + 12) % 12;
  return { rootClass, shape: CHORD_SHAPES[match[2] || ""] };
};

// "E5:2 ~F5:1 .:4 | ..." to [{ step, midi, steps, isGlide }], and its length in steps
export const parseLine = (line = "") => {
  const notes = [];
  let step = 0;
  line.split(/\s+/).filter(token => token && token != "|").forEach(token => {
    const [name, length] = token.split(":");
    const steps = Number(length || 1);
    if (name != ".") {
      const isGlide = name.startsWith("~");
      notes.push({ step, midi: getMidi(isGlide ? name.slice(1) : name), steps, isGlide });
    }
    step += steps;
  });
  return { notes, length: step };
};
// "Em7 Am7:8 D7:8 | ..." (a bar each, unless given) to [{ step, steps, rootClass, shape }]
export const parseChords = (line = "") => {
  const chords = [];
  let step = 0;
  line.split(/\s+/).filter(token => token && token != "|").forEach(token => {
    const [name, length] = token.split(":");
    const steps = Number(length || 16);
    chords.push({ step, steps, ...getChord(name) });
    step += steps;
  });
  return { chords, length: step };
};

// - - - a theme's parts, step by step - - -

const BASS_PATTERNS = {
  long: () => [[0, 16, 0]],
  rootFifth: () => [[0, 8, 0], [8, 8, 7]],
  root8: () => [0, 2, 4, 6, 8, 10, 12, 14].map(step => [step, 2, 0]),
  octave8: () => [0, 2, 4, 6, 8, 10, 12, 14].map((step, k) => [step, 2, k % 2 ? 12 : 0]),
  pulse16: () => Array.from({ length: 16 }, (_, step) => [step, 1, 0]),
  arp: () => [0, 2, 4, 6, 8, 10, 12, 14].map((step, k) => [step, 2, [0, 7, 12, 7][k % 4]]),
  stomp: () => [[0, 4, 0], [6, 2, 0], [8, 4, 0], [12, 2, 12], [14, 2, 0]],
  // synthwave's: the root pumping in eighths; rolling sixteenths with the octave on the offbeats
  pump8: () => [0, 2, 4, 6, 8, 10, 12, 14].map(step => [step, 2, 0]),
  roll16: () => Array.from({ length: 16 }, (_, step) => [step, 1, step % 4 == 2 ? 12 : 0]),
  walk: (chord, next) => {
    const third = chord.shape[1];
    const nextRoot = next ? next.rootClass : chord.rootClass;
    const approach = ((nextRoot - chord.rootClass + 12) % 12) - 1; // a half step below the next root
    return [[0, 4, 0], [4, 4, third], [8, 4, 7], [12, 4, approach <= 0 ? 11 : approach]];
  }
};
// [step, steps, which chord tones ('all', or indexes), octave up]
const HARMONY_PATTERNS = {
  pad: () => [[0, 16, "all", 0]],
  stabs: () => [2, 6, 10, 14].map(step => [step, 1, "all", 0]),
  chug: () => [0, 2, 4, 6, 8, 10, 12, 14].map(step => [step, 1, "all", 0]),
  tremolo: () => Array.from({ length: 16 }, (_, step) => [step, 1, "all", 0]),
  arp8: () => [0, 2, 4, 6, 8, 10, 12, 14].map((step, k) => [step, 2, [k % 3], 0]),
  arp16: () => Array.from({ length: 16 }, (_, step) => [step, 1, [[0, 1, 2, 1][step % 4]], step % 8 >= 4 ? 1 : 0]),
  musicbox: () => [0, 2, 4, 6, 8, 10, 12, 14].map((step, k) => [step, 2, [[0, 2, 1, 2][k % 4]], 1]),
  underPad: () => [[0, 16, "all", 0]] // (synthwave's pad under another harmony)
};

// synthwave's bass, from the theme's (when the theme has no synthwave bass of its own)
const SYNTHWAVE_BASS = { root8: "roll16", rootFifth: "pump8" };
const compileTheme = (theme, mods = {}) => {
  const melody = parseLine(theme.melody);
  const counter = parseLine(theme.counter);
  const { chords, length: chordLength } = parseChords(theme.chords);
  const length = Math.max(melody.length, chordLength, 16);
  const events = Array.from({ length }, () => []);
  const add = (step, event) => events[step % length].push(event);

  melody.notes.forEach(note => add(note.step, { part: "lead", ...note }));
  if (!mods.isLight) counter.notes.forEach(note => add(note.step, { part: "counter", ...note, layer: theme.isCounterAlways ? undefined : "intense" }));

  const addChordParts = (part, styleName, layer) => {
    if (!styleName) return;
    chords.forEach((chord, k) => {
      const next = chords[(k + 1) % chords.length];
      for (let bar = 0; bar < chord.steps; bar += 16) {
        const span = Math.min(16, chord.steps - bar);
        if (part == "bass") {
          const pattern = BASS_PATTERNS[styleName](chord, bar + 16 >= chord.steps ? next : chord);
          pattern.filter(([step]) => step < span).forEach(([step, steps, interval]) => {
            const root = 40 + ((chord.rootClass - 4 + 12) % 12); // (from E2 up to D#3: low, but not mud)
            add(chord.step + bar + step, { part, midi: root + interval + 12 * (theme.bassOctave || 0), steps: Math.min(steps, span - step), layer });
          });
        } else {
          HARMONY_PATTERNS[styleName]().filter(([step]) => step < span).forEach(([step, steps, tones, octave]) => {
            const root = 55 + ((chord.rootClass - 7 + 12) % 12); // (voiced from G3 up)
            const intervals = tones == "all" ? chord.shape : tones.map(index => chord.shape[index % chord.shape.length]);
            intervals.forEach(interval => add(chord.step + bar + step, { part, pattern: styleName, midi: root + interval + 12 * octave + 12 * (theme.harmonyOctave || 0), steps: Math.min(steps, span - step), layer, isChord: tones == "all" }));
          });
        }
      }
    });
  };
  const isWave = mods.style == "synthwave";
  addChordParts("bass", mods.bass || (isWave && !theme.synthwave?.bass && SYNTHWAVE_BASS[theme.bass]) || theme.bass, undefined);
  // (synthwave: a wide pad under the chords too, unless the theme's harmony is a pad already or it says not)
  if (isWave && !mods.isLight && theme.harmony != "pad" && theme.wavePad !== false && chords.length) addChordParts("harmony", "underPad", undefined);
  if (!mods.isLight) addChordParts("harmony", mods.harmony || theme.harmony, theme.intense && theme.intense.harmony ? "calm" : undefined);
  if (!mods.isLight && theme.intense && theme.intense.harmony) addChordParts("harmony", theme.intense.harmony, "intense");

  const addDrums = (presets, layer) => {
    const list = [].concat(presets || []);
    if (!list.length) return;
    for (let bar = 0; bar < length / 16; bar++) {
      const pattern = DRUMS[list[bar % list.length]] || {};
      Object.entries(pattern).forEach(([drum, hits]) => {
        if (mods.isLight && !["k", "h", "r"].includes(drum)) return;
        [...hits].forEach((hit, step) => {
          if (hit == ".") return;
          if (mods.isLight && drum == "h" && step % 4 != 0) return;
          add(bar * 16 + step, { part: "drums", drum, isAccent: hit == "X", layer });
        });
      });
    }
  };
  const hasIntenseDrums = theme.intense && theme.intense.drums;
  addDrums(mods.drums || theme.drums, hasIntenseDrums ? "calm" : undefined);
  if (hasIntenseDrums && !mods.isLight) addDrums(theme.intense.drums, "intense");
  return { events, length };
};

// - - - the instruments - - -

const waveCache = new WeakMap();
const getPulseWave = (ctx, duty) => {
  const waves = waveCache.get(ctx) || {};
  waveCache.set(ctx, waves);
  if (waves[duty]) return waves[duty];
  const count = 48;
  const real = new Float32Array(count);
  const imag = new Float32Array(count);
  for (let n = 1; n < count; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
  }
  return (waves[duty] = ctx.createPeriodicWave(real, imag));
};

// { wave, gain, attack, decay, sustain, release, filter, detunePair, vibrato, send }
const INSTRUMENTS = {
  pulse50: { wave: 0.5, gain: 0.07, attack: 0.004, decay: 0.08, sustain: 0.7, release: 0.03, vibrato: 10 },
  pulse25: { wave: 0.25, gain: 0.08, attack: 0.004, decay: 0.08, sustain: 0.7, release: 0.03, vibrato: 12 },
  pulse12: { wave: 0.125, gain: 0.045, attack: 0.004, decay: 0.06, sustain: 0.6, release: 0.03 },
  triangle: { wave: "triangle", gain: 0.13, attack: 0.004, decay: 0.05, sustain: 0.9, release: 0.03 },
  triangleLead: { wave: "triangle", gain: 0.16, attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.06, vibrato: 14 },
  chipBox: { wave: "triangle", gain: 0.09, attack: 0.002, decay: 0.25, sustain: 0.15, release: 0.1 },
  saw: { wave: "sawtooth", gain: 0.05, attack: 0.02, decay: 0.15, sustain: 0.75, release: 0.12, filter: 2600, detunePair: 7, vibrato: 14, send: "echo" },
  softLead: { wave: "sine", gain: 0.1, attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.2, vibrato: 16, send: "echo" },
  pad: { wave: "sawtooth", gain: 0.018, attack: 0.35, decay: 0.4, sustain: 0.8, release: 0.5, filter: 1300, detunePair: 9, send: "reverb" },
  pluck: { wave: "sawtooth", gain: 0.03, attack: 0.003, decay: 0.16, sustain: 0.1, release: 0.08, filter: 1800, send: "reverb" },
  pluckLow: { wave: "sawtooth", gain: 0.035, attack: 0.003, decay: 0.1, sustain: 0.4, release: 0.04, filter: 900, detunePair: 8 },
  bell: { wave: "sine", gain: 0.06, attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.3, partial: 2.76, send: "reverb" },
  sub: { wave: "sine", gain: 0.17, attack: 0.008, decay: 0.1, sustain: 0.85, release: 0.06, layer: { wave: "sawtooth", gain: 0.1, filter: 380 } },
  // synthwave's ('filterEnv': the filter opening bright and closing, from 'from' to 'to' Hz over 'seconds'; 'send' one
  // or more of echo, reverb, chorus)
  waveLead: { wave: "sawtooth", gain: 0.045, attack: 0.012, decay: 0.3, sustain: 0.75, release: 0.25, filter: 3400, detunePair: 11, vibrato: 12, send: ["echo", "reverb"] },
  waveSoftLead: { wave: "triangle", gain: 0.17, attack: 0.03, decay: 0.3, sustain: 0.75, release: 0.35, vibrato: 14, partial: 2, send: ["echo", "reverb"] },
  waveBrass: { wave: "sawtooth", gain: 0.03, attack: 0.015, decay: 0.25, sustain: 0.45, release: 0.18, filter: 900, filterEnv: { from: 3600, to: 900, seconds: 0.22 }, detunePair: 9, send: ["reverb", "chorus"] },
  wavePad: { wave: "sawtooth", gain: 0.02, attack: 0.7, decay: 0.6, sustain: 0.85, release: 1.1, filter: 1500, detunePair: 14, send: ["reverb", "chorus"] },
  waveUnderPad: { wave: "sawtooth", gain: 0.008, attack: 0.9, decay: 0.6, sustain: 0.85, release: 1.2, filter: 1100, detunePair: 16, send: ["reverb", "chorus"] },
  waveArp: { wave: 0.5, gain: 0.03, attack: 0.002, decay: 0.12, sustain: 0.15, release: 0.12, filter: 2600, send: ["echo", "chorus"] },
  waveGate: { wave: "sawtooth", gain: 0.022, attack: 0.003, decay: 0.08, sustain: 0.55, release: 0.04, filter: 1900, detunePair: 12, send: ["chorus"] },
  waveGrowl: { wave: "sawtooth", gain: 0.03, attack: 0.004, decay: 0.1, sustain: 0.5, release: 0.05, filter: 1200, filterEnv: { from: 2600, to: 700, seconds: 0.1 }, detunePair: 18 },
  waveBell: { wave: "sine", gain: 0.09, attack: 0.002, decay: 0.9, sustain: 0.08, release: 0.5, partial: 3.5, send: ["echo", "reverb"] },
  waveBass: { wave: "sawtooth", gain: 0.06, attack: 0.004, decay: 0.12, sustain: 0.55, release: 0.05, filter: 600, filterEnv: { from: 1700, to: 500, seconds: 0.12 }, layer: { wave: "sine", gain: 0.11, filter: 300 } }
};
const VOICES = {
  chip: { lead: "pulse25", counter: "pulse12", harmony: "pulse12", bass: "triangle", musicbox: "chipBox" },
  synth: { lead: "saw", counter: "softLead", harmony: "pluck", pad: "pad", chug: "pluckLow", bass: "sub", musicbox: "bell" },
  synthwave: { lead: "waveLead", counter: "waveSoftLead", harmony: "waveArp", stabs: "waveBrass", pad: "wavePad", underPad: "waveUnderPad", chug: "waveGrowl", tremolo: "waveGate", arp8: "waveArp", arp16: "waveArp", bass: "waveBass", musicbox: "waveBell" }
};

const playNote = (ctx, outs, instrument, midi, start, seconds, { glideFrom, gainScale = 1 } = {}) => {
  const spec = INSTRUMENTS[instrument];
  if (!spec) return;
  const frequency = getFrequency(midi);
  const end = start + Math.max(seconds, 0.03);
  const level = ctx.createGain();
  const peak = spec.gain * gainScale;
  level.gain.setValueAtTime(0.0001, start);
  level.gain.linearRampToValueAtTime(peak, start + spec.attack);
  level.gain.setTargetAtTime(peak * spec.sustain, start + spec.attack, spec.decay / 3);
  level.gain.setValueAtTime(peak * spec.sustain, Math.max(end - 0.005, start + spec.attack));
  level.gain.setTargetAtTime(0.0001, end, spec.release / 3);
  let into = level;
  if (spec.filter) {
    const shape = ctx.createBiquadFilter();
    shape.type = "lowpass";
    shape.frequency.value = spec.filter;
    shape.Q.value = spec.filterEnv ? 3 : 1.2;
    if (spec.filterEnv) {
      shape.frequency.setValueAtTime(spec.filterEnv.from, start);
      shape.frequency.exponentialRampToValueAtTime(spec.filterEnv.to, start + spec.filterEnv.seconds);
    }
    shape.connect(level);
    into = shape;
  }
  level.connect(outs.dry);
  [].concat(spec.send || []).forEach(send => outs[send] && level.connect(outs[send]));
  const stopAt = end + spec.release * 2 + 0.05;
  const makeOsc = (detune, ratio = 1, wave = spec.wave, dest = into, gain = 1) => {
    const osc = ctx.createOscillator();
    if (typeof wave == "number") osc.setPeriodicWave(getPulseWave(ctx, wave));
    else osc.type = wave;
    osc.detune.value = detune;
    if (glideFrom) {
      osc.frequency.setValueAtTime(getFrequency(glideFrom) * ratio, start);
      osc.frequency.exponentialRampToValueAtTime(frequency * ratio, start + Math.min(0.07, seconds * 0.5));
    } else osc.frequency.setValueAtTime(frequency * ratio, start);
    if (spec.vibrato && seconds > 0.25) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, start);
      depth.gain.linearRampToValueAtTime(spec.vibrato, start + Math.min(0.35, seconds));
      lfo.connect(depth).connect(osc.detune);
      lfo.start(start);
      lfo.stop(stopAt);
    }
    let node = osc;
    if (gain != 1) {
      const scale = ctx.createGain();
      scale.gain.value = gain;
      node = osc.connect(scale);
    }
    node.connect(dest);
    osc.start(start);
    osc.stop(stopAt);
  };
  makeOsc(0);
  if (spec.detunePair) makeOsc(spec.detunePair, 1, spec.wave, into, 0.7);
  if (spec.partial) makeOsc(0, spec.partial, "sine", into, 0.25);
  if (spec.layer) {
    const shape = ctx.createBiquadFilter();
    shape.type = "lowpass";
    shape.frequency.value = spec.layer.filter;
    shape.connect(level);
    makeOsc(0, 1, spec.layer.wave, shape, spec.layer.gain / spec.gain);
  }
};

const playDrum = (ctx, outs, style, drum, start, isAccent) => {
  const accent = isAccent ? 1.4 : 1;
  const noise = ({ gain, type, frequency, q = 1, seconds, send }) => {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx, "white");
    const shape = ctx.createBiquadFilter();
    shape.type = type;
    shape.frequency.value = frequency;
    shape.Q.value = q;
    const level = ctx.createGain();
    level.gain.setValueAtTime(gain * accent, start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(shape).connect(level).connect(outs.dry);
    if (send && outs.reverb) level.connect(outs.reverb);
    source.start(start, Math.random() * 2);
    source.stop(start + seconds + 0.02);
  };
  const thud = ({ from, to, seconds, gain, wave = "sine" }) => {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + seconds);
    const level = ctx.createGain();
    level.gain.setValueAtTime(gain * accent, start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(level).connect(outs.dry);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  };
  const isChip = style == "chip";
  if (style == "synthwave") return playWaveDrum(drum, { noise, thud, accent, ctx, outs, start });
  switch (drum) {
    case "k":
      if (isChip) thud({ from: 190, to: 45, seconds: 0.1, gain: 0.38, wave: "triangle" });
      else { thud({ from: 140, to: 42, seconds: 0.3, gain: 0.6 }); noise({ gain: 0.05, type: "lowpass", frequency: 2000, seconds: 0.01 }); }
      break;
    case "s":
      if (isChip) noise({ gain: 0.16, type: "highpass", frequency: 900, seconds: 0.09 });
      else { noise({ gain: 0.22, type: "bandpass", frequency: 1900, q: 0.8, seconds: 0.17, send: true }); thud({ from: 200, to: 160, seconds: 0.08, gain: 0.12, wave: "triangle" }); }
      break;
    case "h":
      noise({ gain: isChip ? 0.06 : 0.045, type: "highpass", frequency: isChip ? 7000 : 9000, seconds: 0.03 });
      break;
    case "o":
      noise({ gain: isChip ? 0.05 : 0.04, type: "highpass", frequency: 7000, seconds: 0.18 });
      break;
    case "r":
      noise({ gain: 0.12, type: "bandpass", frequency: 2800, q: 4, seconds: 0.03, send: !isChip });
      break;
    case "t":
      thud({ from: isChip ? 160 : 150, to: 80, seconds: 0.18, gain: 0.35, wave: isChip ? "triangle" : "sine" });
      break;
    case "c":
      noise({ gain: isChip ? 0.06 : 0.07, type: "highpass", frequency: 5000, seconds: isChip ? 0.6 : 1.2, send: !isChip });
      break;
    default:
  }
};

/*
  synthwave's kit: a punchy kick, the gated-reverb snare (a burst of dense noise held flat, then cut short, into the
  hall), a clap for the rim, bright hats, big toms that fall in pitch, a long crash.
*/
const playWaveDrum = (drum, { noise, thud, accent, ctx, outs, start }) => {
  const gated = (gain, seconds) => {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx, "white");
    const shape = ctx.createBiquadFilter();
    shape.type = "bandpass";
    shape.frequency.value = 2200;
    shape.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.setValueAtTime(gain * accent, start);
    level.gain.setValueAtTime(gain * accent * 0.8, start + seconds);
    level.gain.linearRampToValueAtTime(0.0001, start + seconds + 0.025); // (the gate shutting)
    source.connect(shape).connect(level).connect(outs.dry);
    if (outs.reverb) level.connect(outs.reverb);
    source.start(start, Math.random() * 2);
    source.stop(start + seconds + 0.05);
  };
  switch (drum) {
    case "k":
      thud({ from: 160, to: 44, seconds: 0.34, gain: 0.62 });
      noise({ gain: 0.06, type: "lowpass", frequency: 3000, seconds: 0.012 });
      break;
    case "s":
      noise({ gain: 0.2, type: "bandpass", frequency: 1800, q: 0.8, seconds: 0.12 });
      thud({ from: 230, to: 180, seconds: 0.09, gain: 0.16, wave: "triangle" });
      gated(0.07, 0.2);
      break;
    case "r": // (a clap: three quick bursts)
      [0, 0.012, 0.024].forEach(lag => noise({ gain: 0.09, type: "bandpass", frequency: 1400, q: 1.5, seconds: 0.03 + lag, send: true }));
      break;
    case "h":
      noise({ gain: 0.035, type: "highpass", frequency: 8500, seconds: 0.028 });
      break;
    case "o":
      noise({ gain: 0.035, type: "highpass", frequency: 7500, seconds: 0.22 });
      break;
    case "t":
      thud({ from: 210, to: 70, seconds: 0.42, gain: 0.42 });
      noise({ gain: 0.04, type: "bandpass", frequency: 900, seconds: 0.1, send: true });
      break;
    case "c":
      noise({ gain: 0.06, type: "highpass", frequency: 4500, seconds: 1.8, send: true });
      break;
    default:
  }
};

// - - - a playing theme - - -

const LOOK_AHEAD = { everyMs: 25, aheadSeconds: 0.15 };
const STYLE_LEVELS = { chip: 1, synth: 0.55, synthwave: 0.72 }; // (synthwave measured as loud as the others: offline renders, 2026-11-28)

class ThemePlayer {
  constructor(id, { style = getThemeStyle(id), isLight = false, isLooping = true, bars, intensity = 0 } = {}) {
    const theme = THEMES[id];
    this.id = id;
    this.style = style;
    this.isLight = isLight;
    this.isLooping = isLooping;
    this.intensity = intensity;
    // a medley: each theme in turn, at its own tempo (the credits)
    this.sections = (theme.medley || [id]).map(sectionId => {
      const sectionTheme = getStyledTheme(THEMES[sectionId], style);
      const compiled = compileTheme(sectionTheme, { isLight, style });
      const length = bars ? Math.min(bars * 16, compiled.length) : compiled.length;
      return { theme: sectionTheme, ...compiled, length, stepSeconds: 60 / sectionTheme.bpm / 4, voices: { ...VOICES[style], ...((sectionTheme.voices || {})[style] || {}) } };
    });
    this.sectionIndex = 0;
    this.step = 0;
    this.lastMidi = {};
    // (the two styles about as loud as each other; and the theme's volume in this scene, from the Sound (dev) panel)
    this.level = (STYLE_LEVELS[style] || 1) * getSoundVolume(`music:${id}`);
  }

  start(fadeSeconds = 1.2) {
    const ctx = getAudio();
    const nodes = getAudioNodes();
    if (!ctx || !nodes) return false;
    this.connect(ctx, nodes.music, fadeSeconds);
    this.isRunning = true;
    this.timer = setInterval(() => this.schedule(), LOOK_AHEAD.everyMs);
    this.schedule();
    return true;
  }

  // (an OfflineAudioContext: the theme's first 'seconds', to check it renders and how loud)
  renderInto(ctx, dest, seconds) {
    this.connect(ctx, dest, 0.02);
    this.isRunning = true;
    this.scheduleUntil(seconds);
  }

  connect(ctx, dest, fadeSeconds) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(this.level, ctx.currentTime + Math.max(fadeSeconds, 0.02));
    this.out.connect(dest);
    this.outs = { dry: this.out };
    if (this.style == "synth" || this.style == "synthwave") {
      const isWave = this.style == "synthwave";
      const echo = ctx.createDelay(2);
      echo.delayTime.value = (60 / this.sections[0].theme.bpm) * 0.75; // (a dotted eighth)
      const back = ctx.createGain();
      back.gain.value = isWave ? 0.42 : 0.3; // (synthwave's echo longer)
      const echoLevel = ctx.createGain();
      echoLevel.gain.value = isWave ? 0.3 : 0.35;
      echo.connect(back).connect(echo);
      echo.connect(echoLevel).connect(this.out);
      const room = ctx.createConvolver();
      const length = Math.floor(ctx.sampleRate * (isWave ? 3 : 1.8)); // (synthwave's: a big hall)
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let k = 0; k < length; k++) data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / length, isWave ? 2.4 : 3);
      }
      room.buffer = impulse;
      const roomLevel = ctx.createGain();
      roomLevel.gain.value = isWave ? 0.32 : 0.4;
      room.connect(roomLevel).connect(this.out);
      this.outs.echo = echo;
      this.outs.reverb = room;
      // synthwave's chorus: a short delay swaying, mixed in beside the dry sound (the pads' and arps' width)
      if (isWave) {
        const chorus = ctx.createDelay(0.05);
        chorus.delayTime.value = 0.014;
        const sway = ctx.createOscillator();
        const depth = ctx.createGain();
        sway.frequency.value = 0.7;
        depth.gain.value = 0.004;
        sway.connect(depth).connect(chorus.delayTime);
        sway.start();
        const chorusLevel = ctx.createGain();
        chorusLevel.gain.value = 0.6;
        chorus.connect(chorusLevel).connect(this.out);
        this.outs.chorus = chorus;
        this.chorusSway = sway;
      }
    }
    this.nextTime = ctx.currentTime + 0.08;
  }

  schedule() {
    this.scheduleUntil(this.ctx.currentTime + LOOK_AHEAD.aheadSeconds);
  }

  scheduleUntil(endTime) {
    const ctx = this.ctx;
    while (this.isRunning && this.nextTime < endTime) {
      const section = this.sections[this.sectionIndex];
      const { theme, stepSeconds, voices } = section;
      const swing = this.step % 4 == 2 ? (theme.swing || 0) * stepSeconds : 0;
      const at = this.nextTime + swing;
      section.events[this.step].forEach(event => {
        if (event.layer == "intense" && this.intensity < 1) return;
        if (event.layer == "calm" && this.intensity >= 1) return;
        if (event.part == "drums") return playDrum(ctx, this.outs, this.style, event.drum, at, event.isAccent);
        const harmonyStyle = event.pattern || (event.layer == "intense" ? theme.intense.harmony : theme.harmony);
        const instrument = event.part == "harmony" ? (voices[harmonyStyle] || voices.harmony) : voices[event.part];
        const glideFrom = event.isGlide ? this.lastMidi[event.part] : undefined;
        playNote(ctx, this.outs, instrument, event.midi, at, event.steps * stepSeconds * (event.part == "lead" ? 0.95 : 0.9), { glideFrom, gainScale: event.isChord ? 0.8 : 1 });
        this.lastMidi[event.part] = event.midi;
      });
      this.nextTime += stepSeconds;
      this.step++;
      if (this.step >= section.length) {
        this.step = 0;
        this.sectionIndex++;
        if (this.sectionIndex >= this.sections.length) {
          this.sectionIndex = 0;
          if (!this.isLooping) {
            this.stop(0.6, (this.nextTime - ctx.currentTime));
            if (this.onEnd) this.onEnd();
            return;
          }
        }
      }
    }
  }

  setIntensity(intensity) {
    this.intensity = intensity;
  }

  stop(fadeSeconds = 1.2, afterSeconds = 0) {
    clearInterval(this.timer);
    this.timer = undefined;
    this.isRunning = false;
    if (!this.ctx || !this.out) return;
    const at = this.ctx.currentTime + afterSeconds;
    const out = this.out;
    out.gain.cancelScheduledValues(at);
    out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), at);
    out.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(fadeSeconds, 0.02));
    const sway = this.chorusSway;
    setTimeout(() => { out.disconnect(); if (sway) sway.stop(); }, (afterSeconds + fadeSeconds) * 1000 + 600);
  }
}

// - - - what the game calls - - -

let current; // { key, player }
let wanted; // what to play once sound may start: { id, options }

const getKey = (id, { isLight = false, style } = {}) => `${id}|${isLight ? "light" : ""}|${style || getThemeStyle(id)}`;

// crossfade to a theme (or to silence, with undefined). the same one already playing goes on as it is
export const playMusic = (id, options = {}) => {
  wanted = id ? { id, options } : undefined;
  if (!id) {
    if (current) current.player.stop(options.fadeSeconds ?? 1.2);
    current = undefined;
    return;
  }
  if (!THEMES[id]) return;
  const key = getKey(id, options);
  if (current && current.key == key) {
    if (options.intensity !== undefined) current.player.setIntensity(options.intensity);
    return;
  }
  const player = new ThemePlayer(id, options);
  if (!player.start(options.fadeSeconds ?? 1.2)) return; // (no sound yet: it starts on the first press, below)
  if (current) current.player.stop(options.fadeSeconds ?? 1.2);
  current = { key, player, options };
  noteHeard(`music:${id}`);
};
export const stopMusic = (fadeSeconds = 1.2) => playMusic(undefined, { fadeSeconds });
// what's playing: its id, and whether it's the light take or tense (the dev panel's)
export const getCurrentMusicInfo = () => current && { id: current.player.id, style: current.player.style, isLight: current.player.isLight, intensity: current.player.intensity };
// the style override changed, or a theme's picked style: the theme playing goes over to it (a quick crossfade)
export const refreshMusicStyle = () => {
  if (!current) return;
  const { player, options } = current;
  playMusic(player.id, { ...options, style: undefined, intensity: player.intensity, fadeSeconds: 0.4 });
};
export const getCurrentMusic = () => (current ? current.player.id : undefined);

// the tense layer: 0 calm, 1 tense (the ghost rings, the flood, the door near)
export const setMusicIntensity = intensity => {
  if (wanted) wanted.options = { ...wanted.options, intensity };
  if (current) current.player.setIntensity(intensity);
};

// a theme's opening bars over the music, the music turned down under it (an Agent showing: Jamie)
let stingUntil = 0;
export const playMusicSting = (id, { bars = 2 } = {}) => {
  const ctx = getAudio();
  if (!ctx || !THEMES[id] || Date.now() < stingUntil || getCurrentMusic() == id) return; // (not over its own theme)
  const player = new ThemePlayer(id, { isLooping: false, bars });
  if (!player.start(0.05)) return;
  const seconds = bars * 16 * (60 / getStyledTheme(THEMES[id], player.style).bpm / 4);
  stingUntil = Date.now() + seconds * 1000 + 1500;
  if (current && current.player.out) {
    const gain = current.player.out.gain;
    gain.setTargetAtTime(0.2 * current.player.level, ctx.currentTime, 0.1);
    gain.setTargetAtTime(current.player.level, ctx.currentTime + seconds, 0.4);
  }
};

// a theme's first 'seconds' into a given context (an OfflineAudioContext: the checks)
export const renderMusicInto = (id, style, ctx, dest, seconds, options = {}) => new ThemePlayer(id, { ...options, style }).renderInto(ctx, dest, seconds);

// for the /music review: one theme, now, in a style; stopped by stopMusic
export const previewMusic = (id, style, options = {}) => playMusic(id, { ...options, style, fadeSeconds: 0.3 });

// a theme's volume changed in the Sound (dev) panel, or the scene did: the theme playing goes to its level there
onSoundVolumes(() => {
  if (!current || !current.player.out || !current.player.ctx) return;
  const player = current.player;
  noteHeard(`music:${player.id}`);
  const level = (STYLE_LEVELS[player.style] || 1) * getSoundVolume(`music:${player.id}`);
  if (Math.abs(level - player.level) < 0.001) return;
  player.level = level;
  player.out.gain.setTargetAtTime(Math.max(level, 0.0001), player.ctx.currentTime, 0.1);
});

// (dev: what's playing, for scripted checks)
if (import.meta.env && import.meta.env.DEV && typeof window != "undefined") window.__kaijuMusic = { getCurrentMusic, getWanted: () => wanted && wanted.id, getCurrentMusicInfo: () => getCurrentMusicInfo(), getNodes: () => getAudioNodes(), getLevel: () => AUDIO_LEVEL };

onAudioUnlock(() => {
  if (wanted && !current) playMusic(wanted.id, wanted.options);
});
