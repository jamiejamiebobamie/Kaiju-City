import { afterEach, describe, expect, it } from 'vitest';
import { LEVELS, PENINSULA } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { GIANT_KAIJU } from './GiantKaiju';
import { CAMPAIGN_SECTIONS } from './Campaign';
import { saveRecruitChoice } from './Unlocks';
import { storage } from 'Utils/storage';

const saved = { ...GIANT_KAIJU };
afterEach(() => Object.assign(GIANT_KAIJU, saved));

const makeFinal = () => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm = new GameManager({ level: LEVELS.finalBattle, settingsManager });
  gm.initGame();
  while (gm.cutscene) gm.stepPieces();
  return gm;
};
const getTeam = gm => gm.gameBoardPiecesManager.getTeamPieces(gm.gameBoardPiecesManager.getPlayerTeamIndex());
// a power of the team's, on a tile under the weak spot
const hitWeakSpot = gm => {
  const [tile] = gm.getTilesInBox(gm.giant.getPartBox());
  const fire = gm.settingsManager.getAbilityAndTileStatusData().isOnFire;
  tile.updateTileStatus({ updateKey: gm.accTime, tileStatus: fire, currCount: 5, dirs: [], teamIndex: gm.gameBoardPiecesManager.getPlayerTeamIndex(), targetIndex: -1 });
  gm.accTime += GIANT_KAIJU.hitEveryMs + 10;
  gm.updateFinalBattle();
};

describe('the end of the Lab fight', () => {
  it('with the clones beaten, the teammate transforms before the fight is won (when the giant is the final battle)', () => {
    GIANT_KAIJU.isFinalBattle = true;
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.lab, settingsManager });
    gm.initGame();
    for (let k = 0; k < 3000 && (gm.cutscene || !gm.getPieces().some(piece => piece.avatar == 'agent' && piece.isOnTiles)); k += 1) gm.stepPieces();
    const { teammate } = gm.getGhostTeam();
    expect(teammate).toBeDefined();
    gm.score = gm.getKillsToWin();
    expect(gm.getGameResult()).toBe(null);
    gm.stepPieces();
    expect(gm.transformState).toBe('transforming');
    for (let k = 0; k < 600 && gm.transformState != 'done'; k += 1) gm.stepPieces();
    expect(teammate.isVisible).toBe(false);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });
});

describe('the final battle', () => {
  it('is on the Peninsula three times the size, with tiles and people their usual size (the last section when it is on)', () => {
    expect(CAMPAIGN_SECTIONS[CAMPAIGN_SECTIONS.length - 1].levelId).toBe(GIANT_KAIJU.isFinalBattle ? 'finalBattle' : 'peninsula');
    const level = LEVELS.finalBattle;
    expect(level.world.width).toBe(PENINSULA.world.width * GIANT_KAIJU.mapScale);
    expect(level.grid.rowStep).toBe(PENINSULA.grid.rowStep);
    expect(level.pieceScale).toBe(PENINSULA.pieceScale);
    expect(level.walkableTiles.length).toBeGreaterThan(PENINSULA.walkableTiles.length * GIANT_KAIJU.mapScale * 2);
    expect(level.kaijuEntry.perimeterTiles.length).toBeGreaterThan(10);
  });

  it('the teammate is the giant: no teammate fights beside the player, and recruits join on their own', () => {
    storage.clear();
    saveRecruitChoice('punk', 'recruit');
    saveRecruitChoice('black_female', 'terminate');
    const gm = makeFinal();
    const team = getTeam(gm);
    expect(team.filter(piece => !piece.isRecruit).length).toBe(1);
    expect(team.filter(piece => piece.isRecruit).map(({ avatar }) => avatar)).toEqual(['punk']);
    expect(gm.giantPiece.color).toBeDefined();
    storage.clear();
  });

  it('marches for the city; reaching it loses the fight', () => {
    GIANT_KAIJU.marchRowsPerSecond = 40;
    GIANT_KAIJU.attackEveryMs = Infinity;
    const gm = makeFinal();
    getTeam(gm).forEach(piece => { piece.isUnhurtable = true; });
    for (let k = 0; k < 600 && gm.getGameResult() === null; k += 1) gm.stepPieces();
    expect(gm.giant.getIsAtCity()).toBe(true);
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
  });

  it('the team\'s powers on its weak spot drain it, and stagger it; the weak spot moves on', () => {
    const gm = makeFinal();
    const { lives } = gm.giantPiece;
    const part = gm.giant.getPart().id;
    for (let k = 0; k < GIANT_KAIJU.hitsPerPart; k += 1) hitWeakSpot(gm);
    expect(gm.giantPiece.lives).toBe(lives - GIANT_KAIJU.hitsPerPart);
    expect(gm.giant.getPart().id).not.toBe(part);
  });

  it('waves of 5, 7 and 10 Kaiju come to protect it as it drains', () => {
    const gm = makeFinal();
    const getKaiju = () => gm.getPieces().filter(piece => piece.avatar == 'kaiju' && !piece.isGiant).length;
    expect(getKaiju()).toBe(0);
    while (gm.giantPiece.lives / gm.giantPiece.maxLives > 0.74) hitWeakSpot(gm);
    expect(getKaiju()).toBe(5);
    while (gm.giantPiece.lives / gm.giantPiece.maxLives > 0.24) hitWeakSpot(gm);
    expect(getKaiju()).toBe(22);
  });

  it('drained, the ray gun brings the teammate back, and the city is saved', () => {
    const gm = makeFinal();
    while (!gm.isGiantDraining) hitWeakSpot(gm);
    expect(gm.giantPiece.isDead).toBe(false);
    expect(gm.cutscene).toBeDefined();
    for (let k = 0; k < 400 && gm.cutscene; k += 1) gm.stepPieces();
    expect(gm.restoredTeammate).toBeDefined();
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });
});
