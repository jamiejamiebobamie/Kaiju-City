import { GAME_TICK, PIECES_INFO } from 'Utils/gameState';
import { LEVELS } from '../Levels/levels';
import { BOTTOM_SPOTS, getKit, makeGame, seedRandom, TOP_SPOTS, useKits, VERSUS_LIMIT_MS } from '../balance/simulate';
import { DECISION_TICKS, decodeAction, getActionMask, observe } from './brain';

/*
  One NPC learning to fight: a 2 v 2 on the Peninsula with no Kaiju. The learner is the first piece of the top team.
  Its teammate and both opponents play by the rules, each with three random powers, one of them at least an attack.
  The learner chooses every few game ticks, about three times a second, as the game's own NPCs would.

  Rewards, as agreed with Jamie:
  - a real life lost: -1. a death also costs the lives still left, so a health passive that leaves it fragile
    (Haunt's Lichdom) only costs anything when it gets the learner killed sooner.
  - a real life taken from an opponent with the learner's own power: +1, and its lives still left if that kills them.
  - an extra life from a passive (Overgrowth's Healthy) earns nothing: it only saves real lives.
  - casting a power earns nothing on its own.
  - the team winning: +3. a little is lost for each decision, so it doesn't hang back for ever.
*/
export const TRAINING = {
  ticksPerDecision: DECISION_TICKS,
  lifeLost: -1,
  lifeTaken: 1,
  win: 3,
  perDecision: -0.002,
  timeLimitMs: VERSUS_LIMIT_MS
};

type StepResult = { observation: Array<number>; actionMask: Array<boolean>; reward: number; terminated: boolean; truncated: boolean; info: Record<string, unknown> };

export class TrainingEnv {
  gm: any;
  learner: any;
  opponents: Array<any> = [];
  lastLives = new Map<any, number>();
  tileMs = 0;
  isBaseline = false;

  // 'isBaseline': the learner plays by the rules instead, to compare against
  reset({ seed = Math.floor(Math.random() * 2 ** 31), isBaseline = false } = {}): StepResult {
    seedRandom(seed);
    this.isBaseline = isBaseline;
    const gm = makeGame({ ...LEVELS.peninsula, kaijuEntry: undefined }, 2, {});
    const board = gm.gameBoardManager;
    const team = gm.getPieces().slice(0, 2);
    const [{ maxLives, moveSpeed }] = team;
    this.opponents = BOTTOM_SPOTS.map(spot => {
      const piece = gm.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO.punk, abilities: [], maxLives, moveSpeed }, teamIndex: 1 });
      piece.initCharLocation(true, board.getClosestWalkableTileToLocation(spot));
      return piece;
    });
    team.forEach((piece, index) => piece.initCharLocation(true, board.getClosestWalkableTileToLocation(TOP_SPOTS[index])));
    useKits(gm, team, [getKit(), getKit()]);
    useKits(gm, this.opponents, [getKit(), getKit()]);
    this.gm = gm;
    this.learner = team[0];
    this.tileMs = 0;
    this.lastLives = new Map([this.learner, ...this.opponents].map(piece => [piece, piece.lives]));
    if (!isBaseline) this.learner.brainAction = { move: 0, power: 0 };
    return { ...this.view(), reward: 0, terminated: false, truncated: false, info: { kit: this.getKit() } };
  }

  getKit() {
    return this.learner.abilities.map(ability => ability.gameBoardPieceAbilityData.element);
  }

  view() {
    return { observation: observe(this.gm, this.learner), actionMask: getActionMask(this.learner, this.gm.gameManagerProxy, this.gm.getAccTime()) };
  }

  step(action: number): StepResult {
    const { gm, learner } = this;
    if (!this.isBaseline) learner.brainAction = decodeAction(action);
    for (let tick = 0; tick < TRAINING.ticksPerDecision && gm.getGameResult() === null && !learner.isDead; tick += 1) {
      gm.stepPieces();
      for (this.tileMs += GAME_TICK.pieceMs; this.tileMs >= GAME_TICK.tileMs; this.tileMs -= GAME_TICK.tileMs) gm.stepTiles();
    }
    const reward = this.getReward();
    const result = gm.getGameResult();
    const isWon = result === 0;
    const terminated = result !== null || learner.isDead;
    const truncated = !terminated && gm.getAccTime() >= TRAINING.timeLimitMs;
    return {
      ...this.view(),
      reward: reward + (isWon ? TRAINING.win : 0),
      terminated,
      truncated,
      info: { result, isWon, isLearnerDead: learner.isDead, timeMs: gm.getAccTime() }
    };
  }

  // the change in real lives since the last decision
  getReward() {
    let reward = TRAINING.perDecision;
    const lost = piece => {
      const before = this.lastLives.get(piece);
      const now = piece.isDead ? 0 : piece.lives;
      this.lastLives.set(piece, now);
      return Math.max(before - now, 0); // a death counts every life still left
    };
    reward += lost(this.learner) * TRAINING.lifeLost;
    this.opponents.forEach(opponent => {
      const taken = lost(opponent);
      if (taken && opponent.lastHitBy === this.learner.pieceIndex) reward += taken * TRAINING.lifeTaken;
    });
    return reward;
  }
}
