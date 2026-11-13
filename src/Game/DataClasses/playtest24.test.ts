import { describe, expect, it } from 'vitest';
import { LEVELS } from './Levels/levels';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';

// playtest 24 (Jamie, 2026-11-12)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(true);
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};

describe('playtest 24', () => {
  it('N9: Ghost Girl fighting for the team casts Haunt only while its cost is under half her real health (at least once)', () => {
    const gm = makeGame(LEVELS.peninsula, { autoRecruits: ['black_female'], recruits: ['black_female'] });
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    const ghost = gm.getPieces().find(piece => piece.isRecruit && piece.avatar == 'black_female');
    const haunt = ghost.abilities.find(ability => ability.gameBoardPieceAbilityData.element == 'death');
    const castsAllowed = lives => {
      ghost.lives = lives;
      let casts = 0;
      for (ghost.livesModifier = 0; ghost.getIsCostAffordable(haunt); ghost.livesModifier -= 1) casts += 1;
      return casts;
    };
    expect([4, 3, 2, 1].map(castsAllowed)).toEqual([2, 1, 1, 1]);
    // not the player's own Haunt, nor a rival's
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    player.livesModifier = -5;
    expect(player.getIsCostAffordable(haunt)).toBe(true);
  });

  it('N12: in the Agents\' fight, powers aim only at someone on the caster\'s own floor', () => {
    const gm = makeGame(LEVELS.lab);
    const floor = { i: 10, j: 12 };
    const catwalk = { i: 10, j: 3 };
    const [a, b] = gm.getPieces();
    a.isOnTiles = b.isOnTiles = true;
    a.getTileIndex = () => floor;
    b.getTileIndex = () => catwalk;
    expect(gm.getIsSameFloor(a, b)).toBe(false);
    b.getTileIndex = () => ({ i: 12, j: 14 });
    expect(gm.getIsSameFloor(a, b)).toBe(true);
    expect(makeGame(LEVELS.peninsula).getIsSameFloor(a, { ...b, getTileIndex: () => catwalk })).toBe(true);
  });

  it('N11: the Agent waiting on the catwalk is not the camera\'s, unless the player is up there', () => {
    const gm = makeGame(LEVELS.lab);
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    const agent = { isHeldOnCatwalk: true };
    player.getTileIndex = () => ({ i: 10, j: 12 });
    expect(gm.getIsCameraKeptOff(player, agent)).toBe(true);
    player.getTileIndex = () => ({ i: 10, j: 3 });
    expect(gm.getIsCameraKeptOff(player, agent)).toBe(false);
  });

  it('N10: the Lab with no Agent in it: the way out reads "Search for Agent"', () => {
    expect(LEVELS.labBeforeTrap.sceneElements.find(({ id }) => id == 'exit').label).toBe('Search for Agent');
    expect(LEVELS.labIntro.sceneElements.find(({ id }) => id == 'exit').label).toBe('Exit');
  });

  it('N8: a Lab option\'s key cuts the welcome talk short', () => {
    const gm = makeGame(LEVELS.labIntro);
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    gm.talks = [];
    gm.addSceneTalks(); // (the log's talk: on in the game, a setting off in tests)
    for (let k = 0; k < 40 && !gm.getIsTalking(); k++) gm.stepPieces();
    expect(gm.getIsTalking()).toBe(true);
    expect(gm.skipSceneTalks()).toBe(true);
    expect(gm.getIsTalking()).toBe(false);
  });
});
