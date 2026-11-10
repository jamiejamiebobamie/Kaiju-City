import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';

// Jamie's open items (2026-11-07, worked 2026-11-10)
const makeGame = (level, { elements = ['Fire', 'Ice', 'Metal'], isTeammate = true, killsToWin = undefined, recruits = [] as Array<string> } = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(elements);
  settingsManager.setIsTeammate(isTeammate);
  const gm: any = new GameManager({ level, settingsManager, killsToWin, recruits, autoRecruits: recruits });
  gm.initGame();
  return gm;
};
const skip = gm => { for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces(); };

describe('open items', () => {
  it('1. a scene starting mid-portal-walk ends the walk: the player is there, visible, at its far end; teleports are called off', () => {
    const gm = makeGame(LEVELS.aquarium);
    skip(gm);
    const player = gm.getPieces()[0];
    const [[from, to]] = LEVELS.aquarium.tileLinks;
    player.initCharLocation(true, from);
    player.shouldTeleport = true;
    expect(gm.startPortalWalk(player, to)).toBe(true);
    for (let k = 0; k < 8; k++) gm.stepPieces(); // into the portal, gone
    gm.startCutscene([{ shot: { isWide: true }, ms: 100 }]);
    expect(gm.portalWalk).toBeUndefined();
    expect(player.isVisible).toBe(true);
    expect(player.isOnTiles).toBe(true);
    expect(player.isInPortal).toBe(false);
    expect(player.portalMask).toBeUndefined();
    expect(player.shouldTeleport).toBe(false);
  });

  it('2. the Subway: an NPC on the tracks as they close heads straight off them', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    skip(gm);
    const board = gm.gameBoardManager;
    gm.trainSchedule.setStage('idle', 0);
    const open = new Set<string>(board.walkableTiles.map(({ i, j }) => `${i} ${j}`));
    gm.trainSchedule.setStage('warning', 0);
    const track = [...open].map(key => { const [i, j] = key.split(' ').map(Number); return { i, j }; }).find(tile => board.getIsClosedTile(tile));
    const rival = gm.rivalPiece;
    rival.initCharLocation(true, track);
    rival.isUnhurtable = true;
    gm.getPieces()[0].isUnhurtable = true;
    for (let k = 0; k < 40 && board.getIsClosedTile(rival.getTileIndex()); k++) {
      gm.accTime += 110;
      rival.movePiece({ accTime: gm.accTime });
    }
    expect(board.getIsClosedTile(rival.getTileIndex())).toBe(false);
  });

  it('3. a launched ghost near an NPC counts as danger, for its defensive powers', () => {
    const gm = makeGame(LEVELS.rooftop);
    skip(gm);
    const teammate = gm.getPieces()[1];
    expect(gm.gameBoardManager.getIsPieceInDanger(teammate.pieceIndex)).toBe(false);
    gm.ghostRing = { ghosts: [{ state: 'launched', x: teammate.charLocation.x + 10, y: teammate.charLocation.y }] };
    expect(gm.gameBoardManager.getIsPieceInDanger(teammate.pieceIndex)).toBe(true);
    gm.ghostRing = undefined;
  });

  it('4. the Rooftop without the player’s Dispel: the teammate brings it, stays with them, and says so at their first block', () => {
    const gm = makeGame(LEVELS.rooftop);
    const teammate = gm.getPieces()[1];
    expect(teammate.isGuardian).toBe(true);
    expect(teammate.abilities.map(ability => ability.gameBoardPieceAbilityData.element)).toContain('bubble');
    // with the player's own Dispel, the teammate is as usual
    const withDispel = makeGame(LEVELS.rooftop, { elements: ['Fire', 'Bubble', 'Metal'] });
    expect(withDispel.getPieces()[1].isGuardian).toBeFalsy();
    // the first block by the teammate's Dispel: their line, once
    gm.getIsDispelledAt = () => true;
    gm.getDispelCasterAt = () => teammate.pieceIndex;
    expect(gm.getIsDispelledByTeam({ x: 0, y: 0 })).toBe(true);
    expect(gm.speech && gm.speech.text).toBe("Let's stick together. I'll block her ghosts.");
    gm.speech = null;
    gm.getIsDispelledByTeam({ x: 0, y: 0 });
    expect(gm.speech).toBeNull();
  });

  it('5. the Mermaid’s words from the top floor sit over her head, however near the top of the scene', () => {
    const gm = makeGame(LEVELS.aquarium);
    const rival = gm.rivalPiece;
    rival.charLocation = { x: 700, y: 150 };
    const text = 'Attack the invaders, my beauties!';
    expect(gm.getSpeechOver(rival, 'x', text, { isAboveHead: true }).y).toBeLessThan(gm.getSpeechOver(rival, 'x', text).y);
  });

  it('6/8. with no teammate left to turn, the player turns: "You destroyed the city!"', () => {
    const gm = makeGame(LEVELS.finalPeninsula, { killsToWin: 30 });
    skip(gm);
    const [player, teammate] = gm.getPieces();
    teammate.setIsDead(true);
    gm.score = 30;
    expect(gm.getGameResult()).toBe(null);
    gm.stepPieces();
    expect(gm.finalTurnState).toBe('turning');
    for (let k = 0; k < 600 && gm.finalTurnState != 'destroyed'; k++) gm.stepPieces();
    expect(gm.finalTurnState).toBe('destroyed');
    expect(player.isVisible).toBe(false);
    expect(gm.playerKaiju.color).toBe(player.color);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('7. the Lab fight: the player’s NPCs (recruits too) never plan or step up onto the catwalk', () => {
    const gm = makeGame(LEVELS.lab, { recruits: ['punk'] });
    skip(gm);
    const board = gm.gameBoardManager;
    const catwalk = board.walkableTiles.find(tile => gm.getIsOnCatwalk(tile));
    const recruit = gm.getPieces().find(piece => piece.isRecruit);
    expect(recruit).toBeDefined();
    expect(recruit.getIsAllowedTile(catwalk)).toBe(false);
    const path = board.findPathFromTo(recruit.getTileIndex(), catwalk, undefined, false, recruit.pieceIndex);
    expect(path.some(tile => gm.getIsOnCatwalk(tile))).toBe(false);
    // the player still can
    expect(gm.getPieces()[0].getIsAllowedTile(catwalk)).toBe(true);
  });
});
