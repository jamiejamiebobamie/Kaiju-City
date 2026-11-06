import { describe, expect, it } from 'vitest';
import { GameManager, PORTAL_WALK } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { LEVELS } from './Levels/levels';
import { GAME_TICK } from 'Utils/gameState';

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
    expect(player.getTileIndex()).toEqual(upstairs);
    expect(player.isVisible).toBe(true);
    expect(player.portalMask).toBeUndefined();
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
