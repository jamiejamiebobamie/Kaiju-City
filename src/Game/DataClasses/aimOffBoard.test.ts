import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { AIM_ENTERING_TILES } from './GameBoard/GameBoardManager';

// the Peninsula, the player alone, and two Kaiju walking in (off the tiles)
const makeGame = () => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(false);
  const gm = new GameManager({ level: LEVELS.peninsula, settingsManager });
  gm.initGame();
  for (let k = 0; k < 3000 && gm.cutscene; k += 1) gm.stepPieces();
  gm.getPieces().filter(piece => piece.avatar == 'kaiju').forEach(piece => { piece.isDead = true; });
  gm.kaijuManager.addKaijuPiece(gm.accTime);
  gm.kaijuManager.addKaijuPiece(gm.accTime);
  const [onBoard, walkingIn] = gm.getPieces().filter(piece => piece.avatar == 'kaiju' && !piece.isDead);
  const board = gm.gameBoardManager;
  const player = gm.getPieces()[0];
  const rowPx = board.grid.rowStep * (board.grid.scale || 1);
  // where the walking-in Kaiju stands: this many rows out from its entry tile, the way it came
  const standOut = rows => {
    const entry = board.getCharXAndYFromTileIndex(walkingIn.getTileIndex());
    const from = walkingIn.moveFromLocation;
    const length = Math.hypot(from.x - entry.x, from.y - entry.y) || 1;
    walkingIn.charLocation = { x: entry.x + (from.x - entry.x) / length * rows * rowPx, y: entry.y + (from.y - entry.y) / length * rows * rowPx };
  };
  return { gm, board, player, onBoard, walkingIn, standOut, rowPx };
};

describe('powers aim at Kaiju still walking in (Jamie)', () => {
  it('with no enemy on the tiles, a power goes toward the Kaiju walking in, however far', () => {
    const { board, player, onBoard, walkingIn, standOut } = makeGame();
    onBoard.isDead = true;
    standOut(10);
    expect(walkingIn.isOnTiles).toBe(false);
    expect(board.getClosestAimTarget(player.pieceIndex)).toBe(walkingIn);
    // and the power's first tiles head its way
    const [tile] = board.getTilesTowardPiece(player.getTileIndex(), walkingIn);
    const from = board.getCharXAndYFromTileIndex(player.getTileIndex());
    const to = board.getCharXAndYFromTileIndex(tile);
    const toward = { x: walkingIn.charLocation.x - from.x, y: walkingIn.charLocation.y - from.y };
    expect((to.x - from.x) * toward.x + (to.y - from.y) * toward.y).toBeGreaterThan(0);
  });

  it('with an enemy on the tiles, a closer Kaiju walking in counts only within two tiles of stepping on', () => {
    const { gm, board, player, onBoard, walkingIn, standOut } = makeGame();
    // the player beside the walking-in Kaiju's entry; the other Kaiju on the tiles, far away
    const entry = walkingIn.getTileIndex();
    player.setTileIndex(entry);
    player.charLocation = board.getCharXAndYFromTileIndex(entry);
    const far = board.walkableTiles.reduce((best, tile) => {
      const d = Math.hypot(tile.i - entry.i, tile.j - entry.j);
      return d > best.d ? { tile, d } : best;
    }, { tile: entry, d: -1 }).tile;
    onBoard.initCharLocation(true, far);
    expect(onBoard.isOnTiles).toBe(true);
    standOut(AIM_ENTERING_TILES + 2);
    expect(board.getClosestAimTarget(player.pieceIndex)).toBe(onBoard);
    standOut(AIM_ENTERING_TILES - 0.5);
    expect(board.getClosestAimTarget(player.pieceIndex)).toBe(walkingIn);
    // the Kaiju on the tiles, closer: it is the one
    player.setTileIndex(far);
    player.charLocation = board.getCharXAndYFromTileIndex(far);
    expect(board.getClosestAimTarget(player.pieceIndex)).toBe(onBoard);
    expect(gm).toBeDefined();
  });
});
