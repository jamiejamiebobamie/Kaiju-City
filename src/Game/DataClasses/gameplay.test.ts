import { GAME_TICK } from 'Utils/gameState';
import { MASTER_PENINSULA_TILES as PENINSULA_TILE_LOOKUP_VALS } from './masterPeninsula';
import { GameLoop } from './GameLoop';
import { GameManager, GameResult } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { LEVELS } from './Levels/levels';
import { setIsClickThrough, setIsDialogueLog } from './DialogueLog';
import { TimeoutHandler } from './TimeoutHandler';
import { findPath } from './GameBoard/findPath';
import { CENTER_TILE, getLitTiles, makeGame, placePiece, putStatusOnTile } from './testHelpers';
import { getThrowVec, startRagdoll, stepRagdoll } from './Ragdoll';
import { KAIJU_SPEED, setKaijuSpeedMode } from './KaijuSpeedTest';
import { BUBBLE_DRAWBACKS, setIsDrawbackOn } from './BubbleTest';

const useAbility = ({ gm, player }, abilityIndex) => {
  const ability = player.abilities[abilityIndex];
  ability.useAbility({
    accTime: gm.accTime || 1,
    piece: player,
    registerTimeout: gm.gameManagerProxy.registerTimeout,
    updateTileWithAbilityStatus: gm.gameManagerProxy.updateTileWithAbilityStatus
  });
};

describe('aiming', () => {
  const { i, j } = CENTER_TILE;
  const aims = [
    { name: 'up', target: { i, j: j - 4 }, dir: 'up' },
    { name: 'down', target: { i, j: j + 4 }, dir: 'down' },
    { name: 'down right', target: { i: i + 4, j: j + 4 }, dir: 'down right' },
    { name: 'up left', target: { i: i - 4, j: j - 4 }, dir: 'up left' }
  ];
  aims.forEach(({ name, target, dir }) => {
    it(`shoots ${name} at an enemy ${name}`, () => {
      const { board } = makeGame();
      const [, dirs] = board.getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex: CENTER_TILE, toTileIndex: target, numTiles: 1 });
      expect(dirs).toEqual([dir]);
    });
  });

  it('lands an ability between the player and the Kaiju', () => {
    const game = makeGame({ kaijuTile: { i, j: j + 4 } });
    useAbility(game, 0);
    expect(getLitTiles(game.gm)[0].tileIndex).toEqual({ i, j: j + 1 });
  });

  it('shoots the way the piece is facing with no enemy on the board', () => {
    const game = makeGame();
    game.kaiju.isDead = true;
    game.player.setDir('up');
    game.player.setDir('idle');
    useAbility(game, 0);
    expect(getLitTiles(game.gm)[0].tileIndex).toEqual({ i, j: j - 1 });
  });

  it('applies the range and area passives', () => {
    const game = makeGame({ kaijuTile: { i, j: j + 4 } });
    game.player.tileCountModifier = 2;
    useAbility(game, 0);
    const { range } = game.settingsManager.getAbilityAndTileStatusData().isOnFire;
    expect(getLitTiles(game.gm)[0].getCurrCount()).toBe(range + 2);
  });
});

describe('damage, healing and death', () => {
  const { i, j } = CENTER_TILE;

  it('statuses damage enemies, but not teammates', () => {
    const { gm, board, player, kaiju } = makeGame({ kaijuTile: { i, j: j + 2 } });
    putStatusOnTile(gm, 'isOnFire', kaiju.tileIndex, { dirs: ['down'], teamIndex: 0 });
    putStatusOnTile(gm, 'isOnFire', player.tileIndex, { dirs: ['down'], teamIndex: 0 });
    expect(board.getDmg(kaiju.pieceIndex)).toBe(1);
    expect(board.getDmg(player.pieceIndex)).toBe(0);
  });

  it('decrements and heals lives', () => {
    const { player } = makeGame();
    player.decrementHealth(5000, 1);
    expect(player.lives).toBe(player.maxLives - 1);
    player.decrementHealth(7000, -1);
    expect(player.lives).toBe(player.maxLives);
    player.decrementHealth(9000, -1);
    expect(player.lives).toBe(player.maxLives);
  });

  it('takes from extra lives first', () => {
    const { player } = makeGame();
    player.livesModifier = 1;
    player.decrementHealth(5000, 1);
    expect(player.livesModifier).toBe(0);
    expect(player.lives).toBe(player.maxLives);
  });

  it('only lands one hit per damage interval: 1 second for players, 400ms for Kaiju', () => {
    const { player, kaiju } = makeGame();
    player.decrementHealth(1000, 1);
    player.decrementHealth(1500, 1);
    expect(player.lives).toBe(player.maxLives - 1);
    kaiju.decrementHealth(1000, 1);
    kaiju.decrementHealth(1500, 1);
    expect(kaiju.lives).toBe(kaiju.maxLives - 2);
  });

  it('a Kaiju on the same tile hurts the player, and takes no damage itself', () => {
    const { board, player, kaiju } = makeGame({ kaijuTile: CENTER_TILE });
    expect(board.getDmg(player.pieceIndex)).toBe(1);
    expect(board.getDmg(kaiju.pieceIndex)).toBe(0);
  });

  it('a dead piece dies, leaves remains, and scores', () => {
    const { gm, kaiju, piecesManager } = makeGame();
    kaiju.lives = 1;
    kaiju.decrementHealth(5000, 1);
    expect(kaiju.getIsDead()).toBe(true);
    expect(gm.score).toBe(1);
    expect(piecesManager.getDeathPieces().length).toBe(1);
  });
});

describe('abilities', () => {
  it('a Kaiju shoots fire when its cooldown ends, and not before', () => {
    const { i, j } = CENTER_TILE;
    const { gm, kaiju } = makeGame({ kaijuTile: { i, j: j + 2 } });
    kaiju.useAbilities(100);
    expect(getLitTiles(gm).length).toBe(0);
    kaiju.useAbilities(9001);
    expect(getLitTiles(gm)[0].getAppliedStatus()).toBe('isOnKaijuFire');
  });

  it('heal finds the most damaged teammate', () => {
    const { gm, player } = makeGame({ isTeammate: true });
    const teammate = gm.getPieces()[1];
    teammate.lives = 1;
    expect(gm.gameManagerProxy.getMostDmgedTeammate(player.pieceIndex)).toBe(teammate);
  });

  it('cannot be used again until its cooldown ends', () => {
    const { gm } = makeGame();
    const input = gm.getPlayerInputHandler();
    input.usePlayerAbilityFromIndex(0, 1000);
    const { accTime } = input.getPlayerAbilities()[0];
    input.usePlayerAbilityFromIndex(0, 1500);
    expect(input.getPlayerAbilities()[0].accTime).toBe(accTime);
    input.usePlayerAbilityFromIndex(0, 4000);
    expect(input.getPlayerAbilities()[0].accTime).toBe(4000);
  });

  it('passives switch off after their duration of game time', () => {
    const game = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    useAbility(game, 1); // ice: -1 speed
    expect(game.player.moveSpeedModifier).toBe(-1);
    game.gm.timeoutHandler.update(4000);
    expect(game.player.moveSpeedModifier).toBe(-1);
    game.gm.timeoutHandler.update(6000);
    expect(game.player.moveSpeedModifier).toBe(0);
  });

  it('the player teleports to the end of their chosen path, then gets the passive', () => {
    const { i, j } = CENTER_TILE;
    const game = makeGame({ abilities: ['Glass', 'Ice', 'Water'] });
    const { gm, player } = game;
    const input = gm.getPlayerInputHandler();
    input.usePlayerAbilityFromIndex(0, 1000);
    expect(player.shouldTeleport).toBe(true);
    player.moveToTiles = [{ i, j: j + 1 }, { i, j: j + 2 }];
    player.teleportPiece();
    expect(player.tileIndex).toEqual({ i, j: j + 2 });
    // it leaves a wormhole behind, both ways, and doesn't fall straight back through it
    expect(gm.gameBoardManager.getLinkedTile({ i, j })).toEqual({ i, j: j + 2 });
    expect(gm.gameBoardManager.getLinkedTile({ i, j: j + 2 })).toEqual({ i, j });
    player.movePiece({ accTime: 1100, playerInputHandler: input });
    expect(player.tileIndex).toEqual({ i, j: j + 2 });
  });

  it('the wormhole closes after a while', () => {
    const { i, j } = CENTER_TILE;
    const { gm } = makeGame();
    gm.gameBoardManager.addWormhole({ i, j }, { i, j: j + 3 }, 1000, 6000);
    gm.gameBoardManager.updateWormholes(6999);
    expect(gm.gameBoardManager.getLinkedTile({ i, j })).toEqual({ i, j: j + 3 });
    gm.gameBoardManager.updateWormholes(7000);
    expect(gm.gameBoardManager.getLinkedTile({ i, j })).toBeUndefined();
    expect(gm.getWormholes()).toEqual([]);
  });
});

describe('AI', () => {
  const { i, j } = CENTER_TILE;

  it('notices enemy fire nearby', () => {
    const { gm, board, player } = makeGame();
    expect(board.getIsPieceInDanger(player.pieceIndex)).toBe(false);
    putStatusOnTile(gm, 'isOnFire', { i, j: j + 1 }, { dirs: ['down'], count: 5, teamIndex: 1 });
    expect(board.getIsPieceInDanger(player.pieceIndex)).toBe(true);
  });

  it('runs to the safest tile: the same one every time', () => {
    const { board, player } = makeGame();
    const safeTiles = new Set(Array.from({ length: 10 }, () => JSON.stringify(board.getSafeTileIndex(player.pieceIndex))));
    expect(safeTiles.size).toBe(1);
  });
});

describe('pathing', () => {
  it('walks around walls, which the old greedy pathing could not do', () => {
    const blocked = new Set(['1 0', '1 1', '1 2']);
    const path = findPath({
      start: { i: 0, j: 1 },
      goal: { i: 2, j: 1 },
      getAdjacentTiles: ({ i, j }) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([a, b]) => ({ i: i + a, j: j + b }))
        .filter(t => t.i >= 0 && t.j >= 0 && t.i < 4 && t.j < 4),
      getLocation: ({ i, j }) => ({ x: i, y: j }),
      getIsBlocked: ({ i, j }) => blocked.has(`${i} ${j}`)
    });
    expect(path.length).toBeGreaterThan(2);
    expect(path[path.length - 1]).toEqual({ i: 2, j: 1 });
    expect(path.every(({ i, j }) => !blocked.has(`${i} ${j}`))).toBe(true);
  });

  it('returns no path between separated areas', () => {
    const path = findPath({
      start: { i: 0, j: 0 },
      goal: { i: 2, j: 0 },
      getAdjacentTiles: ({ i, j }) => [{ i, j: j + 1 }].filter(t => t.j < 2),
      getLocation: ({ i, j }) => ({ x: i, y: j })
    });
    expect(path).toEqual([]);
  });

  it('finds the map\'s paths step by step, tile to adjacent tile', () => {
    const { board } = makeGame();
    const from = PENINSULA_TILE_LOOKUP_VALS[0];
    const to = PENINSULA_TILE_LOOKUP_VALS[PENINSULA_TILE_LOOKUP_VALS.length - 1];
    const path = board.findPathFromTo(from, to);
    expect(path.length).toBeGreaterThan(5);
    path.forEach((tile, k) => expect(board.getAreTilesAdjacent(k ? path[k - 1] : from, tile)).toBe(true));
  });
});

describe('player movement', () => {
  const countTilesMoved = ({ player, gm }, ticks, playerInputHandler) => {
    const seen = new Set();
    for (let k = 0; k < ticks; k++) {
      gm.accTime += GAME_TICK.pieceMs;
      player.movePiece({ accTime: gm.accTime, playerInputHandler });
      seen.add(`${player.tileIndex.i} ${player.tileIndex.j}`);
    }
    return seen.size;
  };

  it('moves as fast holding a key as it does following a click', () => {
    const { i, j } = CENTER_TILE;
    const clicking = makeGame();
    const clickInput = clicking.gm.getPlayerInputHandler();
    clicking.player.updateMovmement(clicking.board.findPathFromTo(CENTER_TILE, { i, j: j - 4 }));
    const clicked = countTilesMoved(clicking, 13, clickInput);

    const holding = makeGame();
    const holdInput = holding.gm.getPlayerInputHandler();
    holdInput.addKey('ArrowUp');
    const held = countTilesMoved(holding, 13, holdInput);

    expect(held).toBeGreaterThan(3);
    expect(Math.abs(held - clicked)).toBeLessThanOrEqual(1);
  });
});

describe('timers', () => {
  it('run on game time', () => {
    const timers = new TimeoutHandler();
    let hasFired = false;
    timers.update(1000);
    timers.registerTimeout(() => { hasFired = true; }, 500);
    timers.update(1400);
    expect(hasFired).toBe(false);
    timers.update(1500);
    expect(hasFired).toBe(true);
  });

  it('can be cancelled', () => {
    const timers = new TimeoutHandler();
    let hasFired = false;
    const ref = timers.registerTimeout(() => { hasFired = true; }, 100);
    timers.unregisterTimeout(ref);
    timers.update(1000);
    expect(hasFired).toBe(false);
  });
});

describe('game loop', () => {
  const makeLoop = () => {
    const counts = { pieces: 0, tiles: 0 };
    const loop = new GameLoop({
      steps: [
        { everyMs: GAME_TICK.pieceMs, run: () => { counts.pieces++; } },
        { everyMs: GAME_TICK.tileMs, run: () => { counts.tiles++; } }
      ],
      maxCatchUpMs: GAME_TICK.maxCatchUpMs
    });
    return { loop, counts };
  };

  // the same 11 seconds of play on displays from 30Hz to a future 1000Hz
  [30, 60, 144, 240, 1000].forEach(hz => {
    it(`runs at the same speed at ${hz}Hz`, () => {
      const { loop, counts } = makeLoop();
      const frameMs = 1000 / hz;
      for (let elapsed = 0; elapsed < 11000; elapsed += frameMs) loop.advance(frameMs);
      expect(Math.abs(counts.pieces - 100)).toBeLessThanOrEqual(1);
      expect(Math.abs(counts.tiles - 68)).toBeLessThanOrEqual(1);
    });
  });

  it('catches up after a slow frame', () => {
    const { loop, counts } = makeLoop();
    loop.advance(440);
    expect(counts.pieces).toBe(4);
  });

  it('does not fast-forward after a stall, such as a hidden tab', () => {
    const { loop, counts } = makeLoop();
    loop.advance(60000);
    expect(counts.pieces).toBeLessThanOrEqual(5);
  });
});

describe('a full match', () => {
  it('pausing freezes the game, and unpausing carries on with the same match', () => {
    const { gm, player } = makeGame();
    gm.stepPieces();
    const { accTime } = gm;
    gm.togglePauseGame();
    gm.stepPieces();
    gm.stepTiles();
    expect(gm.accTime).toBe(accTime);
    gm.togglePauseGame();
    gm.stepPieces();
    expect(gm.accTime).toBe(accTime + GAME_TICK.pieceMs);
    expect(gm.gameBoardPiecesManager.getPlayerPiece()).toBe(player);
  });

  it('spawns Kaiju onto the board', () => {
    const { gm } = makeGame();
    gm.gameBoardPiecesManager.pieces = [gm.gameBoardPiecesManager.getPlayerPiece()];
    gm.gameBoardPiecesManager.teams[1].teammateIndices = [];
    for (let k = 0; k < 250; k++) { gm.stepPieces(); gm.stepTiles(); }
    const kaiju = gm.getPieces().filter(p => p.avatar == 'kaiju');
    expect(kaiju.length).toBeGreaterThan(0);
    expect(kaiju[0].isOnTiles).toBe(true);
  });

  it('is won by reaching the kill target', () => {
    const { gm } = makeGame();
    expect(gm.getGameResult()).toBe(null);
    gm.score = 5; // easy difficulty
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('is lost when the whole player team is dead', () => {
    const { gm, player } = makeGame();
    player.lives = 1;
    player.decrementHealth(5000, 1);
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
    expect(gm.getUiState().isPlayerDead).toBe(true);
  });

  it('plays minutes of a real match with a teammate without crashing', () => {
    const { gm, settingsManager } = makeGame({ isTeammate: true, abilities: ['Love', 'Glass', 'Death'] });
    settingsManager.setDifficulty(3);
    for (let k = 0; k < 3000 && gm.getGameResult() === null; k++) {
      gm.stepPieces();
      if (k % 3 != 2) gm.stepTiles();
      const uiState = gm.getUiState();
      expect(uiState.players[0].abilities.length).toBe(3);
    }
    const positions = gm.getPieces().flatMap(p => [p.charLocation.x, p.charLocation.y]);
    expect(positions.every(Number.isFinite)).toBe(true);
  });
});

describe('Shield', () => {
  const castShield = (game, accTime) => {
    game.gm.accTime = accTime;
    game.gm.timeoutHandler.update(accTime);
    game.gm.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
    const index = game.player.abilities.findIndex(a => a.gameBoardPieceAbilityData.element == 'metal');
    useAbility(game, index);
    return game.player.abilities[index];
  };

  it('the first Shield is plain. one cast soon after is a ring wider and lasts longer.', () => {
    const game = makeGame({ abilities: ['Metal', 'Fire', 'Ice'] });
    castShield(game, 1000);
    const [plain] = getLitTiles(game.gm);
    expect(plain.getCurrCount()).toBe(2);
    expect(plain.cast.trailBonus).toBe(0);
    castShield(game, 5000);
    const [buffed] = getLitTiles(game.gm);
    expect(buffed.getCurrCount()).toBe(3);
    expect(buffed.cast.trailBonus).toBe(25);
  });

  it('casting again restarts the passive instead of stacking it', () => {
    const game = makeGame({ abilities: ['Metal', 'Fire', 'Ice'] });
    castShield(game, 1000);
    const shield = castShield(game, 5000);
    game.gm.timeoutHandler.update(9000); // the first cast's passive would have ended here
    expect(shield.isPassiveApplied).toBe(true);
    game.gm.timeoutHandler.update(12001);
    expect(shield.isPassiveApplied).toBe(false);
  });

  it('shields fade on their own', () => {
    const game = makeGame({ abilities: ['Metal', 'Fire', 'Ice'] });
    castShield(game, 1000);
    for (let k = 1; k <= 60; k++) game.gm.gameBoardManager.updateTileState(1000 + k * 160);
    expect(getLitTiles(game.gm).length).toBe(0);
  });
});

describe('Water', () => {
  it('sends two waves: once both come forward, they are rows apart', () => {
    const { i, j } = CENTER_TILE;
    // up the map, where there is room before an edge
    const game = makeGame({ abilities: ['Water', 'Fire', 'Ice'], kaijuTile: { i, j: j - 12 } });
    const index = game.player.abilities.findIndex(a => a.gameBoardPieceAbilityData.element == 'water');
    useAbility(game, index);
    expect(getLitTiles(game.gm).map(tile => tile.cast.isForwardWave).sort()).toEqual([false, true]);
    for (let k = 1; k <= 10; k++) game.gm.gameBoardManager.updateTileState(1 + k * 160);
    // in the player's column, the first wave has turned and trails the second
    const getRow = isForwardWave => getLitTiles(game.gm)
      .find(tile => tile.tileIndex.i == i && tile.getCurrCount() > 0 && tile.cast.isForwardWave == isForwardWave).tileIndex.j;
    expect(getRow(false) - getRow(true)).toBeGreaterThanOrEqual(4);
  });
});

describe('ragdolls', () => {
  const ROW_PX = 40;

  it('a body is thrown the way the power was travelling, spins, and comes to rest lying down', () => {
    let body = startRagdoll({ x: 0, y: 0 }, getThrowVec('idle', ['right', 'up right', 'down right'], 'down'), ROW_PX);
    expect(body.angle).toBe(0); // standing, as it starts
    let mostSwing = 0;
    for (let k = 0; k < 100 && !body.isResting; k++) {
      body = stepRagdoll(body, GAME_TICK.pieceMs / 1000, ROW_PX);
      mostSwing = Math.max(mostSwing, ...body.limbs.map(({ angle }) => Math.abs(angle)));
    }
    expect(body.isResting).toBe(true);
    expect(body.x).toBeGreaterThan(ROW_PX);
    expect(Math.abs(body.y)).toBeLessThan(body.x / 2);
    expect(body.height).toBe(0);
    expect(Math.abs(body.angle % 180)).toBe(90); // lying on one side
    expect(mostSwing).toBeGreaterThan(20); // the limbs flop about on the way
  });

  it('a body thrown at the edge of the play area bounces back in', () => {
    const bounds = { left: -ROW_PX, top: -ROW_PX * 10, right: ROW_PX, bottom: ROW_PX * 10 };
    let body = startRagdoll({ x: 0, y: 0 }, { x: 2.6, y: 0 }, ROW_PX);
    for (let k = 0; k < 100 && !body.isResting; k++) body = stepRagdoll(body, GAME_TICK.pieceMs / 1000, ROW_PX, bounds);
    expect(body.x).toBeLessThan(ROW_PX * 1.5);
  });

  it('running adds to the throw', () => {
    const still = getThrowVec('idle', ['up'], 'down');
    const running = getThrowVec('up', ['up'], 'down');
    expect(running.y).toBeLessThan(still.y);
  });

  it('with nothing pushing, they fall back from where they faced', () => {
    expect(getThrowVec('idle', [], 'up').y).toBeGreaterThan(0);
  });

  it('the camera holds on the death that ended the fight, and slow motion eases in after a moment', () => {
    const { gm, player } = makeGame();
    player.lives = 1;
    player.decrementHealth(1000, 1);
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
    gm.stepPieces();
    const shot = gm.getCameraShot();
    expect(shot.point).toEqual(gm.getDeathLocation(gm.getDeathPieces()[0]));
    expect(gm.getTimeScale()).toBe(1);
    for (let k = 0; k < 20; k++) gm.stepPieces();
    expect(gm.getCameraShot()).toBe(shot); // the same shot, so the camera doesn't pull in again
    // it eases after the body, so it stays close without shaking with each bounce
    const body = gm.getDeathLocation(gm.getDeathPieces()[0]);
    expect(Math.hypot(shot.point.x - body.x, shot.point.y - body.y)).toBeLessThan(gm.level.grid.rowStep * gm.level.grid.scale * 2);
    expect(gm.getTimeScale()).toBeCloseTo(0.2);
  });
});

describe('Fire', () => {
  const castFire = (game, accTime) => {
    game.gm.accTime = accTime;
    game.gm.timeoutHandler.update(accTime);
    game.gm.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
    const index = game.player.abilities.findIndex(a => a.gameBoardPieceAbilityData.element == 'fire');
    useAbility(game, index);
    return getLitTiles(game.gm)[0];
  };

  it('starts at mid range, goes further with each cast soon after, to a cap, and starts over after a pause', () => {
    const game = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    const counts = [1000, 3000, 5000, 7000, 9000, 11000].map(accTime => castFire(game, accTime).getCurrCount());
    expect(counts).toEqual([16, 19, 22, 25, 28, 28]);
    expect(castFire(game, 30000).getCurrCount()).toBe(16);
  });

  it('a longer cast still counts its ticks from where it started', () => {
    const game = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    castFire(game, 1000);
    const tile = castFire(game, 3000);
    expect(tile.cast.rangeBonus).toBe(3);
    expect(tile.getTileStatus().getCurrTick(tile.getCurrCount() - tile.cast.rangeBonus)).toBe(0);
  });

  it('turns to smoke where it bounces off the edge of the map', () => {
    const game = makeGame({ abilities: ['Fire', 'Ice', 'Water'] });
    castFire(game, 1000);
    let hasSmoked = false;
    for (let k = 1; k <= 40 && !hasSmoked; k++) {
      game.gm.gameBoardManager.updateTileState(1000 + k * 160);
      hasSmoked = getLitTiles(game.gm).some(tile => tile.cast.isSmoke);
    }
    expect(hasSmoked).toBe(true);
  });
});

describe('Kaiju speed playtest', () => {
  afterEach(() => setKaijuSpeedMode('rampage'));

  it('rampage: faster for a moment after breathing fire', () => {
    setKaijuSpeedMode('rampage');
    const kaiju = makeGame().kaiju as any;
    kaiju.rampageEndsAt = 4000;
    kaiju.updateSpeedBoost(3000);
    expect(kaiju.moveSpeedModifier).toBe(KAIJU_SPEED.boost);
    kaiju.updateSpeedBoost(4000);
    expect(kaiju.moveSpeedModifier).toBe(0);
  });

  it('wind-up: faster while it glows, before it breathes', () => {
    setKaijuSpeedMode('windUp');
    const kaiju = makeGame().kaiju as any;
    kaiju.isGoingToSpewFire = true;
    kaiju.updateSpeedBoost(1000);
    expect(kaiju.moveSpeedModifier).toBe(KAIJU_SPEED.boost);
    kaiju.isGoingToSpewFire = false;
    kaiju.updateSpeedBoost(1100);
    expect(kaiju.moveSpeedModifier).toBe(0);
  });
});

describe('Bubble drawbacks playtest', () => {
  const DRAWBACKS = ['suds', 'burst', 'cleanSlate', 'soaked', 'fizzOut'] as const;
  const only = (...ids) => DRAWBACKS.forEach(id => setIsDrawbackOn(id, ids.includes(id)));
  afterEach(() => only('fizzOut'));

  const setUp = () => {
    const game = makeGame({ abilities: ['Bubble', 'Ice', 'Water'] });
    const bubble = game.player.abilities.find(a => a.gameBoardPieceAbilityData.element == 'bubble');
    const dispel = accTime => {
      game.gm.accTime = accTime;
      game.gm.timeoutHandler.update(accTime);
      game.gm.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus());
      bubble.useAbility({ accTime, piece: game.player, registerTimeout: game.gm.gameManagerProxy.registerTimeout, updateTileWithAbilityStatus: game.gm.gameManagerProxy.updateTileWithAbilityStatus });
    };
    return { ...game, bubble, dispel };
  };

  it('Fizz Out: each quick Dispel asks for fewer tiles, and a pause resets it', () => {
    only('fizzOut');
    const { player, bubble } = setUp();
    const areaBonuses = [];
    const cast = accTime => bubble.useAbility({ accTime, piece: player, registerTimeout: () => 0, updateTileWithAbilityStatus: ({ areaBonus }) => areaBonuses.push(areaBonus) });
    [1000, 2000, 3000, 10000].forEach(cast);
    expect(areaBonuses).toEqual([-0, -1, -2, -0]);
  });

  it('Burst: the other powers wait after a Dispel', () => {
    only('burst');
    const { player, bubble, dispel } = setUp();
    dispel(1000);
    const others = player.abilities.filter(a => a !== bubble);
    expect(others.every(a => a.getIsOnCooldown(2400, false))).toBe(true);
    expect(others.every(a => !a.getIsOnCooldown(2500, false))).toBe(true);
  });

  it('Clean Slate: a Dispel ends the other powers\' passives', () => {
    only('cleanSlate');
    const game = setUp();
    const ice = game.player.abilities.find(a => a.gameBoardPieceAbilityData.element == 'ice');
    useAbility(game, game.player.abilities.indexOf(ice));
    expect(game.player.moveSpeedModifier).toBe(-1);
    game.dispel(1500);
    expect(game.player.moveSpeedModifier).toBe(0);
    game.gm.timeoutHandler.update(20000); // the ended passive's own timer does nothing now
    expect(game.player.moveSpeedModifier).toBe(0);
  });

  it('Soaked: slower for a while, and casting again restarts it rather than stacking', () => {
    only('soaked');
    const { player, gm, dispel } = setUp();
    dispel(1000);
    dispel(2000);
    expect(player.moveSpeedModifier).toBe(-1);
    gm.timeoutHandler.update(4500); // the first cast's time is up, the second's isn't
    expect(player.moveSpeedModifier).toBe(-1);
    gm.timeoutHandler.update(5000);
    expect(player.moveSpeedModifier).toBe(0);
  });

  it('Suds: tiles a Dispel crosses stay soapy for a while', () => {
    only('suds');
    const { gm, dispel } = setUp();
    dispel(1000);
    gm.gameBoardManager.updateTileState(1160);
    const [soapy] = gm.getSoapyTiles();
    expect(soapy).toBeDefined();
    gm.gameBoardManager.getTilesInFlatArray().forEach(tile => tile.clearTileStatus()); // the Dispel has passed
    gm.gameBoardManager.updateTileState(1160 + BUBBLE_DRAWBACKS.suds.ms + 1);
    expect(gm.gameBoardManager.getIsSoapy(soapy)).toBe(false);
  });
});

describe('the Lab fight', () => {
  const makeLabFight = (isRetry) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    const gm = new GameManager({ level: LEVELS.lab, settingsManager, isRetry });
    gm.initGame();
    if (gm.cutscene) gm.skipCutscene();
    return gm;
  };

  it('the Agent who did the talking stays gone once the fight starts, even on a retry', () => {
    const gm = makeLabFight(true);
    const talker = gm.extras[0];
    expect(talker.isDead).toBe(true);
    expect(talker.isVisible).toBe(false);
  });

  it('Enter hurries the talk along to the next line', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    const gm = new GameManager({ level: LEVELS.lab, settingsManager });
    gm.initGame();
    const first = gm.speech;
    expect(gm.advanceDialogue()).toBe(true);
    gm.stepPieces();
    expect(gm.speech).not.toBe(first);
  });

  it('on a retry, the Agents hold their powers for a moment', () => {
    const gm = makeLabFight(true);
    const agent = gm.getPieces().find(piece => piece.teamIndex != 0 && !piece.isDead);
    expect(gm.getIsPowersOff(agent)).toBe(true);
    gm.accTime += LEVELS.lab.agentDrops.retryPowersMs;
    expect(gm.getIsPowersOff(agent)).toBe(false);
    expect(makeLabFight(false).getIsPowersOff(agent)).toBe(false);
  });
});

describe('team colors', () => {
  it("a status shows the color of the side that cast it, so a charmed piece's powers show the charmer's", () => {
    const { gm, player } = makeGame();
    const playerTeam = player.getTeamIndex();
    expect(gm.getStatusTeamColor(player.pieceIndex, playerTeam)).toBe(gm.getPlayerColor());
    expect(gm.getStatusTeamColor(player.pieceIndex, playerTeam + 1)).not.toBe(gm.getPlayerColor());
    expect(gm.getStatusTeamColor(999, playerTeam)).toBeUndefined();
  });
});

describe('the dialogue log', () => {
  const makeLevel = (level) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    const gm = new GameManager({ level, settingsManager });
    gm.initGame();
    return gm;
  };
  const run = (gm, ticks) => { for (let k = 0; k < ticks; k++) gm.stepPieces(); };
  beforeEach(() => { setIsDialogueLog(true); setIsClickThrough(true); });
  afterEach(() => { setIsDialogueLog(false); setIsClickThrough(true); });

  it('a conversation goes to the log, after a look at the whole scene, and each line waits to be moved on', () => {
    const gm = makeLevel(LEVELS.lab);
    expect(gm.dialogueLog).toEqual([]); // the whole scene first
    run(gm, 40);
    expect(gm.dialogueLog.length).toBe(1);
    expect(gm.dialogueLog[0]).toMatchObject({ who: 'agent', avatar: 'agent' });
    expect(gm.speech.isLogged).toBe(true); // no balloon
    expect(gm.getCameraShot().isWide).toBeFalsy(); // the shot is on the Agent
    run(gm, 100);
    expect(gm.dialogueLog.length).toBe(1); // still waiting
    expect(gm.advanceDialogue()).toBe(true);
    run(gm, 1);
    expect(gm.dialogueLog.length).toBe(2);
  });

  it("the Street Agent's words go to the log once each, and the unlock waits for the last", () => {
    const gm = makeLevel(LEVELS.street);
    if (gm.cutscene) gm.skipCutscene();
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(LEVELS.street.unlock.spot));
    for (let k = 0; k < 30; k++) { run(gm, 3); gm.advanceDialogue(); }
    expect(gm.dialogueLog.map(({ text }) => text).length).toBe(LEVELS.street.sceneElements.find(({ type }) => type == 'speech').lines.length);
    expect(gm.getIsSceneTalkDone()).toBe(true);
  });

  it('a shout stays a balloon', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    const gm = new GameManager({ level: LEVELS.peninsula, settingsManager, hasArrival: true });
    gm.initGame();
    for (let k = 0; k < 400 && !(gm.speech && gm.speech.text.includes('Heads-up')); k++) gm.stepPieces();
    expect(gm.speech.text).toContain('Heads-up');
    expect(gm.speech.isLogged).toBeFalsy();
    expect(gm.dialogueLog).toEqual([]);
  });
});
