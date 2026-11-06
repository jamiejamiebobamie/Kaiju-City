import fs from 'node:fs';
import { applyLevelFile, getTileTone, LEVEL_FILES, LEVELS, RUN_SPEED_SCALE, TILE_TONES, updateMapWalkSites } from 'Game/DataClasses/Levels/levels';
import { rescaleLevelTiles } from 'Game/DataClasses/Levels/levelScale';
import aquarium from 'Game/DataClasses/Levels/data/aquarium.json';
import rapidTransit from 'Game/DataClasses/Levels/data/rapidTransit.json';
import { CAMPAIGN_SECTIONS, getIsLastSection } from './Campaign';
import { GameManager, GameResult, getRecruitLines } from './GameManager';
import { addUnlock, getUnlocks, saveRecruitChoice } from './Unlocks';
import { getIsAvatarOpen, getIsSkillOpen, ROSTER, saveAvatarColor, unlockRecruitSkill } from './Avatars';
import { PIECES_INFO as ROSTER_PIECES } from 'Utils/gameState';
import { getSciFiClass, SCI_FI_CLASSES } from './sciFiClasses';
import { SettingsManager } from './SettingsManager';
import { TRAIN_HIT } from './TrainSchedule';
import { GameBoardPieceKaiju } from './GameBoard/Pieces/GameBoardPieceKaiju';
import { PIECES_INFO } from 'Utils/gameState';
import { MASTER_PENINSULA as PENINSULA, MASTER_PENINSULA_TILES as PENINSULA_TILE_LOOKUP_VALS } from './masterPeninsula';
import { Camera, CAMERA, getCameraZoom, getCloseZoom, WIDE_SHOT } from './Camera';
import { getCharXAndY, getPerimeterEdges, getTileCenter, getTileIndexAtLocation, getTileXAndY } from './GameBoard/hexGrid';
import { CENTER_TILE, makeGame, placePiece } from './testHelpers';
import { storage } from 'Utils/storage';

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
      sceneElements.filter(({ phase }) => phase && !['trainLights', 'exitOpen', 'labTalk'].includes(phase)).forEach(({ phase }) => expect(ids).toContain(phase));
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

    it('closes the tracks as soon as the lights start, and opens them as the train leaves', () => {
      const { gm, board } = makeSubway();
      gm.trainSchedule.setStage('warning', 0);
      expect(board.getIsInBounds(trackTile)).toBe(false);
      gm.trainSchedule.setStage('train', 0);
      expect(board.getIsInBounds(trackTile)).toBe(false);
      gm.trainSchedule.setStage('clearing', 0);
      expect(board.getIsInBounds(trackTile)).toBe(true);
    });

    const runPiece = (gm, piece, ticks) => {
      const input = gm.getPlayerInputHandler();
      for (let k = 0; k < ticks; k++) {
        gm.accTime += 110;
        piece.movePiece({ accTime: gm.accTime, playerInputHandler: input });
      }
    };

    it('a teammate fighting a rival heads off the tracks on their own by the longest warning', () => {
      const settingsManager = new SettingsManager();
      settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
      settingsManager.setIsTeammate(true);
      const gm = new GameManager({ level: { ...LEVELS.rapidTransit, rival: undefined }, settingsManager });
      gm.initGame();
      const [player, teammate] = gm.getPieces();
      const rival = gm.gameBoardPiecesManager.addPiece({
        pieceClass: GameBoardPieceKaiju,
        pieceInfo: {
          ...PIECES_INFO.kaiju,
          abilities: settingsManager.getKaijuAbilities(0),
          spewFireCoolDown: 9000,
          maxLives: 3,
          moveSpeed: 3,
          isDoAvoidEnemy: false
        },
        teamIndex: 1
      });
      placePiece(gm, rival, LEVELS.rapidTransit.tileSets.train[0]);
      placePiece(gm, player, LEVELS.rapidTransit.tileSets.train[10]);
      placePiece(gm, teammate, trackTile);
      gm.accTime = 5000;
      gm.trainSchedule.setStage('warning', gm.accTime);
      gm.wideShotMs = 0;
      const longestWarningTicks = 90;
      for (let k = 0; k < longestWarningTicks; k++) {
        if (gm.trainSchedule.stage != 'warning') gm.trainSchedule.setStage('warning', gm.accTime);
        gm.stepPieces();
        gm.wideShotMs = 0;
      }
      expect(gm.gameBoardManager.getIsInBounds(teammate.getTileIndex())).toBe(true);
    });

    it('the player on the tracks is left to get off alone, and is hit if they stay', () => {
      const { gm, player } = makeSubway();
      player.initCharLocation(true, trackTile);
      const lives = player.lives;
      gm.accTime = 5000;
      gm.trainSchedule.setStage('warning', gm.accTime);
      expect(player.getMoveToTiles()).toEqual([]);
      runPiece(gm, player, 30);
      expect(player.getTileIndex()).toEqual(trackTile);
      gm.trainSchedule.setStage('train', gm.accTime);
      expect(player.lives).toBe(lives - TRAIN_HIT.dmg);
    });

    it('the player can click their way off the tracks during the warning', () => {
      const { gm, player, board } = makeSubway();
      const input = gm.getPlayerInputHandler();
      player.initCharLocation(true, trackTile);
      const lives = player.lives;
      gm.accTime = 5000;
      gm.trainSchedule.setStage('warning', gm.accTime);
      const center = getTileCenter(LEVELS.rapidTransit.grid, LEVELS.rapidTransit.tileSets.train[0]);
      input.updatePlayerDestinationAndClickedTileFromClick(gm.getClosestReachableTile(center));
      expect(player.getMoveToTiles().length).toBeGreaterThan(0);
      runPiece(gm, player, 300);
      expect(board.getIsInBounds(player.getTileIndex())).toBe(true);
      gm.trainSchedule.setStage('train', gm.accTime);
      expect(player.lives).toBe(lives);
    });

    it('the player can run off the tracks with the keys during the warning', () => {
      const { gm, player, board } = makeSubway();
      const input = gm.getPlayerInputHandler();
      player.initCharLocation(true, trackTile);
      gm.accTime = 5000;
      gm.trainSchedule.setStage('warning', gm.accTime);
      input.addKey('KeyA');
      runPiece(gm, player, 60);
      input.removeKey('KeyA');
      expect(board.getIsInBounds(player.getTileIndex())).toBe(true);
    });

    it('a path across the tracks keeps going if the player is on them when the lights start', () => {
      const { gm, player, board } = makeSubway();
      const onPlatform = LEVELS.rapidTransit.tileSets.train[0];
      player.initCharLocation(true, trackTile);
      player.updateMovmement(board.findPathFromTo(trackTile, onPlatform));
      const { length } = player.getMoveToTiles();
      gm.trainSchedule.setStage('warning', 0);
      expect(player.getMoveToTiles().length).toBe(length);
    });

    it('walking on open tiles, closed tiles stay off limits', () => {
      const { gm, board } = makeSubway();
      const onPlatform = LEVELS.rapidTransit.tileSets.train[0];
      gm.trainSchedule.setStage('warning', 0);
      expect(board.getIsInBounds(gm.getClosestReachableTile(getTileCenter(LEVELS.rapidTransit.grid, onPlatform)))).toBe(true);
      expect(board.findPathFromTo(onPlatform, trackTile)).toEqual([]);
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

  it('walking levels are the street, sewers and the first Lab visit', () => {
    const walking = Object.values(LEVELS).filter(level => level.isWalkingLevel).map(({ id }) => id).sort();
    expect(walking).toEqual(['labIntro', 'labTrap', 'mapAquarium', 'mapLab', 'mapRooftop', 'mapSubway', 'sewer1', 'sewer2', 'street', 'visit-aquarium', 'visit-rapidTransit', 'visit-rooftop']);
  });

  it('no level has goal tiles: map walks have sites instead', () => {
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
    expect(moveSpeedScale).toBeCloseTo(RUN_SPEED_SCALE);
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

describe('rivals', () => {
  const makeFight = levelId => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS[levelId], settingsManager });
    gm.initGame();
    return gm;
  };
  const stepUntilRival = gm => {
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    return gm.rivalPiece;
  };

  ['rapidTransit', 'rooftop', 'aquarium'].forEach(levelId => {
    it(`${levelId}: the bystander touches the part, then fights as an opposing piece`, () => {
      const gm = makeFight(levelId);
      expect(gm.rivalPiece.isShowHealthBarOnComponent).toBeFalsy();
      const rival = stepUntilRival(gm);
      expect(rival.isShowHealthBarOnComponent).toBe(true);
      expect(rival.isPlain).toBe(false);
      const { avatar, abilities, touchPhase, maxLives } = LEVELS[levelId].rival;
      expect(gm.getActivePhases()).toContain(touchPhase);
      expect(rival.avatar).toBe(avatar);
      expect(rival.teamIndex).not.toBe(gm.getPieces()[0].teamIndex);
      expect(rival.isNpc).toBe(true);
      expect(rival.maxLives).toBe(maxLives);
      expect(rival.abilities.length).toBe(abilities.length);
      expect(gm.getIsWalkable(rival.getTileIndex())).toBe(true);
    });
  });

  it('defeating the rival wins the level', () => {
    const gm = makeFight('rooftop');
    const rival = stepUntilRival(gm);
    expect(gm.getGameResult()).toBe(null);
    gm.accTime += 5000;
    rival.decrementHealth(gm.accTime, rival.maxLives);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('Peninsula has no rival, and still needs its Kaiju kills', () => {
    expect(LEVELS.peninsula.rival).toBeUndefined();
    expect(makeFight('peninsula').getKillsToWin()).toBeGreaterThan(1);
  });

  it('every level draws characters the same size against its tiles', () => {
    const getRowsTall = ({ pieceScale, grid }) => pieceScale / grid.rowStep;
    Object.values(LEVELS).forEach(level => expect(getRowsTall(level)).toBeCloseTo(getRowsTall(LEVELS.peninsula)));
  });
});

describe('the Lab catwalk', () => {
  const makeLab = () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Glass']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.lab, settingsManager });
    gm.initGame();
    return { gm, player: gm.getPieces()[0], input: gm.getPlayerInputHandler() };
  };
  const catwalkSpot = { x: 700, y: 130 };

  it('cannot be walked to', () => {
    const { gm, player } = makeLab();
    expect(LEVELS.lab.tileLinks).toEqual([]);
    const tile = gm.getClosestReachableTile(catwalkSpot);
    expect(getTileCenter(LEVELS.lab.grid, tile).y).toBeGreaterThan(300);
    expect(gm.gameBoardManager.findPathFromTo(player.getTileIndex(), { i: 27, j: 4 })).toEqual([]);
  });

  it('can be reached with Teleport', () => {
    const { gm, player, input } = makeLab();
    player.setShouldTeleport(true);
    const tile = gm.getClosestReachableTile(catwalkSpot);
    expect(getTileCenter(LEVELS.lab.grid, tile).y).toBeLessThan(200);
    input.updatePlayerDestinationAndClickedTileFromClick(tile);
    gm.accTime += 110;
    player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    expect(player.getTileIndex()).toEqual(tile);
    expect(player.shouldTeleport).toBe(false);
  });
});

describe('the Agents in the Lab', () => {
  const makeLab = () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.lab, settingsManager });
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    const [player] = gm.getPieces();
    player.maxLives = 1000;
    player.lives = 1000;
    return { gm, player };
  };
  const run = (gm, ticks) => {
    for (let k = 0; k < ticks; k++) gm.stepPieces();
  };
  const getAgents = gm => gm.getPieces().filter(piece => piece.avatar == 'agent' && !gm.extras.includes(piece));

  const dropCount = LEVELS.lab.agentDrops.drops.length;

  it('the Agent who did the talking fights from where he stood, then the rest come in one at a time', () => {
    const { gm } = makeLab();
    const [speaker] = getAgents(gm);
    expect(getAgents(gm).length).toBe(1);
    expect(speaker.isOnTiles).toBe(true);
    expect(speaker.isEntering).toBe(false);
    run(gm, 20);
    expect(getAgents(gm).length).toBe(2);
    run(gm, 400);
    expect(getAgents(gm).length).toBe(1 + dropCount);
  });

  it('each Agent has three powers, picked at random', () => {
    const { gm } = makeLab();
    run(gm, 400);
    getAgents(gm).forEach(agent => {
      const elements = agent.abilities.map(a => a.gameBoardPieceAbilityData.element);
      expect(new Set(elements).size).toBe(3);
    });
  });

  it('walk the catwalk from off-shot, drop, and land on the floor to fight', () => {
    const { gm } = makeLab();
    const getDropping = () => getAgents(gm).filter(piece => piece.isEntering);
    while (!getDropping().length) gm.stepPieces();
    const [agent] = getDropping();
    const { y } = agent.charLocation;
    expect(agent.charLocation.x).toBeLessThan(0);
    expect(agent.isOnTiles).toBe(false);
    let hasFallen = false;
    for (let k = 0; k < 200 && !agent.isOnTiles; k++) {
      gm.stepPieces();
      hasFallen = hasFallen || agent.isFalling;
    }
    expect(hasFallen).toBe(true);
    expect(agent.isOnTiles).toBe(true);
    expect(agent.isFalling).toBe(false);
    expect(agent.charLocation.y).toBeGreaterThan(y);
    expect(gm.getIsWalkable(agent.getTileIndex())).toBe(true);
    expect(agent.lives).toBe(4);
  });

  it('never teleport somewhere they could not walk back from', () => {
    const { gm } = makeLab();
    // a clone that dropped to the floor (the talker waits up on the catwalk)
    const getDropped = () => getAgents(gm).find(agent => agent != gm.catwalkAgent && agent.isOnTiles);
    while (!getDropped()) gm.stepPieces();
    const agent = getDropped();
    const board = gm.gameBoardManager;
    for (let k = 0; k < 40; k++) {
      const tile = board.getSafeTileIndex(agent.pieceIndex);
      expect(getTileCenter(LEVELS.lab.grid, tile).y).toBeGreaterThan(300);
    }
  });

  it('winning takes every Agent, the speaker too', () => {
    const { gm } = makeLab();
    run(gm, 400);
    const agents = getAgents(gm);
    const last = agents.pop();
    // hard enough to get through any extra lives their random powers gave them
    const finish = agent => agent.decrementHealth(gm.accTime, agent.maxLives + agent.livesModifier);
    agents.forEach(agent => {
      gm.accTime += 5000;
      finish(agent);
    });
    expect(gm.getGameResult()).toBe(null);
    gm.accTime += 5000;
    finish(last);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });
});

describe('campaign', () => {
  const levelIds = CAMPAIGN_SECTIONS.map(({ levelId }) => levelId);

  it('every section is a real level, or a story page', () => {
    levelIds.filter(Boolean).forEach(id => expect(LEVELS[id]).toBeDefined());
  });

  it('every label is its own, so the dev panel can tell them apart', () => {
    expect(new Set(CAMPAIGN_SECTIONS.map(({ label }) => label)).size).toBe(CAMPAIGN_SECTIONS.length);
  });

  it('after the first fight, Peninsula leads to a radio call, a map walk, then the recruit level', () => {
    expect(levelIds.slice(1, 4)).toEqual(['street', 'mapSubway', 'rapidTransit']);
    [['mapRooftop', 'rooftop'], ['mapAquarium', 'aquarium']].forEach(([map, side]) => {
      const index = levelIds.indexOf(map);
      expect(levelIds[index - 1]).toBe('peninsula');
      expect(levelIds[index + 1]).toBe(side);
      expect(CAMPAIGN_SECTIONS[index].radio({ powerName: 'Wildfire', choices: {} }).length).toBeGreaterThan(0);
    });
  });

  it('the battleground Lab comes before the Sewers, which lead to the Lab fight', () => {
    expect(levelIds.slice(levelIds.indexOf('mapLab'), levelIds.indexOf('lab') + 1)).toEqual(['mapLab', 'labTrap', 'sewer1', 'sewer2', 'lab']);
  });

  it('the walking Lab is an optional stop on the earlier map walks', () => {
    ['mapSubway', 'mapRooftop', 'mapAquarium'].forEach(id => expect(LEVELS[id].sites.some(({ isDetour }) => isDetour)).toBe(true));
    expect(levelIds).not.toContain('labIntro');
  });

  it('each Peninsula fight has more Kaiju than the last', () => {
    const kills = CAMPAIGN_SECTIONS.filter(({ levelId }) => levelId == 'peninsula').map(section => section.kills);
    expect(kills.slice(0, 3)).toEqual([10, 15, 20]);
    kills.forEach((count, index) => index && expect(count).toBeGreaterThan(kills[index - 1]));
  });

  it('ends on the Peninsula', () => {
    expect(levelIds[levelIds.length - 1]).toBe('peninsula');
    expect(getIsLastSection(levelIds.length - 1)).toBe(true);
    expect(getIsLastSection(0)).toBe(false);
  });
});

describe('cutscenes', () => {
  const makeGame = (level, hasArrival = false) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level, settingsManager, hasArrival });
    gm.initGame();
    return gm;
  };

  it('a fight opens on the whole level, pulls in, plays its words, then the part is touched', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    expect(gm.getCameraShot().isWide).toBe(true);
    const { accTime } = gm;
    const said = [];
    while (gm.cutscene) {
      gm.stepPieces();
      if (gm.speech && !said.includes(gm.speech.text)) said.push(gm.speech.text);
    }
    expect(said).toEqual(['Ooo... pretty...', "No, don't touch it!"]);
    expect(gm.accTime).toBe(accTime);
    expect(gm.getActivePhases()).toContain('eyeTouched');
    gm.stepPieces();
    expect(gm.getPieces().some(({ avatar }) => avatar == 'punk')).toBe(true);
  });

  it('on arrival the teammate stays hidden, runs up from the base into the shot, and calls out beside the player', () => {
    const gm = makeGame(LEVELS.peninsula, true);
    const [player, teammate] = gm.getPieces();
    expect(teammate.isVisible).toBe(false);
    while (gm.cutscene && !gm.cutscene.steps[gm.cutscene.index].arrivals) gm.stepPieces();
    expect(teammate.isVisible).toBe(true);
    const { world, cameraZoom } = LEVELS.peninsula;
    const viewHeight = world.height / cameraZoom;
    expect(teammate.charLocation.y - player.charLocation.y).toBeGreaterThan(viewHeight / 2);
    let speech = null;
    while (gm.cutscene) {
      gm.stepPieces();
      speech = gm.speech || speech;
    }
    expect(speech.text).toContain('Heads-up');
    expect(Math.abs(teammate.charLocation.y - player.charLocation.y)).toBeLessThan(viewHeight / 4);
    expect(gm.getIsWalkable(teammate.getTileIndex())).toBe(true);
  });

  it('on the Rooftop the team stands either side of her, turned to her', () => {
    const gm = makeGame(LEVELS.rooftop);
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    gm.startRecruitScene();
    const [player, teammate] = gm.getPieces();
    expect(teammate.charLocation.x).toBeLessThan(player.charLocation.x);
    expect(player.facingDir).toBe('downLeft');
    expect(teammate.facingDir).toBe('downRight');
  });

  it('after the fight the player stands over the rival, and the teammate is offset', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    const rival = gm.rivalPiece;
    gm.accTime += 5000;
    rival.decrementHealth(gm.accTime, rival.maxLives);
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
    gm.stepPieces();
    expect(gm.isSlowMotion).toBe(true);
    gm.startRecruitScene();
    const [player, teammate] = gm.getPieces();
    expect(player.charLocation.y).toBeLessThan(gm.recruitScene.body.y);
    expect(teammate.charLocation.x).toBeLessThan(player.charLocation.x);
    expect(gm.speech.lines).toEqual(getRecruitLines('him', []));
    expect(gm.recruitScene.shot.isFollowingMouse).toBeFalsy(); // the camera holds still for the choice
  });

  it('the Street opens on the Agent calling the team over, then its door opens after a full loop of the words', () => {
    const gm = makeGame(LEVELS.street);
    expect(gm.cutscene.steps.some(({ speech }) => speech && speech.text == LEVELS.street.greeting.text)).toBe(true);
    gm.skipCutscene();
    const [player] = gm.getPieces();
    const { exit } = LEVELS.street;
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(exit.spot));
    gm.stepPieces();
    expect(gm.getGameResult()).toBe(null);
    gm.accTime = exit.afterMs;
    gm.stepPieces();
    expect(gm.getActivePhases()).toContain('exitOpen');
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('the Lab fight opens with the Agent\'s reveal, each line once, and his Agents only drop afterward', () => {
    const gm = makeGame(LEVELS.lab);
    const seenLines = [];
    while (gm.cutscene) {
      if (gm.speech && seenLines.at(-1) != gm.speech.text) seenLines.push(gm.speech.text);
      gm.stepPieces();
    }
    const { script } = LEVELS.lab.showdown;
    expect(seenLines).toEqual(script.filter(({ who }) => who != 'teammate' || gm.getPieces().length > 1).map(({ text }) => text));
    expect(script.at(-1).text).toBe('Failed experiments.');
    expect(gm.extras.every(({ isVisible }) => !isVisible)).toBe(true);
    expect(gm.agentsDropped).toBe(0);
    expect(gm.accTime).toBe(0);
  });

  it('Sewer 2 plays its script, walks the team up to the parts, and ends in the light', () => {
    const gm = makeGame(LEVELS.sewer2);
    const [player] = gm.getPieces();
    const start = player.charLocation;
    while (gm.cutscene) gm.stepPieces();
    expect(player.charLocation).not.toEqual(start);
    expect(gm.getActivePhases()).toContain('blinding');
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });

  it('people standing in a scene are pieces, but nothing aims at them', () => {
    const gm = makeGame(LEVELS.street);
    const [agent] = gm.extras;
    expect(agent.avatar).toBe('agent');
    expect(gm.getPieces()).toContain(agent);
    expect(agent.isOnTiles).toBe(false);
    expect(gm.gameManagerProxy.getClosestEnemy(0)).toBeUndefined();
  });

  it('the Lab door is always open', () => {
    const gm = makeGame(LEVELS.labIntro);
    gm.stepPieces();
    expect(gm.getActivePhases()).toContain('exitOpen');
    expect(gm.gameBoardManager.getIsInBounds(gm.gameBoardManager.getClosestWalkableTileToLocation(LEVELS.labIntro.exit.spot))).toBe(true);
  });

  it('in the Lab trap the team faces the Agent, then Agents give chase in slow motion and the door opens', () => {
    const gm = makeGame(LEVELS.labTrap);
    const [player] = gm.getPieces();
    expect(player.getFacingDir()).toBe('up');
    const seenLines = [];
    while (gm.cutscene) {
      if (gm.speech && seenLines.at(-1) != gm.speech.text) seenLines.push(gm.speech.text);
      gm.stepPieces();
    }
    expect(seenLines).toEqual(LEVELS.labTrap.trap.script.filter(({ text, ifRecruits }) => text && !ifRecruits).map(({ text }) => text));
    expect(gm.getPieces()[0].isPlain).toBe(true); // the ray took their glow
    expect(gm.getPieces().filter(piece => piece.isChaser).length).toBe(LEVELS.labTrap.trap.chasers.xs.length);
    expect(gm.isChaseSlowed).toBe(true);
    expect(gm.gameBoardManager.moveSpeedScale).toBeLessThan(LEVELS.labTrap.moveSpeedScale);
    gm.stepPieces();
    expect(gm.getActivePhases()).toContain('exitOpen');
    gm.accTime = gm.chaseSlowEndsAt;
    gm.stepPieces();
    expect(gm.isChaseSlowed).toBe(false);
    expect(gm.gameBoardManager.moveSpeedScale).toBeCloseTo(LEVELS.labTrap.moveSpeedScale);
  });
});

describe('Charm', () => {
  const makeFight = () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.aquarium, settingsManager });
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    return { gm, player: gm.getPieces()[0], rival: gm.rivalPiece, board: gm.gameBoardManager };
  };
  const addSecondEnemy = gm => {
    const second = gm.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO.punk, abilities: [], maxLives: 6, moveSpeed: 1 }, teamIndex: 1 });
    second.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation({ x: 300, y: 700 }));
    return second;
  };
  const charmTile = (gm, board, piece, teamIndex) => {
    const { i, j } = piece.getTileIndex();
    const status = gm.settingsManager.getAbilityAndTileStatusData().isCharming;
    board.tiles[i][j].updateTileStatus({ updateKey: 0, tileStatus: status, currCount: 20, dirs: ['up'], teamIndex, targetIndex: piece.pieceIndex });
  };

  it('turns an enemy for five seconds, then lets them go', () => {
    const { gm, player, rival, board } = makeFight();
    addSecondEnemy(gm);
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(1000);
    expect(rival.isCharmed).toBe(true);
    expect(rival.teamIndex).toBe(player.teamIndex);
    rival.updateCharm(5999);
    expect(rival.isCharmed).toBe(true);
    rival.updateCharm(6000);
    expect(rival.isCharmed).toBe(false);
    expect(rival.teamIndex).toBe(rival.homeTeamIndex);
  });

  it('Spurned: once it breaks, they go for whoever charmed them, even with someone closer', () => {
    const { gm, player, rival, board } = makeFight();
    addSecondEnemy(gm);
    const teammate = gm.gameBoardPiecesManager.addPiece({ pieceInfo: { ...PIECES_INFO.girl, abilities: [] }, teamIndex: player.teamIndex });
    const { i, j } = rival.getTileIndex();
    board.tiles[i][j].updateTileStatus({
      updateKey: 0, tileStatus: gm.settingsManager.getAbilityAndTileStatusData().isCharming, currCount: 20, dirs: ['up'],
      teamIndex: player.teamIndex, targetIndex: rival.pieceIndex, cast: { ...board.tiles[i][j].cast, casterIndex: player.pieceIndex }
    });
    rival.updateCharm(1000);
    rival.updateCharm(6000);
    teammate.initCharLocation(true, rival.getTileIndex()); // right beside them
    expect(board.getClosestEnemy(rival.pieceIndex)).toBe(player);
    player.isDead = true;
    expect(board.getClosestEnemy(rival.pieceIndex)).not.toBe(player);
  });

  it('is spent on the enemy it touches', () => {
    const { gm, player, rival, board } = makeFight();
    addSecondEnemy(gm);
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(1000);
    const { i, j } = rival.getTileIndex();
    expect(board.tiles[i][j].getTileStatus()).toBeFalsy();
  });

  it('hurts instead, and does not charm, an enemy with no allies on the board', () => {
    const { gm, player, rival, board } = makeFight();
    const { lives } = rival;
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(5000);
    expect(rival.isCharmed).toBe(false);
    expect(rival.teamIndex).toBe(rival.homeTeamIndex);
    expect(rival.lives).toBe(lives - 1);
    const { i, j } = rival.getTileIndex();
    expect(board.tiles[i][j].getTileStatus()).toBeFalsy();
  });

  it('ends early once a charmed enemy has no old allies left', () => {
    const { gm, player, rival, board } = makeFight();
    const second = addSecondEnemy(gm);
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(1000);
    expect(rival.isCharmed).toBe(true);
    second.setIsDead(true);
    rival.updateCharm(1100);
    expect(rival.isCharmed).toBe(false);
  });

  it('a charmed enemy that dies still counts as a kill', () => {
    const { gm, player, rival, board } = makeFight();
    addSecondEnemy(gm);
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(gm.accTime);
    gm.accTime += 500;
    rival.decrementHealth(gm.accTime, rival.maxLives);
    expect(gm.score).toBe(1);
  });

  it('does not charm its own side, and reverses a charmed player\'s keys', () => {
    const { gm, player, rival, board } = makeFight();
    charmTile(gm, board, rival, rival.teamIndex);
    rival.updateCharm(gm.accTime);
    expect(rival.isCharmed).toBe(false);
    const input = gm.getPlayerInputHandler();
    input.addKey('KeyW');
    expect(input.getPressedDir()).toBe('up');
    charmTile(gm, board, player, rival.teamIndex);
    player.updateCharm(gm.accTime);
    expect(player.teamIndex).toBe(player.homeTeamIndex);
    expect(input.getPressedDir()).toBe('down');
  });

  it('Heal does not help a charmed enemy, even while they fight on the healer side', () => {
    const { gm, player, rival, board } = makeFight();
    addSecondEnemy(gm);
    charmTile(gm, board, rival, player.teamIndex);
    rival.updateCharm(1000);
    expect(rival.teamIndex).toBe(player.teamIndex);
    const { i, j } = rival.getTileIndex();
    const heal = gm.settingsManager.getAbilityAndTileStatusData().isHealing;
    board.tiles[i][j].updateTileStatus({ updateKey: 0, tileStatus: heal, currCount: 20, dirs: ['up'], teamIndex: player.teamIndex, targetIndex: -1 });
    expect(board.getDmg(rival.pieceIndex)).toBe(0);
    // aimed Heal looks for the most hurt of the healer's own team, which a charmed enemy never joins
    rival.lives = 1;
    expect(gm.gameBoardPiecesManager.getMostDmgedTeammate(player.pieceIndex)).not.toBe(rival);
    // the player's own heal still works on the player
    const spot = player.getTileIndex();
    board.tiles[spot.i][spot.j].updateTileStatus({ updateKey: 0, tileStatus: heal, currCount: 20, dirs: ['up'], teamIndex: player.teamIndex, targetIndex: -1 });
    expect(board.getDmg(player.pieceIndex)).toBeLessThan(0);
  });

  it('the Mermaid fights with Heal, Bubble and Charm', () => {
    expect(LEVELS.aquarium.rival.abilities).toEqual(['love', 'bubble', 'wink']);
    expect(makeFight().rival.abilities.length).toBe(3);
  });
});

describe('roster and unlocks', () => {
  const useStorage = () => storage.clear();
  afterEach(() => vi.unstubAllGlobals());

  it('seven characters, each with a sprite sheet, a portrait and a death sprite', () => {
    expect(ROSTER.length).toBe(7);
    ROSTER.forEach(({ id }) => {
      expect(fs.existsSync(`public/${ROSTER_PIECES[id].spriteSheetSrc}`)).toBe(true);
      expect(id == 'guy' || fs.existsSync(`public/levels/portraits/${id}.png`)).toBe(true);
      expect(fs.existsSync(`public/levels/dead/${id}.png`)).toBe(true);
    });
  });

  it('every combination of three powers has a class', () => {
    const powers = ['Bubble', 'Death', 'Fire', 'Glass', 'Ice', 'Lightning', 'Love', 'Metal', 'Water', 'Wink', 'Wood'];
    expect(Object.keys(SCI_FI_CLASSES).length).toBe(165);
    powers.forEach(a => powers.forEach(b => powers.forEach(c => {
      if (a < b && b < c) expect(getSciFiClass([c, a, b])).toBeDefined();
    })));
  });

  it('secret characters stay closed until they are unlocked', () => {
    useStorage();
    const hazmat = ROSTER.find(({ id }) => id == 'hazmat');
    expect(getIsAvatarOpen(hazmat)).toBe(false);
    addUnlock('hazmat');
    expect(getIsAvatarOpen(hazmat)).toBe(true);
    expect(getIsAvatarOpen(ROSTER[0])).toBe(true);
  });

  it('a recruit\'s power opens when they are terminated', () => {
    useStorage();
    expect(getIsSkillOpen('wink')).toBe(false);
    expect(getIsSkillOpen('fire')).toBe(true);
    expect(unlockRecruitSkill('mermaid').name).toBe('Charm');
    expect(getIsSkillOpen('wink')).toBe(true);
  });

  it('Teleport opens by beating the Agents', () => {
    useStorage();
    expect(getIsSkillOpen('glass')).toBe(false);
    expect(unlockRecruitSkill('agent').name).toBe('Teleport');
    expect(getIsSkillOpen('glass')).toBe(true);
  });

  it('a chosen teammate joins the team, and locked powers stay out of their kit', () => {
    useStorage();
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    settingsManager.setTeammateAvatar('punk');
    const gm = new GameManager({ level: LEVELS.peninsula, settingsManager });
    gm.initGame();
    expect(gm.getPieces()[1].avatar).toBe('punk');
    for (let k = 0; k < 200; k++) {
      const elements = settingsManager.getThreeRandomAbilities().map(({ gameBoardPieceAbilityData }) => gameBoardPieceAbilityData.element);
      ['wood', 'death', 'wink', 'glass'].forEach(element => expect(elements).not.toContain(element));
    }
  });

  it('a color from the vat stays with the character', () => {
    useStorage();
    saveAvatarColor('guy', '#123456');
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(false);
    const gm = new GameManager({ level: LEVELS.peninsula, settingsManager });
    gm.initGame();
    expect(gm.getPieces()[0].color).toBe('#123456');
  });

  it('in the Lab trap the ray leaves the recruits their glow, and they stay to fight with their powers', () => {
    useStorage();
    saveRecruitChoice('punk', 'recruit');
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.labTrap, settingsManager });
    gm.initGame();
    const tiles = gm.getPieces().map(piece => `${piece.getTileIndex().i} ${piece.getTileIndex().j}`);
    expect(new Set(tiles).size).toBe(tiles.length); // lined up, no one on top of anyone
    while (gm.cutscene) gm.stepPieces();
    const [player, teammate, punk] = gm.getPieces();
    expect(player.isPlain && teammate.isPlain).toBe(true);
    expect(punk.isPlain).toBeFalsy();
    expect(punk.abilities.length).toBeGreaterThan(0);
    expect(gm.getIsPowersOff(punk)).toBe(false);
    expect(gm.getIsPowersOff(teammate)).toBe(true);
    expect(teammate.escapeTile).toBeDefined();
    expect(punk.escapeTile).toBeUndefined();
    for (let k = 0; k < 40 && !gm.speech; k++) gm.stepPieces();
    expect(gm.speech.text).toBe(LEVELS.labTrap.trap.chaseLines.agent);
  });

  it('recruits walk with the team in the Sewers, and only recruits', () => {
    useStorage();
    saveRecruitChoice('punk', 'recruit');
    saveRecruitChoice('mermaid', 'terminate');
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.sewer1, settingsManager });
    gm.initGame();
    expect(gm.getPieces().map(({ avatar }) => avatar)).toEqual(['guy', 'girl', 'punk']);
    const [player, , punk] = gm.getPieces();
    expect(punk.teamIndex).toBe(player.teamIndex);
    for (let k = 0; k < 40; k++) gm.stepPieces();
    expect(punk.isDead).toBe(false);
  });
});

describe('fourth playtest', () => {
  const makeGame = (level, options = {}) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level, settingsManager, ...options });
    gm.initGame();
    return gm;
  };

  it('a teammate with no spawn tile of their own starts beside the player', () => {
    const [player, teammate] = makeGame(LEVELS.rapidTransit).getPieces();
    expect(Math.abs(teammate.tileIndex.i - player.tileIndex.i)).toBeLessThanOrEqual(1);
    expect(Math.abs(teammate.tileIndex.j - player.tileIndex.j)).toBeLessThanOrEqual(1);
  });

  it('the camera goes to the teammate for their line, and back to the part', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    const { focus } = LEVELS.rapidTransit.rival.intro;
    const seen = [];
    while (gm.cutscene) {
      const { point } = gm.getCameraShot();
      if (point && seen[seen.length - 1] != point) seen.push(point);
      gm.stepPieces();
    }
    expect(seen.length).toBe(3);
    expect(seen[0]).toBe(focus);
    expect(seen[1].x).toBeLessThan(focus.x / 2);
    expect(seen[2]).toBe(focus);
  });

  it('the arriving teammate has no tile highlight until their line is done', () => {
    const gm = makeGame(LEVELS.peninsula, { hasArrival: true });
    const [, teammate] = gm.getPieces();
    const getKey = ({ i, j }) => `${i} ${j}`;
    expect(gm.getPieceColorsLookup()[getKey(teammate.tileIndex)]).toBeUndefined();
    while (gm.cutscene) gm.stepPieces();
    expect(gm.getPieceColorsLookup()[getKey(teammate.tileIndex)]).toBeDefined();
  });

  it('with a train through, the camera pulls out while the player and Punk Guy are on platforms it cuts apart', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    gm.trainSchedule.setStage('train', gm.accTime);
    const board = gm.gameBoardManager;
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    const reachable = new Set(board.getReachableTiles(player.getTileIndex()).map(({ i, j }) => `${i} ${j}`));
    const across = board.walkableTiles.find(({ i, j }) => !reachable.has(`${i} ${j}`) && !board.getIsClosedTile({ i, j }));
    expect(across).toBeDefined();
    gm.rivalPiece.initCharLocation(true, across);
    expect(gm.getIsWideShot()).toBe(true);
    gm.rivalPiece.initCharLocation(true, player.getTileIndex()); // a Teleport brings them together
    expect(gm.getIsApartByTrain()).toBe(false);
  });

  it('a train hit that does not kill knocks them down as a ragdoll, and they get up 3 s later', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    const player = gm.gameBoardPiecesManager.getPlayerPiece();
    gm.knockDown(player, { ...player.charLocation });
    expect(player.isVisible).toBe(false);
    expect(gm.getDeathPieces().some(({ isKnockdown }) => isKnockdown)).toBe(true);
    expect(gm.getCameraShot()).toBeDefined(); // in close on the player
    const { accTime } = gm;
    for (let k = 0; k < 400 && gm.accTime < accTime + 3100; k++) gm.stepPieces();
    expect(player.isVisible).toBe(true);
    expect(gm.getDeathPieces().some(({ isKnockdown }) => isKnockdown)).toBe(false);
  });

  it('winning sends the train away for good', () => {
    const gm = makeGame(LEVELS.rapidTransit);
    while (gm.cutscene) gm.stepPieces();
    gm.stepPieces();
    gm.trainSchedule.setStage('train', gm.accTime);
    gm.accTime += 5000;
    gm.rivalPiece.decrementHealth(gm.accTime, gm.rivalPiece.maxLives);
    for (let k = 0; k < 200; k++) gm.stepPieces();
    expect(gm.getActivePhases()).not.toContain('train');
    expect(gm.getActivePhases()).not.toContain('trainLights');
  });

  it('the Peninsula Kaiju target comes from the section', () => {
    expect(makeGame(LEVELS.peninsula, { killsToWin: 15 }).getUiState().kaijuToWin).toBe(15);
  });

  it('every recruit lies at their own fixed spot on walkable ground, with room around them', () => {
    ['rapidTransit', 'rooftop', 'aquarium'].forEach(id => {
      const gm = makeGame(LEVELS[id]);
      const { recruitSpot } = LEVELS[id].rival;
      const tile = gm.gameBoardManager.getClosestWalkableTileToLocation(recruitSpot);
      const { x, y } = getTileCenter(LEVELS[id].grid, tile);
      expect(Math.hypot(x - recruitSpot.x, y - recruitSpot.y)).toBeLessThan(LEVELS[id].grid.rowStep * 2);
    });
  });

  it('swapping avatars changes the pieces already in the scene', () => {
    const gm = makeGame(LEVELS.labIntro);
    gm.changeTeamAvatars('punk', 'mermaid');
    expect(gm.getPieces().slice(0, 2).map(({ avatar }) => avatar)).toEqual(['punk', 'mermaid']);
    expect(gm.getPieces()[0].spriteSheetSrc).toContain('punk');
  });

  it('a door opens from a nearby tile, not one exact tile', () => {
    const gm = makeGame(LEVELS.labIntro);
    const [player] = gm.getPieces();
    const { exit } = LEVELS.labIntro;
    gm.activePhases.add('exitOpen');
    const { rowStep } = LEVELS.labIntro.grid;
    // walking right along the floor, below the back wall, doesn't take it
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation({ x: exit.spot.x, y: exit.spot.y + rowStep * 2.2 }));
    expect(gm.getGameResult()).toBe(null);
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation({ x: exit.spot.x, y: exit.spot.y + rowStep }));
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
  });
});

describe('playtest fixes', () => {
  const makeGame = (level, isTeammate = false) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(isTeammate);
    const gm = new GameManager({ level, settingsManager });
    gm.initGame();
    return { gm, settingsManager, player: gm.getPieces()[0], input: gm.getPlayerInputHandler() };
  };

  it('nobody but the Kaiju gets Kaiju Fire, and a kit has no repeats', () => {
    const { settingsManager } = makeGame(LEVELS.peninsula);
    for (let k = 0; k < 300; k++) {
      const elements = settingsManager.getThreeRandomAbilities().map(({ gameBoardPieceAbilityData }) => gameBoardPieceAbilityData.element);
      expect(elements).not.toContain('kaijuFire');
      expect(new Set(elements).size).toBe(3);
    }
  });

  it('letting go of a key still ends on the center of the assigned tile', () => {
    const { gm, player, input } = makeGame(LEVELS.rooftop);
    const tick = () => {
      gm.accTime += 110;
      player.movePiece({ accTime: gm.accTime, playerInputHandler: input });
    };
    for (let held = 1; held < 12; held++) {
      input.addKey('KeyD');
      for (let k = 0; k < held; k++) tick();
      input.removeKey('KeyD');
      for (let k = 0; k < 30; k++) tick();
      const { x, y } = gm.gameBoardManager.getCharXAndYFromTileIndex(player.getTileIndex());
      expect(player.charLocation.x).toBeCloseTo(x);
      expect(player.charLocation.y).toBeCloseTo(y);
    }
  });

  it('the train warning keeps the camera close: the lights show in panels instead', () => {
    const { gm } = makeGame({ ...LEVELS.rapidTransit, rival: undefined });
    gm.trainSchedule.setStage('warning', 0);
    expect(gm.getActivePhases()).toContain('trainLights');
    expect(gm.getIsWideShot()).toBe(false);
    const { accTime } = gm;
    gm.stepPieces();
    expect(gm.accTime).toBeGreaterThan(accTime);
  });

  it('the camera stays close while an Agent enters (its caret shows it), and the game keeps going', () => {
    const { gm } = makeGame(LEVELS.lab);
    while (gm.cutscene) gm.stepPieces();
    const getDropping = () => gm.getPieces().filter(piece => piece.isEntering && !piece.isDead);
    for (let k = 0; k < 200 && !getDropping().length; k++) gm.stepPieces();
    expect(gm.getIsWideShot()).toBe(false);
    const [agent] = getDropping();
    const { accTime } = gm;
    for (let k = 0; k < 200 && !agent.isOnTiles; k++) gm.stepPieces();
    expect(gm.accTime).toBeGreaterThan(accTime);
    expect(gm.getIsWideShot()).toBe(false);
  });

  it('the camera moves to the teammate when the player is down', () => {
    const { gm, player } = makeGame(LEVELS.rooftop, true);
    expect(gm.getFocusPiece()).toBe(player);
    gm.accTime += 5000;
    player.decrementHealth(gm.accTime, player.maxLives);
    expect(gm.getFocusPiece()).toBe(gm.getPieces()[1]);
  });

  it('reaching the site ends a map walk', () => {
    const { gm, player } = makeGame(LEVELS.mapRooftop);
    expect(gm.getGameResult()).toBe(null);
    const [site] = LEVELS.mapRooftop.sites;
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation({ x: site.spot.x + 30, y: site.spot.y }));
    expect(gm.getGameResult()).toBe(GameResult.PlayerWon);
    expect(gm.reachedSite).toBe(site);
  });

  it("stepping on the sweeper's tile unlocks the hazmat worker, once the Agent has had his say", () => {
    storage.clear();
    const { gm, player } = makeGame(LEVELS.street);
    if (gm.cutscene) gm.skipCutscene();
    player.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(LEVELS.street.unlock.spot));
    gm.stepPieces();
    expect(gm.unlockMessage).toBeFalsy(); // the Agent is still talking
    gm.accTime = LEVELS.street.unlock.afterMs;
    gm.stepPieces();
    expect(gm.unlockMessage).toContain('Hazmat');
    expect(getUnlocks()).toContain('hazmat');
    vi.unstubAllGlobals();
  });

  it('the sewers have no bystanders standing in them', () => {
    [LEVELS.sewer1, LEVELS.sewer2].forEach(({ sceneElements }) => expect(sceneElements.filter(({ type }) => type == 'npc')).toEqual([]));
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
    const gm = new GameManager({ level: { ...LEVELS.rapidTransit, rival: undefined }, settingsManager });
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

  it('walking scenes sit at the whole scene', () => {
    Object.values(LEVELS).filter(({ isWalkingLevel, isMapWalk }) => isWalkingLevel && !isMapWalk).forEach(({ cameraZoom }) => expect(cameraZoom).toBe(1));
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

const settle = (camera, player, aim, enemy = undefined) => {
  for (let k = 0; k < 60; k++) camera.lookToward(player, aim, enemy);
};

describe('enemy zoom', () => {
  const makeCamera = () => new Camera({ viewWidth: 400, viewHeight: 400, worldWidth: 4000, worldHeight: 4000, zoom: 2 });
  const player = { x: 2000, y: 2000 };
  const still = { x: 0, y: 0 };

  it('stays put while the enemy is already in view', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    settle(camera, player, still, { x: 2050, y: 2000 });
    expect(camera.zoom).toBe(2);
  });

  it('eases out to show a farther enemy, with both in view', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    const enemy = { x: 2150, y: 2000 };
    settle(camera, player, still, enemy);
    expect(camera.zoom).toBeLessThan(2);
    const viewWidth = 400 / camera.zoom;
    [player.x, enemy.x].forEach(x => {
      expect(x).toBeGreaterThan(camera.x);
      expect(x).toBeLessThan(camera.x + viewWidth);
    });
  });

  it('stops at its limit for a far enemy, keeping the player in view and giving that enemy a caret', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    const enemy = { x: 3500, y: 2000 };
    settle(camera, player, still, enemy);
    expect(camera.zoom).toBeCloseTo(2 * CAMERA.enemyZoomOut);
    const viewWidth = 400 / camera.zoom;
    expect(player.x).toBeGreaterThan(camera.x);
    expect(player.x).toBeLessThan(camera.x + viewWidth);
    expect(camera.getEdgeCaret(enemy, player, 20)).toBeDefined();
  });

  it('zooms back in when the enemy is gone', () => {
    const camera = makeCamera();
    camera.centerOn(player);
    settle(camera, player, still, { x: 3500, y: 2000 });
    settle(camera, player, still);
    expect(camera.zoom).toBeCloseTo(2);
  });
});

describe('Rooftop', () => {
  it('matches Peninsula: tile size, character size, and tiles on screen', () => {
    const frame = { width: 1600, height: 900 };
    const getTilePx = ({ world, grid, cameraZoom }) => grid.rowStep * cameraZoom * Math.min(frame.width / world.width, frame.height / world.height);
    ['rooftop'].forEach(id => {
      expect(LEVELS[id].grid.rowStep).toBeCloseTo(LEVELS.peninsula.grid.rowStep);
      expect(LEVELS[id].pieceScale).toBeCloseTo(LEVELS.peninsula.pieceScale);
      expect(getTilePx(LEVELS[id]) / getTilePx(LEVELS.peninsula)).toBeCloseTo(1, 1);
    });
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
    settle(camera, player, { x: 1, y: 1 });
    expect(camera.zoom).toBeCloseTo(2 * (1 - CAMERA.lookZoomOut));
    const viewWidth = 400 / camera.zoom;
    expect(player.x).toBeGreaterThan(camera.x);
    expect(player.x).toBeLessThan(camera.x + viewWidth);
  });

  it('never zooms out past the edges of the level', () => {
    const camera = new Camera({ viewWidth: 1400, viewHeight: 787, worldWidth: 1408, worldHeight: 768, zoom: 1.05 });
    settle(camera, { x: 700, y: 400 }, { x: 1, y: 0 });
    expect(camera.zoom).toBeCloseTo(787 / 768);
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

describe('recruit calls', () => {
  it('a called recruit fights beside the team with their rival powers, without a HUD of their own', () => {
    const { gm } = makeGame({ isTeammate: true });
    const huds = gm.getUiState().players.length;
    expect(gm.callRecruit('punk')).toBe(true);
    const recruit = gm.getPieces().find(piece => piece.isRecruit);
    expect(recruit.getTeamIndex()).toBe(gm.gameBoardPiecesManager.getPlayerTeamIndex());
    expect(recruit.isNpc).toBe(true);
    expect(recruit.abilities.map(a => a.gameBoardPieceAbilityData.element).sort()).toEqual(['glass', 'metal', 'wood']);
    expect(gm.getUiState().players.length).toBe(huds);
  });

  it('a recruit still standing keeps the fight going once the player and teammate are down', () => {
    const { gm } = makeGame();
    gm.callRecruit('mermaid');
    gm.gameBoardPiecesManager.getPlayerPiece().isDead = true;
    expect(gm.getGameResult()).toBe(null);
    gm.getPieces().filter(piece => piece.isRecruit).forEach(piece => { piece.isDead = true; });
    expect(gm.getGameResult()).toBe(GameResult.PlayerLost);
  });

  it('no one can be called during a cutscene', () => {
    const { gm } = makeGame();
    gm.cutscene = { steps: [], index: 0, msLeft: 0 };
    expect(gm.callRecruit('punk')).toBe(false);
  });
});

describe('recruits', () => {
  it('the teammate speaks of Punk Girl and the Aquarium Worker as her, and Punk Guy as him', () => {
    expect(LEVELS.rooftop.rival.pronoun).toBe('her');
    expect(LEVELS.aquarium.rival.pronoun).toBe('her');
    expect(LEVELS.rapidTransit.rival.pronoun).toBe('him');
    expect(getRecruitLines('her').join(' ')).toContain('study her DNA to get her power');
    expect(getRecruitLines('him').join(' ')).toContain('study his DNA to get his power');
  });

  it('the choice talk changes each time: the last choice, then a pattern', () => {
    expect(getRecruitLines('him', ['recruit'])[0]).toMatch(/joined the crew/);
    expect(getRecruitLines('him', ['terminate'])[0]).toMatch(/power for ourselves/);
    expect(getRecruitLines('her', ['terminate', 'terminate'])[0]).toBe("I guess we're going to terminate her, like the others?");
    expect(getRecruitLines('her', ['recruit', 'terminate']).join(' ')).toMatch(/crew member.*harvest her power/);
  });

  it('a called recruit has a HUD of their own, apart from the team', () => {
    const { gm } = makeGame({ isTeammate: true });
    expect(gm.getUiState().recruits).toEqual([]);
    gm.callRecruit('black_female');
    const { recruits, players } = gm.getUiState();
    expect(recruits.map(({ gender }) => gender)).toEqual(['black_female']);
    expect(players.map(({ gender }) => gender)).not.toContain('black_female');
  });

  it('the Aquarium Worker and Punk Girl say more before their fights', () => {
    const getText = level => level.rival.intro.lines.map(({ text }) => text).join(' ');
    expect(getText(LEVELS.aquarium)).toMatch(/must've worked here/);
    expect(getText(LEVELS.rooftop)).toMatch(/ancestors/);
    expect(LEVELS.aquarium.rival.intro.lines[0].name).toBe('Aquarium Worker');
  });
});

describe('Slippery', () => {
  const getStopTile = isSlippery => {
    const game = makeGame();
    game.player.slipperyModifier = isSlippery ? 1 : 0;
    hold(game, ['KeyW'], 6);
    hold(game, [], 30); // let go, and let it come to a stop
    return game.player.tileIndex;
  };

  it('a slippery piece stops one tile later than it would', () => {
    const still = getStopTile(false);
    const slid = getStopTile(true);
    expect(slid.i).toBe(still.i);
    expect(still.j - slid.j).toBe(1);
  });
});

describe('the Lab Trap', () => {
  it('when the chase starts, the teammate runs for the exit and is gone once there', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.labTrap, settingsManager });
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    const [player, teammate] = gm.getPieces();
    player.maxLives = 1000;
    player.lives = 1000;
    expect(teammate.escapeTile).toBeDefined();
    for (let k = 0; k < 600 && teammate.isVisible; k++) gm.stepPieces();
    expect(teammate.isVisible).toBe(false);
    expect(gm.getGameResult()).toBe(null); // the player still has to get out
  });

  it('recruits are in the scene', () => {
    expect(LEVELS.labTrap.hasRecruitFollowers).toBe(true);
  });
});

describe('visiting battlegrounds from the map', () => {
  afterEach(() => updateMapWalkSites([]));

  it('a battleground won on shows on the later map walks, as a stop off the walk', () => {
    expect(LEVELS.mapRooftop.sites.some(site => site.visitLevelId)).toBe(false);
    updateMapWalkSites(['rapidTransit']);
    const visit = LEVELS.mapRooftop.sites.find(site => site.visitLevelId);
    expect(visit.visitLevelId).toBe('visit-rapidTransit');
    expect(visit.isDetour).toBe(true);
    // the walk to the Subway itself isn't doubled up
    expect(LEVELS.mapSubway.sites.filter(({ icon }) => icon == 'subway').length).toBe(1);
  });

  it('a visit is a walk: no bystander, no trains, the teammate has a word, and a door back', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS['visit-rapidTransit'], settingsManager });
    gm.initGame();
    expect(gm.rivalPiece).toBeUndefined();
    expect(gm.trainSchedule).toBeUndefined();
    expect(gm.speech.text).toMatch(/Not much to do here/);
    while (gm.cutscene && gm.speech.text.startsWith('Not')) gm.stepPieces();
    expect(gm.speech.text).toMatch(/good place to train/);
    expect(LEVELS['visit-rapidTransit'].exit).toBeDefined();
  });

  const makeWalk = (level, options = {}) => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level, settingsManager, ...options });
    gm.initGame();
    while (gm.cutscene) gm.stepPieces();
    return gm;
  };

  it('starting a walk beside a site, or coming back out of one, does not walk straight into it', () => {
    updateMapWalkSites(['rooftop']);
    const fromStart = makeWalk(LEVELS.mapAquarium); // the walk starts by the Rooftop
    fromStart.stepPieces();
    expect(fromStart.getIsAtGoal()).toBe(false);
    const rooftop = LEVELS.mapAquarium.sites.find(({ visitLevelId }) => visitLevelId == 'visit-rooftop');
    const back = makeWalk(LEVELS.mapAquarium, { returnSpot: rooftop.spot });
    back.stepPieces();
    expect(back.getIsAtGoal()).toBe(false);
    expect(back.getIsPlayerNear(rooftop.spot, 6)).toBe(true); // beside it, all the same
  });
});

describe('playing again after a loss', () => {
  it('the opening scene is skipped, and everything it set up is in place', () => {
    const settingsManager = new SettingsManager();
    settingsManager.setSortedPlayerChosenAbilityElementsString(['Fire', 'Ice', 'Water']);
    settingsManager.setIsTeammate(true);
    const gm = new GameManager({ level: LEVELS.rapidTransit, settingsManager, isRetry: true });
    gm.initGame();
    expect(gm.cutscene).toBeUndefined();
    expect(gm.speech).toBeNull();
    expect(gm.getActivePhases()).toContain(LEVELS.rapidTransit.rival.touchPhase);
    expect((gm.rivalPiece as any).isPlain).toBe(false);
  });
});

describe('map walks', () => {
  it('only show battlegrounds won before this point in the campaign', () => {
    const getIcons = id => LEVELS[id].sceneElements.filter(({ id: elementId }) => elementId.endsWith('Icon')).map(({ id: elementId }) => elementId);
    updateMapWalkSites(['rooftop', 'rapidTransit']);
    expect(getIcons('mapSubway')).not.toContain('rooftopIcon');
    expect(getIcons('mapAquarium')).toContain('rooftopIcon');
    expect(getIcons('mapAquarium')).toContain('subwayIcon');
    updateMapWalkSites([]);
  });
});
