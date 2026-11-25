import { describe, expect, it } from 'vitest';
import { storage } from 'Utils/storage';
import { BEATEN_CODE, enterUnlockCode, getEverythingCards } from './UnlockCodes';
import { getIsGameBeaten } from './Unlocks';

// (Jamie, 2026-11-24) the code shown on beating the game, typed into the Lab monitor's UNLOCK.EXE
describe('unlock codes', () => {
  it('KAIJU, caps or not, opens everything, Multiplayer too; anything else is no code', () => {
    storage.clear();
    expect(BEATEN_CODE).toBe('KAIJU');
    expect(enterUnlockCode('nope')).toBeUndefined();
    expect(getIsGameBeaten()).toBe(false);
    expect(enterUnlockCode('kaiju')).toBeTruthy();
    expect(getIsGameBeaten()).toBe(true);
    storage.clear();
    expect(enterUnlockCode(' KaIjU ')).toBeTruthy();
  });

  // (Jamie, 2026-11-24) a card for each thing opened; what was open already isn't shown again
  it('cards only for what was not open already', () => {
    storage.clear();
    const first = enterUnlockCode('kaiju');
    expect(first && first.cards.map(({ label }) => label)).toContain('Multiplayer unlocked!');
    expect(first && first.cards.length).toBe(getEverythingCards().length);
    const again = enterUnlockCode('kaiju');
    expect(again && again.cards).toEqual([]);
  });
});
