import { describe, expect, it } from 'vitest';
import { CAMERA_THREATS } from './GameManager';
import { CENTER_TILE, makeGame } from './testHelpers';

// a power on a tile, chasing a piece
const putChasing = (gm, tileIndex, appliedStatus, targetIndex, teamIndex) => {
  const status = gm.settingsManager.getAbilityAndTileStatusData()[appliedStatus];
  const tile = gm.gameBoardManager.tiles[tileIndex.i][tileIndex.j];
  tile.updateTileStatus({ updateKey: 0, tileStatus: status, currCount: 5, dirs: ['up'], teamIndex, targetIndex });
  gm.gameBoardManager.activeTiles = gm.gameBoardManager.getTilesInFlatArray().filter(each => each.getIsVisible());
};

describe('what the enemy zoom also looks toward', () => {
  const near = { i: CENTER_TILE.i, j: CENTER_TILE.j - 3 };

  it('a power chasing the player: Haunt, Overgrowth, Ice Slice, Charm and the sea creatures, but not Heal', () => {
    ['isGhosted', 'isWooded', 'isCold', 'isCharming', 'isSeaGhost'].forEach(appliedStatus => {
      const { gm, player } = makeGame();
      putChasing(gm, near, appliedStatus, player.pieceIndex, 1);
      expect(gm.getCameraThreats(player).length).toBe(1);
    });
    const { gm, player } = makeGame();
    putChasing(gm, near, 'isHealing', player.pieceIndex, 1);
    expect(gm.getCameraThreats(player)).toEqual([]);
  });

  it('only what chases the player: not the teammate, and not the player side’s own powers', () => {
    const { gm, player } = makeGame({ isTeammate: true });
    const teammate = gm.gameBoardPiecesManager.getTeamPieces(player.getTeamIndex()).find(piece => piece != player);
    putChasing(gm, near, 'isGhosted', teammate.pieceIndex, 1);
    expect(gm.getCameraThreats(player)).toEqual([]);
    putChasing(gm, near, 'isGhosted', player.pieceIndex, player.getTeamIndex());
    expect(gm.getCameraThreats(player)).toEqual([]);
  });

  it('a Kaiju not yet on the board, once it is near the player', () => {
    const { gm, player } = makeGame();
    gm.kaijuManager.addKaijuPiece(gm.accTime);
    const kaiju = gm.getPieces().find(piece => piece.avatar == 'kaiju' && !piece.isOnTiles);
    expect(kaiju.isOnTiles).toBe(false);
    const rowPx = gm.level.grid.rowStep * gm.level.grid.scale;
    kaiju.charLocation = { x: player.charLocation.x, y: player.charLocation.y + (CAMERA_THREATS.kaijuNearRows + 4) * rowPx };
    expect(gm.getCameraThreats(player)).toEqual([]);
    kaiju.charLocation = { x: player.charLocation.x, y: player.charLocation.y + (CAMERA_THREATS.kaijuNearRows - 4) * rowPx };
    expect(gm.getCameraThreats(player).map(({ key }) => key)).toEqual([`piece ${kaiju.pieceIndex}`]);
  });
});
