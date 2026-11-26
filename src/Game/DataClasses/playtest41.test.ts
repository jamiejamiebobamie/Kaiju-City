import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

const getElements = (piece: any) => piece.abilities.map((ability: any) => ability.gameBoardPieceAbilityData.element);

// Jamie's list of 2026-11-25 (playtest 41)
describe('playtest 41', () => {
  it('the Subway: the teammate brings a Teleport when the player has none', () => {
    for (let run = 0; run < 8; run++) {
      const settingsManager = new SettingsManager();
      settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Bubble']);
      settingsManager.setIsTeammate(true);
      const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
      gm.initGame();
      const [, teammate] = gm.getPieces();
      expect(getElements(teammate)).toContain('glass');
    }
  });

  it('the Subway: no second Teleport for the teammate when the player has one', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Glass']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    const [, teammate] = gm.getPieces();
    expect(getElements(teammate).filter((element: string) => element == 'glass').length).toBeLessThanOrEqual(1);
  });

  it('allies on a leash: the whole screen with the opponent near, down to 5 tiles with them far', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Glass']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    for (let k = 0; k < 6000 && (gm.cutscene || !gm.rivalPiece || !gm.rivalPiece.isOnTiles); k++) gm.stepPieces();
    gm.setViewTileRadius(12);
    const [player, teammate] = gm.getPieces();
    const rival = gm.rivalPiece;
    const tilePx = gm.level.grid.colStep * gm.level.grid.scale;
    rival.charLocation = { x: player.charLocation.x + tilePx * 3, y: player.charLocation.y };
    expect(gm.getAllyLeash(teammate).radius).toBeCloseTo(12);
    rival.charLocation = { x: player.charLocation.x + tilePx * 30, y: player.charLocation.y };
    expect(gm.getAllyLeash(teammate).radius).toBeCloseTo(5);
    rival.charLocation = { x: player.charLocation.x + tilePx * 18, y: player.charLocation.y };
    expect(gm.getAllyLeash(teammate).radius).toBeCloseTo(8.5);
    // never the player, nor an enemy
    expect(gm.getAllyLeash(player)).toBeUndefined();
    expect(gm.getAllyLeash(rival)).toBeUndefined();
  });

  it('allies on a leash: the teammate keeps near the player through a fight', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Glass']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.rooftop, settingsManager });
    gm.initGame();
    for (let k = 0; k < 6000 && (gm.cutscene || !gm.rivalPiece || !gm.rivalPiece.isOnTiles); k++) gm.stepPieces();
    gm.setViewTileRadius(8);
    const [player, teammate] = gm.getPieces();
    const tilePx = gm.level.grid.colStep * gm.level.grid.scale;
    let checked = 0, far = 0;
    for (let k = 0; k < 900 && gm.getGameResult() === null; k++) {
      gm.stepPieces();
      if (k % 3 != 2) gm.stepTiles();
      const leash = gm.getAllyLeash(teammate);
      if (k < 150 || !leash || !teammate.isOnTiles || teammate.isDead) continue;
      checked++;
      const apart = Math.hypot(teammate.charLocation.x - player.charLocation.x, teammate.charLocation.y - player.charLocation.y) / tilePx;
      if (apart > leash.radius + 2) far++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(far / checked).toBeLessThan(0.1);
  }, 30000);

  it('the Subway: cut off from Punk Guy with the player, the teammate teleports beside him and leaves the player a portal', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Bubble']);
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    for (let k = 0; k < 6000 && (gm.cutscene || !gm.rivalPiece || !gm.rivalPiece.isOnTiles); k++) gm.stepPieces();
    const [player, teammate] = gm.getPieces();
    const rival = gm.rivalPiece;
    const board = gm.gameBoardManager;
    gm.trainSchedule.setStage('train', gm.accTime);
    const playerRegion = gm.getTeleportRegion(player.getTileIndex());
    // the teammate beside the player; Punk Guy on another platform; the train between
    const near = board.walkableTiles.find((tile: any) => gm.getTeleportRegion(tile) == playerRegion && !board.getLinkedTile(tile)
      && (tile.i != player.getTileIndex().i || tile.j != player.getTileIndex().j));
    teammate.setTileIndex(near);
    teammate.charLocation = board.getCharXAndYFromTileIndex(near);
    teammate.moveToTiles = [];
    const other = board.walkableTiles.find((tile: any) => gm.getTeleportRegion(tile) != playerRegion && !board.getLinkedTile(tile));
    rival.setTileIndex(other);
    rival.charLocation = board.getCharXAndYFromTileIndex(other);
    gm.activePhases.add('train');
    gm.getIsApartByTrain = () => true;
    gm.updateTrappedRival = () => {}; // (he stays put for the check)
    const from = { ...teammate.getTileIndex() };
    gm.updateShadowingTeammate();
    expect(teammate.shouldTeleport).toBe(true);
    for (let k = 0; k < 400 && teammate.shouldTeleport; k++) { if (gm.trainSchedule.stage != 'train') gm.trainSchedule.setStage('train', gm.accTime); gm.stepPieces(); }
    expect(gm.getTeleportRegion(teammate.getTileIndex())).toBe(gm.getTeleportRegion(rival.getTileIndex()));
    const way = board.getLinkedTile(from);
    expect(way).toBeDefined();
    expect(gm.getTeleportRegion(way)).toBe(gm.getTeleportRegion(rival.getTileIndex()));
    // off the leash while the portal's open: not pulled back
    expect(gm.getAllyLeash(teammate)).toBeUndefined();
  });

  it('a hit taken by a passive\'s extra health is counted, so its "-1" shows (the Punk Guy\'s Healthy)', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Metal', 'Bubble']);
    settingsManager.setIsTeammate(false);
    const gm: any = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    const [player] = gm.getPieces();
    player.livesModifier = 1;
    const lives = player.lives;
    player.decrementHealth(1000, 1);
    expect(player.lives).toBe(lives);
    expect(player.absorbedHits).toBe(1);
  });
});
