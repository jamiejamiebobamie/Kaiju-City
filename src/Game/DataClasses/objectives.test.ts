import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { EXIT_OPEN_PHASE } from './Levels/levels';

// the objectives (Jamie, 2026-11-10)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const skip = gm => { for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces(); gm.stepPieces(); };
const text = gm => gm.objective && gm.objective.text;

describe('objectives', () => {
  it('the Peninsula: Defeat the Kaiju, shown as the count', () => {
    const gm = makeGame(LEVELS.peninsula);
    skip(gm);
    expect(gm.objective).toEqual({ text: 'Defeat the Kaiju', isKaijuCount: true });
    expect(gm.getUiState().isObjectiveKaijuCount).toBe(true);
  });

  it('the Street: nothing, then Talk to Agent once he has called, then Go to Transit Station once he has spoken', () => {
    const gm = makeGame(LEVELS.street);
    expect(text(gm)).toBeFalsy();
    skip(gm);
    expect(text(gm)).toBe('Talk to Agent');
    gm.setPhase(EXIT_OPEN_PHASE, true);
    gm.stepPieces();
    expect(text(gm)).toBe('Go to Transit Station');
  });

  it('the map walks lead somewhere each', () => {
    [['mapSubway', 'Go to Transit Station'], ['mapRooftop', 'Go to Rooftop'], ['mapAquarium', 'Go to Aquarium'], ['mapLab', 'Go to the Lab']].forEach(([id, objective]) => {
      const gm = makeGame(LEVELS[id]);
      skip(gm);
      expect(text(gm)).toBe(objective);
    });
  });

  it('a rival’s fight: nothing in its opening scene, then Defeat [them]', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    gm.stepPieces();
    expect(text(gm)).toBeFalsy();
    skip(gm);
    expect(text(gm)).toBe('Defeat Punk Guy');
  });

  it('the Rooftop: Defeat Ghost Girl, Survive the Ghosts, and Defeat Ghostly Ghost Girl', () => {
    const gm = makeGame(LEVELS.rooftop);
    skip(gm);
    expect(text(gm)).toBe('Defeat Ghost Girl');
    gm.ghostRing = { ghosts: [], getIsFormed: () => true };
    gm.updateObjective();
    expect(text(gm)).toBe('Survive the Ghosts');
    gm.ghostRing = undefined;
    gm.rivalPiece.isGhostForm = true;
    gm.updateObjective();
    expect(text(gm)).toBe('Defeat Ghostly Ghost Girl');
  });

  it('the Aquarium: Survive the Flood while she is up top, then Defeat Aquarium Worker', () => {
    const gm = makeGame(LEVELS.aquarium);
    skip(gm);
    expect(text(gm)).toBe('Defeat Aquarium Worker');
    gm.isShattered = true;
    gm.rivalPiece.setTileIndex(gm.gameBoardManager.walkableTiles.find(tile => gm.getIsTopFloor(tile)));
    gm.updateObjective();
    expect(text(gm)).toBe('Survive the Flood');
  });

  it('the Lab trap: nothing while the Agent talks, then Escape the Lab', () => {
    const gm = makeGame(LEVELS.labTrap);
    expect(text(gm)).toBeFalsy();
    skip(gm);
    for (let k = 0; k < 200 && !gm.getPieces().some(piece => piece.isChaser); k++) gm.stepPieces();
    gm.stepPieces();
    expect(text(gm)).toBe('Escape the Lab');
  });

  it('Sewer 1: nothing, then Investigate the Glow; Sewer 2: nothing', () => {
    const gm = makeGame(LEVELS.sewer1);
    gm.stepPieces();
    expect(text(gm)).toBeFalsy();
    gm.setPhase((LEVELS.sewer1.walkIn as any).reveal.glowPhase, true);
    gm.cutscene = undefined;
    gm.updateObjective();
    expect(text(gm)).toBe('Investigate the Glow');
    const two = makeGame(LEVELS.sewer2);
    skip(two);
    expect(text(two)).toBeFalsy();
  });

  it('the Lab fight: Defeat Agents', () => {
    const gm = makeGame(LEVELS.lab);
    skip(gm);
    expect(text(gm)).toBe('Defeat Agents');
  });

  it('the last fight: Defeat the Kaiju, then Stop [the teammate]', () => {
    const gm = makeGame(LEVELS.finalTurnFight, { isRetry: true });
    gm.stepPieces();
    expect(text(gm)).toBe(`Stop ${gm.getTeammateName()}`);
    expect(gm.getUiState().isObjectiveKaijuCount).toBe(false);
  });

  it('a detour off a map walk carries its objective over; each new one counts up', () => {
    const gm = makeGame(LEVELS.labIntro, { carriedObjective: { text: 'Go to Aquarium' } });
    skip(gm);
    expect(text(gm)).toBe('Go to Aquarium');
    const count = gm.objectiveCount;
    gm.carriedObjective = { text: 'Go to Rooftop' };
    gm.updateObjective();
    expect(gm.objectiveCount).toBe(count + 1);
  });
});
