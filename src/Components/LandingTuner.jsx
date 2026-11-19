import React from "react";
import styled from "styled-components";

/*
  The landing's tuner (dev, Jamie 2026-11-18): open the landing with ?tune to place the joiner's two parts up or down
  (together and each on its own) and to place and size the moon and its reflection, live. Its values are kept in this
  browser while ?tune is on (without it, the landing uses the defaults below); "Copy values" puts them on the clipboard
  to paste back to Claude, who makes them the defaults. A click or a key on the panel does not start the game.
    joiner: logo px down (negative: up): 'both' moves the two together, 'band' the blue-to-black band and its threads,
      'glow' the yellow under it
    moon, reflection: the Peninsula picture's px (its horizon is row 403): middle x, y, and radius; the moon's dark
      side's light (earthshine: 0 the sky's colour) and the glow round it (shares)
    cityscape: logo px down (negative: up): the skyline (with its spotlights and joiner) over the Peninsula, which
      stays put; the title and the Kaiju don't move
    pressKey: "[Press any key]"'s height, as a share of the window's (0 the top, 1 the bottom)
    baseJoiner: the skyline's base blue carried down over its feet: its top and height, its middle across, its top's and
      its bottom's widths (logo px), where its fade begins (a share of its height, solid above it) and its opacity
*/
// (Jamie's, 2026-11-18)
export const LANDING_TUNE_DEFAULTS = {
  joiner: { both: -4.5, band: 0, glow: -1 },
  moon: { x: 992, y: 357, radius: 30, darkSide: 0.3, glow: 0.55 },
  reflection: { x: 1021, y: 464, radius: 33 },
  cityscape: { y: 4 },
  pressKey: { top: 0.655 },
  baseJoiner: { top: 191, height: 23, middle: 292.5, topWidth: 533, bottomWidth: 533, solid: 0.65, opacity: 1 }
};
const RANGES = {
  joiner: { both: [-20, 20, 0.5], band: [-20, 20, 0.5], glow: [-20, 20, 0.5] },
  moon: { x: [600, 1700, 1], y: [120, 400, 1], radius: [8, 90, 1], darkSide: [0, 1.2, 0.01], glow: [0, 1.5, 0.01] },
  reflection: { x: [600, 1700, 1], y: [405, 760, 1], radius: [6, 70, 1] },
  cityscape: { y: [-30, 30, 0.5] },
  pressKey: { top: [0.5, 0.97, 0.005] },
  baseJoiner: { top: [150, 240, 0.5], height: [2, 60, 0.5], middle: [200, 400, 0.5], topWidth: [100, 700, 1], bottomWidth: [100, 700, 1], solid: [0, 1, 0.01], opacity: [0, 1, 0.01] }
};
const STORE_KEY = "kaiju-landing-tune";

// (read as the app loads: the landing's redirect to /home drops the query, and the panel unmounted on the next render)
const IS_TUNING = typeof window != "undefined" && new URLSearchParams(window.location.search).has("tune");
export const getIsTunePanel = () => IS_TUNING || new URLSearchParams(window.location.search).has("tune");

const copyDefaults = () => JSON.parse(JSON.stringify(LANDING_TUNE_DEFAULTS));

// (the defaults, or with ?tune, what was last set here; anything unreadable falls back to the defaults)
export const loadLandingTune = () => {
  const tune = copyDefaults();
  if (!getIsTunePanel()) return tune;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}");
    Object.keys(tune).forEach(group => Object.keys(tune[group]).forEach(key => {
      const value = saved[group] && saved[group][key];
      if (typeof value == "number" && isFinite(value)) tune[group][key] = value;
    }));
  } catch (error) { /* (no storage here: the defaults) */ }
  return tune;
};

const saveLandingTune = tune => {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(tune)); } catch (error) { /* (not kept) */ }
};

const Panel = styled.div`
  position: fixed;
  right: 10px;
  bottom: 10px;
  z-index: 50;
  width: 260px;
  max-height: calc(100dvh - 20px);
  overflow-y: auto;
  padding: 8px 10px;
  font: 11px monospace;
  color: #bfe9c8;
  background: rgba(8, 12, 10, 0.9);
  border: 1px solid #2d5a3c;
  cursor: default;
  fieldset { margin: 4px 0; padding: 4px 6px; border: 1px solid #2d5a3c; }
  legend { color: white; }
  label { display: grid; grid-template-columns: 52px 1fr 44px; gap: 6px; align-items: center; }
  input[type="range"] { width: 100%; }
  output { text-align: right; }
  button { margin: 4px 4px 0 0; font: 11px monospace; cursor: pointer; }
`;

const stop = event => event.stopPropagation();

export const LandingTuner = ({ tune, setTune }) => {
  const set = (group, key, value) => setTune(all => {
    const next = { ...all, [group]: { ...all[group], [key]: value } };
    saveLandingTune(next);
    return next;
  });
  const reset = () => {
    const next = copyDefaults();
    saveLandingTune(next);
    setTune(next);
  };
  return (
    <Panel onClick={stop} onPointerDown={stop} onKeyDown={stop} onKeyUp={stop} aria-label="Landing tuner">
      {Object.entries(RANGES).map(([group, keys]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {Object.entries(keys).map(([key, [low, high, step]]) => (
            <label key={key}>
              {key}
              <input type="range" min={low} max={high} step={step} value={tune[group][key]} onChange={event => set(group, key, Number(event.target.value))} />
              <output>{tune[group][key]}</output>
            </label>
          ))}
        </fieldset>
      ))}
      <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(tune))}>Copy values</button>
      <button onClick={reset}>Reset</button>
    </Panel>
  );
};
