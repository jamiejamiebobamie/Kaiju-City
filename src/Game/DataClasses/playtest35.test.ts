import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// Jamie's playtest 35 (2026-11-18)
describe('playtest 35', () => {
  it('5. the Lab escape: an Agent runs right onto the player\'s tile', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.labTrap, settingsManager });
    gm.initGame();
    for (let k = 0; k < 5000 && !gm.getPieces().some(piece => piece.isChaser); k++) gm.stepPieces();
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const [player] = gm.getPieces();
    player.isUnhurtable = true; // (to watch where they go)
    player.moveToTiles = [];
    const chasers = () => gm.getPieces().filter(piece => piece.isChaser && !piece.getIsDead() && piece.isOnTiles);
    const isOnPlayer = () => chasers().some(piece => piece.tileIndex.i == player.tileIndex.i && piece.tileIndex.j == player.tileIndex.j);
    let reached = false;
    for (let k = 0; k < 3000 && !reached; k++) {
      gm.stepPieces();
      reached = isOnPlayer();
    }
    expect(reached).toBe(true);
  });
});
