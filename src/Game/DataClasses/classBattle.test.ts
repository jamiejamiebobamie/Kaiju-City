import { describe, expect, it } from 'vitest';
import { buildBattlePreviewLevel } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// the class's battle preview (Jamie, 2026-11-15): the game's engine on a little patch of the Peninsula's grid
const startPreview = () => {
  const level = buildBattlePreviewLevel();
  const settings = new SettingsManager();
  settings.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Lightning']);
  settings.setIsTeammate(false);
  const gm: any = new GameManager({ level, settingsManager: settings, killsToWin: 99999 });
  gm.initGame();
  const player = gm.gameBoardPiecesManager.getPlayerPiece();
  player.isNpc = true;
  player.decrementHealth = () => {};
  return { gm, level, player };
};

describe('class battle preview', () => {
  it('is the Peninsula grid, its Kaiju coming in from the sides only, every 1.8 to 3.6 s, four at most', () => {
    const { level } = startPreview();
    expect(level.grid.colStep).toBe(18.9);
    expect(level.grid.rowStep).toBe(21.6);
    expect(level.kaijuEntry.isSidesOnly).toBe(true);
    expect(level.kaijuEntry.spawnEveryMs).toEqual([1800, 3600]); // (Jamie, playtest 39: was 5 to 10 s)
  });

  it('runs a minute of fighting: Kaiju come, from the left or right, and the avatar never dies', () => {
    const { gm, level, player } = startPreview();
    const { minX, maxX } = level.kaijuEntry.bounds;
    const seenStarts = new Set();
    for (let k = 0; k < 60000 / 50; k++) {
      gm.stepPieces();
      if (k % 2 == 0) gm.stepTiles();
      gm.kaijuManager.kaijuPieces.forEach(kaiju => {
        if (!seenStarts.has(kaiju)) {
          seenStarts.add(kaiju);
          // (first seen a step or two in from its edge)
          expect(Math.min(Math.abs(kaiju.charLocation.x - minX), Math.abs(kaiju.charLocation.x - maxX))).toBeLessThan(20);
        }
      });
    }
    expect(gm.kaijuManager.kaijuPieces.length).toBeGreaterThan(0);
    expect(gm.kaijuManager.kaijuPieces.length).toBeLessThanOrEqual(4); // (was 2)
    expect(player.getIsDead()).toBe(false);
  }, 60000);
});
