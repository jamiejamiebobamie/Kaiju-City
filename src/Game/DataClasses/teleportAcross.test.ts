import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { PORTAL_REST_MS } from './GameBoard/Pieces/GameBoardPieceBase';

const makeGame = level => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(false);
  const gm = new GameManager({ level, settingsManager });
  gm.initGame();
  for (let k = 0; k < 3000 && gm.cutscene; k += 1) gm.stepPieces();
  return { gm, player: gm.getPieces()[0], board: gm.gameBoardManager, input: gm.getPlayerInputHandler() };
};
const key = ({ i, j }) => `${i} ${j}`;

describe('Teleport toward the rival, across the gaps (Jamie)', () => {
  // the Subway with a train in: the platforms are ground of their own
  const makeSubway = () => {
    const game = makeGame(LEVELS.rapidTransit);
    game.gm.trainSchedule.setStage('train', 0);
    const rival = game.gm.rivalPiece;
    rival.isOnTiles = true;
    rival.isDead = false;
    return { ...game, rival };
  };

  it('on another platform, toward the rival: lands on their platform, at its far edge, never past it', () => {
    const { gm, board, input, rival } = makeSubway();
    const regions = new Map();
    board.walkableTiles.forEach(tile => {
      const region = gm.getTeleportRegion(tile);
      regions.set(region, [...(regions.get(region) || []), tile]);
    });
    expect(regions.size).toBeGreaterThanOrEqual(3); // three platforms, at least
    // the rival on the middle platform (by x), the player on each of the others
    const byX = [...regions.values()].filter(tiles => tiles.length > 20)
      .sort((a, b) => Math.min(...a.map(({ i }) => i)) - Math.min(...b.map(({ i }) => i)));
    const middle = byX[1];
    const rivalTile = middle[Math.floor(middle.length / 2)];
    rival.setTileIndex(rivalTile);
    const rivalRegion = gm.getTeleportRegion(rivalTile);
    let landed = 0;
    [[byX[byX.length - 1], 'left'], [byX[0], 'right']].forEach(([platform, pressed]) => {
      platform.forEach(from => {
        const path = gm.getTeleportAcross(from, pressed, input);
        if (!path) return;
        landed += 1;
        const end = path[path.length - 1];
        expect(gm.getTeleportRegion(end)).toBe(rivalRegion);
        expect(board.getIsInBounds(end)).toBe(true);
        // no overshoot: the next tile along the line is not on their platform
        const [dir] = input.getTileDirsFromPressedDir(pressed, end);
        const offset = board.getTileOffsetFromDir(dir, end);
        const next = { i: end.i + offset.i, j: end.j + offset.j };
        expect(board.getIsInBounds(next) && gm.getTeleportRegion(next) == rivalRegion).toBe(false);
        // and it goes the way pressed
        expect(pressed == 'left' ? end.i < from.i : end.i > from.i).toBe(true);
      });
    });
    expect(landed).toBeGreaterThan(5);
  });

  it('away from them, or on their platform, the Teleport goes as always', () => {
    const { gm, board, input, rival } = makeSubway();
    const rivalTile = rival.getTileIndex();
    const rivalRegion = gm.getTeleportRegion(rivalTile);
    const same = board.walkableTiles.filter(tile => gm.getTeleportRegion(tile) == rivalRegion);
    same.forEach(from => ['left', 'right', 'up', 'down'].forEach(pressed => expect(gm.getTeleportAcross(from, pressed, input)).toBeUndefined()));
  });

  it('the Aquarium: from the ground floor toward the rival upstairs, it lands upstairs', () => {
    const { gm, board, input } = makeGame(LEVELS.aquarium);
    const rival = gm.rivalPiece;
    rival.isOnTiles = true;
    const top = board.walkableTiles.filter(tile => gm.getIsTopFloor(tile));
    const ground = board.walkableTiles.filter(tile => !gm.getIsTopFloor(tile));
    rival.setTileIndex(top[Math.floor(top.length / 2)]);
    const paths = ground.map(from => gm.getTeleportAcross(from, 'up', input)).filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach(path => expect(gm.getIsTopFloor(path[path.length - 1])).toBe(true));
    // down, away from them: as always
    ground.forEach(from => expect(gm.getTeleportAcross(from, 'down', input)).toBeUndefined());
  });
});

describe('NPCs rest from portals after going through one (Jamie)', () => {
  it('an NPC through a tile link cannot go through one again, either end, for a while', () => {
    const { gm, player } = makeGame(LEVELS.aquarium);
    const [[a, b]] = LEVELS.aquarium.tileLinks;
    player.isNpc = true;
    player.accTime = 1000;
    player.setTileIndex(a);
    player.jumpToLinkedTile(b);
    expect(key(player.getTileIndex())).toBe(key(b));
    expect(player.getIsPortalResting()).toBe(true);
    // back the other way, too soon: it stays
    player.jumpToLinkedTile(a);
    expect(key(player.getTileIndex())).toBe(key(b));
    // and plans its paths without the links
    const board = gm.gameBoardManager;
    expect(board.getPathStepsFrom(b, true)(b).some(tile => key(tile) == key(a))).toBe(false);
    // rested, it can
    player.accTime = 1000 + PORTAL_REST_MS + 1;
    expect(player.getIsPortalResting()).toBe(false);
    player.jumpToLinkedTile(a);
    expect(key(player.getTileIndex())).toBe(key(a));
  });

  it('the player is never kept from them', () => {
    const { player } = makeGame(LEVELS.aquarium);
    player.portalRestUntil = Infinity;
    expect(player.getIsPortalResting()).toBe(false);
  });
});
