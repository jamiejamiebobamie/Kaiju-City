import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// playtest 20 (Jamie, 2026-11-12)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const key = tile => `${tile.i} ${tile.j}`;

describe('playtest 20', () => {
  it('J10: hit by the train, the player is put straight on a safe tile with no portal, and none can be made there', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    const board = gm.gameBoardManager;
    const player = gm.getPieces()[0];
    const safe = board.getClosestWalkableTile(player.getTileIndex(), true);
    board.reserveTile(safe, gm.accTime + 5000);
    const other = board.walkableTiles.find(tile => key(tile) != key(safe));
    board.addWormhole(safe, other, gm.accTime, 3000);
    expect(board.getLinkedTile(safe)).toBeUndefined();
    gm.startPortalWalk = () => { throw new Error('no portal walk'); };
    player.hitByTrain(gm.accTime, { mode: 'shove', dmg: 2 }, safe);
    expect(key(player.getTileIndex())).toBe(key(safe));
  });

  it('J14: on a map walk the teammate starts beside the player', () => {
    const gm = makeGame(LEVELS.mapRooftop);
    const [player, teammate] = gm.getPieces();
    expect(gm.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).map(key)).toContain(key(teammate.getTileIndex()));
  });

  it('J20/J21: the Agent fight lines the team up, and the first Agent drops straight from the catwalk', () => {
    expect((LEVELS.lab as any).showdown.lineUp).toBeTruthy();
    expect(LEVELS.lab.agentDrops.firstDropMs).toBe(500);
    expect(LEVELS.lab.agentDrops.isFirstStraightDown).toBe(true);
  });
});

describe('playtest 21', () => {
  it('K9: up one stairway, the Mermaid plans down the other one at once', () => {
    const gm = makeGame(LEVELS.aquarium);
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    const rival = gm.rivalPiece;
    const [[lowA, upA], [lowB]] = LEVELS.aquarium.tileLinks;
    rival.initCharLocation(true, lowA);
    rival.accTime = 1000;
    rival.jumpToLinkedTile(upA); // up stairway A: it rests now
    expect(rival.getIsPortalResting()).toBe(false);
    const path = gm.gameBoardManager.findPathFromTo(rival.getTileIndex(), lowB, undefined, false, rival.pieceIndex);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some(tile => key(tile) == key(lowA))).toBe(false);
  });
});
