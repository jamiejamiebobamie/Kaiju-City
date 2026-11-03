const UNLOCKS_KEY = 'kaiju-unlocks';
const CHOICES_KEY = 'kaiju-recruit-choices';

// saved in the browser. these are simply not remembered if storage isn't available.
const load = (key: string, fallback: string) => {
  try {
    return JSON.parse(localStorage.getItem(key) || fallback);
  } catch {
    return JSON.parse(fallback);
  }
};

const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* (not remembered) */ }
};

export const getUnlocks = (): Array<string> => load(UNLOCKS_KEY, '[]');

// versus is fought on the battlegrounds the player has won on
export const getBattlegroundUnlockId = (levelId: string) => `battleground-${levelId}`;

export const addUnlock = (id: string) => save(UNLOCKS_KEY, [...new Set([...getUnlocks(), id])]);

// dev testing: everything unlocked is closed again
export const resetUnlocks = () => {
  save(UNLOCKS_KEY, []);
  save(CHOICES_KEY, {});
};

export const getRecruitChoices = (): Record<string, string> => load(CHOICES_KEY, '{}');

export const saveRecruitChoice = (id: string, choice: string) => save(CHOICES_KEY, { ...getRecruitChoices(), [id]: choice });
