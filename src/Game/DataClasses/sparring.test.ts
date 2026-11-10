import { describe, expect, it } from 'vitest';
import { LEVELS, SPARRING, TRAINING_PHASE, getSparringLevelId, getVisitLevelId } from './Levels/levels';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { storage } from 'Utils/storage';

// sparring with the teammate (Jamie, 2026-11-10)
const makeGame = (level, options: any = {}) => {
  const settingsManager = new SettingsManager();
  settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Metal']);
  settingsManager.setIsTeammate(options.isTeammate ?? true);
  settingsManager.setTeammateAvatar('girl');
  const gm: any = new GameManager({ level, settingsManager, ...options });
  gm.initGame();
  return gm;
};

describe('sparring with the teammate', () => {
  it('with the bystander terminated, the teammate offers to spar on a visit; then Do Training opens', () => {
    storage.clear();
    const gm = makeGame(LEVELS[getVisitLevelId('rooftop')], { terminated: ['black_female'] });
    expect(gm.getSparringOffer()).toBeDefined();
    const said = [];
    for (let k = 0; k < 4000 && gm.cutscene; k++) {
      if (gm.speech && !said.includes(gm.speech.text)) said.push(gm.speech.text);
      gm.stepPieces();
    }
    expect(said).toContain('We could fight each other. Become tougher...');
    expect(gm.getActivePhases()).toContain(TRAINING_PHASE);
    expect(gm.trainingLevelId).toBe(getSparringLevelId('rooftop'));
    // not without the termination
    expect(makeGame(LEVELS[getVisitLevelId('rooftop')]).getSparringOffer()).toBeUndefined();
  });

  it('the sparring fight: the teammate, one on one, as tough as they have become; beating them wins', () => {
    const gm = makeGame(LEVELS[getSparringLevelId('rooftop')], { isTeammate: false, bonusLives: 3 });
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    gm.stepPieces();
    const rival = gm.rivalPiece;
    expect(rival.avatar).toBe('girl');
    expect(rival.maxLives).toBe(4 + 3);
    expect(gm.objective && gm.objective.text).toBe(`Defeat ${gm.getTeammateName()}`);
    gm.accTime += 5000;
    rival.lastDmgAccTime = 0;
    rival.decrementHealth(gm.accTime, rival.lives + rival.livesModifier);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('health won sparring is the player’s and the teammate’s both, up to 20', () => {
    const gm = makeGame(LEVELS.peninsula, { bonusLives: 5 });
    const [player, teammate] = gm.getPieces();
    expect(player.maxLives).toBe(9);
    expect(player.lives).toBe(9);
    expect(teammate.maxLives).toBe(9);
    const capped = makeGame(LEVELS.peninsula, { bonusLives: 40 });
    expect(capped.getPieces()[0].maxLives).toBe(SPARRING.maxPlayerLives);
    // at the cap, no more sparring offers
    const visit = makeGame(LEVELS[getVisitLevelId('rooftop')], { terminated: ['black_female'], bonusLives: 40 });
    expect(visit.getSparringOffer()).toBeUndefined();
  });
});
