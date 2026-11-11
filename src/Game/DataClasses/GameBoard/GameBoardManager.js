import { TILE_DIRS, TILE_DIR_NORM_VECS, TILE_STATUS_RANKS } from 'Utils/gameState';

// a way turned toward another, by at most 'steps' sixths of a turn (the tile ways run clockwise in TILE_DIRS)
export const turnToward = (from, to, steps) => {
    const a = TILE_DIRS.indexOf(from);
    const b = TILE_DIRS.indexOf(to);
    if (a < 0 || b < 0) return to;
    const clockwise = (b - a + 6) % 6;
    const turn = clockwise <= 3 ? Math.min(clockwise, steps) : -Math.min(6 - clockwise, steps);
    return TILE_DIRS[(a + turn + 6) % 6];
};
import { getRandomIntInRange, getDistanceToFrom, getNormVecFromDestAndOrigin } from 'Game/utils'
import { GameBoardTile } from 'Game/DataClasses/GameBoard/Tile/GameBoardTile'
import { findPath } from 'Game/DataClasses/GameBoard/findPath'
import { getCharXAndY, getTileCenter, getTileIndexAtLocation, getTileXAndY } from 'Game/DataClasses/GameBoard/hexGrid'

// powers aim at a Kaiju walking in, ahead of the closest enemy on the tiles, once it is this many tiles from stepping on (Jamie)
export const AIM_ENTERING_TILES = 2;

// a used wormhole stays in sight this long after its link has gone, for the walk through it
export const WORMHOLE_USED_MS = 2500;

// how much pathing avoids the tiles around enemies, in tiles
const ENEMY_NEARBY_TILE_COST = 4;

// how far off a wall's line a tile can sit and still be part of the wall, in half-rows
const WALL_TOLERANCE = 0.2;

export class GameBoardManager {
    constructor({ level, gameManagerProxy }) {
        this.gameManagerProxy = gameManagerProxy;
        this.updateProxyProps = undefined;
        this.clickedTileIndex = undefined;
        this.hoveredTileIndex = undefined;
        this.tiles = []; // per tile (unique 'i' and 'j') rendering and tile status info
        this.activeTiles = []; // tiles with something to draw on them
        this.level = level;
        this.grid = level.grid;
        this.numTileColumns = level.grid.columns;
        this.numTileRows = level.grid.rows;
        this.scale = level.grid.scale;
        this.moveSpeedScale = level.moveSpeedScale;
        this.walkableTiles = level.walkableTiles;
        this.walkableRevision = 0;
        this.closedTileKeys = new Set(); // tiles taken away for now, eg. the tracks while a train is due
        this.walkableTileKeys = new Set(level.walkableTiles.map(({ i, j }) => `${i} ${j}`));
        this.linkedTiles = new Map(level.tileLinks.flatMap(([a, b]) => [[`${a.i} ${a.j}`, b], [`${b.i} ${b.j}`, a]]));
        this.wormholes = []; // links a teleport leaves behind for a while: { from, to, startsAt, endsAt }
    }

    // anyone can go through, both ways, until it closes. a tile the level already links keeps its own link.
    addWormhole = (from, to, accTime, durationMs) => {
        const getKey = ({ i, j }) => `${i} ${j}`;
        if (getKey(from) == getKey(to) || this.linkedTiles.has(getKey(from)) || this.linkedTiles.has(getKey(to))) return;
        this.linkedTiles.set(getKey(from), to);
        this.linkedTiles.set(getKey(to), from);
        this.wormholes.push({ from, to, startsAt: accTime, endsAt: accTime + durationMs });
    }

    /*
        A Teleport's wormhole is good for one trip besides the Teleport's own (Jamie): it shuts as someone goes through,
        so two side by side can't pass a piece back and forth forever. The link goes at once; the portal stays in sight a
        moment longer, for the walk through it. The bosses' own portals (open until shut) stay.
    */
    useWormhole = (tile, accTime) => {
        const getKey = ({ i, j }) => `${i} ${j}`;
        const wormhole = this.wormholes.find(({ from, to, endsAt }) => endsAt < Infinity && [from, to].some(end => getKey(end) == getKey(tile)));
        if (!wormhole) return;
        [wormhole.from, wormhole.to].forEach(end => this.linkedTiles.delete(getKey(end)));
        wormhole.endsAt = Math.min(wormhole.endsAt, accTime + WORMHOLE_USED_MS);
    }

    // a wormhole closes when its time is up, or early when the tile at either end is gone (the Subway's tracks, a train in. Jamie)
    updateWormholes(accTime) {
        const getIsOpen = ({ from, to, endsAt }) => endsAt > accTime && this.getIsInBounds(from) && this.getIsInBounds(to);
        const [open, closed] = [this.wormholes.filter(getIsOpen), this.wormholes.filter(wormhole => !getIsOpen(wormhole))];
        closed.forEach(({ from, to }) => [from, to].forEach(({ i, j }) => this.linkedTiles.delete(`${i} ${j}`)));
        this.wormholes = open;
    }

    getWormholes() {
        return this.wormholes;
    }

    // every portal shut at once, links and all (a boss's own teleport: the Rooftop scream, the Mermaid's portal)
    closeWormholes() {
        this.updateWormholes(Infinity);
    }

    initTiles() {
        const tiles = [];
        for (let i = 0; i < this.numTileColumns; i++) {
            const row = []
            for (let j = 0; j < this.numTileRows; j++) {
                const tileIndex = { i, j };
                const newTile = new GameBoardTile({
                    tileIndex,
                    isVisible: this.getIsInBounds(tileIndex),
                    tileLocation: this.getTileXAndYFromTileIndex(tileIndex),
                    zIndex: this.getFlattenedArrayIndex(tileIndex),
                    scale: this.scale
                })
                row.push(newTile);
            }
            tiles.push(row);
        }
        this.tiles = tiles;
        this.activeTiles = tiles.flat().filter(tile => tile.getIsVisible());
    }

    getClickedTileIndex = () => {
        return this.clickedTileIndex;
    }

    getHoveredTileIndex = () => {
        return this.hoveredTileIndex;
    }

    setClickedTileIndex = (clickedTileIndex) => {
        this.clickedTileIndex = clickedTileIndex;
    }

    clearClickedTileIndex = () => {
        this.clickedTileIndex = undefined;
    }

    setHoveredTileIndex = (hoveredTileIndex) => {
        this.hoveredTileIndex = hoveredTileIndex;
    }

    getNumTileColumns() {
        return this.numTileColumns;
    }

    getTilesInFlatArray() {
        return this.tiles.flat();
    }

    getActiveTiles() {
        return this.activeTiles;
    }

    resetTiles() {
        this.tiles = [];
    }

    setUpdateProxyProps(updateMethod) {
        this.updateProxyProps = updateMethod;
    }

    updateTileWithAbilityStatus = ({
        accTime,
        pieceIndex,
        appliedStatus,
        isBuffed = false,
        stackRange = 0, // from casting the same power again and again
        areaBonus = 0 // eg. Bubble's Fizz Out: below 0 makes it smaller
    }) => {
        const self = this.gameManagerProxy.getPiece(pieceIndex);
        const pieceTileIndex = self.getTileIndex();

        const abilityAndTileStatusData = this.gameManagerProxy.getAbilityAndTileStatusData();
        const tileStatus = abilityAndTileStatusData[appliedStatus];

        // teleporting moves the piece. it does not put a status on the board.
        if (appliedStatus == 'isTeleportTile') {
            self.setShouldTeleport(true);
            return;
        }

        // determine target of power
        let target = self;
        if (appliedStatus == 'isHealing') {
            const teammate = this.gameManagerProxy.getMostDmgedTeammate(pieceIndex);
            if (!!teammate) {
                target = teammate;
            }
        } else {
            // the closest enemy on the tiles, or a Kaiju about to step onto them (getClosestAimTarget)
            const enemy = this.getClosestAimTarget(pieceIndex);
            if (!!enemy) {
                target = enemy;
            }
        }

        const targetTileIndex = target.getTileIndex();
        const area = self.numTilesModifier || areaBonus ? Math.max(tileStatus.area + self.numTilesModifier + areaBonus, 1) : tileStatus.area;

        /*
            1. get the 'tileIndex' of the tile to update with the 'appliedStatus'
            2. also: get the directions ('dirs') the status will spread in
                from that tile on next update

            with no target to aim at, shoot in the direction the piece is facing.
        */
        const isTargetOnSameTile = !!target.isOnTiles && targetTileIndex.i == pieceTileIndex.i && targetTileIndex.j == pieceTileIndex.j;
        const [tileIndex, dirs] = target == self || isTargetOnSameTile ?
            this.getAdjacentTilesFromNormVec(pieceTileIndex, this.getNormVecFromAnimDir(self.getFacingDir()), area)
            : this.getTilesTowardPiece(pieceTileIndex, target, area);

        const targetIndex = target.getPieceIndex();
        const teamIndex = self.getTeamIndex();

        // 'Dispel' keeps its size. it is not affected by the range modifier.
        const rangeBonus = (appliedStatus == 'isBubble' ? 0 : self.tileCountModifier) + (isBuffed ? tileStatus.buffedCastBonus.range : 0) + stackRange;
        const range = tileStatus.range + rangeBonus;
        const cast = {
            casterIndex: pieceIndex,
            trailBonus: isBuffed ? tileStatus.buffedCastBonus.trailTicks : 0,
            isForwardWave: false,
            rangeBonus,
            isSmoke: false
        };

        const castOnTile = (castTileIndex, isForwardWave) => {
            if (!this.getIsInBounds(castTileIndex)) return;
            const tile = this.tiles[castTileIndex.i][castTileIndex.j];
            if (tile.getCanApplyStatus(tileStatus)) {
                tile.updateTileStatus({ updateKey: accTime, tileStatus, currCount: range, dirs: [...dirs], teamIndex, targetIndex, cast: isForwardWave ? { ...cast, isForwardWave } : cast });
            }
        };
        castOnTile(tileIndex, false);
        // the first wave rolls back before it comes forward, so the two waves arrive one after the other
        if (tileStatus.hasForwardWave) {
            const offset = this.getTileOffsetFromDir(dirs[0], tileIndex);
            castOnTile({ i: tileIndex.i + offset.i, j: tileIndex.j + offset.j }, true);
        }
    };

    /*
        Every tile reads the current board, then every tile updates together,
        so the order of the update loops has no effect on where a status goes.
    */
    updateTileState(accTime) {
        this.accTime = accTime;
        const contenders = {};
        for (let i = 0; i < this.numTileColumns; i++) {
            for (let j = 0; j < this.numTileRows; j++) {
                this.addContendersFromTile(this.tiles[i][j], contenders);
            }
        }

        const { lookup, highlightedTileIndices } = this.getHighlightedTiles();
        const teleportTileKey = this.getTeleportTileKey(highlightedTileIndices);
        const { isTeleportTile } = this.gameManagerProxy.getAbilityAndTileStatusData();
        this.activeTiles = [];

        for (let i = 0; i < this.numTileColumns; i++) {
            for (let j = 0; j < this.numTileRows; j++) {
                const tile = this.tiles[i][j];
                const key = `${i} ${j}`;
                const winner = this.getWinningContender(contenders[key]);

                tile.setUpdateKey(accTime);
                if (winner) {
                    tile.updateTileStatus({ updateKey: accTime, ...winner.getTileStatusValues() });
                } else {
                    tile.clearTileStatus();
                }

                // update player tile highlight from hovered or clicked tile
                tile.setIsHighlighted(tile.getIsVisible() && lookup.has(key));
                tile.setTeleportTileStatus(teleportTileKey == key ? isTeleportTile : undefined);
                if (tile.getIsVisible()) this.activeTiles.push(tile);
            }
        }
    }

    // the highest ranked status wins. among the same status, the highest count wins.
    getWinningContender(tileContenders = []) {
        if (!tileContenders.length) return undefined;
        const getRank = contender => TILE_STATUS_RANKS[contender.getAppliedStatus()];
        const winningRank = Math.min(...tileContenders.map(getRank));
        const winners = tileContenders.filter(contender => getRank(contender) == winningRank);
        const highestCount = Math.max(...winners.map(contender => contender.getCurrCount()));
        const strongest = winners.filter(contender => contender.getCurrCount() == highestCount);
        return strongest[getRandomIntInRange({ max: strongest.length - 1 })];
    }

    getTeleportTileKey(highlightedTileIndices) {
        const player = this.gameManagerProxy.getPlayerPiece();
        const lastTile = highlightedTileIndices[highlightedTileIndices.length - 1];
        return player.shouldTeleport && !!lastTile ? `${lastTile.i} ${lastTile.j}` : undefined;
    }

    addContender(contenders, { i, j }, contender) {
        const key = `${i} ${j}`;
        contenders[key] = contenders[key] || [];
        contenders[key].push(contender);
    }

    addContendersFromTile(tile, contenders) {
        const tileIndex = tile.tileIndex;
        const tileStatus = tile.getTileStatus();
        if (!tile.isVisible || !tileStatus) return;

        const currCount = tile.getCurrCount();
        // ticks count from where the cast really started, which a range bonus moves
        const tickCount = currCount - tile.cast.rangeBonus;

        // 1. persist curr tile's status on curr tile (a piece on the tile clears it)
        const trailAge = currCount == 0 ? tile.trailAge + 1 : 0;
        const isPersist = tileStatus.getIsPersistent() || (tileStatus.getIsLeaveTrail() && currCount != 0);
        if (isPersist && !tileStatus.getIsTrailFaded(trailAge - tile.cast.trailBonus) && !this.gameManagerProxy.getIsPieceOnTile(tileIndex)) {
            this.addContender(contenders, tileIndex, tile.getTileContenderFromTile({ currCount: 0, trailAge }));
        }

        if (currCount == 0) return;

        // 2. move curr tile's status to adjacent tiles based on dirs
        const tick = tileStatus.getCurrTick(tickCount);
        const tileWall = this.getTileWall(tile, tick);
        const isReversing = !tile.cast.isForwardWave && tileStatus.getIsReverseDirection(tickCount);
        const isWallReversing = !!tileWall && isReversing;
        const wall = isWallReversing ? this.getReversedWall(tileWall, tick) : tileWall;
        const dirs = isWallReversing ? tile.getDirs().map(d => tileStatus.reverseDir(d)[0]) : tile.getDirs();
        dirs.forEach((d, dirIndex) => {
            const tileIndexOffset = this.getTileOffsetFromDir(d, tileIndex);
            const nextTileIndex = { i: tileIndex.i + tileIndexOffset.i, j: tileIndex.j + tileIndexOffset.j };

            let newDirs = [d];
            if (this.getIsInBounds(nextTileIndex) && this.gameManagerProxy.getIsStatusAllowedOn(tileStatus.getAppliedStatus(), nextTileIndex)) {
                if (tileStatus.getIsSpread(tickCount)) {
                    const area = tileStatus.getSpreadArea(tickCount);
                    const [_, dirs] = this.getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex: tileIndex, toTileIndex: nextTileIndex, numTiles: area });
                    newDirs = dirs;
                } else if (tileStatus.getIsRotating(tickCount)) {
                    newDirs = tileStatus.rotateStatus(tickCount);
                } else if (tileStatus.getIsConserveDirections(tickCount)) {
                    newDirs = dirs;
                } else if (tileStatus.getIsTracking(tickCount)) {
                    // with nothing to chase, keep going the same way
                    const target = this.gameManagerProxy.getPiece(tile.targetIndex);
                    if (!target.getIsDead() && (target.getTeamIndex() != tile.teamIndex || tileStatus.getDmgAmt() < 0)) {
                        const [_, dirs] = this.getTilesTowardPiece(tileIndex, target);
                        // a soft chase: it turns toward the target only so far each step, so it overshoots and comes about
                        newDirs = tileStatus.getTurnSteps() !== undefined && dirs.length ? [turnToward(d, dirs[0], tileStatus.getTurnSteps())] : dirs;
                    }
                } else if (isReversing) {
                    newDirs = tileStatus.reverseDir(d);
                }

                if (!wall || this.getIsTileInWall(wall, nextTileIndex, tick + 1)) {
                    // SIDE EFFECT: 'getTileContenderFromTile' decrements currCount for next tile update
                    this.addContender(contenders, nextTileIndex, tile.getTileContenderFromTile({ newDirs, wall, currCount: tileStatus.getBranchCount(dirIndex) }));
                }
            } else if (tileStatus.getIsBouncy()) {
                /*
                    next tile is not on game board,
                    if status isBouncy, reflect status back onto the game board.
                    find the reflected dir based on tileStatus' 'bounceLogic'
                */
                const rd = tileStatus.reflectDir(d);
                const reflectedOffset = this.getTileOffsetFromDir(rd[0], tileIndex);
                const reflectedTileIndex = { i: tileIndex.i + reflectedOffset.i, j: tileIndex.j + reflectedOffset.j };
                if (this.getIsInBounds(reflectedTileIndex)) {
                    this.addContender(contenders, reflectedTileIndex, tile.getTileContenderFromTile({ currCount: tileStatus.getBounceCount(currCount), newDirs: rd, wall: false, cast: this.getBouncedCast(tile) }));
                }
            }
        });
    }

    // a status that smokes turns to smoke where it hits an edge. its count is reset, so the range bonus no longer counts.
    getBouncedCast(tile) {
        const isSmoke = tile.cast.isSmoke || tile.getTileStatus().hasSmokeOnBounce;
        return { ...tile.cast, isSmoke, rangeBonus: 0 };
    }

    /*
        A wall moves half a row forward each tick, two half-rows deep, and it widens a column on each side.
        'wall' is the line it moves from: where it started, which way it faces, and the tick it set off.
    */
    getTileWall(tile, tick) {
        if (!tile.getTileStatus().getIsWall() || tile.wall === false) return undefined;
        if (!tile.wall) {
            tile.wall = {
                origin: getTileCenter(this.grid, tile.tileIndex),
                normVec: this.getNormVecFromAnimDir(tile.getDirs()[0]),
                startTick: tick
            };
        }
        return tile.wall;
    }

    // the same wall, turned around where it stands
    getReversedWall(wall, tick) {
        const ticksMoving = tick - wall.startTick;
        const halfRows = ticksMoving ? ticksMoving + 1 : 0;
        const distance = halfRows * this.grid.rowStep * this.grid.scale / 2;
        return {
            origin: { x: wall.origin.x + wall.normVec.x * distance, y: wall.origin.y + wall.normVec.y * distance },
            normVec: { x: -wall.normVec.x, y: -wall.normVec.y },
            startTick: tick
        };
    }

    getIsTileInWall(wall, tileIndex, tick) {
        const { x, y } = getTileCenter(this.grid, tileIndex);
        const forward = (x - wall.origin.x) * wall.normVec.x + (y - wall.origin.y) * wall.normVec.y;
        const halfRows = forward / (this.grid.rowStep * this.grid.scale / 2);
        const ticksMoving = tick - wall.startTick;
        return halfRows >= ticksMoving - WALL_TOLERANCE && halfRows <= ticksMoving + 1 + WALL_TOLERANCE;
    }

    // the sort order of a piece standing at a spot (by its feet), rather than by the tile it is assigned
    getZIndexAtLocation = ({ x, y }) => {
        const { charOffsetX, charOffsetY, scale } = this.grid;
        const tile = getTileIndexAtLocation(this.grid, { x: x - charOffsetX * scale, y: y - charOffsetY * scale });
        return tile ? this.getFlattenedArrayIndex(tile) : 0;
    };

    getFlattenedArrayIndex = (tileIndex) => {
        const { i, j } = tileIndex;
        return i !== undefined && j !== undefined ? this.numTileColumns * j + i : 0;
    };

    resetHightlightedTiles = () => {
        this.clickedTileIndex = undefined;
        this.hoveredTileIndex = undefined;
    }

    getHighlightedTiles = () => {
        let highlightedTileIndices = [];
        const lookup = new Set();

        const player = this.gameManagerProxy.getPlayerPiece();
        const moveToTiles = player.getMoveToTiles();

        const toTileIndex = this.hoveredTileIndex || this.clickedTileIndex;
        if (toTileIndex) {
            // show clicked or hovered path
            const playerTileIndex = player.getTileIndex();
            highlightedTileIndices = this.findPathFromTo(playerTileIndex, toTileIndex);
            if (!highlightedTileIndices.length && player.shouldTeleport) highlightedTileIndices = [toTileIndex];
            highlightedTileIndices.forEach(({ i, j }) => lookup.add(`${i} ${j}`));
        } else if (!!moveToTiles.length) {
            // show next tile from move with <WASD/arrow> keys
            const nextTile = moveToTiles[0];
            highlightedTileIndices = [nextTile];
            lookup.add(`${nextTile.i} ${nextTile.j}`)
        }

        return { lookup, highlightedTileIndices };
    }

    updateBounds() {
        this.updateProxyProps();
    }

    // for levels that change as they go, eg. the subway's platforms while a train is in
    setWalkableTiles(tiles) {
        this.walkableTiles = tiles;
        this.walkableTileKeys = new Set(tiles.map(({ i, j }) => `${i} ${j}`));
        this.closedTileKeys = new Set(this.level.walkableTiles.map(({ i, j }) => `${i} ${j}`).filter(key => !this.walkableTileKeys.has(key)));
        const allTiles = this.tiles.flat();
        allTiles.forEach(tile => tile.updateIsVisible(this.getIsInBounds(tile.tileIndex)));
        this.activeTiles = allTiles.filter(tile => tile.getIsVisible());
        this.walkableRevision += 1;
    }

    getWalkableRevision() {
        return this.walkableRevision;
    }

    getClosestWalkableTileToLocation({ x, y }) {
        const getDistance = tile => {
            const center = getTileCenter(this.grid, tile);
            return Math.hypot(center.x - x, center.y - y);
        };
        return this.walkableTiles.reduce((closest, tile) => getDistance(tile) < getDistance(closest) ? tile : closest);
    }

    getClosestWalkableTile(tileIndex) {
        const { x, y } = this.getCharXAndYFromTileIndex(tileIndex);
        const getDistance = tile => getDistanceToFrom(this.getCharXAndYFromTileIndex(tile), { x, y });
        return this.walkableTiles.reduce((closest, tile) => getDistance(tile) < getDistance(closest) ? tile : closest);
    }

    // the tile the player can walk to that is closest to a spot on the level. tiles cut off from the player don't count.
    getClosestReachableTile(fromTile, { x, y }) {
        const reachable = this.getReachableTiles(fromTile);
        const getDistance = tile => {
            const center = getTileCenter(this.grid, tile);
            return Math.hypot(center.x - x, center.y - y);
        };
        // teleporting goes anywhere walkable, even tiles no path leads to
        if (this.gameManagerProxy.getPlayerPiece().shouldTeleport) reachable.push(...this.walkableTiles);
        const open = reachable.filter(this.getIsInBounds);
        return (open.length ? open : reachable).reduce((closest, tile) => getDistance(tile) < getDistance(closest) ? tile : closest);
    }

    getReachableTiles(fromTile) {
        const seen = new Set([`${fromTile.i} ${fromTile.j}`]);
        const reachable = [fromTile];
        const getNextTiles = this.getPathStepsFrom(fromTile);
        for (const tile of reachable) { // also visits the tiles added along the way
            getNextTiles(tile).forEach(next => {
                const key = `${next.i} ${next.j}`;
                if (seen.has(key)) return;
                seen.add(key);
                reachable.push(next);
            });
        }
        return reachable;
    }

    getIsClosedTile = ({ i, j }) => {
        return this.closedTileKeys.has(`${i} ${j}`);
    }

    // a piece standing on a closed tile can still walk across closed tiles, to get off of them
    // 'getIsLinkOpen': a link (by the tile it leaves from) a piece may take now (the Mermaid's resting stairways)
    getPathStepsFrom(startTile, isWithoutLinks = false, getIsLinkOpen = undefined) {
        const isLeavingClosedTiles = this.getIsClosedTile(startTile);
        return tile => {
            const closedSteps = isLeavingClosedTiles ? this.getNeighborTiles(tile).filter(this.getIsClosedTile) : [];
            const links = isWithoutLinks || (getIsLinkOpen && !getIsLinkOpen(tile)) ? [] : this.getLinkedTiles(tile);
            return [...this.getAdjacentTileIndices(tile), ...closedSteps, ...links];
        };
    }

    getLinkedTile = ({ i, j }) => {
        return this.linkedTiles.get(`${i} ${j}`);
    }

    getLinkedTiles(tileIndex) {
        const linkedTile = this.getLinkedTile(tileIndex);
        return linkedTile ? [linkedTile] : [];
    }

    getIsInBounds = (tileIndex) => {
        return this.walkableTileKeys.has(`${tileIndex.i} ${tileIndex.j}`);
    }

    // 'crowdPieceIndex': an NPC's path, which goes round tiles others stand on or are headed for, where there is room (A*'s weights)
    findPathFromTo = (startIndex, goalIndex, /* and (optionally) avoid: */ enemyTiles = undefined, isAlwaysAvoid = false, crowdPieceIndex = undefined) => {
        const crowdCosts = crowdPieceIndex === undefined ? undefined : this.gameManagerProxy.getCrowdCosts(crowdPieceIndex);
        const getCrowdCost = tile => (crowdCosts && crowdCosts.get(`${tile.i} ${tile.j}`)) || 0;
        const getIsEnemyTile = tile => !!enemyTiles && enemyTiles.some(e => e.i === tile.i && e.j === tile.j);
        const getIsNextToEnemy = tile => !!enemyTiles && this.getAdjacentAdjacentTileIndices(tile).some(getIsEnemyTile);
        // an NPC resting from portals plans without them
        const piece = crowdPieceIndex === undefined ? undefined : this.gameManagerProxy.getPiece(crowdPieceIndex);
        const isWithoutLinks = !!piece && !!piece.getIsPortalResting && piece.getIsPortalResting();
        // and keeps to the tiles it may go on (the ghost boss's roof, the Lab's floor for the player's NPCs)
        const getSteps = this.getPathStepsFrom(startIndex, isWithoutLinks, piece && piece.linkRestMs ? tile => !piece.getIsLinkResting(tile) : undefined);
        const getAllowedSteps = piece && piece.getIsAllowedTile ? tile => getSteps(tile).filter(next => piece.getIsAllowedTile(next)) : getSteps;
        const avoidedPath = findPath({
            start: startIndex,
            goal: goalIndex,
            getAdjacentTiles: getAllowedSteps,
            getLocation: this.getCharXAndYFromTileIndex,
            getIsBlocked: tile => getIsEnemyTile(tile) || (isAlwaysAvoid && getIsNextToEnemy(tile)),
            getExtraCost: tile => (getIsNextToEnemy(tile) ? ENEMY_NEARBY_TILE_COST : 0) + getCrowdCost(tile)
        });
        if (!!avoidedPath.length || !enemyTiles || isAlwaysAvoid) return avoidedPath;

        // boxed-in by enemies: going through them beats not moving
        return this.findPathFromTo(startIndex, goalIndex);
    };

    getTileXAndYFromTileIndex(tileIndex) {
        return getTileXAndY(this.grid, tileIndex);
    };

    getCharXAndYFromTileIndex = (tileIndex) => {
        return getCharXAndY(this.grid, tileIndex);
    };

    getAreTilesAdjacent(tileIndex1, tileIndex2) {
        return [
            { i: 0, j: -1 },
            { i: 1, j: tileIndex1.i % 2 ? 0 : -1 },
            { i: 1, j: tileIndex1.i % 2 ? 1 : 0 },
            { i: 0, j: 1 },
            { i: -1, j: tileIndex1.i % 2 ? 1 : 0 },
            { i: -1, j: tileIndex1.i % 2 ? 0 : -1 }
        ]
            .map(t => {
                return { i: t.i + tileIndex1.i, j: t.j + tileIndex1.j };
            })
            .some(t => tileIndex2.i === t.i && tileIndex2.j === t.j);
    };

    getAdjacentTileIndices(tileIndex) {
        return this.getNeighborTiles(tileIndex).filter(this.getIsInBounds);
    }

    getNeighborTiles(tileIndex) {
        return [
            { i: 0, j: -1 },
            { i: 1, j: tileIndex.i % 2 ? 0 : -1 },
            { i: 1, j: tileIndex.i % 2 ? 1 : 0 },
            { i: 0, j: 1 },
            { i: -1, j: tileIndex.i % 2 ? 1 : 0 },
            { i: -1, j: tileIndex.i % 2 ? 0 : -1 }
        ].map(t => ({ i: t.i + tileIndex.i, j: t.j + tileIndex.j }));
    };

    getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex, toTileIndex, numTiles = 1 }) {
        const normVec = this.getNormVecFromTileIndices({ fromTileIndex, toTileIndex });
        return this.getAdjacentTilesFromNormVec(fromTileIndex, normVec, numTiles);
    }

    getAdjacentAdjacentTileIndices = tileIndex => {
        return [
            // ADJACENT TILES
            { i: 0, j: -1 },
            { i: 1, j: tileIndex.i % 2 ? 0 : -1 },
            { i: 1, j: tileIndex.i % 2 ? 1 : 0 },
            { i: 0, j: 1 },
            { i: -1, j: tileIndex.i % 2 ? 1 : 0 },
            { i: -1, j: tileIndex.i % 2 ? 0 : -1 },

            // TILES THAT ARE TWO ADJACENT
            { i: 0, j: 2 }, // up two
            { i: 0, j: -2 }, // down two
            { i: -2, j: -1 }, // up left two
            { i: 2, j: -1 }, // up right two
            { i: -2, j: 1 }, // down left two
            { i: 2, j: 1 }, // down right two
            { i: -1, j: tileIndex.i % 2 ? -1 : -2 }, // top left two
            { i: 1, j: tileIndex.i % 2 ? -1 : -2 }, // top right two
            { i: -2, j: 0 }, // left two
            { i: 2, j: 0 }, // right two
            { i: -1, j: tileIndex.i % 2 ? 2 : 1 }, // bottom left two
            { i: 1, j: tileIndex.i % 2 ? 2 : 1 }, // bottom right two
        ]
            .map(t => {
                return { i: t.i + tileIndex.i, j: t.j + tileIndex.j };
            }).filter(tileIndex => this.getIsInBounds(tileIndex))
    };

    getClosestEnemy = (pieceIndex) => {
        // spurned, they go for the one who charmed them, near or far
        const { spurnedBy } = this.gameManagerProxy.getPiece(pieceIndex);
        const charmer = spurnedBy !== undefined && spurnedBy >= 0 ? this.gameManagerProxy.getPiece(spurnedBy) : undefined;
        if (charmer && !charmer.getIsDead() && charmer.getTeamIndex() != this.gameManagerProxy.getPieceTeamIndex(pieceIndex)) return charmer;
        const otherTeamsPieces = this.gameManagerProxy.getOtherTeamsPieces(pieceIndex);
        const tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const enemyPiece = this.getClosestPieceFromTileIndex(otherTeamsPieces, tileIndex);
        return enemyPiece;
    }

    /*
        What a power aims at (Jamie): the closest enemy on the tiles. A Kaiju still walking in, off them, instead when
        there is no enemy on the tiles, or when it is the closest and is within AIM_ENTERING_TILES of stepping onto them.
        The power goes its way, and meets it as it arrives.
    */
    getClosestAimTarget = (pieceIndex) => {
        const onTiles = this.getClosestEnemy(pieceIndex);
        if (onTiles && this.gameManagerProxy.getPiece(pieceIndex).spurnedBy == onTiles.pieceIndex) return onTiles; // spurned: the charmer
        const from = this.getCharXAndYFromTileIndex(this.gameManagerProxy.getPieceTileIndex(pieceIndex));
        const getDistance = piece => getDistanceToFrom(from, piece.charLocation);
        const walkingIn = this.gameManagerProxy.getOtherTeamsPieces(pieceIndex)
            .filter(piece => piece.avatar == 'kaiju' && !piece.isGiant && !piece.isDead && !piece.isOnTiles && piece.isVisible !== false && !!piece.charLocation)
            .sort((a, b) => getDistance(a) - getDistance(b))[0];
        if (!walkingIn) return onTiles;
        if (!onTiles) return walkingIn;
        return getDistance(walkingIn) < getDistance(onTiles) && this.getIsAboutToEnter(walkingIn) ? walkingIn : onTiles;
    }

    // a Kaiju walking in, within AIM_ENTERING_TILES of the tile where it steps onto the board
    getIsAboutToEnter(piece) {
        const entry = this.getCharXAndYFromTileIndex(piece.getTileIndex());
        if (!entry) return false;
        const { rowStep, scale = 1 } = this.grid;
        return getDistanceToFrom(entry, piece.charLocation) <= AIM_ENTERING_TILES * rowStep * scale;
    }

    // the tiles (and dirs) from a tile toward a piece: its tile, or, off the tiles (a Kaiju walking in), where it stands
    getTilesTowardPiece(fromTileIndex, piece, numTiles = 1) {
        if (piece.isOnTiles || !piece.charLocation) return this.getNumAdjacentTilesInDirectionFromTileToTile({ fromTileIndex, toTileIndex: piece.getTileIndex(), numTiles });
        const normVec = getNormVecFromDestAndOrigin(piece.charLocation, this.getCharXAndYFromTileIndex(fromTileIndex));
        return this.getAdjacentTilesFromNormVec(fromTileIndex, normVec, numTiles);
    }

    getPathToClosestEnemy = (pieceIndex) => {
        const tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const enemy = this.getClosestEnemy(pieceIndex);
        const path = !!enemy ? this.findPathFromTo(tileIndex, enemy.tileIndex, undefined, false, pieceIndex) : [];
        return path;  // aka: 'moveToTiles'
    }

    getPathFromTileToTile = ({ fromTile, toTile, avoidTiles, isAlwaysAvoid, pieceIndex = undefined }) => {
        return this.findPathFromTo(fromTile, toTile, avoidTiles, isAlwaysAvoid, pieceIndex);
    }

    getClosestPieceFromTileIndex = (pieces, tileIndex) => {
        const { piece } = pieces
            .filter(({ isDead, isOnTiles }) => !isDead && !!isOnTiles)
            .reduce(
                (maxDistanceData, piece) => {
                    const distance = getDistanceToFrom(this.getCharXAndYFromTileIndex(tileIndex), piece.charLocation);
                    return maxDistanceData.distance > distance
                        ? { piece, distance }
                        : maxDistanceData;
                },
                { piece: undefined, distance: Number.MAX_SAFE_INTEGER }
            );

        return piece;
    };

    getPathToTeamLeader = (pieceIndex) => {
        const piece = this.gameManagerProxy.getPiece(pieceIndex);
        const leaderPiece = this.gameManagerProxy.getTeamLeaderPiece(pieceIndex);
        const path = this.findPathFromTo(piece.getTileIndex(), leaderPiece.getTileIndex(), undefined, false, pieceIndex);
        return path;  // aka: 'moveToTiles'
    }

    moveTo = ({
        currentLocation,
        moveFromLocation,
        moveToLocation,
        moveSpeed: tilesMoveSpeed
    }) => {
        const moveSpeed = tilesMoveSpeed * this.moveSpeedScale;
        const distanceFromStart = getDistanceToFrom(moveFromLocation, currentLocation);
        const distanceToFinish = getDistanceToFrom(moveToLocation, currentLocation);
        const totalDistance = getDistanceToFrom(moveFromLocation, moveToLocation);
        const { x, y } = currentLocation;
        const x_dir = distanceToFinish
            ? (moveToLocation.x - x) / distanceToFinish
            : 0;
        const y_dir = distanceToFinish
            ? (moveToLocation.y - y) / distanceToFinish
            : 0;
        const hasArrived =
            distanceToFinish < moveSpeed || distanceFromStart > totalDistance;
        return {
            newLocation: hasArrived ? moveToLocation : {
                x: x + x_dir * moveSpeed,
                y: y + y_dir * moveSpeed
            },
            hasArrived
        };
    };

    getSafeTileIndex = (pieceIndex, isTeleport = false) => {
        const otherTeamsPieces = this.gameManagerProxy.getOtherTeamsPieces(pieceIndex).filter(({ isDead }) => !isDead);

        if (!otherTeamsPieces.length) {
            return this.getRandomTileIndexOnBoard();
        }

        const otherTeamsTilesLookup = otherTeamsPieces.reduce((acc, { tileIndex }) => {
            acc[`${tileIndex.i} ${tileIndex.j}`] = tileIndex;
            return acc;
        }, {});

        const sumLocations = otherTeamsPieces.reduce((acc, { charLocation }) => {
            acc.x += charLocation.x;
            acc.y += charLocation.y;
            return acc
        }, { x: 0, y: 0 });

        const avgLocation = { x: sumLocations.x / otherTeamsPieces.length, y: sumLocations.y / otherTeamsPieces.length };

        // only tiles the piece could walk from: a teleport must not strand it, eg. on the Lab's catwalk
        // the Subway's Punk Guy teleports over the tracks to the other platforms, to get away: his portal lets the team follow
        const isAcross = isTeleport && !!this.gameManagerProxy.getPiece(pieceIndex).canTeleportAcross;
        const reachableTiles = (isAcross ? this.walkableTiles.filter(tile => !this.getIsClosedTile(tile)) : this.getReachableTiles(this.gameManagerProxy.getPieceTileIndex(pieceIndex)))
            .filter(tileIndex => !this.gameManagerProxy.getIsOffLimitsTile(pieceIndex, tileIndex));
        let safeTileObj = {
            distance: Number.MIN_SAFE_INTEGER,
            tileIndex: reachableTiles[getRandomIntInRange({ max: reachableTiles.length - 1 })]
        };

        const teamIndex = this.gameManagerProxy.getPieceTeamIndex(pieceIndex);
        reachableTiles.forEach(tileIndex => {
            const currTileXY = this.getCharXAndYFromTileIndex(tileIndex);
            const testDist = getDistanceToFrom(currTileXY, avgLocation);
            if (testDist > safeTileObj.distance) {
                const tile = this.tiles[tileIndex.i][tileIndex.j];
                const isDmgTile = tile.getIsDmgTile(teamIndex) && tile.getDmgAmt() > 0;
                const isSafe = !isDmgTile && !otherTeamsTilesLookup[`${tileIndex.i} ${tileIndex.j}`];

                if (isSafe) {
                    safeTileObj = {
                        distance: testDist,
                        tileIndex
                    };
                }
            }
        });
        return safeTileObj.tileIndex;
    };

    getMoveOntoGameBoardMovementData = () => {
        const { minX: min_X, minY: min_Y, maxX: max_X, maxY: max_Y } = this.level.kaijuEntry.bounds;

        const randIntX = getRandomIntInRange({ min: min_X, max: max_X });
        const randIntY = getRandomIntInRange({ min: min_Y, max: max_Y });

        const charLocation = Math.random() > 0.5 ? { x: randIntX, y: min_Y } : { x: Math.random() > 0.5 ? min_X : max_X, y: randIntY };
        const tileIndex = this.getClosestPerimeterTileFromLocation(charLocation);
        const destXY = this.getTileXAndYFromTileIndex(tileIndex);
        const dir = this.getDirFromNormVec(getNormVecFromDestAndOrigin(destXY, charLocation));

        return {
            charLocation,
            tileIndex,
            dir
        };
    }

    getClosestPerimeterTileFromLocation(location) {
        const { perimeterTiles } = this.level.kaijuEntry;
        let closest = { distance: Number.MAX_SAFE_INTEGER, tile: perimeterTiles[0] };
        perimeterTiles.forEach(({ i, j }) => {
            const distance = getDistanceToFrom(this.getCharXAndYFromTileIndex({ i, j }), location);
            if (closest.distance > distance) closest = { distance, tile: { i, j } };
        });
        return closest.tile;
    };

    getRandomTileIndexOnBoard = () => {
        return this.walkableTiles[getRandomIntInRange({ max: this.walkableTiles.length - 1 })];
    };

    getPathToSafeTile = (pieceIndex) => {
        const safeTileIndex = this.getSafeTileIndex(pieceIndex);
        const tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const path = this.findPathFromTo(tileIndex, safeTileIndex, undefined, false, pieceIndex);
        return path;  // aka: 'moveToTiles'
    }

    getPathToSafeTileAndAvoidEnemies = (pieceIndex) => {
        const safeTileIndex = this.getSafeTileIndex(pieceIndex);
        const tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const otherTeamsPieces = this.gameManagerProxy.getOtherTeamsPieces(pieceIndex);
        const path = this.findPathFromTo(tileIndex, safeTileIndex, /* ...and avoid: */ otherTeamsPieces.map(({ tileIndex }) => tileIndex), false, pieceIndex);
        return path;  // aka: 'moveToTiles'
    }

    getIsPieceInDanger = (pieceIndex) => {
        const otherTeamsTilesLookup = this.gameManagerProxy.getOtherTeamsPieces(pieceIndex).filter(({ isDead }) => !isDead).reduce((acc, { tileIndex }) => {
            acc[`${tileIndex.i} ${tileIndex.j}`] = tileIndex;
            return acc;
        }, {});

        const tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const teamIndex = this.gameManagerProxy.getPieceTeamIndex(pieceIndex);

        const surroundingTileIndices = this.getAdjacentAdjacentTileIndices(tileIndex);

        const isInDanger =
            !!surroundingTileIndices &&
            surroundingTileIndices.some(
                t =>
                    !!t &&
                    (Array.isArray(this.tiles[t.i]) &&
                        !!this.tiles[t.i][t.j] &&
                        this.tiles[t.i][t.j].getIsDmgTile(teamIndex)
                        && this.tiles[t.i][t.j].getDmgAmt() > 0
                    ) // enemy status tile, will cause dmg
                    ||
                    !!otherTeamsTilesLookup[`${t.i} ${t.j}`] // enemy tile, will cause dmg
            );
        // the bosses' own threats (Jamie): the ghost boss's launched ghosts, which do their harm off the tiles' damage
        return isInDanger || this.gameManagerProxy.getIsBossThreatNear(pieceIndex);
    }

    // includes dmg from Kaiju on the tile and dmg status tiles (and 'Heals', ie. negative dmg)
    getDmg = (pieceIndex, tileIndex = this.gameManagerProxy.getPieceTileIndex(pieceIndex)) => {
        const teamIndex = this.gameManagerProxy.getPieceTeamIndex(pieceIndex);
        const tile = this.tiles[tileIndex.i][tileIndex.j];
        const piece = this.gameManagerProxy.getPiece(pieceIndex);
        const homeTeamIndex = piece && piece.homeTeamIndex !== undefined ? piece.homeTeamIndex : teamIndex;
        const statusDmg = tile.getIsDmgTile(teamIndex, homeTeamIndex) ? tile.getDmgAmt() : 0;
        const isContactDmg = this.gameManagerProxy.getIsContactDmg(pieceIndex, tileIndex);
        return isContactDmg ? Math.max(statusDmg, 1) : statusDmg;
    }

    // who cast the status on a tile, or -1
    getStatusCaster = ({ i, j }) => {
        const tile = this.tiles[i] && this.tiles[i][j];
        return tile && tile.getTileStatus() ? tile.cast.casterIndex : -1;
    }

    // the ways the status on a tile is travelling
    getStatusDirs = ({ i, j }) => {
        const tile = this.tiles[i] && this.tiles[i][j];
        return tile && tile.getTileStatus() ? [...tile.getDirs()] : [];
    }

    // the team whose Charm is on this piece's tile, if it isn't the piece's own
    getCharmingTeam = (pieceIndex) => {
        const { i, j } = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        const tile = this.tiles[i][j];
        const status = tile.getTileStatus();
        const isCharm = !!status && status.getAppliedStatus() == 'isCharming';
        return isCharm && tile.teamIndex != this.gameManagerProxy.getPieceTeamIndex(pieceIndex) ? tile.teamIndex : undefined;
    }

    clearTileStatusUnderPiece = (pieceIndex) => {
        const { i, j } = this.gameManagerProxy.getPieceTileIndex(pieceIndex);
        this.tiles[i][j].clearTileStatus();
    }

    getTileOffsetFromDir = (dir, tileIndex) => {
        switch (dir) {
            case "up":
                return { i: 0, j: -1 }; // up
            case "up right":
                return { i: 1, j: tileIndex.i % 2 ? 0 : -1 }; // up right
            case "down right":
                return { i: 1, j: tileIndex.i % 2 ? 1 : 0 }; // down right
            case "down":
                return { i: 0, j: 1 }; // down
            case "down left":
                return { i: -1, j: tileIndex.i % 2 ? 1 : 0 }; // down left
            case "up left":
                return { i: -1, j: tileIndex.i % 2 ? 0 : -1 }; // up left
            default:
                return { i: 0, j: 0 };
        }
    }

    getDirFromTiles = (currTileIndex, nextTileIndex) => {
        const areAdjacent = this.getAreTilesAdjacent(currTileIndex, nextTileIndex);

        if (areAdjacent) {
            const offset = { i: nextTileIndex.i - currTileIndex.i, j: nextTileIndex.j - currTileIndex.j };
            const lookup_key = `${offset.i} ${offset.j} ${currTileIndex.i % 2}`;
            const lookup = {
                "0 -1 0": "up",
                "0 -1 1": "up",
                "0 1 1": "down",
                "0 1 0": "down",
                "0 0 0": "idle",
                "0 0 1": "idle",
                "1 0 1": "upRight",
                "1 -1 0": "upRight",
                "1 1 1": "downRight",
                "1 0 0": "downRight",
                "-1 1 1": "downLeft",
                "-1 0 0": "downLeft",
                "-1 0 1": "upLeft",
                "-1 -1 0": "upLeft"
            };
            const dir = lookup[lookup_key];
            return dir;

        } else {
            const normVec = this.getNormVecFromTileIndices({ fromTileIndex: currTileIndex, toTileIndex: nextTileIndex });
            const dir = this.getDirFromNormVec(normVec);
            return dir;
        }

    };

    getNormVecFromTileIndices({ fromTileIndex, toTileIndex }) {
        const originXY = this.getTileXAndYFromTileIndex(fromTileIndex);
        const destXY = this.getTileXAndYFromTileIndex(toTileIndex);
        const normVec = getNormVecFromDestAndOrigin(destXY, originXY);
        return normVec;
    }

    // eg. 'downRight' -> 'down right' -> { x: 0.868, y: 0.496 }
    getNormVecFromAnimDir(animDir) {
        const tileDir = animDir.replace(/([A-Z])/, ' $1').toLowerCase();
        return TILE_DIR_NORM_VECS[Math.max(TILE_DIRS.indexOf(tileDir), 0)];
    }

    getDirFromNormVec(normVec) {
        const xDir = normVec.x > 0 ? "Right" : "Left"; // go right
        const yDir = normVec.y > 0 ? "down" : "up"; // go up
        return `${yDir}${xDir}`;
    }

    getAdjacentTilesFromNormVec(currTile, normVec, area) {
        const directionMapping = [
            { x: 0, y: -1 },
            { x: 0.868, y: -0.496 },
            { x: 0.868, y: 0.496 },
            { x: 0, y: 1 },
            { x: -0.868, y: 0.496 },
            { x: -0.868, y: -0.496 }
        ];
        const tileIndexMapping = [
            { i: 0, j: -1 }, // up
            { i: 1, j: currTile.i % 2 ? 0 : -1 }, // up right
            { i: 1, j: currTile.i % 2 ? 1 : 0 }, // down right
            { i: 0, j: 1 }, // down
            { i: -1, j: currTile.i % 2 ? 1 : 0 }, // down left
            { i: -1, j: currTile.i % 2 ? 0 : -1 } // up left
        ];
        const coords = directionMapping[0];
        const distance = Number.MAX_SAFE_INTEGER;
        const closest = directionMapping.reduce(
            (acc, item, i) => {
                const distance = getDistanceToFrom(item, normVec);

                if (
                    distance < acc.distance
                    && this.getIsInBounds({
                        i: currTile.i + tileIndexMapping[i].i,
                        j: currTile.j + tileIndexMapping[i].j
                    })) {
                    return { i, coords: item, distance }
                } else {
                    return acc;
                }
            },
            { i: 0, coords, distance }
        );
        const tileDirMapping = [
            "up",
            "up right",
            "down right",
            "down",
            "down left",
            "up left"
        ];
        const i = closest.i;
        let spawnPowerTileIndex = {
            i: currTile.i + tileIndexMapping[i].i,
            j: currTile.j + tileIndexMapping[i].j
        };
        if (area >= 6) {
            // the aimed direction comes first
            return [spawnPowerTileIndex, [...tileDirMapping.slice(i), ...tileDirMapping.slice(0, i)]];
        } else if (area) {
            const dirs = [tileDirMapping[i]];
            for (let k = 1; k < area - 1; k++) {
                const l = i - k < 0 ? 6 - i - k : i - k;
                const m = i + k > 5 ? -1 * (6 - k - i) : i + k;
                dirs.push(tileDirMapping[l]);
                dirs.push(tileDirMapping[m]);
            }
            return [spawnPowerTileIndex, dirs];
        } else {
            return [spawnPowerTileIndex, []];
        }
    };
}