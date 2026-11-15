import { describe, expect, it } from 'vitest';
import { storage } from 'Utils/storage';
import { getIsFirstPlay, markPlaythroughStarted } from './Avatars';

// the power picker (Jamie, 2026-11-14): skipped on the very first new game only; every replay shows it
describe('first play', () => {
  it('is only the first new game: once a playthrough has started, the next new game is a replay', () => {
    storage.clear();
    expect(getIsFirstPlay()).toBe(true);
    markPlaythroughStarted();
    expect(getIsFirstPlay()).toBe(false);
    storage.clear();
  });
});
