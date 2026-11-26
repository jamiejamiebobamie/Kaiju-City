/*
  Each sound's volume, scene by scene (Jamie, 2026-11-26), set in the game's Sound (dev) panel as Jamie plays through:
  - a key per sound: "sfx:hit", "music:title", "loop:fire";
  - the scene: the level's own id (the Subway, the Rooftop...), or "landing", "start" (the monitor's start screen),
    "menu" (the avatar select, the picker, the vat);
  - a sound's volume in a scene is the one saved for it there; failing that, the last one saved for it anywhere (it's
    been heard before, and set); failing that, 1 (as reviewed).
  Saved in soundVolumes.json, with the sounds whose volumes differ a lot from scene to scene ('differences').
*/
import SAVED from "../Game/DataClasses/soundVolumes.json";

const DIFFERENCE_RATIO = 2; // (one scene's at least twice another's: noted)

export const SOUND_VOLUMES = { scenes: { ...(SAVED.scenes || {}) }, last: { ...(SAVED.last || {}) }, differences: SAVED.differences || [] };
let scene = "landing";
const heard = {}; // scene: Set of keys heard there (this session)
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());

export const setSoundScene = name => {
  if (!name || name == scene) return;
  scene = name;
  notify();
};
export const getSoundScene = () => scene;
export const onSoundVolumes = listener => { listeners.add(listener); return () => listeners.delete(listener); };

export const getSoundVolume = key => {
  const own = SOUND_VOLUMES.scenes[scene] && SOUND_VOLUMES.scenes[scene][key];
  if (own !== undefined) return own;
  const last = SOUND_VOLUMES.last[key];
  return last !== undefined ? last : 1;
};
export const getIsSetHere = key => !!SOUND_VOLUMES.scenes[scene] && SOUND_VOLUMES.scenes[scene][key] !== undefined;

// a sound heard in this scene (for the panel's list)
export const noteHeard = key => {
  const set = heard[scene] || (heard[scene] = new Set());
  if (set.has(key)) return;
  set.add(key);
  notify();
};
export const getHeardHere = () => [...(heard[scene] || [])];

// the scenes whose volumes for this sound differ most, when one is at least twice another
export const getDifference = key => {
  const values = Object.entries(SOUND_VOLUMES.scenes).map(([name, volumes]) => [name, volumes[key]]).filter(([, value]) => value !== undefined);
  if (values.length < 2) return undefined;
  const [low, high] = values.reduce(([lo, hi], entry) => [entry[1] < lo[1] ? entry : lo, entry[1] > hi[1] ? entry : hi], [values[0], values[0]]);
  return high[1] >= Math.max(low[1], 0.01) * DIFFERENCE_RATIO ? { low, high } : undefined;
};
const getDifferences = () => {
  const keys = new Set(Object.values(SOUND_VOLUMES.scenes).flatMap(volumes => Object.keys(volumes)));
  return [...keys].map(key => [key, getDifference(key)]).filter(([, difference]) => difference)
    .map(([key, { low, high }]) => `${key}: ${high[1].toFixed(2)} in ${high[0]}, ${low[1].toFixed(2)} in ${low[0]}`);
};

let saveTimer;
export const setSoundVolume = (key, value) => {
  const volumes = SOUND_VOLUMES.scenes[scene] || (SOUND_VOLUMES.scenes[scene] = {});
  volumes[key] = value;
  SOUND_VOLUMES.last[key] = value;
  SOUND_VOLUMES.differences = getDifferences();
  notify();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/__sound-volumes/save", { method: "POST", body: JSON.stringify(SOUND_VOLUMES) }).catch(() => {});
  }, 500);
};
