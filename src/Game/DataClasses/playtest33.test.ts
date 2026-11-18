import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';

// Jamie's playtest 33 (2026-11-17)
const makeGame = level => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager });
  gm.initGame();
  return gm;
};

describe('playtest 33', () => {
  it('17. the Lab escape: the Agents hurt the player, and the player down loses it (another go), though the teammate runs on', () => {
    const gm = makeGame(LEVELS.labTrap);
    for (let k = 0; k < 5000 && !gm.getPieces().some(piece => piece.isChaser); k++) gm.stepPieces();
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const [player, teammate] = gm.getPieces();
    const chaser = gm.getPieces().find(piece => piece.isChaser);
    for (let k = 0; k < 2000 && !chaser.isOnTiles; k++) gm.stepPieces();
    const before = player.lives;
    for (let k = 0; k < 200 && !player.getIsDead(); k++) {
      chaser.initCharLocation(true, player.getTileIndex());
      gm.accTime += 100;
      gm.stepPieces();
    }
    expect(before).toBeGreaterThan(0);
    expect(player.getIsDead()).toBe(true);
    expect(teammate.getIsDead()).toBe(false);
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
    expect(gm.getFallenRecruits()).toEqual([]); // no one is gone for good from here
  });
});
