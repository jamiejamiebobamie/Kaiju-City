import { storage } from 'Utils/storage';
const UNLOCKS_KEY = 'kaiju-unlocks';
const CHOICES_KEY = 'kaiju-recruit-choices';

// remembered through Utils/storage: for now, for this visit only
const load = (key: string, fallback: string) => {
  try {
    return JSON.parse(storage.getItem(key) || fallback);
  } catch {
    return JSON.parse(fallback);
  }
};

const save = (key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch { /* (not remembered) */ }
};

export const getUnlocks = (): Array<string> => load(UNLOCKS_KEY, '[]');

// versus is fought on the battlegrounds the player has won on
export const getBattlegroundUnlockId = (levelId: string) => `battleground-${levelId}`;

// the levels the player has won a recruit fight on
export const getWonBattlegrounds = (): Array<string> => getUnlocks()
  .filter(id => id.startsWith('battleground-'))
  .map(id => id.slice('battleground-'.length));

export const addUnlock = (id: string) => save(UNLOCKS_KEY, [...new Set([...getUnlocks(), id])]);

// dev testing: everything unlocked is closed again
export const resetUnlocks = () => {
  save(UNLOCKS_KEY, []);
  save(CHOICES_KEY, {});
};

export const getRecruitChoices = (): Record<string, string> => load(CHOICES_KEY, '{}');

export const saveRecruitChoice = (id: string, choice: string) => save(CHOICES_KEY, { ...getRecruitChoices(), [id]: choice });

// a new playthrough: the last one's choices are gone (Jamie)
export const clearRecruitChoices = () => save(CHOICES_KEY, {});
