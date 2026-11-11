import { describe, expect, it } from 'vitest';
import { LEVELS, getTrainingLevelId } from './Levels/levels';
import { GameManager, HAZMAT_RECRUIT } from './GameManager';
import { SettingsManager } from './SettingsManager';

// playtest 19 (Jamie, 2026-11-11)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const key = tile => `${tile.i} ${tile.j}`;

describe('playtest 19', () => {
  it('H3: in the Peninsula fight the teammate starts beside the player', () => {
    const gm = makeGame(LEVELS.peninsula);
    const [player, teammate] = gm.getPieces();
    const beside = gm.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).map(key);
    expect(beside).toContain(key(teammate.getTileIndex()));
  });

  it('H4: the Subway training keeps its trains', () => {
    expect(LEVELS[getTrainingLevelId('rapidTransit')].hasTrainSchedule).toBe(true);
  });

  it('H8: the Hazmat Worker glows orange', () => {
    expect(HAZMAT_RECRUIT.color).toBe('#ff8a1f');
  });

  it('H1: the Hazmat Worker is "recruited!", as the other recruits are', () => {
    expect((LEVELS.street.unlock as any).isRecruit).toBe(true);
  });
});

describe('playtest 19, the final battle', () => {
  it('H19: the player down when the last Kaiju falls: no one turns, the fight is won', () => {
    const gm = makeGame(LEVELS.finalPeninsula);
    for (let k = 0; k < 6000 && gm.cutscene; k++) gm.stepPieces();
    gm.getPieces()[0].isDead = true;
    gm.startFinalTurn();
    expect(gm.finalTurnState).toBe('saved');
    expect(gm.getGameResult()).toBe(0);
  });
});

describe('playtest 19, permadeath where it counts', () => {
  it('a recruit down in the Lab trap or in training is not gone; in the Peninsula, Agent and rival fights they are', () => {
    const fallen = level => {
      const gm = makeGame(level, { autoRecruits: ['punk'], recruits: ['punk'] });
      gm.getPieces = () => [{ isRecruit: true, getIsDead: () => true, avatar: 'punk' }];
      return gm.getFallenRecruits();
    };
    expect(fallen(LEVELS.labTrap)).toEqual([]);
    expect(fallen(LEVELS[getTrainingLevelId('rooftop')])).toEqual([]);
    ['peninsula', 'lab', 'rooftop', 'finalPeninsula'].forEach(id => expect(fallen(LEVELS[id])).toEqual(['punk']));
  });
});
