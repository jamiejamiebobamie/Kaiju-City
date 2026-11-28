import { describe, expect, it } from 'vitest';
import { THEMES, DRUMS } from './musicThemes';
import { parseLine, parseChords } from './music';

// the themes as written (Jamie, 2026-11-26): every bar full, every chord and note readable
describe('music themes', () => {
  Object.entries(THEMES).forEach(([id, theme]: [string, any]) => {
    it(`${id}: every bar is 16 sixteenths, and the melody and chords are as long as each other`, () => {
      if (theme.medley) {
        theme.medley.forEach((part: string) => expect(THEMES).toHaveProperty(part));
        return;
      }
      theme.melody.split('|').forEach((bar: string, k: number) => {
        expect({ bar: k + 1, steps: parseLine(bar).length }).toEqual({ bar: k + 1, steps: 16 });
      });
      expect(parseChords(theme.chords).length).toBe(parseLine(theme.melody).length);
      [].concat(theme.drums || [], (theme.intense && theme.intense.drums) || []).forEach((name: string) => {
        expect(DRUMS).toHaveProperty(name);
        Object.values((DRUMS as any)[name]).forEach((lane: any) => expect(lane.length).toBe(16));
      });
      expect(theme.bpm).toBeGreaterThan(40);
    });
  });
});

// the 80s synthwave takes (Jamie, 2026-11-28): every theme has one, and it names only drums, patterns and voices there are
describe('synthwave takes', () => {
  const BASS = ['long', 'rootFifth', 'root8', 'octave8', 'pulse16', 'arp', 'stomp', 'walk', 'pump8', 'roll16'];
  Object.entries(THEMES).forEach(([id, theme]: [string, any]) => {
    it(`${id}: a synthwave take that holds together`, () => {
      expect(theme.synthwave).toBeDefined();
      expect(typeof theme.synthwave.flavor).toBe('string');
      const take = { ...theme, ...theme.synthwave };
      if (take.medley) return;
      if (take.bass) expect(BASS).toContain(take.bass);
      [].concat(take.drums || [], (take.intense && take.intense.drums) || []).forEach((name: string) => {
        expect(DRUMS).toHaveProperty(name);
        Object.values((DRUMS as any)[name]).forEach((lane: any) => expect(lane.length).toBe(16));
      });
      expect(take.bpm).toBeGreaterThan(40);
    });
  });
});
