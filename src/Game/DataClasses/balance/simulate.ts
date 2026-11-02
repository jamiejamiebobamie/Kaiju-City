import { GAME_TICK, PIECES_INFO, Difficulty, TILE_STATUSES_AND_ABILITY_DATA } from 'Utils/gameState';
import { GameManager } from '../GameManager';
import { SettingsManager } from '../SettingsManager';
import { LEVELS } from '../Levels/levels';

/*
  AI against AI, with no browser, to compare the powers.
  'edits' are ability changes by applied status, and go through the same edits an ability editor would make.
*/
export const POWERS = TILE_STATUSES_AND_ABILITY_DATA.map(({ element }) => element).filter((element, index, all) => element != 'kaijuFire' && all.indexOf(element) == index);

const ATTACK_POWERS = ['ice', 'fire', 'water', 'wood', 'lightning', 'death', 'charm'];
const VERSUS_LIMIT_MS = 120000;
const KAIJU_LIMIT_MS = 300000;
const KAIJU_TO_WIN = 20;
const TOP_SPOTS = [{ x: 230, y: 160 }, { x: 260, y: 190 }];
const BOTTOM_SPOTS = [{ x: 230, y: 660 }, { x: 200, y: 630 }];

const seedRandom = (seed: number) => {
  let state = seed;
  Math.random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

// three powers, at least one of them an attack: a kit that can't hurt anyone tells us nothing
const getKit = () => {
  for (;;) {
    const kit = [...POWERS].sort(() => Math.random() - 0.5).slice(0, 3);
    if (kit.some(power => ATTACK_POWERS.includes(power))) return kit;
  }
};

export const getTeamKits = () => [getKit(), getKit()];

const makeGame = (level, killsToWin, edits) => {
  const settingsManager = new SettingsManager();
  settingsManager.setAbilityEdits(edits);
  settingsManager.setSortedPlayerChosenAbilityElementsString([]);
  settingsManager.setIsTeammate(true);
  settingsManager.setDifficulty(Difficulty.Hard);
  const gm = new GameManager({ level, settingsManager, killsToWin });
  gm.initGame();
  return gm;
};

const useKits = (gm, pieces, kits) => pieces.forEach((piece, index) => {
  piece.isNpc = true;
  piece.abilities = gm.settingsManager.getAbilitiesFromElements(kits[index]);
});

const play = (gm, limitMs) => {
  let pieceMs = 0;
  let tileMs = 0;
  for (let ms = 0; ms < limitMs && gm.getGameResult() === null; ms += GAME_TICK.pieceMs) {
    gm.stepPieces();
    pieceMs += GAME_TICK.pieceMs;
    for (tileMs += GAME_TICK.pieceMs; tileMs >= GAME_TICK.tileMs; tileMs -= GAME_TICK.tileMs) gm.stepTiles();
  }
  return { result: gm.getGameResult(), timeMs: gm.getAccTime() };
};

// 1 if the first team won, 0 if the second did, 0.5 if time ran out
export const playVersus = ({ teamKits, otherKits, seed, edits = {} }) => {
  seedRandom(seed);
  const level = { ...LEVELS.peninsula, kaijuEntry: undefined };
  const gm = makeGame(level, 2, edits);
  const board = gm.gameBoardManager;
  const team = gm.getPieces().slice(0, 2);
  const [{ maxLives, moveSpeed }] = team;
  const others = BOTTOM_SPOTS.map(spot => {
    const piece = gm.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO.punk, abilities: [], maxLives, moveSpeed }, teamIndex: 1 });
    piece.initCharLocation(true, board.getClosestWalkableTileToLocation(spot));
    return piece;
  });
  team.forEach((piece, index) => piece.initCharLocation(true, board.getClosestWalkableTileToLocation(TOP_SPOTS[index])));
  useKits(gm, team, teamKits);
  useKits(gm, others, otherKits);
  const { result, timeMs } = play(gm, VERSUS_LIMIT_MS);
  return { score: result === null ? 0.5 : result === 0 ? 1 : 0, timeMs };
};

export const playKaiju = ({ teamKits, seed, edits = {} }) => {
  seedRandom(seed);
  const gm = makeGame({ ...LEVELS.peninsula }, KAIJU_TO_WIN, edits);
  useKits(gm, gm.getPieces().slice(0, 2), teamKits);
  const { result, timeMs } = play(gm, KAIJU_LIMIT_MS);
  return { isWin: result === 0, isLoss: result === -1, kills: gm.score, timeMs };
};
