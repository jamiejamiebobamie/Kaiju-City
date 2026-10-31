import fs from 'node:fs';
import { applyLevelFile, getTileTone, LEVEL_FILES, LEVELS, TILE_TONES } from 'Game/Levels/levels';
import { rescaleLevelTiles } from 'Game/Levels/levelScale';
import aquarium from 'Game/Levels/data/aquarium.json';
import rapidTransit from 'Game/Levels/data/rapidTransit.json';
import { GameManager } from './GameManager';
import { SettingsManager } from './SettingsManager';
import { TRAIN_HIT } from './TrainSchedule';
import { MASTER_PENINSULA as PENINSULA, MASTER_PENINSULA_TILES as PENINSULA_TILE_LOOKUP_VALS } from './masterPeninsula';
import { Camera, CAMERA, getCameraZoom, getCloseZoom, WIDE_SHOT } from './Camera';
import { getCharXAndY, getPerimeterEdges, getTileCenter, getTileIndexAtLocation, getTileXAndY } from './GameBoard/hexGrid';
import { CENTER_TILE, makeGame, placePiece } from './testHelpers';

const { grid } = PENINSULA;
const hold = ({ gm, player }, keys, ticks) => {
  const input = gm.getPlayerInputHandler();
  keys.forEach(key => input.addKey(key));
  const tiles = [];
  for (let k = 0; k < ticks; k++) {
    gm.accTime += 110;
    player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    tiles.push(player.tileIndex);
  }
  keys.forEach(key => input.removeKey(key));
  return tiles;
};

describe('hexagon grid', () => {
  // master's formulas
  const scale = grid.scale;
  it('places tiles where master did', () => {
    [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 7, j: 12 }, { i: 23, j: 35 }].forEach(({ i, j }) => {
      expect(getTileXAndY(grid, { i, j }).x).toBeCloseTo((i === 0 ? i * 45 - 25 : i * 45 + 25 * (i - 1)) * scale);
      expect(getTileXAndY(grid, { i, j }).y).toBeCloseTo((i % 2 ? j * 80 + 40 : j * 80) * scale);
      expect(getCharXAndY(grid, { i, j }).x).toBeCloseTo((i === 0 ? i * 45 - 25 : i * 45 + 25 * (i - 1)) * scale + 52.5 * scale);
    });
  });

  it('finds the tile at every tile\'s center', () => {
    PENINSULA_TILE_LOOKUP_VALS.forEach(tile => {
      expect(getTileIndexAtLocation(grid, getTileCenter(grid, tile))).toEqual({ i: tile.i, j: tile.j });
    });
  });

  it('finds nothing outside of the grid', () => {
    expect(getTileIndexAtLocation(grid, { x: -500, y: -500 })).toBeUndefined();
  });
});

describe('level config', () => {
  it('builds the tiles from the level', () => {
    const { board } = makeGame();
    expect(board.tiles.length).toBe(grid.columns);
    expect(board.tiles[0].length).toBe(grid.rows);
    expect(board.getTilesInFlatArray().filter(t => t.getIsVisible()).length).toBe(PENINSULA.walkableTiles.length);
  });
});

describe('levels', () => {
  const getKey = ({ i, j }) => `${i} ${j}`;
  const getNeighbors = ({ i, j }) => [[0, -1], [0, 1], [1, i % 2 ? 0 : -1], [1, i % 2 ? 1 : 0], [-1, i % 2 ? 0 : -1], [-1, i % 2 ? 1 : 0]]
    .map(([a, b]) => ({ i: i + a, j: j + b }));

  const getReachable = (tiles, start) => {
    const walkable = new Set(tiles.map(getKey));
    const seen = new Set([getKey(start)]);
    const queue = [start];
    while (queue.length) {
      getNeighbors(queue.pop()).filter(t => walkable.has(getKey(t)) && !seen.has(getKey(t))).forEach(t => {
        seen.add(getKey(t));
        queue.push(t);
      });
    }
    return seen;
  };

  it('spawn and goal tiles are all on walkable tiles', () => {
    Object.values(LEVELS).forEach(({ walkableTiles, spawnTiles, goalTiles }) => {
      const walkable = new Set(walkableTiles.map(getKey));
      [...spawnTiles, ...goalTiles].forEach(tile => expect(walkable.has(getKey(tile))).toBe(true));
    });
  });

  it('the only way up from the aquarium floor is a tile link', () => {
    const { walkableTiles, spawnTiles, tileLinks } = LEVELS.aquarium;
    const reachable = getReachable(walkableTiles, spawnTiles[0]);
    tileLinks.forEach(([stairTop, balcony]) => {
      expect(reachable.has(getKey(stairTop))).toBe(true);
      expect(reachable.has(getKey(balcony))).toBe(false);
    });
  });

  describe('tile links', () => {
    const { walkableTiles, spawnTiles, tileLinks } = LEVELS.aquarium;
    const [[stairTop, balcony]] = tileLinks;
    // a plain tile upstairs: stopping on a linked tile would jump back down
    const floor = getReachable(walkableTiles, spawnTiles[0]);
    const upstairs = walkableTiles.find(tile =>
      !floor.has(getKey(tile)) && !tileLinks.flat().some(link => getKey(link) == getKey(tile)));
    const makeAquarium = () => {
      const settingsManager = new SettingsManager();
      settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
      settingsManager.setIsTeammate(false);
      const gm = new GameManager({ level: LEVELS.aquarium, settingsManager });
      gm.initGame();
      return { gm, player: gm.getPieces()[0], board: gm.gameBoardManager, input: gm.getPlayerInputHandler() };
    };
    const walk = ({ gm, player, input }, ticks) => {
      for (let k = 0; k < ticks; k++) {
        gm.accTime += 110;
        player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
      }
    };

    it('jumps to its partner when the player stops on it, and stays there', () => {
      const game = makeAquarium();
      const { player } = game;
      player.initCharLocation(true, stairTop);
      walk(game, 3);
      expect(player.getTileIndex()).toEqual(balcony);
      walk(game, 10);
      expect(player.getTileIndex()).toEqual(balcony);
    });

    it('can be used again after walking off it and back', () => {
      const game = makeAquarium();
      const { player, board } = game;
      player.initCharLocation(true, stairTop);
      walk(game, 3);
      const next = board.getAdjacentTileIndices(balcony)[0];
      player.updateMovmement([next, balcony]);
      walk(game, 30);
      expect(player.getTileIndex()).toEqual(stairTop);
    });

    it('pathing goes through a link to reach the balcony', () => {
      const { board, player } = makeAquarium();
      const path = board.findPathFromTo(player.getTileIndex(), upstairs);
      const keys = path.map(getKey);
      expect(path.length).toBeGreaterThan(0);
      expect(keys.some(key => tileLinks.flat().some(t => getKey(t) == key))).toBe(true);
    });

    it('a click on the balcony gets there from the floor', () => {
      const game = makeAquarium();
      const { player, input } = game;
      input.updatePlayerDestinationAndClickedTileFromClick(upstairs);
      walk(game, 400);
      expect(player.getTileIndex()).toEqual(upstairs);
    });

    it('walking past a linked tile does not jump', () => {
      const game = makeAquarium();
      const { player, board } = game;
      const [before, after] = board.getAdjacentTileIndices(balcony);
      player.initCharLocation(true, before);
      player.updateMovmement([balcony, after]);
      walk(game, 30);
      expect(player.getTileIndex()).toEqual(after);
    });
  });

  it('every level has a tile tone', () => {
    Object.values(LEVELS).forEach(level => expect(getTileTone(level, [])).toBeDefined());
  });

  it('the shattered aquarium changes tile tone, and goes back without it', () => {
    expect(getTileTone(LEVELS.aquarium, ['tongue'])).toBe(TILE_TONES.dark);
    expect(getTileTone(LEVELS.aquarium, ['tongue', 'shattered'])).toBe(TILE_TONES.white);
  });

  it('scene elements only use phases their level has', () => {
    Object.values(LEVELS).forEach(({ phases, sceneElements }) => {
      const ids = phases.map(({ id }) => id);
      sceneElements.filter(({ phase }) => phase && phase != 'trainLights').forEach(({ phase }) => expect(ids).toContain(phase));
    });
  });

  it('scene art exists', () => {
    const paths = Object.values(LEVELS).flatMap(({ sceneElements, foregroundLayers }) => [
      ...foregroundLayers.map(({ src }) => src),
      ...sceneElements.flatMap(({ src, enter = [], loop = [], exit = [] }) => [src, ...enter, ...loop, ...exit]).filter(Boolean)
    ]);
    expect(paths.length).toBeGreaterThan(10);
    paths.forEach(src => expect(fs.existsSync(`public${src}`)).toBe(true));
  });

  describe('the subway train', () => {
    const makeSubway = () => {
      const settingsManager = new SettingsManager();
      settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
      settingsManager.setIsTeammate(false);
      const gm = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
      gm.initGame();
      return { gm, player: gm.getPieces()[0], board: gm.gameBoardManager };
    };
    const train = new Set(LEVELS.rapidTransit.tileSets.train.map(getKey));
    const trackTile = LEVELS.rapidTransit.walkableTiles.find(tile => !train.has(getKey(tile)) && getTileCenter(LEVELS.rapidTransit.grid, tile).y > 500);

    it('runs on a timer: lights, then train, then lights, then nothing', () => {
      const { gm } = makeSubway();
      const stages = [];
      for (let k = 0; k < 2000; k++) {
        gm.stepPieces();
        const { stage } = gm.trainSchedule;
        if (stage != stages[stages.length - 1]) stages.push(stage);
      }
      expect(stages.slice(0, 5)).toEqual(['idle', 'warning', 'train', 'clearing', 'idle']);
    });

    it('keeps the lights flashing through the warning, train and clearing, then turns them off', () => {
      const { gm } = makeSubway();
      gm.trainSchedule.setStage('warning', 0);
      expect(gm.getActivePhases()).toContain('trainLights');
      gm.trainSchedule.setStage('train', 0);
      expect(gm.getActivePhases()).toEqual(expect.arrayContaining(['trainLights', 'train']));
      gm.trainSchedule.setStage('clearing', 0);
      expect(gm.getActivePhases()).toContain('trainLights');
      expect(gm.getActivePhases()).not.toContain('train');
      gm.trainSchedule.setStage('idle', 0);
      expect(gm.getActivePhases()).not.toContain('trainLights');
    });

    it('swaps the walkable tiles while it is in', () => {
      const { gm, board } = makeSubway();
      expect(board.getIsInBounds(trackTile)).toBe(true);
      gm.togglePhase('train');
      expect(board.getIsInBounds(trackTile)).toBe(false);
      gm.togglePhase('train');
      expect(board.getIsInBounds(trackTile)).toBe(true);
    });

    it('hits a piece on the tracks, and shoves it to the platform', () => {
      const { gm, player, board } = makeSubway();
      player.initCharLocation(true, trackTile);
      const lives = player.lives;
      gm.accTime = 5000;
      gm.togglePhase('train');
      expect(player.lives).toBe(lives - TRAIN_HIT.dmg);
      expect(board.getIsInBounds(player.getTileIndex())).toBe(true);
    });

    it('leaves a piece on the platform alone, and stops its path at the tracks', () => {
      const { gm, player } = makeSubway();
      const lives = player.lives;
      player.moveToTiles = [trackTile];
      gm.togglePhase('train');
      expect(player.lives).toBe(lives);
      expect(player.getMoveToTiles()).toEqual([]);
    });
  });

  it('kaiju parts start on, on the levels that have one', () => {
    expect(new GameManager({ level: LEVELS.aquarium, settingsManager: new SettingsManager() }).getActivePhases()).toContain('tongue');
  });

  it('walking levels are the street and sewers', () => {
    const walking = Object.values(LEVELS).filter(level => level.isWalkingLevel).map(({ id }) => id).sort();
    expect(walking).toEqual(['sewer1', 'sewer2', 'street']);
  });

  it('no level has a goal for now', () => {
    Object.values(LEVELS).forEach(({ goalTiles }) => expect(goalTiles).toEqual([]));
  });

  it('the peninsula has tiles down to the bottom of the map', () => {
    const lowest = Math.max(...PENINSULA.walkableTiles.map(tile => getTileCenter(grid, tile).y));
    expect(lowest + PENINSULA.contentOffset.y).toBeGreaterThan(PENINSULA.world.height - 14);
  });

  it('starts the player team on the spawn tiles', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.rooftop, settingsManager });
    gm.initGame();
    expect(gm.getPieces()[0].getTileIndex()).toEqual(LEVELS.rooftop.spawnTiles[0]);
    expect(gm.getPieces()[1].getTileIndex()).toEqual(LEVELS.rooftop.spawnTiles[1]);
  });
});

describe('tile scale', () => {
  it('keeps the area the tiles cover', () => {
    const scaled = rescaleLevelTiles(aquarium, 0.8);
    const grid = { ...scaled.grid };
    const oldKeys = new Set(aquarium.tileSets.base.map(({ i, j }) => `${i} ${j}`));
    expect(scaled.tileSets.base.length).toBeGreaterThan(aquarium.tileSets.base.length * 1.2);
    scaled.tileSets.base.forEach(tile => {
      const { i, j } = getTileIndexAtLocation(aquarium.grid, getTileCenter(grid, tile));
      expect(oldKeys.has(`${i} ${j}`)).toBe(true);
    });
  });

  it('keeps spawn and linked tiles on walkable tiles', () => {
    [0.7, 1.3].forEach(factor => {
      const scaled = rescaleLevelTiles(aquarium, factor);
      const walkable = new Set(scaled.tileSets.base.map(({ i, j }) => `${i} ${j}`));
      [...scaled.tileSets.spawn, ...scaled.tileLinks.flat()].forEach(({ i, j }) => expect(walkable.has(`${i} ${j}`)).toBe(true));
    });
  });

  it('rescales every walkable set: the subway keeps its train tiles apart', () => {
    const scaled = rescaleLevelTiles(rapidTransit, 0.8);
    expect(scaled.tileSets.train.length).toBeLessThan(scaled.tileSets.noTrain.length);
  });
});

describe('the mouse highlight', () => {
  it('hides while the player uses the keys, until the mouse moves', () => {
    const { gm, board } = makeGame();
    const input = gm.getPlayerInputHandler();
    const { i, j } = CENTER_TILE;
    input.updateHoveredTileFromPlayerHover({ i, j: j + 3 });
    expect(board.getHoveredTileIndex()).toEqual({ i, j: j + 3 });
    input.addKey('KeyW');
    expect(board.getHoveredTileIndex()).toBeUndefined();
    input.updateHoveredTileFromPlayerHover({ i, j: j + 3 });
    expect(board.getHoveredTileIndex()).toEqual({ i, j: j + 3 });
  });
});

describe('peninsula level file', () => {
  const inScene = ({ grid, contentOffset }, location) => ({ x: location.x + contentOffset.x, y: location.y + contentOffset.y });

  it('puts every tile and character where master did', () => {
    PENINSULA.walkableTiles.forEach(tile => {
      const master = inScene(PENINSULA, getTileCenter(PENINSULA.grid, tile));
      const level = inScene(LEVELS.peninsula, getTileCenter(LEVELS.peninsula.grid, tile));
      expect(level.x).toBeCloseTo(master.x, 1);
      expect(level.y).toBeCloseTo(master.y, 1);
      const masterPiece = inScene(PENINSULA, getCharXAndY(PENINSULA.grid, tile));
      const levelPiece = inScene(LEVELS.peninsula, getCharXAndY(LEVELS.peninsula.grid, tile));
      expect(Math.abs(levelPiece.x - masterPiece.x)).toBeLessThan(0.1);
      expect(Math.abs(levelPiece.y - masterPiece.y)).toBeLessThan(0.1);
    });
  });

  it('keeps its size, speed and way in for Kaiju', () => {
    const { pieceScale, moveSpeedScale, kaijuEntry } = LEVELS.peninsula;
    expect(pieceScale).toBeCloseTo(1);
    expect(moveSpeedScale).toBeCloseTo(1);
    expect(kaijuEntry.perimeterTiles.length).toBe(PENINSULA.kaijuEntry.perimeterTiles.length);
  });

  it('Kaiju entry tiles are not walkable tiles of their own set', () => {
    expect(LEVELS.peninsula.tileSets.kaijuEntry).toBeUndefined();
  });

  it('can be rescaled like any other level, keeping its Kaiju entry', () => {
    const scaled = rescaleLevelTiles(LEVEL_FILES.peninsula, 1.5);
    expect(scaled.tileSets.kaijuEntry.length).toBeGreaterThan(0);
    expect(scaled.tileSets.base.length).toBeLessThan(LEVEL_FILES.peninsula.tileSets.base.length);
  });
});

describe('saving a level from the editor', () => {
  it('rebuilds the level from the new file, and keeps its scene', () => {
    const before = LEVEL_FILES.street;
    const level = LEVELS.street;
    const tiles = before.tileSets[Object.keys(before.tileSets)[0]];
    applyLevelFile({ ...before, tileSets: { ...before.tileSets, [Object.keys(before.tileSets)[0]]: tiles.slice(1) } });
    expect(LEVELS.street.walkableTiles.length).toBe(tiles.length - 1);
    expect(LEVELS.street.isWalkingLevel).toBe(level.isWalkingLevel);
    expect(LEVELS.street.sceneElements).toEqual(level.sceneElements);
    applyLevelFile(before);
  });
});

describe('clicks', () => {
  const makeGame = () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.aquarium, settingsManager });
    gm.initGame();
    return { gm, player: gm.getPieces()[0], input: gm.getPlayerInputHandler(), board: gm.gameBoardManager };
  };
  const tick = ({ gm, player, input }, count) => {
    for (let k = 0; k < count; k++) {
      gm.accTime += 110;
      player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    }
  };
  const getFarTile = (board, from) => board.walkableTiles.find(tile => board.findPathFromTo(from, tile).length > 8);

  it('a click just after letting go of a movement key keeps its path', () => {
    const game = makeGame();
    const { player, input, board } = game;
    input.addKey('KeyD');
    tick(game, 4);
    input.removeKey('KeyD');
    input.updatePlayerDestinationAndClickedTileFromClick(getFarTile(board, player.getTileIndex()));
    const { length } = player.getMoveToTiles();
    tick(game, 8);
    expect(length).toBeGreaterThan(8);
    expect(player.getMoveToTiles().length).toBeGreaterThan(0);
  });

  it('goes to the clicked tile, even if the hovered tile is out of date', () => {
    const { player, input, board } = makeGame();
    const from = player.getTileIndex();
    input.updateHoveredTileFromPlayerHover(from);
    input.updatePlayerDestinationAndClickedTileFromClick(getFarTile(board, from));
    expect(player.getMoveToTiles().length).toBeGreaterThan(0);
  });
});

describe('nearest tile', () => {
  const makeGame = level => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level, settingsManager });
    gm.initGame();
    return gm;
  };

  it('a spot on a walkable tile gets that tile', () => {
    const gm = makeGame(LEVELS.aquarium);
    const tile = gm.gameBoardManager.walkableTiles[20];
    expect(gm.getClosestReachableTile(getTileCenter(LEVELS.aquarium.grid, tile))).toEqual(tile);
  });

  it('a spot off the tiles gets the closest walkable tile', () => {
    const gm = makeGame(LEVELS.aquarium);
    const { x, y } = getTileCenter(LEVELS.aquarium.grid, { i: 20, j: 23 });
    const tile = gm.getClosestReachableTile({ x, y: y + 500 });
    expect(gm.getIsWalkable(tile)).toBe(true);
    const others = gm.gameBoardManager.walkableTiles.map(t => Math.hypot(getTileCenter(LEVELS.aquarium.grid, t).x - x, getTileCenter(LEVELS.aquarium.grid, t).y - y - 500));
    expect(Math.hypot(getTileCenter(LEVELS.aquarium.grid, tile).x - x, getTileCenter(LEVELS.aquarium.grid, tile).y - y - 500)).toBeCloseTo(Math.min(...others));
  });

  it('tiles the player can only reach through a link still count', () => {
    const gm = makeGame(LEVELS.aquarium);
    const [[, balcony]] = LEVELS.aquarium.tileLinks;
    expect(gm.getClosestReachableTile(getTileCenter(LEVELS.aquarium.grid, balcony))).toEqual(balcony);
  });

  it('tiles cut off from the player do not count', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    const board = gm.gameBoardManager;
    gm.trainSchedule.setStage('train', 0);
    const from = gm.getPieces()[0].getTileIndex();
    const tile = gm.getClosestReachableTile(getTileCenter(LEVELS.rapidTransit.grid, { i: 40, j: 15 }));
    expect(board.findPathFromTo(from, tile).length > 0 || (tile.i == from.i && tile.j == from.j)).toBe(true);
  });
});

describe('perimeter', () => {
  it('a lone tile has six edges', () => {
    expect(getPerimeterEdges([{ i: 4, j: 4 }])).toHaveLength(6);
  });

  it('two neighbors share an edge, whichever columns they are on', () => {
    [[{ i: 4, j: 4 }, { i: 5, j: 4 }], [{ i: 4, j: 4 }, { i: 5, j: 3 }], [{ i: 5, j: 4 }, { i: 6, j: 5 }], [{ i: 5, j: 4 }, { i: 5, j: 5 }]]
      .forEach(pair => expect(getPerimeterEdges(pair)).toHaveLength(10));
  });

  it('a tile in the middle of others has no open edges', () => {
    const center = { i: 5, j: 4 };
    const ring = [{ i: 5, j: 3 }, { i: 5, j: 5 }, { i: 4, j: 4 }, { i: 4, j: 5 }, { i: 6, j: 4 }, { i: 6, j: 5 }];
    expect(getPerimeterEdges([center, ...ring]).filter(({ tile }) => tile === center)).toHaveLength(0);
  });
});

describe('wide shots', () => {
  const makeSubway = () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.rapidTransit, settingsManager });
    gm.initGame();
    return gm;
  };

  it('holds the game still, then the camera returns before the game resumes', () => {
    const gm = makeSubway();
    gm.togglePhase('eyeTouched');
    const { accTime } = gm;
    expect(gm.getIsWideShot()).toBe(true);
    const totalMs = gm.wideShotMs;
    let isBackBeforeResuming = false;
    for (let ms = 0; ms < totalMs; ms += 110) {
      gm.stepPieces();
      if (!gm.getIsWideShot() && gm.wideShotMs > 0) isBackBeforeResuming = true;
    }
    expect(isBackBeforeResuming).toBe(true);
    expect(gm.accTime).toBe(accTime);
    gm.stepPieces();
    expect(gm.accTime).toBeGreaterThan(accTime);
  });

  it('a phase that is already on does not start another one', () => {
    const gm = makeSubway();
    gm.setPhase('trainLights', true);
    gm.wideShotMs = 0;
    gm.setPhase('trainLights', true);
    expect(gm.wideShotMs).toBe(0);
    expect(WIDE_SHOT.pullMs).toBeGreaterThan(0);
  });
});

describe('close camera', () => {
  const sizes = { hexWidthPx: 40, isTouch: false, viewWidth: 1400, viewHeight: 787, worldWidth: 1408, worldHeight: 768 };

  it('zooms in from fitting the whole scene', () => {
    expect(getCloseZoom({ ...sizes, cameraZoom: 2 })).toBeCloseTo(getCameraZoom(sizes) * 2);
  });

  it('a zoom of 1 leaves the whole scene in view', () => {
    expect(getCloseZoom({ ...sizes, cameraZoom: 1 })).toBe(getCameraZoom(sizes));
  });

  it('every level file sets a camera zoom', () => {
    Object.values(LEVELS).forEach(({ cameraZoom }) => expect(cameraZoom).toBeGreaterThanOrEqual(1));
  });

  it('points a caret at something outside of the view, and a bigger one when it is closer', () => {
    const camera = new Camera({ viewWidth: 100, viewHeight: 100, worldWidth: 1000, worldHeight: 1000, zoom: 1 });
    const player = { x: 50, y: 50 };
    expect(camera.getEdgeCaret({ x: 60, y: 60 }, player, 10)).toBeUndefined();
    const near = camera.getEdgeCaret({ x: 150, y: 50 }, player, 10);
    const far = camera.getEdgeCaret({ x: 400, y: 50 }, player, 10);
    expect(near.degrees).toBeCloseTo(0);
    expect(near.left).toBeLessThan(100);
    expect(near.size).toBeGreaterThan(far.size);
  });
});

describe('mouse look', () => {
  const makeCamera = (zoom = 2) => new Camera({ viewWidth: 400, viewHeight: 300, worldWidth: 2000, worldHeight: 1500, zoom });
  const player = { x: 1000, y: 750 };

  it('stays on the player with the mouse in the middle', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    const { x, y, zoom } = camera;
    camera.lookToward(player, { x: 0, y: 0 });
    expect([camera.x, camera.y, camera.zoom]).toEqual([x, y, zoom]);
  });

  it('shifts toward the mouse, then comes back', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    const { x } = camera;
    camera.lookToward(player, { x: 0.6, y: 0 });
    expect(camera.x).toBeGreaterThan(x);
    expect(camera.zoom).toBe(2);
    camera.lookToward(player, { x: -0.6, y: 0 });
    expect(camera.x).toBeLessThan(x + 1);
  });

  it('eases out when the mouse is far out, and keeps the player in view', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    camera.lookToward(player, { x: 1, y: 1 });
    expect(camera.zoom).toBeCloseTo(2 * (1 - CAMERA.lookZoomOut));
    const viewWidth = 400 / camera.zoom;
    expect(player.x).toBeGreaterThan(camera.x);
    expect(player.x).toBeLessThan(camera.x + viewWidth);
  });

  it('never zooms out past the whole level', () => {
    const camera = new Camera({ viewWidth: 1400, viewHeight: 787, worldWidth: 1408, worldHeight: 768, zoom: 1.05 });
    camera.lookToward({ x: 700, y: 400 }, { x: 1, y: 0 });
    expect(camera.zoom).toBeCloseTo(1400 / 1408);
  });
});

describe('camera', () => {
  const makeCamera = () => new Camera({ viewWidth: 100, viewHeight: 100, worldWidth: 400, worldHeight: 300, zoom: 1 });

  it('stays put while the player is away from the edges', () => {
    const camera = makeCamera();
    camera.centerOn({ x: 200, y: 150 });
    const { x, y } = camera;
    camera.follow({ x: 205, y: 155 });
    expect([camera.x, camera.y]).toEqual([x, y]);
  });

  it('pans as the player nears the edge of the view', () => {
    const camera = makeCamera();
    camera.centerOn({ x: 200, y: 150 });
    camera.follow({ x: 240, y: 150 });
    expect(camera.x).toBeCloseTo(240 - 100 * (1 - CAMERA.edgeMargin));
  });

  it('stops at the edges of the level', () => {
    const camera = makeCamera();
    camera.follow({ x: 1000, y: 1000 });
    expect([camera.x, camera.y]).toEqual([300, 200]);
    camera.follow({ x: -1000, y: -1000 });
    expect([camera.x, camera.y]).toEqual([0, 0]);
  });

  it('never pans a level that fits the view', () => {
    const camera = new Camera({ viewWidth: 400, viewHeight: 300, worldWidth: 400, worldHeight: 300, zoom: 1 });
    camera.follow({ x: 399, y: 299 });
    expect([camera.x, camera.y]).toEqual([0, 0]);
  });

  it('centers a level smaller than the view', () => {
    const camera = new Camera({ viewWidth: 800, viewHeight: 300, worldWidth: 400, worldHeight: 300, zoom: 1 });
    camera.follow({ x: 200, y: 100 });
    expect(camera.x).toBe(-200);
  });

  describe('zoom', () => {
    const screen = { viewWidth: 1200, viewHeight: 675, worldWidth: 1380, worldHeight: 752 };

    it('fits the whole level when its tiles are large enough', () => {
      expect(getCameraZoom({ ...screen, hexWidthPx: 56, isTouch: false })).toBeCloseTo(1200 / 1380);
    });

    it('zooms in, so the view pans, when tiles would be too small to click', () => {
      const zoom = getCameraZoom({ ...screen, viewWidth: 600, viewHeight: 338, hexWidthPx: 25, isTouch: false });
      expect(zoom * 25).toBeCloseTo(CAMERA.minMouseTilePx);
    });

    it('zooms further on touch screens, so tiles can be tapped', () => {
      const zoom = getCameraZoom({ ...screen, hexWidthPx: 30, isTouch: true });
      expect(zoom * 30).toBeCloseTo(CAMERA.minTouchTilePx);
    });
  });
});

describe('WASD movement', () => {
  it('walks left and right along a row', () => {
    const game = makeGame();
    const tiles = hold(game, ['KeyD'], 12);
    const rows = new Set(tiles.map(({ j }) => j));
    expect(new Set(tiles.map(({ i }) => i)).size).toBeGreaterThan(2);
    expect(rows.size).toBe(1);
  });

  it('works from every tile on the map, in every direction that has somewhere to go', () => {
    const { board } = makeGame();
    const directions = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA']];
    const dirsOfKeys = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    let stuck = 0;
    PENINSULA_TILE_LOOKUP_VALS.forEach(tile => {
      directions.forEach(keys => {
        const game = makeGame({ playerTile: tile });
        const moved = hold(game, keys, 5).some(t => t.i != tile.i || t.j != tile.j);
        const input = game.gm.getPlayerInputHandler();
        const pressed = keys.map(k => dirsOfKeys[k]).join(' ');
        const hasRoom = input.getTileDirsFromPressedDir(pressed, tile).some(dir => {
          const offset = board.getTileOffsetFromDir(dir, tile);
          return board.getIsInBounds({ i: tile.i + offset.i, j: tile.j + offset.j });
        });
        if (hasRoom && !moved) stuck++;
      });
    });
    expect(stuck).toBe(0);
  });

  it('slides along the coast rather than stopping', () => {
    const { board } = makeGame();
    const tile = PENINSULA_TILE_LOOKUP_VALS.find(t => {
      const up = board.getTileOffsetFromDir('up', t);
      const upRight = board.getTileOffsetFromDir('up right', t);
      return !board.getIsInBounds({ i: t.i + up.i, j: t.j + up.j }) && board.getIsInBounds({ i: t.i + upRight.i, j: t.j + upRight.j });
    });
    const game = makeGame({ playerTile: tile });
    const tiles = hold(game, ['KeyW'], 6);
    expect(tiles.some(t => t.i != tile.i)).toBe(true);
  });

  it('turns as soon as a new direction is pressed', () => {
    const game = makeGame();
    const { gm, player } = game;
    const input = gm.getPlayerInputHandler();
    hold(game, ['KeyW'], 1);
    expect(player.dir).toBe('up');
    input.addKey('KeyS');
    input.removeKey('KeyW');
    gm.accTime += 110;
    player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    expect(player.dir).toBe('down');
  });

  it('stops when the keys are released', () => {
    const game = makeGame();
    const { gm, player } = game;
    const input = gm.getPlayerInputHandler();
    hold(game, ['KeyS'], 3);
    for (let k = 0; k < 8; k++) {
      gm.accTime += 110;
      player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    }
    expect(player.dir).toBe('idle');
    expect(player.getMoveToTiles()).toEqual([]);
    placePiece(gm, player, CENTER_TILE);
  });
});

describe('tile icons', () => {
  it('always have a usable rotation', () => {
    const { gm, board, settingsManager } = makeGame();
    const tile = board.tiles[CENTER_TILE.i][CENTER_TILE.j];
    Object.values(settingsManager.getAbilityAndTileStatusData()).forEach((status: any) => {
      tile.updateTileStatus({ updateKey: 1, tileStatus: status, currCount: 3, dirs: ['down'], teamIndex: 0, targetIndex: 0 });
      expect(Number.isFinite(tile.getRotation())).toBe(true);
    });
    expect(gm).toBeTruthy();
  });
});
