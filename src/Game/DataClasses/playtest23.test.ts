import { describe, expect, it } from 'vitest';
import { LEVELS, getVisitLevelId } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { storage } from 'Utils/storage';

// playtest 23 (Jamie, 2026-11-12)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  settingsManager.setTeammateAvatar('girl');
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const key = tile => `${tile.i} ${tile.j}`;

describe('playtest 23', () => {
  it('M8: Punk Guy cut off by the train runs about his platform, and stops the run once the train has gone', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    const rival = gm.rivalPiece;
    let isApart = true;
    gm.getIsApartByTrain = () => isApart;
    rival.moveToTiles = [];
    gm.updateApartRival();
    expect(rival.walkToTile).toBeDefined();
    const reachable = gm.gameBoardManager.getReachableTiles(rival.getTileIndex()).map(key);
    expect(reachable).toContain(key(rival.walkToTile));
    isApart = false;
    gm.updateApartRival();
    expect(rival.walkToTile).toBeUndefined();
  });

  it('M12: a recruit who died in the fight is not stood up in the choice scene', () => {
    const gm = makeGame(LEVELS.rooftop, { autoRecruits: ['punk'], recruits: ['punk'] });
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    const recruit = gm.getPieces().find(piece => piece.isRecruit);
    recruit.isDead = true;
    gm.startRecruitScene();
    expect(recruit.isDead).toBe(true);
  });

  it('M13: a recruit recruited, then fallen for good, leaves their battleground offering sparring', () => {
    storage.clear();
    const visit = LEVELS[getVisitLevelId('rooftop')];
    expect(makeGame(visit).getSparringOffer()).toBeUndefined();
    expect(makeGame(visit, { fallen: ['black_female'] }).getSparringOffer()).toBeDefined();
  });
});
