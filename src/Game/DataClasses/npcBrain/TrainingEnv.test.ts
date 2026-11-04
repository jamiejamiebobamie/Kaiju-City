import { NUM_ACTIONS, OBSERVATION_SIZE, decodeAction } from './brain';
import { TRAINING, TrainingEnv } from './TrainingEnv';

describe('NPC training', () => {
  it('an episode gives observations of the agreed size, a mask, and ends', () => {
    const env = new TrainingEnv();
    let result = env.reset({ seed: 7, kind: 'versus' });
    expect(result.observation.length).toBe(OBSERVATION_SIZE);
    expect(result.actionMask.length).toBe(NUM_ACTIONS);
    expect(result.observation.every(Number.isFinite)).toBe(true);
    let steps = 0;
    while (!result.terminated && !result.truncated && steps < 2000) {
      const legal = result.actionMask.map((isLegal, action) => isLegal ? action : -1).filter(action => action >= 0);
      result = env.step(legal[(steps * 7) % legal.length]);
      steps += 1;
    }
    expect(result.terminated || result.truncated).toBe(true);
  });

  it('the learner moves where it is told and uses the power it picks', () => {
    const env = new TrainingEnv();
    let result = env.reset({ seed: 3, kind: 'versus' });
    const start = { ...env.learner.getTileIndex() };
    const moveDown = result.actionMask.findIndex((isLegal, action) => isLegal && decodeAction(action).move > 0 && decodeAction(action).power == 0);
    for (let k = 0; k < 4; k++) result = env.step(moveDown);
    expect(env.learner.getTileIndex()).not.toEqual(start);
    const castFirst = result.actionMask.findIndex((isLegal, action) => isLegal && decodeAction(action).move == 0 && decodeAction(action).power == 1);
    expect(castFirst).toBeGreaterThanOrEqual(0);
    env.step(castFirst);
    expect(env.learner.abilities[0].accTime).toBeGreaterThan(0);
  });

  it('losing a real life costs 1, and a death costs every life left', () => {
    const env = new TrainingEnv();
    env.reset({ seed: 5, kind: 'versus', aggression: 0.5 });
    const { learner } = env;
    learner.lives -= 1;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeLost + TRAINING.perDecision);
    // fragile from a passive, they die with lives still left: all of them count
    learner.isDead = true;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeLost * (learner.maxLives - 1) + TRAINING.perDecision);
  });

  it('a life taken counts only when the learner cast what hit them', () => {
    const env = new TrainingEnv();
    env.reset({ seed: 9, kind: 'versus', aggression: 0.5 });
    const [opponent] = env.getOpponents();
    opponent.lives -= 1;
    opponent.lastHitBy = env.learner.pieceIndex + 1;
    expect(env.getReward()).toBeCloseTo(TRAINING.perDecision);
    opponent.lives -= 1;
    opponent.lastHitBy = env.learner.pieceIndex;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeTaken + TRAINING.perDecision);
  });

  it('a match against the Kaiju runs, and a Kaiju life taken counts like any other', () => {
    const env = new TrainingEnv();
    let result = env.reset({ seed: 11, kind: 'kaiju', aggression: 0.5 });
    let steps = 0;
    while (!env.getOpponents().some(piece => piece.isOnTiles) && steps < 400) {
      result = env.step(0);
      steps += 1;
    }
    const kaiju = env.getOpponents().find(piece => piece.isOnTiles);
    expect(kaiju.avatar).toBe('kaiju');
    expect(result.observation.length).toBe(OBSERVATION_SIZE);
    env.getReward();
    kaiju.lives -= 1;
    kaiju.lastHitBy = env.learner.pieceIndex;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeTaken + TRAINING.perDecision);
  });

  it('aggression is the last input, and leans the rewards', () => {
    const env = new TrainingEnv();
    const result = env.reset({ seed: 5, kind: 'versus', aggression: 1 });
    expect(result.observation[OBSERVATION_SIZE - 1]).toBe(1);
    const nearness = () => TRAINING.nearness * Math.max(1 - env.getNearestRows() / TRAINING.nearRows, 0);
    env.learner.lives -= 1;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeLost * (1 - TRAINING.aggressionLean) + TRAINING.perDecision + nearness());
    env.learner.aggression = 0;
    const [opponent] = env.getOpponents();
    opponent.lives -= 1;
    opponent.lastHitBy = env.learner.pieceIndex;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeTaken * (1 - TRAINING.aggressionLean) + TRAINING.perDecision - nearness());
  });

  it('sides come in different sizes, and the NPC sees how many are on each', () => {
    const env = new TrainingEnv();
    const result = env.reset({ seed: 13, kind: 'versus', sizes: { allies: 3, opponents: 5 } });
    const team = env.gm.getPieces().filter(piece => piece.teamIndex == env.learner.teamIndex);
    expect(team.length).toBe(4);
    expect(env.getOpponents().length).toBe(5);
    expect(env.gm.getKillsToWin()).toBe(5);
    expect(team.every(piece => piece.isNpc && piece.abilities.length == 3)).toBe(true);
    expect(result.observation.slice(-3, -1)).toEqual([3 / 5, 5 / 5]);
  });
});
