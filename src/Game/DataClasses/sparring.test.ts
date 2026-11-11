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
    const gm = makeGame(LEVELS[getSparringLevelId('rooftop')], { isTeammate: false, trainingPoints: { player: 1, teammate: 3 } });
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

  it('training points: each their own, on top of the health, up to 6 (10 in all)', () => {
    const gm = makeGame(LEVELS.peninsula, { trainingPoints: { player: 5, teammate: 2 } });
    const [player, teammate] = gm.getPieces();
    expect(player.maxLives).toBe(9);
    expect(player.lives).toBe(9);
    expect(teammate.maxLives).toBe(6);
    const capped = makeGame(LEVELS.peninsula, { trainingPoints: { player: 40, teammate: 40 } });
    expect(capped.getPieces()[0].maxLives).toBe(SPARRING.maxPlayerLives);
    expect(SPARRING.maxPlayerLives).toBe(10);
    // at the cap, no more sparring offers
    const visit = makeGame(LEVELS[getVisitLevelId('rooftop')], { terminated: ['black_female'], trainingPoints: { player: 40, teammate: 40 } });
    expect(visit.getSparringOffer()).toBeUndefined();
  });

  it('training points go first when hit, for good: healing does not bring them back', () => {
    const gm = makeGame(LEVELS.peninsula, { trainingPoints: { player: 3, teammate: 1 } });
    const [player] = gm.getPieces();
    gm.accTime += 5000;
    player.lastDmgAccTime = 0;
    player.decrementHealth(gm.accTime, 2);
    expect(player.lives).toBe(5);
    expect(player.maxLives).toBe(5);
    player.decrementHealth(gm.accTime + 5000, -3);
    expect(player.lives).toBe(5);
    expect(gm.getTrainingPoints()).toEqual({ player: 1, teammate: 1 });
  });

  it('back from sparring won: the card and glow first, the player held still; then "Good job..." and Do Training', () => {
    storage.clear();
    const gm = makeGame(LEVELS[getVisitLevelId('rooftop')], { terminated: ['black_female'], healthReward: true, trainingOutcome: { isSparring: true }, trainingPoints: { player: 1, teammate: 1 } });
    expect(gm.cutscene).toBeFalsy();
    const [player] = gm.getPieces();
    expect(player.isHeld).toBe(true);
    expect(gm.getPlayerInputHandler().getPressedDir()).toBe('idle');
    for (let k = 0; k < 2000 && !gm.cutscene; k++) gm.stepPieces();
    expect(gm.speech.text).toMatch(/^Good job/);
    for (let k = 0; k < 4000 && gm.cutscene; k++) gm.stepPieces();
    expect(gm.getActivePhases()).toContain(TRAINING_PHASE);
    expect(player.isHeld).toBe(false);
  });

  it('sparred here before: "Want to go again?"', () => {
    storage.clear();
    const gm = makeGame(LEVELS[getVisitLevelId('rooftop')], { terminated: ['black_female'], sparredHere: true });
    expect(gm.speech.text).toBe('Want to go again?');
  });

  it('a training fight goes back to its walking battleground', () => {
    expect((LEVELS[getSparringLevelId('rooftop')] as any).visitLevelId).toBe(getVisitLevelId('rooftop'));
  });
});
