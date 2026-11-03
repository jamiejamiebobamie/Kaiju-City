/*
  A playtest: two ways a Kaiju's speed can follow its fire, to see which plays better.
  'rampage': faster for a moment after breathing fire. 'windUp': faster while it glows, just before it breathes.
  Chosen in the dev panel and remembered in the browser.
*/
export const KAIJU_SPEED = {
  boost: 1, // added to its move speed
  rampageMs: 3000
};

export const KAIJU_SPEED_MODES = ['rampage', 'windUp', 'off'] as const;
export type KaijuSpeedMode = typeof KAIJU_SPEED_MODES[number];

const KEY = 'kaiju-speed-test';
let mode: KaijuSpeedMode = 'rampage';
try {
  const saved = localStorage.getItem(KEY) as KaijuSpeedMode;
  if (KAIJU_SPEED_MODES.includes(saved)) mode = saved;
} catch { /* (not remembered) */ }

export const getKaijuSpeedMode = () => mode;

export const setKaijuSpeedMode = (next: KaijuSpeedMode) => {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch { /* (not remembered) */ }
};

// how much faster a Kaiju is right now
export const getKaijuSpeedBoost = ({ accTime, rampageEndsAt, isGoingToSpewFire }: { accTime: number; rampageEndsAt: number; isGoingToSpewFire: boolean }) => {
  if (mode == 'rampage') return accTime < rampageEndsAt ? KAIJU_SPEED.boost : 0;
  if (mode == 'windUp') return isGoingToSpewFire ? KAIJU_SPEED.boost : 0;
  return 0;
};
