/*
  The touch HUD's layouts (Jamie, 2026-11-28): Jamie's three mock-ups (TouchMockup_view1-3 / blockout1-3, OneDrive
  KaijuCity/TouchMockup/EXPORTS) and Claude's own, to play each and pick. Switch in the touch menu (dev).

  Each thing's middle: 'x' a share of the screen's width, 'y' of its height (the safe area: inside a phone's notch and
  rounded corners); 'size' its diameter (or height) as a share of the screen's height, so a thumb's reach stays the same
  on a wider phone. 'health': the row's left and right edges (x), its middle (y) and height. 'ticker': the band the
  objective runs across, its left and right edges, middle and text height. 'extras': where a Kaiju's powers past the
  first three go (the final fight), a row from 'x' to 'right' at 'y', each 'size'.
  (Measured from the 848 x 465 mock-up exports.)
*/
const MENU = { x: 0.045, y: 0.085, size: 0.11 };
const EXTRAS = { x: 0.56, right: 0.95, y: 0.25, size: 0.12 };

export const TOUCH_LAYOUTS = {
  1: {
    name: "1. Row of powers, health below",
    menu: MENU,
    joystick: { x: 0.2, y: 0.727, size: 0.41, knob: 0.17 },
    powers: [{ x: 0.566, y: 0.72, size: 0.232 }, { x: 0.729, y: 0.72, size: 0.232 }, { x: 0.894, y: 0.72, size: 0.232 }],
    health: { left: 0.515, right: 0.958, y: 0.905, size: 0.052 },
    passives: [{ x: 0.065, y: 0.645, size: 0.086 }, { x: 0.1, y: 0.538, size: 0.086 }, { x: 0.153, y: 0.477, size: 0.086 }],
    ticker: { left: 0.1, right: 0.975, y: 0.086, size: 0.075 },
    extras: EXTRAS
  },
  2: {
    name: "2. Power cluster, health top right",
    menu: MENU,
    joystick: { x: 0.2, y: 0.727, size: 0.41, knob: 0.17 },
    powers: [{ x: 0.696, y: 0.828, size: 0.215 }, { x: 0.851, y: 0.785, size: 0.269 }, { x: 0.896, y: 0.516, size: 0.198 }],
    health: { left: 0.525, right: 0.967, y: 0.082, size: 0.052 },
    passives: [{ x: 0.065, y: 0.645, size: 0.086 }, { x: 0.1, y: 0.538, size: 0.086 }, { x: 0.153, y: 0.477, size: 0.086 }],
    ticker: { left: 0.1, right: 0.49, y: 0.082, size: 0.05 },
    extras: EXTRAS
  },
  3: {
    name: "3. Power triangle, passives by the stick",
    menu: MENU,
    joystick: { x: 0.159, y: 0.731, size: 0.44, knob: 0.18 },
    powers: [{ x: 0.767, y: 0.753, size: 0.237 }, { x: 0.89, y: 0.57, size: 0.258 }, { x: 0.902, y: 0.828, size: 0.226 }],
    health: { left: 0.525, right: 0.967, y: 0.082, size: 0.052 },
    passives: [{ x: 0.313, y: 0.645, size: 0.086 }, { x: 0.316, y: 0.785, size: 0.086 }, { x: 0.283, y: 0.903, size: 0.086 }],
    ticker: { left: 0.1, right: 0.49, y: 0.082, size: 0.05 },
    extras: EXTRAS
  },
  /*
    Claude's (from Jamie's words: health along the bottom right, the passives above it, the powers above those and a
    little left, the stick further left). The powers on an arc the right thumb sweeps from its rest in the corner: the
    first, the biggest, nearest the thumb's natural spot; the passives a quiet row over the health, where their smoke
    rises into open space; the stick low and wide on the left; the objective centered at the top, out of both thumbs' way.
  */
  4: {
    name: "4. Claude's: thumb arc",
    menu: MENU,
    joystick: { x: 0.14, y: 0.7, size: 0.42, knob: 0.17 },
    powers: [{ x: 0.67, y: 0.7, size: 0.24 }, { x: 0.775, y: 0.52, size: 0.21 }, { x: 0.915, y: 0.56, size: 0.22 }],
    health: { left: 0.64, right: 0.965, y: 0.93, size: 0.045 },
    passives: [{ x: 0.79, y: 0.83, size: 0.07 }, { x: 0.85, y: 0.83, size: 0.07 }, { x: 0.91, y: 0.83, size: 0.07 }],
    ticker: { left: 0.12, right: 0.88, y: 0.075, size: 0.06 },
    extras: EXTRAS
  }
};

export const TOUCH_LAYOUT_IDS = Object.keys(TOUCH_LAYOUTS);
const LAYOUT_KEY = "kaiju-touch-layout";
export const getTouchLayoutId = () => {
  const saved = typeof window != "undefined" && window.localStorage.getItem(LAYOUT_KEY);
  return saved && TOUCH_LAYOUTS[saved] ? saved : "4";
};
export const saveTouchLayoutId = id => window.localStorage.setItem(LAYOUT_KEY, id);

/*
  The objective, across the top now and then (Jamie: no strip, just the words, every 5 to 10 s; to tune). Then (mobile
  playtest 1): no longer run across, but smoke that condenses into the words, holds a beat, and drifts apart.
  'condenseMs' and 'fadeMs' the smoke's, 'holdMs' the words' (plus 'msPerChar' each, for longer ones), 'gapMs' till the
  next; 'scatter' how far each letter drifts, in letter heights.
*/
export const TICKER = { gapMs: 7000, condenseMs: 1100, holdMs: 1600, msPerChar: 45, fadeMs: 1500, scatter: 0.9 };

// the dialogue panel on the right, the game pushed over beside it (Jamie: the view shrinks, not its content)
export const TOUCH_DIALOGUE = { share: 0.38 };
// the Lab's color vat: the Agent's panel wider, the color picker inside it (Jamie, 2026-11-28); 'pickerDvh' the
// picker's height in it
export const TOUCH_VAT = { share: 0.45, pickerDvh: 30 };
