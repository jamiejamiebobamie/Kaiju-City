import { describe, expect, it } from 'vitest';
import { GameManager, PORTAL_WALK } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { LEVELS } from './Levels/levels';
import { GAME_TICK } from 'Utils/gameState';

const getRowsApart = (gm, a, b) => {
  const board = gm.gameBoardManager;
  const from = board.getCharXAndYFromTileIndex(a);
  const to = board.getCharXAndYFromTileIndex(b);
  return Math.hypot(from.x - to.x, from.y - to.y) / (gm.level.grid.rowStep * gm.level.grid.scale);
};

const makeAquarium = () => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(false);
  const gm = new GameManager({ level: LEVELS.aquarium, settingsManager });
  gm.initGame();
  while (gm.cutscene) gm.stepPieces();
  gm.stepPieces();
  return { gm, player: gm.getPieces()[0] };
};

describe('walking through a portal', () => {
  it('in close and held on the way in, the fight going on across, held again on the way out, and there', () => {
    const { gm, player } = makeAquarium();
    const [stairs, upstairs] = LEVELS.aquarium.tileLinks[0]; // the left stairs, and the balcony door upstairs
    player.initCharLocation(true, stairs);
    player.jumpToLinkedTile(upstairs);
    // in: the game holds, and the body goes past the pillar's edge
    expect(gm.cutscene).toBeDefined();
    expect(gm.portalWalk.stage).toBe('in');
    const heldAt = gm.accTime;
    gm.stepPieces();
    expect(player.portalMask).toBeDefined();
    expect(player.portalMask.point).toEqual(LEVELS.aquarium.linkWalls[0].point);
    for (let k = 0; k < 40 && gm.portalWalk.stage == 'in'; k += 1) gm.stepPieces();
    expect(gm.accTime).toBe(heldAt);
    // across: nowhere, and the fight goes on
    expect(gm.portalWalk.stage).toBe('across');
    gm.stepPieces(); // the scene's last step ends
    expect(gm.cutscene).toBeUndefined();
    expect(player.isVisible).toBe(false);
    expect(player.isOnTiles).toBe(false);
    expect(gm.getCameraShot().isPlayZoom).toBe(true);
    for (let k = 0; k < 40 && gm.portalWalk.stage == 'across'; k += 1) gm.stepPieces();
    expect(gm.accTime).toBeGreaterThanOrEqual(heldAt + PORTAL_WALK.zoomOutMs + PORTAL_WALK.panMs - GAME_TICK.pieceMs);
    // out: held again, and they walk out onto the far end
    expect(gm.portalWalk.stage).toBe('out');
    for (let k = 0; k < 40 && gm.portalWalk; k += 1) gm.stepPieces();
    expect(gm.portalWalk).toBeUndefined();
    gm.stepPieces(); // the scene's last step ends
    expect(gm.cutscene).toBeUndefined();
    // out past the door's edge: at the far end, or a step or two on, all of them in view
    expect(getRowsApart(gm, player.getTileIndex(), upstairs)).toBeLessThan(3);
    expect(gm.gameBoardManager.getIsInBounds(player.getTileIndex())).toBe(true);
    expect(player.isVisible).toBe(true);
    expect(player.portalMask).toBeUndefined();
  });

  it('an NPC whose path starts through a link takes the link, rather than walking across the gap off the tiles', () => {
    const { gm } = makeAquarium();
    const rival = gm.rivalPiece;
    const [stairs, upstairs] = LEVELS.aquarium.tileLinks[0];
    rival.initCharLocation(true, upstairs);
    const onward = gm.gameBoardManager.getAdjacentTileIndices(stairs).filter(gm.gameBoardManager.getIsInBounds)[0];
    rival.updateMovmement([stairs, onward]);
    expect(rival.getTileIndex()).toEqual(stairs);
    expect(rival.moveToTiles).toEqual([onward]);
  });

  it('the HUDs stay up while the player walks through: the scene holds the fight, but is a mid-fight one', () => {
    const { gm, player } = makeAquarium();
    const [stairs, upstairs] = LEVELS.aquarium.tileLinks[0];
    player.initCharLocation(true, stairs);
    player.jumpToLinkedTile(upstairs);
    expect(gm.cutscene.isMidFight).toBe(true);
    expect(gm.getUiState().isCutscene).toBe(false);
  });

  it('only the player: NPCs go straight through', () => {
    const { gm, player } = makeAquarium();
    const rival = gm.rivalPiece;
    const [stairs, upstairs] = LEVELS.aquarium.tileLinks[0]; // the left stairs, and the balcony door upstairs
    rival.initCharLocation(true, stairs);
    rival.jumpToLinkedTile(upstairs);
    expect(gm.portalWalk).toBeUndefined();
    expect(rival.getTileIndex()).toEqual(upstairs);
    expect(player.isVisible).toBe(true);
  });
});
