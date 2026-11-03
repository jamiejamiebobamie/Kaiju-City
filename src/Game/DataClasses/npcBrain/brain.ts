import { TILE_DIRS, TILE_STATUSES_AND_ABILITY_DATA } from 'Utils/gameState';

/*
  A trained NPC's senses and controls, shared by the training bridge and the game.
  An action is one move (stay, or a step in one of the six tile directions) and one power (none, or one of the piece's three).
  The observation is what the NPC knows about itself, the closest pieces, and the tiles around it, as numbers near -1 to 1.
  Changing either one means training a new model: keep OBSERVATION_VERSION in step.
*/
export const OBSERVATION_VERSION = 1;

export const MOVES = ['stay', ...TILE_DIRS];
export const DECISION_TICKS = 3; // a trained NPC chooses every few piece ticks: about three times a second
export const POWER_SLOTS = 3;
export const NUM_ACTIONS = MOVES.length * (POWER_SLOTS + 1);

// every power, in a fixed order, so the NPC can tell its powers apart
export const ELEMENTS = TILE_STATUSES_AND_ABILITY_DATA.map(({ element }) => element).filter((element, index, all) => all.indexOf(element) == index);

const SCALE = {
  lives: 6,
  livesModifier: 3,
  speed: 3,
  tiles: 12, // distances, in rows
  stacks: 4
};

export const decodeAction = (action: number) => ({ move: Math.floor(action / (POWER_SLOTS + 1)), power: action % (POWER_SLOTS + 1) });

const step = (proxy, tile, dir) => {
  const offset = proxy.getTileOffsetFromDir(dir, tile);
  return { i: tile.i + offset.i, j: tile.j + offset.j };
};

// the tiles around a piece, always in the same order: the six beside it, then the twelve beyond those
export const getNearbyTiles = (proxy, tile) => {
  const ring = TILE_DIRS.map(dir => step(proxy, tile, dir));
  const straight = TILE_DIRS.map((dir, k) => step(proxy, ring[k], dir));
  const between = TILE_DIRS.map((dir, k) => step(proxy, ring[k], TILE_DIRS[(k + 1) % TILE_DIRS.length]));
  return [tile, ...ring, ...straight, ...between];
};

const getIsPowerReady = (piece, ability, proxy, accTime) =>
  !!ability && !proxy.getIsPowersOff(piece) && !ability.getIsOnCooldown(accTime, piece.isNpc) && !piece.getHasUsedOneAbility(accTime);

// which actions make sense right now: no walking off the tiles, no power that isn't ready
export const getActionMask = (piece, proxy, accTime) => {
  const moves = MOVES.map((move, k) => k == 0 || proxy.getIsInBounds(step(proxy, piece.getTileIndex(), move)));
  const powers = [true, ...Array.from({ length: POWER_SLOTS }, (_, k) => getIsPowerReady(piece, piece.abilities[k], proxy, accTime))];
  return moves.flatMap(isMove => powers.map(isPower => isMove && isPower));
};

const oneHot = (index, size) => Array.from({ length: size }, (_, k) => (k == index ? 1 : 0));

const describePower = (piece, ability, accTime) => {
  if (!ability) return Array(ELEMENTS.length + 5).fill(0);
  const data = ability.gameBoardPieceAbilityData;
  const cooldown = piece.isNpc ? data.cooldownTimeAI : data.cooldownTimePlayer;
  const sinceCast = ability.accTime ? accTime - ability.accTime : Infinity;
  const passiveMs = data.passiveDurationTime || data.cooldownTimeAI;
  return [
    ...oneHot(ELEMENTS.indexOf(data.element), ELEMENTS.length),
    ability.getIsOnCooldown(accTime, piece.isNpc) ? 0 : 1,
    Math.min(Math.max(1 - sinceCast / cooldown, 0), 1), // cooldown still to go
    ability.isPassiveApplied ? 1 : 0,
    ability.isPassiveApplied ? Math.min(Math.max(1 - sinceCast / passiveMs, 0), 1) : 0, // passive time still to go
    (ability.stacks || 0) / SCALE.stacks
  ];
};

const describePiece = (piece, other, rowPx) => !other ? [0, 0, 0, 0, 0] : [
  1,
  (other.charLocation.x - piece.charLocation.x) / rowPx / SCALE.tiles,
  (other.charLocation.y - piece.charLocation.y) / rowPx / SCALE.tiles,
  other.lives / SCALE.lives,
  (other.livesModifier || 0) / SCALE.livesModifier
];

const byDistance = piece => (a, b) =>
  Math.hypot(a.charLocation.x - piece.charLocation.x, a.charLocation.y - piece.charLocation.y)
  - Math.hypot(b.charLocation.x - piece.charLocation.x, b.charLocation.y - piece.charLocation.y);

// 'gm': the GameManager. health passives (Haunt's Lichdom, Overgrowth's Healthy) show as 'livesModifier' and as passive time left.
export const observe = (gm, piece) => {
  const proxy = gm.gameManagerProxy;
  const board = gm.gameBoardManager;
  const accTime = gm.getAccTime();
  const rowPx = gm.level.grid.rowStep * gm.level.grid.scale;
  const living = gm.getPieces().filter(other => other != piece && !other.isDead && other.isOnTiles && other.avatar != 'extra');
  const enemies = living.filter(other => other.teamIndex != piece.teamIndex).sort(byDistance(piece));
  const allies = living.filter(other => other.teamIndex == piece.teamIndex).sort(byDistance(piece));
  const enemyTiles = new Set(enemies.map(({ tileIndex: { i, j } }) => `${i} ${j}`));
  const tiles = getNearbyTiles(proxy, piece.getTileIndex()).flatMap(tile => {
    if (!proxy.getIsInBounds(tile)) return [0, 0, 0, 0];
    const boardTile = board.tiles[tile.i][tile.j];
    const amount = boardTile.tileStatus ? boardTile.getDmgAmt() : 0;
    const isAimedAtMe = boardTile.getIsDmgTile(piece.teamIndex);
    return [1, isAimedAtMe && amount > 0 ? 1 : 0, isAimedAtMe && amount < 0 ? 1 : 0, enemyTiles.has(`${tile.i} ${tile.j}`) ? 1 : 0];
  });
  return [
    piece.lives / SCALE.lives,
    (piece.livesModifier || 0) / SCALE.livesModifier,
    (piece.moveSpeedModifier || 0) / SCALE.speed,
    piece.isCharmed ? 1 : 0,
    (piece.slipperyModifier || 0) > 0 ? 1 : 0,
    ...Array.from({ length: POWER_SLOTS }, (_, k) => describePower(piece, piece.abilities[k], accTime)).flat(),
    ...describePiece(piece, enemies[0], rowPx),
    ...describePiece(piece, enemies[1], rowPx),
    ...describePiece(piece, allies[0], rowPx).slice(0, 4),
    ...tiles
  ];
};

export const OBSERVATION_SIZE = 5 + POWER_SLOTS * (ELEMENTS.length + 5) + 5 + 5 + 4 + 19 * 4;

/*
  The piece acts on its latest action: it steps one tile when it is between tiles, and uses the power once.
  Called from the piece's own move, in place of the rules, whenever it has a brain action.
*/
export const followBrainAction = (piece, accTime) => {
  const proxy = piece.gameManagerProxy;
  const action = piece.brainAction;
  if (piece.isThere) {
    const next = action.move > 0 ? step(proxy, piece.getTileIndex(), MOVES[action.move]) : undefined;
    piece.moveToTiles = next && proxy.getIsInBounds(next) ? [next] : [];
  }
  if (action.power > 0) {
    const ability = piece.abilities[action.power - 1];
    if (getIsPowerReady(piece, ability, proxy, accTime)) {
      piece.storePassive(ability.useAbility({
        accTime,
        piece,
        registerTimeout: proxy.registerTimeout,
        updateTileWithAbilityStatus: proxy.updateTileWithAbilityStatus
      }));
    }
    action.power = 0; // once per action
  }
};
