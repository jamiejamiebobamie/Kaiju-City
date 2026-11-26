/*
  The loops under a scene (Jamie, 2026-11-26: the approved "would loop" sounds at /sounds, made to run on): the level's
  own (the city, the wind, the tanks' hum, the Lab's machines and vat, the Sewers' drips and the door's glow, the
  Street's cars) and the tiles' (fire, water, electricity, ghosts), each faded to the level asked of it by setAmbience.
*/
import { getAudio, getAudioNodes } from "./audio";
import { getNoiseBuffer, playSfxInto } from "./sfx";

const random = (min, max) => min + Math.random() * (max - min);

// each loop: 'build' its steady part into 'out' (returns its sources), and 'events' now and then (a sound id)
const LOOPS = {
  fire: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 500, gain: 0.15 })],
    events: { id: "crackle-one", everyMs: [120, 420] }
  },
  water: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 700, gain: 0.2, trem: 0.7 })],
    events: { id: "drip-one", everyMs: [900, 2200] }
  },
  electric: {
    build: (ctx, out) => [tone(ctx, out, { f: 60, type: "sawtooth", gain: 0.09, filter: { type: "bandpass", f: 400, q: 2 } })],
    events: { id: "spark-one", everyMs: [150, 700] }
  },
  ghost: {
    build: (ctx, out) => [noise(ctx, out, { type: "bandpass", f: 1200, q: 8, gain: 0.12, sweep: { rate: 0.4, depth: 600 } }), tone(ctx, out, { f: 110, gain: 0.06, trem: 1.5 })]
  },
  wind: {
    build: (ctx, out) => [noise(ctx, out, { type: "bandpass", f: 600, q: 1.5, gain: 0.25, sweep: { rate: 0.35, depth: 300 }, trem: 0.3 })]
  },
  city: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 300, gain: 0.15 }), tone(ctx, out, { f: 760, gain: 0.018, sweep: { rate: 0.6, depth: 140 }, filter: { type: "lowpass", f: 1500 } })]
  },
  traffic: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 280, gain: 0.1 })],
    events: { id: "car-pass", everyMs: [3500, 9000] }
  },
  aquarium: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 250, gain: 0.2 }), tone(ctx, out, { f: 68, gain: 0.08, trem: 0.5 })],
    events: { id: "sea-bubble-one", everyMs: [250, 900] }
  },
  machinery: {
    build: (ctx, out) => [tone(ctx, out, { f: 50, type: "sawtooth", gain: 0.07, filter: { type: "lowpass", f: 300 } })],
    events: { id: "lab-clank", everyMs: [1500, 4000] }
  },
  vat: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 400, gain: 0.06 })],
    events: { id: "bubble-one", everyMs: [80, 260] }
  },
  drips: {
    build: (ctx, out) => [noise(ctx, out, { color: "brown", type: "lowpass", f: 300, gain: 0.05 })],
    events: { id: "drip-one", everyMs: [500, 1600] }
  },
  doorGlow: {
    build: (ctx, out) => [110, 165, 220].map(f => tone(ctx, out, { f, gain: 0.05, trem: 2 })).concat([tone(ctx, out, { f: 1760, gain: 0.01, trem: 7 })])
  }
};

function wobble(ctx, param, rate, depth) {
  const lfo = ctx.createOscillator();
  const amount = ctx.createGain();
  lfo.frequency.value = rate;
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  lfo.start();
  return lfo;
}
function finish(ctx, source, chain, out, { gain, trem }) {
  const level = ctx.createGain();
  level.gain.value = gain;
  const sources = [source];
  if (trem) {
    const stage = ctx.createGain();
    stage.gain.value = 0.5;
    sources.push(wobble(ctx, stage.gain, trem, 0.5));
    chain.connect(level).connect(stage).connect(out);
  } else chain.connect(level).connect(out);
  source.start();
  return sources;
}
function noise(ctx, out, { color = "white", type, f, q = 1, sweep, ...rest }) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx, color);
  source.loop = true;
  const shape = ctx.createBiquadFilter();
  shape.type = type;
  shape.frequency.value = f;
  shape.Q.value = q;
  const sources = finish(ctx, source, source.connect(shape), out, rest);
  if (sweep) sources.push(wobble(ctx, shape.frequency, sweep.rate, sweep.depth));
  return sources;
}
function tone(ctx, out, { f, type = "sine", filter, sweep, ...rest }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = f;
  let chain = osc;
  if (filter) {
    const shape = ctx.createBiquadFilter();
    shape.type = filter.type;
    shape.frequency.value = filter.f;
    shape.Q.value = filter.q || 1;
    chain = osc.connect(shape);
  }
  const sources = finish(ctx, osc, chain, out, rest);
  if (sweep) sources.push(wobble(ctx, osc.frequency, sweep.rate, sweep.depth));
  return sources;
}

const playing = {}; // name: { gain, sources, level, nextEventAt, stopTimer }
const FADE_SECONDS = 0.8;

// each loop's level now, 0 to 1 (those left out: 0), as one 'source' asks (the scene, the vat's screen): each loop plays
// at the most any source asks of it
const bySource = {};
export const setAmbience = (levels, source = "scene") => {
  bySource[source] = levels;
  const ctx = getAudio();
  const nodes = getAudioNodes();
  if (!ctx || !nodes) return;
  const now = performance.now();
  Object.keys(LOOPS).forEach(name => {
    const level = Math.min(1, Math.max(0, ...Object.values(bySource).map(asked => asked[name] || 0)));
    let loop = playing[name];
    if (!level) {
      if (loop && loop.level) {
        loop.level = 0;
        loop.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_SECONDS / 3);
        clearTimeout(loop.stopTimer);
        loop.stopTimer = setTimeout(() => {
          loop.sources.flat().forEach(source => { try { source.stop(); } catch { /* (stopped) */ } });
          loop.gain.disconnect();
          if (playing[name] == loop) delete playing[name];
        }, FADE_SECONDS * 4000);
      }
      return;
    }
    if (!loop) {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(nodes.ambience);
      loop = playing[name] = { gain, sources: LOOPS[name].build(ctx, gain), level: 0, nextEventAt: now };
    }
    clearTimeout(loop.stopTimer);
    if (loop.level != level) loop.gain.gain.setTargetAtTime(level, ctx.currentTime, FADE_SECONDS / 3);
    loop.level = level;
    const events = LOOPS[name].events;
    if (events && now >= loop.nextEventAt) {
      playSfxInto(events.id, ctx, loop.gain);
      loop.nextEventAt = now + random(...events.everyMs);
    }
  });
};
export const stopAmbience = (source = "scene") => setAmbience({}, source);
