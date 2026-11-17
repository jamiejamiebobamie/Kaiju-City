import { describe, expect, it } from 'vitest';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { LEVELS } from './Levels/levels';

describe('playtest 26', () => {
  it('24/30: a taken-over avatar walks through the stairs (a portal) as the player does', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.aquarium, settingsManager });
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    const [player, teammate] = gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
    expect(teammate).toBeDefined();
    // the player went down: the teammate is played as now
    player.setIsDead(true);
    teammate.isNpc = false;
    gm.controlledPiece = teammate;
    const [stairs, upstairs] = LEVELS.aquarium.tileLinks[0];
    teammate.initCharLocation(true, stairs);
    teammate.jumpToLinkedTile(upstairs);
    expect(gm.portalWalk).toBeDefined();
    expect(gm.portalWalk.piece).toBe(teammate);
    expect(gm.cutscene).toBeDefined();
  });
});
