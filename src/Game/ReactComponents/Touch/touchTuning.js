import { useEffect, useState } from "react";
import saved from "./touchTuning.json";
import { TOUCH_DIALOGUE, TOUCH_VAT } from "./touchLayouts";
import { getIsDeviceForced } from "Utils/device";

/*
  Per-device tuning (Jamie, 2026-11-28; mobile step 3): four presets by screen size, not by brand. The size is the
  screen's short side in CSS pixels (its height, held sideways), from what people use today (StatCounter, mid 2026:
  414x896, 360x800, 390x844, 393x873, 384x832, 375x812 lead; this year's iPhones are 402, 420 and 440 across).
  The iPhone SE (375 x 667) is a small phone with a 16:9 screen, narrower than the rest.
*/
export const DEVICE_PRESETS = [
  { id: "smallPhone", label: "Small phone", maxShortPx: 380, examples: "360 Androids, iPhone mini/SE/X (375)" },
  { id: "phone", label: "Standard phone", maxShortPx: 411, examples: "iPhone 12-17 (390-402), most Androids (384-393)" },
  { id: "largePhone", label: "Large phone", maxShortPx: 600, examples: "iPhone XR/11 (414), Plus/Air/Pro Max (420-440), big Androids (412)" },
  // (the HUD's sizes are shares of the screen's height: on a tablet's tall screen they'd be far bigger than a thumb
  // needs, so it starts smaller: 'hudScale', under any tuning)
  { id: "tablet", label: "Tablet", maxShortPx: Infinity, examples: "iPad mini (744), iPad/Air/Pro 11 (810-834), Pro 13 (1024)", hudScale: 0.6 }
];

const PRESET_KEY = "kaiju-touch-preset";
const LOCAL_KEY = "kaiju-touch-tuning"; // (a phone's own, when it can't save into the game: a built game)

// the screen's short side: the real screen's on a phone or tablet; the window's when forced in dev on a PC
export const getShortSidePx = () => {
  if (typeof window == "undefined") return 400;
  if (getIsDeviceForced()) return Math.min(window.innerWidth, window.innerHeight);
  return Math.min(window.screen.width, window.screen.height);
};
export const getDevicePresetId = () => {
  const forced = typeof window != "undefined" && window.localStorage.getItem(PRESET_KEY);
  if (DEVICE_PRESETS.some(({ id }) => id == forced)) return forced;
  const short = getShortSidePx();
  return DEVICE_PRESETS.find(({ maxShortPx }) => short < maxShortPx).id;
};
export const getDevicePreset = () => DEVICE_PRESETS.find(({ id }) => id == getDevicePresetId());
// (the tuning menu's: see each preset on this screen, or "auto")
export const setDevicePresetOverride = id => {
  if (DEVICE_PRESETS.some(preset => preset.id == id)) window.localStorage.setItem(PRESET_KEY, id);
  else window.localStorage.removeItem(PRESET_KEY);
  notify();
};

/*
  A preset's tuning: { hud: { [layoutId]: { [group]: { dx, dy, scale } } }, minTilePx, dialogueShare, vatShare }.
  'dx', 'dy': a share of the screen's width and height; 'scale' about the group's own middle. Anything left out is the
  layout's own (touchLayouts.js) and the defaults below.
*/
export const TUNING_DEFAULTS = { minTilePx: 30, dialogueShare: 0.38, vatShare: 0.45 };
export const HUD_GROUPS = ["joystick", "powers", "passives", "health", "menu", "ticker", "extras"];
export const HUD_GROUP_LABELS = { joystick: "Stick", powers: "Powers", passives: "Passives", health: "Health", menu: "Menu", ticker: "Objective", extras: "Extra powers" };

const readLocal = () => {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "null"); } catch { return null; }
};
let tuning = { presets: { ...(saved.presets || {}), ...((typeof window != "undefined" && readLocal()) || {}).presets } };
let version = 0;
const listeners = new Set();
const notify = () => {
  version += 1;
  applyShares();
  listeners.forEach(listener => listener());
};

export const getPresetTuning = (presetId = getDevicePresetId()) => ({ ...TUNING_DEFAULTS, hud: {}, ...(tuning.presets[presetId] || {}) });
// the panels' widths, kept on the shared settings the game reads
const applyShares = () => {
  const { dialogueShare, vatShare } = getPresetTuning();
  TOUCH_DIALOGUE.share = dialogueShare;
  TOUCH_VAT.share = vatShare;
};
if (typeof window != "undefined") applyShares();

// a change to this screen's preset (the placement tool's)
export const updatePresetTuning = change => {
  const id = getDevicePresetId();
  const current = getPresetTuning(id);
  tuning = { presets: { ...tuning.presets, [id]: { ...current, ...change(current) } } };
  notify();
};
export const setHudGroupTuning = (layoutId, group, change) => updatePresetTuning(current => {
  const forLayout = current.hud[layoutId] || {};
  const now = { dx: 0, dy: 0, scale: 1, ...(forLayout[group] || {}) };
  return { hud: { ...current.hud, [layoutId]: { ...forLayout, [group]: { ...now, ...change(now) } } } };
});

// saved into the game's own file through the dev server (npm run dev -- --host); otherwise kept on this device only
export const saveTouchTuning = async () => {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(tuning));
  try {
    const response = await fetch("/__touch-tuning/save", { method: "POST", body: JSON.stringify(tuning) });
    if (!response.ok) throw new Error(await response.text());
    window.localStorage.removeItem(LOCAL_KEY); // (in the game now: the file's the one to go by)
    return "Saved into the game";
  } catch {
    return "Saved on this device only: run npm run dev -- --host to save into the game";
  }
};

// redraws on any change: the tool's, a preset forced
export const useTouchTuning = () => {
  const [, setVersion] = useState(version);
  useEffect(() => {
    const listener = () => setVersion(version);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { preset: getDevicePreset(), tuning: getPresetTuning(), version };
};

// a group's middle, in the layout's shares (x of the width, y of the height)
export const getGroupMiddle = (layout, group) => {
  const spot = layout[group];
  if (!spot) return undefined;
  if (Array.isArray(spot)) return { x: spot.reduce((sum, { x }) => sum + x, 0) / spot.length, y: spot.reduce((sum, { y }) => sum + y, 0) / spot.length };
  if (spot.left !== undefined) return { x: (spot.left + spot.right) / 2, y: spot.y };
  if (spot.right !== undefined) return { x: (spot.x + spot.right) / 2, y: spot.y };
  return { x: spot.x, y: spot.y };
};

/*
  The layout with this preset's moves and sizes on it. A group grows about its own middle: its parts' sizes and their
  spread both scale ('aspect': the screen's width over its height, so a spread across stays round).
*/
export const getTunedLayout = (layout, hudTuning = {}, baseScale = 1) => {
  const tuned = { ...layout };
  HUD_GROUPS.forEach(group => {
    const change = hudTuning[group] || {};
    if (!layout[group] || (!hudTuning[group] && baseScale == 1)) return;
    const { dx = 0, dy = 0 } = change;
    const scale = (change.scale ?? 1) * baseScale;
    const middle = getGroupMiddle(layout, group);
    const moveX = x => middle.x + (x - middle.x) * scale + dx;
    const moveY = y => middle.y + (y - middle.y) * scale + dy;
    const spot = layout[group];
    const tuneOne = one => {
      const next = { ...one, y: moveY(one.y), size: one.size * scale };
      if (one.left !== undefined) return { ...next, left: moveX(one.left), right: moveX(one.right) };
      if (one.right !== undefined) return { ...next, x: moveX(one.x), right: moveX(one.right) };
      return { ...next, x: moveX(one.x), ...(one.knob ? { knob: one.knob * scale } : {}) };
    };
    tuned[group] = Array.isArray(spot) ? spot.map(tuneOne) : tuneOne(spot);
  });
  return tuned;
};
