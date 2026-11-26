import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { getMusicCue } from './musicCue';
import { THEMES } from 'Utils/musicThemes';

// the theme each scene calls for (Jamie, 2026-11-26)
const cueOf = (level: any, state: any = {}) => getMusicCue({ level, getActivePhases: () => state.phases || [], getPieces: () => state.pieces || [], ...state });

describe('music cues', () => {
  it('each recruit area: their theme walking and at their intro, the battle once the part is touched, tense with the rings and the flood', () => {
    expect(cueOf(LEVELS['visit-rapidTransit']).musicId).toBe('punk');
    expect(cueOf(LEVELS.rapidTransit).musicId).toBe('punk');
    expect(cueOf(LEVELS.rapidTransit, { phases: ['eyeTouched'] }).musicId).toBe('subwayBattle');
    expect(cueOf(LEVELS.rooftop, { isMusicFightOn: true, ghostRing: {} })).toEqual({ musicId: 'rooftopBattle', musicLight: false, musicIntensity: 1 });
    expect(cueOf(LEVELS.aquarium, { isMusicFightOn: true, isShattered: true }).musicIntensity).toBe(1);
    expect(cueOf(LEVELS.aquarium, { isMusicFightOn: true, recruitScene: {} }).musicId).toBe('mermaid');
  });

  it('training and sparring: the battle, lighter', () => {
    expect(cueOf(LEVELS['train-rooftop'])).toEqual({ musicId: 'rooftopBattle', musicLight: true, musicIntensity: 0 });
    expect(cueOf(LEVELS['spar-aquarium'])).toEqual({ musicId: 'aquariumBattle', musicLight: true, musicIntensity: 0 });
  });

  it('the Street, the Lab, the Sewers, the Peninsula and the final fight', () => {
    expect(cueOf(LEVELS.street).musicId).toBe('agent');
    expect(cueOf(LEVELS.labIntro).musicId).toBe('lab');
    expect(cueOf(LEVELS.labTrap).musicId).toBe('lab');
    expect(cueOf(LEVELS.labTrap, { pieces: [{ isChaser: true }] }).musicId).toBe('labEscape');
    expect(cueOf(LEVELS.lab, { cutscene: {} }).musicId).toBe('agent');
    expect(cueOf(LEVELS.lab).musicId).toBe('labEscape');
    expect(cueOf(LEVELS.sewer1).musicIntensity).toBe(0);
    expect(cueOf(LEVELS.sewer1, { phases: ['glow'] }).musicIntensity).toBe(1);
    expect(cueOf(LEVELS.peninsula).musicId).toBe('kaijuFight');
    expect(cueOf(LEVELS.finalPeninsula, { finalTurnState: 'turning' }).musicId).toBe('teammateSad');
    expect(cueOf(LEVELS.finalPeninsula, { finalTurnState: 'fighting' }).musicId).toBe('finalBattle');
    expect(cueOf(LEVELS.finalTurnFight).musicId).toBe('finalBattle');
  });

  it('every level calls for a theme that exists', () => {
    Object.values(LEVELS).forEach((level: any) => {
      const { musicId } = cueOf(level);
      expect({ level: level.id, musicId: musicId && !!(THEMES as any)[musicId] }).toEqual({ level: level.id, musicId: true });
    });
  });
});
