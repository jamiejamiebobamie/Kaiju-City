import { GAME_TICK, PIECES_INFO } from 'Utils/gameState';
import { LEVELS } from '../Levels/levels';
import { BOTTOM_SPOTS, getKit, KAIJU_LIMIT_MS, KAIJU_TO_WIN, makeGame, seedRandom, TOP_SPOTS, useKits, VERSUS_LIMIT_MS } from '../balance/simulate';
import { DECISION_TICKS, decodeAction, getActionMask, getAggression, observe } from './brain';

/*
  One NPC learning to fight on the Peninsula. The learner is the first piece of the top team; its allies play by the rules.
  Sides come in different sizes, as in the Agent fights with recruits along: the learner has 1 to 4 allies.
  Each match is one of two kinds:
  - 'versus': against 1 to 5 opponents, with no Kaiju, until one side has all fallen. The opponents play by the rules.
  - 'kaiju': against the Kaiju waves, until 20 Kaiju fall or the team does.
  Every piece on the team (and each opponent in a versus) has three random powers, one of them at least an attack.
  The learner chooses every few game ticks, about three times a second, as the game's own NPCs would.

  Rewards, as agreed with Jamie:
  - a real life lost: -1. a death also costs the lives still left, so a health passive that leaves it fragile
    (Haunt's Lichdom) only costs anything when it gets the learner killed sooner.
  - a real life taken from an opponent (a Kaiju too) with the learner's own power: +1, and its lives still left if that kills them.
  - an extra life from a passive (Overgrowth's Healthy) earns nothing: it only saves real lives.
  - casting a power earns nothing on its own.
  - the team winning: +3. a little is lost for each decision, so it doesn't hang back for ever.

  Aggression (0 to 1, random each match, and one of the NPC's inputs) leans those rewards. At 0.5 they are exactly the above.
  Towards 1, lives taken are worth more, lives lost cost less, and being near an opponent earns a little each decision.
  Towards 0, the reverse: lives lost cost more, and being near an opponent costs a little.
*/
export const TRAINING = {
  ticksPerDecision: DECISION_TICKS,
  lifeLost: -1,
  lifeTaken: 1,
  win: 3,
  perDecision: -0.002,
  timeLimitMs: { versus: VERSUS_LIMIT_MS, kaiju: KAIJU_LIMIT_MS },
  kaijuShare: 0.35, // the share of matches against the Kaiju
  allies: { min: 1, max: 4 },
  opponents: { min: 1, max: 5 },
  aggressionLean: 0.5, // at aggression 1, lives taken are worth 1.5 and lives lost cost 0.5 (the reverse at 0)
  nearness: 0.005, // at aggression 1, earned each decision right beside an opponent, less further away
  nearRows: 8 // no nearness at this distance or more
};

export type MatchKind = 'versus' | 'kaiju';
export type TeamSizes = { allies: number; opponents: number };

const randomCount = ({ min, max }) => min + Math.floor(Math.random() * (max - min + 1));

// starting spots beyond the two that simulate.ts uses, a little apart, along the top or the bottom
const getSpot = (spots, k) => spots[k] ?? { x: spots[0].x + 30 * (k - 1), y: spots[0].y + (k % 2 ? 30 : 0) * (spots == TOP_SPOTS ? 1 : -1) };
type StepResult = { observation: Array<number>; actionMask: Array<boolean>; reward: number; terminated: boolean; truncated: boolean; info: Record<string, unknown> };

// how the learner played, for evaluate.py: how aggressive it was, and what came of it
const newStats = () => ({ decisions: 0, casts: 0, nearestRowsSum: 0, nearestCount: 0, closings: 0, livesTaken: 0, livesLost: 0 });

export class TrainingEnv {
  gm: any;
  learner: any;
  kind: MatchKind = 'versus';
  sizes: TeamSizes = { allies: 1, opponents: 2 };
  aggression = 0.5;
  lastLives = new Map<any, number>();
  lastNearestRows: number | null = null;
  stats = newStats();
  tileMs = 0;
  isBaseline = false;

  /*
    'isBaseline': the learner plays by the rules instead, to compare against.
    'kind', 'aggression' and 'sizes' are random unless given.
  */
  reset({ seed = Math.floor(Math.random() * 2 ** 31), isBaseline = false, kind = undefined as MatchKind | undefined, aggression = undefined as number | undefined, sizes = undefined as TeamSizes | undefined } = {}): StepResult {
    seedRandom(seed);
    this.isBaseline = isBaseline;
    this.kind = kind ?? (Math.random() < TRAINING.kaijuShare ? 'kaiju' : 'versus');
    this.aggression = aggression ?? Math.random();
    this.sizes = sizes ?? { allies: randomCount(TRAINING.allies), opponents: randomCount(TRAINING.opponents) };
    const gm = this.kind == 'kaiju' ? this.makeKaijuMatch() : this.makeVersusMatch();
    this.gm = gm;
    this.learner = gm.getPieces()[0];
    this.learner.aggression = this.aggression;
    this.tileMs = 0;
    this.stats = newStats();
    this.lastNearestRows = this.getNearestRows();
    this.lastLives = new Map([this.learner, ...this.getOpponents()].map(piece => [piece, piece.lives]));
    if (!isBaseline) this.learner.brainAction = { move: 0, power: 0 };
    return { ...this.view(), reward: 0, terminated: false, truncated: false, info: { kit: this.getKit(), kind: this.kind, aggression: this.aggression, ...this.sizes } };
  }

  // the learner, its teammate, and any more allies. They start along the top.
  makeTeam(gm) {
    const [learner, teammate] = gm.getPieces();
    const extras = Array.from({ length: this.sizes.allies - 1 }, () => this.addPiece(gm, 0));
    const team = [learner, teammate, ...extras];
    team.forEach((piece, k) => piece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(getSpot(TOP_SPOTS, k))));
    useKits(gm, team, team.map(() => getKit()));
  }

  addPiece(gm, teamIndex) {
    const [{ maxLives, moveSpeed }] = gm.getPieces();
    return gm.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO.punk, abilities: [], maxLives, moveSpeed }, teamIndex });
  }

  makeVersusMatch() {
    // the team wins once every opponent has fallen
    const gm = makeGame({ ...LEVELS.peninsula, kaijuEntry: undefined }, this.sizes.opponents, {});
    this.makeTeam(gm);
    const opponents = Array.from({ length: this.sizes.opponents }, (_, k) => {
      const piece = this.addPiece(gm, 1);
      piece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(getSpot(BOTTOM_SPOTS, k)));
      return piece;
    });
    useKits(gm, opponents, opponents.map(() => getKit()));
    return gm;
  }

  makeKaijuMatch() {
    const gm = makeGame({ ...LEVELS.peninsula }, KAIJU_TO_WIN, {});
    this.makeTeam(gm);
    return gm;
  }

  // Kaiju come and go, so the opponents are asked for each time
  getOpponents() {
    return this.gm.getPieces().filter(piece => piece.teamIndex != this.learner.teamIndex);
  }

  // in rows, to the closest living opponent on the tiles, or null when there is none
  getNearestRows() {
    const { learner, gm } = this;
    const rowPx = gm.level.grid.rowStep * gm.level.grid.scale;
    const distances = this.getOpponents().filter(piece => !piece.isDead && piece.isOnTiles)
      .map(piece => Math.hypot(piece.charLocation.x - learner.charLocation.x, piece.charLocation.y - learner.charLocation.y) / rowPx);
    return distances.length ? Math.min(...distances) : null;
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
    const castTimes = learner.abilities.map(ability => ability.accTime);
    for (let tick = 0; tick < TRAINING.ticksPerDecision && gm.getGameResult() === null && !learner.isDead; tick += 1) {
      gm.stepPieces();
      for (this.tileMs += GAME_TICK.pieceMs; this.tileMs >= GAME_TICK.tileMs; this.tileMs -= GAME_TICK.tileMs) gm.stepTiles();
    }
    this.stats.decisions += 1;
    this.stats.casts += learner.abilities.filter((ability, k) => ability.accTime !== castTimes[k]).length;
    const reward = this.getReward();
    const result = gm.getGameResult();
    const isWon = result === 0;
    const terminated = result !== null || learner.isDead;
    const truncated = !terminated && gm.getAccTime() >= TRAINING.timeLimitMs[this.kind];
    return {
      ...this.view(),
      reward: reward + (isWon ? TRAINING.win : 0),
      terminated,
      truncated,
      info: { result, isWon, isLearnerDead: learner.isDead, timeMs: gm.getAccTime(), kind: this.kind, aggression: this.aggression, ...this.stats }
    };
  }

  // the change in real lives since the last decision, leaned by aggression, and the nearness reward
  getReward() {
    const lean = (getAggression(this.learner) - 0.5) * 2; // -1 to 1
    let reward = TRAINING.perDecision;
    const lost = piece => {
      const now = piece.isDead ? 0 : piece.lives;
      const before = this.lastLives.get(piece) ?? now; // a Kaiju that just arrived
      this.lastLives.set(piece, now);
      return Math.max(before - now, 0); // a death counts every life still left
    };
    const livesLost = lost(this.learner);
    this.stats.livesLost += livesLost;
    reward += livesLost * TRAINING.lifeLost * (1 - TRAINING.aggressionLean * lean);
    this.getOpponents().forEach(opponent => {
      const taken = lost(opponent);
      if (!taken || opponent.lastHitBy !== this.learner.pieceIndex) return;
      this.stats.livesTaken += taken;
      reward += taken * TRAINING.lifeTaken * (1 + TRAINING.aggressionLean * lean);
    });
    const nearestRows = this.getNearestRows();
    if (nearestRows !== null) {
      reward += TRAINING.nearness * lean * Math.max(1 - nearestRows / TRAINING.nearRows, 0);
      this.stats.nearestRowsSum += nearestRows;
      this.stats.nearestCount += 1;
      if (this.lastNearestRows !== null && nearestRows < this.lastNearestRows - 0.25) this.stats.closings += 1;
    }
    this.lastNearestRows = nearestRows;
    return reward;
  }
}
