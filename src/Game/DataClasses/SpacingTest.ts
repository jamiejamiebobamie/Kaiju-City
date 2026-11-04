/*
  A playtest: NPCs don't stop on a tile someone else is standing on, so a group spreads out instead of bunching.
  One switch for walking scenes and one for battles, both on by default, remembered in the browser.
*/
export type SpacingKind = 'walking' | 'battle';

const KEY = 'kaiju-spacing';

const load = (): Record<SpacingKind, boolean> => {
  try {
    return { walking: true, battle: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { walking: true, battle: true };
  }
};

let spacing = load();

export const getIsSpacing = (kind: SpacingKind) => spacing[kind];

export const setIsSpacing = (kind: SpacingKind, isOn: boolean) => {
  spacing = { ...spacing, [kind]: isOn };
  try {
    localStorage.setItem(KEY, JSON.stringify(spacing));
  } catch {
    // it just won't be remembered
  }
};
