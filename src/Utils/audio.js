/*
  The game's one audio context (Jamie, 2026-11-26), shared by the sound effects (sfx.js), the music (music.js) and the
  ambience loops (ambience.js):

  master <- the volume (the TV's -/+ buttons: VOLUME_LEVEL, 0 to 16) <- a limiter
    sfx bus      (sound effects; through the level's room, eg. the Subway's echo)
    music bus    (turned down under dialogue and stings: setMusicDuck)
    ambience bus (the level's and the tiles' loops)

  Browsers start sound only after the person has clicked or pressed a key on the page: until then nothing is made, and
  the first press makes the context (unlockAudio, from the listeners below).
*/

export const AUDIO_LEVEL = { volume: 10 / 16, music: 0.55, sfx: 1, ambience: 0.6 };

let ctx;
let nodes;
const isAudioAvailable = () => typeof window != "undefined" && typeof (window.AudioContext || window.webkitAudioContext) == "function";
let isUnlocked = false;
const unlockListeners = new Set();

export const getAudio = () => {
  if (!isAudioAvailable() || !isUnlocked) return undefined;
  if (!ctx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    ctx = new Context();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.ratio.value = 12;
    const master = ctx.createGain();
    master.gain.value = AUDIO_LEVEL.volume;
    master.connect(limiter).connect(ctx.destination);
    const makeBus = level => {
      const bus = ctx.createGain();
      bus.gain.value = level;
      bus.connect(master);
      return bus;
    };
    const musicDuck = ctx.createGain();
    const music = makeBus(AUDIO_LEVEL.music);
    musicDuck.connect(music);
    nodes = { master, sfx: makeBus(AUDIO_LEVEL.sfx), sfxRoom: undefined, music: musicDuck, musicLevel: music, ambience: makeBus(AUDIO_LEVEL.ambience) };
  }
  if (ctx.state == "suspended") ctx.resume();
  return ctx;
};
export const getAudioNodes = () => (getAudio() ? nodes : undefined);

// the volume, 0 to 1 (PlayWindow's -/+ buttons)
export const setAudioVolume = share => {
  AUDIO_LEVEL.volume = Math.max(0, Math.min(1, share));
  if (ctx && nodes) nodes.master.gain.setTargetAtTime(AUDIO_LEVEL.volume, ctx.currentTime, 0.05);
};

// the music quieter (under dialogue, a sting, a scene's words) or back
let duckCount = 0;
export const setMusicDuck = (isDucked, level = 0.35) => {
  duckCount = Math.max(0, duckCount + (isDucked ? 1 : -1));
  if (!ctx || !nodes) return;
  nodes.music.gain.setTargetAtTime(duckCount ? level : 1, ctx.currentTime, 0.25);
};

// the level's room the sound effects ring in: 'subway' and 'sewer' (a big tiled room, a long tunnel), or none
let roomName;
export const setSfxRoom = name => {
  if (name == roomName) return;
  roomName = name;
  if (!ctx || !nodes) return;
  applyRoom();
};
const ROOMS = { subway: { seconds: 2.4, decay: 2.5, wet: 0.55 }, sewer: { seconds: 2.8, decay: 2.2, wet: 0.6 } };
const applyRoom = () => {
  if (nodes.sfxRoom) nodes.sfxRoom.disconnect();
  nodes.sfxRoom = undefined;
  const room = ROOMS[roomName];
  if (!room) return;
  const convolver = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * room.seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let k = 0; k < length; k++) data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / length, room.decay);
  }
  convolver.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = room.wet;
  nodes.sfx.connect(convolver).connect(wet).connect(nodes.master);
  nodes.sfxRoom = { disconnect: () => { try { nodes.sfx.disconnect(convolver); } catch { /* (gone) */ } wet.disconnect(); } };
};

// sound may start: the first click or key press on the page
export const unlockAudio = () => {
  if (isUnlocked) return;
  isUnlocked = true;
  getAudio();
  if (nodes && roomName) applyRoom();
  unlockListeners.forEach(listener => listener());
};
export const onAudioUnlock = listener => {
  if (isUnlocked) listener();
  else unlockListeners.add(listener);
  return () => unlockListeners.delete(listener);
};
export const getIsAudioUnlocked = () => isUnlocked;

if (typeof window != "undefined" && typeof window.addEventListener == "function") {
  ["pointerdown", "keydown", "touchstart"].forEach(type => window.addEventListener(type, unlockAudio, { capture: true, passive: true }));
}
