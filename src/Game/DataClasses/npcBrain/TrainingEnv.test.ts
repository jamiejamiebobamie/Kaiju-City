import { NUM_ACTIONS, OBSERVATION_SIZE, decodeAction } from './brain';
import { TRAINING, TrainingEnv } from './TrainingEnv';

describe('NPC training', () => {
  it('an episode gives observations of the agreed size, a mask, and ends', () => {
    const env = new TrainingEnv();
    let result = env.reset({ seed: 7 });
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
    let result = env.reset({ seed: 3 });
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
    env.reset({ seed: 5 });
    const { learner } = env;
    learner.lives -= 1;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeLost + TRAINING.perDecision);
    // fragile from a passive, they die with lives still left: all of them count
    learner.isDead = true;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeLost * (learner.maxLives - 1) + TRAINING.perDecision);
  });

  it('a life taken counts only when the learner cast what hit them', () => {
    const env = new TrainingEnv();
    env.reset({ seed: 9 });
    const [opponent] = env.opponents;
    opponent.lives -= 1;
    opponent.lastHitBy = env.learner.pieceIndex + 1;
    expect(env.getReward()).toBeCloseTo(TRAINING.perDecision);
    opponent.lives -= 1;
    opponent.lastHitBy = env.learner.pieceIndex;
    expect(env.getReward()).toBeCloseTo(TRAINING.lifeTaken + TRAINING.perDecision);
  });
});
