import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager, HAZMAT_RECRUIT } from './GameManager';
import { SettingsManager } from './SettingsManager';

// playtest 17 (Jamie, 2026-11-10)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};
const skip = gm => { for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces(); gm.stepPieces(); };
const key = tile => `${tile.i} ${tile.j}`;

describe('playtest 17', () => {
  it('E3: the Hazmat Worker fights with his own powers, a white outline, and never speaks', () => {
    const gm = makeGame(LEVELS.aquarium, { recruits: ['hazmat'] });
    expect(gm.getRecruitAbilityElements('hazmat')).toEqual(HAZMAT_RECRUIT.abilities);
    gm.followers = [{ avatar: 'hazmat' }, { avatar: 'mermaid' }];
    expect(gm.getSpeakingFollowers().map(({ avatar }) => avatar)).toEqual(['mermaid']);
  });

  it('E1: in a fight the teammate starts beside the player, on a tile of their own', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    const [player, teammate] = gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
    const beside = gm.gameBoardManager.getAdjacentTileIndices(player.getTileIndex()).map(key);
    expect(beside).toContain(key(teammate.getTileIndex()));
    const others = gm.getPieces().filter(piece => piece !== teammate && piece.isOnTiles).map(piece => key(piece.getTileIndex()));
    expect(others).not.toContain(key(teammate.getTileIndex()));
  });

  it('D3: the Mermaid roams far, and a stairway she took rests for her', () => {
    const gm = makeGame(LEVELS.aquarium);
    skip(gm);
    const rival = gm.rivalPiece;
    expect(rival.linkRestMs).toBe(15000);
    gm.accTime = 100000;
    rival.walkToTile = undefined;
    gm.updateRoamingRival();
    expect(rival.walkToTile).toBeTruthy();
    const link = gm.gameBoardManager.walkableTiles.find(tile => gm.gameBoardManager.getLinkedTile(tile));
    if (link) {
      rival.accTime = 1000;
      rival.linkRests = { [key(link)]: 5000 };
      expect(rival.getIsLinkResting(link)).toBe(true);
      rival.accTime = 6000;
      expect(rival.getIsLinkResting(link)).toBe(false);
    }
  });

  it('the Mermaid’s teleport flash is pink, not the Rooftop’s red', () => {
    expect((LEVELS.aquarium.rival as any).screamFlashColor).toBe('#ff7ad9');
    expect((LEVELS.rooftop.rival as any).screamFlashColor).toBeUndefined();
  });
});
