import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// Jamie's playtest 34 (2026-11-17)
describe('playtest 34', () => {
  it('13. Fire hurts the Punk Guy as the other powers do (he dodges by running, not by any immunity)', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Bubble']);
    settingsManager.setIsTeammate(false);
    const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    for (let k = 0; k < 6000 && (gm.cutscene || !gm.rivalPiece || !gm.rivalPiece.isOnTiles); k++) gm.stepPieces();
    const [player] = gm.getPieces();
    const rival = gm.rivalPiece;
    const fire = player.abilities.findIndex(a => a.gameBoardPieceAbilityData.element.toLowerCase() == 'fire');
    const start = rival.lives;
    for (let round = 0; round < 3; round++) {
      const t = player.getTileIndex();
      rival.initCharLocation(true, { i: t.i, j: t.j + 1 });
      rival.moveSpeed = 0.0001; // held still: no dodging
      gm.accTime += 20000;
      gm.getPlayerInputHandler().usePlayerAbilityFromIndex(fire, gm.accTime);
      for (let k = 0; k < 60; k++) { rival.moveToTiles = []; gm.stepPieces(); }
    }
    expect(rival.lives).toBeLessThan(start);
  });

  it('22. the Lab escape: fallen Agents are replaced from the catwalk, and more keep coming', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.labTrap, settingsManager });
    gm.initGame();
    for (let k = 0; k < 5000 && !gm.getPieces().some(piece => piece.isChaser); k++) gm.stepPieces();
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const chasers = () => gm.getPieces().filter(piece => piece.isChaser && !piece.getIsDead());
    const first = chasers().length;
    chasers().forEach(piece => piece.setIsDead(true));
    expect(chasers().length).toBe(0);
    const [player] = gm.getPieces();
    player.isUnhurtable = true; // (not caught while we watch)
    for (let k = 0; k < 2000 && chasers().length < first + 2; k++) gm.stepPieces();
    expect(chasers().length).toBeGreaterThanOrEqual(first + 1);
  });
});
