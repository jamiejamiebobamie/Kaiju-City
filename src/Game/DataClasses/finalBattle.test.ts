import { afterEach, describe, expect, it } from 'vitest';
import { LEVELS, PENINSULA } from './Levels/levels';
import { GameManager, GameResult, getFinalTurnSpots } from './GameManager';
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

describe('the last fight: the teammate turns', () => {
  const makeLast = (args = {}) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.finalPeninsula, settingsManager, killsToWin: 30, ...args } as any);
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    return gm;
  };

  it('is the last section when the giant is off, after the team’s own radio call (no Agent)', () => {
    const last = CAMPAIGN_SECTIONS[CAMPAIGN_SECTIONS.length - 1];
    if (GIANT_KAIJU.isFinalBattle) return;
    expect(last.levelId).toBe('finalPeninsula');
    expect(last.kills).toBe(30);
    const speakers = last.radio({ powerName: 'Wildfire', choices: {} }).map(({ speaker }) => speaker);
    expect(speakers).not.toContain('agent');
    expect(speakers).toEqual(expect.arrayContaining(['player', 'teammate']));
  });

  it('its Kaiju beaten, the teammate turns into a Kaiju with every power and 10 health; beating it wins', () => {
    const gm = makeLast();
    const [player, teammate] = gm.gameBoardPiecesManager.getTeamPieces(0);
    gm.score = 30;
    expect(gm.getGameResult()).toBe(null);
    gm.stepPieces();
    expect(gm.finalTurnState).toBe('turning');
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    expect(teammate.isVisible).toBe(false);
    const kaiju = gm.teammateKaiju as any;
    expect(kaiju.avatar).toBe('kaiju');
    expect(kaiju.maxLives).toBe(10);
    expect(kaiju.abilities.length).toBeGreaterThanOrEqual(10);
    expect(kaiju.getTeamIndex()).not.toBe(player.getTeamIndex());
    expect(gm.getGameResult()).toBe(null);
    gm.accTime += 5000;
    kaiju.decrementHealth(gm.accTime, kaiju.maxLives);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('the player’s Kaiju downed by the teammate’s loses, though the 30 were beaten', () => {
    const gm = makeLast();
    gm.score = 30;
    gm.stepPieces();
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    gm.accTime += 5000;
    const mine = gm.playerKaiju as any;
    mine.lastDmgAccTime = 0;
    mine.decrementHealth(gm.accTime, mine.lives + mine.livesModifier);
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
  });

  // (Jamie, 2026-11-24) the player turns too, mind intact: their Kaiju, played; their 3 powers on 1 to 3, the rest on 4 to 0
  it('the player turns too: a Kaiju on their side, as much health as the teammate’s, their powers first, every power on 1 to 0', () => {
    const gm = makeLast();
    const [player] = gm.gameBoardPiecesManager.getTeamPieces(0);
    const chosen = player.abilities.map(ability => ability.gameBoardPieceAbilityData.element);
    gm.score = 30;
    gm.stepPieces();
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    const mine = gm.playerKaiju as any;
    expect(mine.avatar).toBe('kaiju');
    expect(mine.getTeamIndex()).toBe(player.getTeamIndex());
    expect(mine.maxLives).toBe(gm.teammateKaiju.maxLives);
    expect(gm.getControlledPiece()).toBe(mine);
    expect(mine.isNpc).toBe(false);
    expect(player.isVisible).toBe(false);
    const elements = mine.abilities.map(ability => ability.gameBoardPieceAbilityData.element);
    expect(elements.slice(0, 3)).toEqual(chosen);
    expect(elements.length).toBe(Math.min(10, gm.getFinalTurnElements().length));
    expect(new Set(elements).size).toBe(elements.length);
    // the player's HUD: the Kaiju's health and powers, under their own face
    const [hud] = gm.gameBoardPiecesManager.getPlayerTeamUiState();
    expect(hud.gender).toBe(player.avatar);
    expect(hud.abilities.length).toBe(elements.length);
    // the number row past 3 casts the Kaiju's other powers (5: the fifth). 0 is the tenth
    expect(elements.length).toBe(10);
    mine.isUnhurtable = true;
    gm.stepPieces(); // (the cutscene's last step done: powers are off in a cutscene)
    expect(gm.cutscene).toBeFalsy();
    gm.accTime += 60000;
    gm.getPlayerInputHandler().usePlayerAbility('Digit5', gm.accTime);
    expect(mine.abilities[4].accTime).toBe(gm.accTime);
    expect(gm.getPlayerInputHandler().getAbilityKeyInputMapping(9)).toBe('Digit0');
  });

  it('the player’s Kaiju is the player’s own kind of piece, and the arrow keys walk it (playtest 38: it stood still)', () => {
    const gm = makeLast();
    gm.score = 30;
    gm.stepPieces();
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    while (gm.cutscene) gm.stepPieces();
    const mine = gm.playerKaiju as any;
    expect(mine.constructor.name).toBe('GameBoardPieceBase');
    mine.isUnhurtable = true;
    const from = { ...mine.getTileIndex() };
    const input = gm.getPlayerInputHandler() as any;
    input.addKey('ArrowLeft');
    for (let k = 0; k < 60; k += 1) gm.stepPieces();
    input.removeKey('ArrowLeft');
    expect(mine.getTileIndex()).not.toEqual(from);
  });

  it('a retry of the turned fight starts everyone where they turned (playtest 38)', () => {
    const gm = makeLast();
    const [player, teammate] = gm.gameBoardPiecesManager.getTeamPieces(0);
    gm.score = 30;
    gm.stepPieces();
    for (let k = 0; k < 600 && gm.finalTurnState != 'fighting'; k += 1) gm.stepPieces();
    const spots = getFinalTurnSpots();
    expect(spots).toBeTruthy();
    const retry = new GameManager({ level: LEVELS.finalTurnFight, settingsManager: gm.settingsManager } as any);
    retry.initGame();
    const [again, mate] = retry.gameBoardPiecesManager.getTeamPieces(0);
    expect(again.getTileIndex()).toEqual(spots.player);
    expect((retry.playerKaiju as any).getTileIndex()).toEqual(spots.player);
    expect((retry.teammateKaiju as any).getTileIndex()).toEqual(spots.teammate);
    expect(spots.player).toEqual(player.getTileIndex());
    expect(spots.teammate).toEqual(teammate.getTileIndex());
    expect(mate).toBeTruthy();
  });

  it('the recruits still standing turn with the teammate: each says a line, then a Kaiju on its side with their powers and 1 health', () => {
    const gm = makeLast({ recruits: ['punk', 'mermaid'], autoRecruits: ['punk', 'mermaid'] });
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const recruits = gm.getPieces().filter(piece => piece.isRecruit);
    expect(recruits.length).toBe(2);
    const powers = recruits.map(piece => piece.abilities.map(ability => ability.gameBoardPieceAbilityData.element));
    gm.score = 30;
    gm.stepPieces();
    const said = [];
    for (let k = 0; k < 3000 && gm.finalTurnState != 'fighting'; k += 1) {
      const speech = gm.cutscene && gm.cutscene.steps[gm.cutscene.index].speech;
      if (speech && typeof speech == 'object' && !said.includes(speech.text)) said.push(speech.text);
      gm.stepPieces();
    }
    expect(said.some(text => text.includes('fool'))).toBe(true); // the Punk's
    expect(said.some(text => text.includes('scales'))).toBe(true); // the Mermaid's
    const turned = gm.recruitKaiju as any[];
    expect(turned.length).toBe(2);
    turned.forEach((kaiju, index) => {
      expect(kaiju.getTeamIndex()).toBe(gm.teammateKaiju.getTeamIndex());
      expect(kaiju.maxLives).toBe(1);
      expect(kaiju.abilities.map(ability => ability.gameBoardPieceAbilityData.element)).toEqual(powers[index]);
    });
    expect(gm.getFallenRecruits()).toEqual([]); // turned, not fallen
  });

  // (Jamie, 2026-11-24) the teammate fallen: the recruits still standing turn with the player, the city's end
  it('with the teammate fallen, the recruits say their lines and turn with the player; the city is destroyed', () => {
    const gm = makeLast({ recruits: ['punk'], autoRecruits: ['punk'] });
    for (let k = 0; k < 3000 && gm.cutscene; k++) gm.stepPieces();
    const [, teammate] = gm.getPieces();
    teammate.setIsDead(true);
    gm.score = 30;
    gm.stepPieces();
    const said = [];
    for (let k = 0; k < 3000 && gm.finalTurnState != 'destroyed'; k += 1) {
      const speech = gm.cutscene && gm.cutscene.steps[gm.cutscene.index].speech;
      if (speech && typeof speech == 'object' && !said.includes(speech.text)) said.push(speech.text);
      gm.stepPieces();
    }
    expect(gm.finalTurnState).toBe('destroyed');
    expect(said.some(text => text.includes('fool'))).toBe(true); // the Punk's
    expect((gm.recruitKaiju as any[]).length).toBe(1);
    expect(gm.recruitKaiju[0].isUnhurtable).toBe(true);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });
});

// (Jamie, 2026-11-24) lines for one recruit along, or more: "They're still empowered" made no sense with one
describe('lines by how many recruits are along', () => {
  const makeGm = level => {
    const settingsManager = new SettingsManager();
    settingsManager.setIsTeammate(true);
    const gm: any = new GameManager({ level, settingsManager });
    return gm;
  };
  it('one recruit: their name in the line, and the many-recruits line left out', () => {
    const gm = makeGm(LEVELS.sewer1);
    gm.followers = [{ avatar: 'punk' }];
    expect(gm.getIsLineForRecruits({ ifRecruits: true, recruitCount: 'one' })).toBe(true);
    expect(gm.getIsLineForRecruits({ ifRecruits: true, recruitCount: 'many' })).toBe(false);
    expect(gm.fillRecruitName('Look. {recruit} is still empowered.')).toBe('Look. Punk Guy is still empowered.');
    gm.followers = [{ avatar: 'punk' }, { avatar: 'mermaid' }];
    expect(gm.getIsLineForRecruits({ ifRecruits: true, recruitCount: 'one' })).toBe(false);
    expect(gm.getIsLineForRecruits({ ifRecruits: true, recruitCount: 'many' })).toBe(true);
    gm.followers = [];
    expect(gm.getIsLineForRecruits({ ifRecruits: true })).toBe(false);
    expect(gm.getIsLineForRecruits({})).toBe(true);
  });
});

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
    expect(CAMPAIGN_SECTIONS[CAMPAIGN_SECTIONS.length - 1].levelId).toBe(GIANT_KAIJU.isFinalBattle ? 'finalBattle' : 'finalPeninsula');
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

describe('a new life starts clean (playtest 38: respawned Kaiju still Spurned)', () => {
  it('respawning ends Spurned, Charm and wading', () => {
    const gm = makeFinal();
    const piece = gm.getPieces().find(other => other.pieceIndex != 0) as any;
    piece.spurnedBy = 0;
    piece.waterSlowEnds = [gm.accTime + 99999];
    expect(piece.getIsSpurned()).toBe(true);
    piece.respawn(gm.accTime);
    expect(piece.getIsSpurned()).toBe(false);
    expect(piece.waterSlowEnds).toEqual([]);
    expect(piece.getStatusEffects(0).map(({ id }) => id)).not.toContain('spurned');
  });
});
