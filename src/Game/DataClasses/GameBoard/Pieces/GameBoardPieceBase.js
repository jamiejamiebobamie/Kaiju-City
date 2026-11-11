import { getWaterSlow } from 'Game/DataClasses/AquariumFlood';
import { getThrowVec } from 'Game/DataClasses/Ragdoll';
import { followBrainAction } from 'Game/DataClasses/npcBrain/brain';

// an NPC through a portal or a tile link rests from them this long (Jamie)
export const PORTAL_REST_MS = 5000;

const CHARM_MS = 5000;
const SLIPPERY_SLIDE_TILES = 1;
const CHARM_ALONE_DMG = 1;

export class GameBoardPieceBase {
    constructor({
        pieceIndex = 0,
        teamIndex = 0,
        avatar = 'guy',
        color = "#55AAff",
        maxLives = 4,
        moveSpeed = 7,
        spriteSheetSrc = '',
        deadSpriteSrc = '',
        isVisible = true,
        isTeamLeader = false,
        isNpc = true,
        isDoAvoidEnemy = true,
        gameManagerProxy,
        abilities = [],
        isOnTiles = true
    }) {

        this.gameManagerProxy = gameManagerProxy;

        this.pieceIndex = pieceIndex;
        this.teamIndex = teamIndex;
        this.isTeamLeader = isTeamLeader;
        this.isNpc = isNpc;
        this.isCharmed = false;
        this.isTileHidden = false; // its tile isn't highlighted, while it makes an entrance
        this.charmEndsAt = 0;
        this.homeTeamIndex = teamIndex; // the team it goes back to, and the team its death counts against
        this.allowedTile = undefined; // when set, the piece never steps, jumps or teleports onto a tile this says no to (the ghost boss)
        this.onBeforeDeath = undefined; // when set and it says so, a blow that would kill the piece doesn't (the ghost boss's phases)
        this.isGhostForm = false; // the ghost boss's last phase: milk-white and see-through
        this.isUnhurtable = false; // the Aquarium: healing up on the top floor, she can't be hurt until she is whole
        this.walkToTile = undefined; // an NPC sent somewhere: it walks there, then fights on (the Mermaid, back down)
        this.waterSlowEnds = []; // the Aquarium's flood: when each step of slowing wears off
        this.portalMask = undefined; // walking through a portal: { point, behind }. the body past this line, on the 'behind' side, isn't drawn
        this.portalRestUntil = 0; // an NPC through a portal or a tile link can't go through one again until then (Jamie: no hopping back and forth)

        // aesthetics
        this.avatar = avatar; // enum?
        this.color = color;
        this.isVisible = isVisible;

        // piece class
        this.pieceClass = '';
        this.pieceClassDescription = '';
        this.elements = '';

        // active abilities
        this.abilities = abilities;
        this.abilityAccTimeInterval = 500; // amt of time in milliseconds to wait between ability usages

        // passive abilities
        this.storedPassive = undefined; // teleport passive is called after teleport
        this.livesModifier = 0;
        this.moveSpeedModifier = 0;
        this.numTilesModifier = 0;
        this.tileCountModifier = 0;
        this.slipperyModifier = 0; // above 0, the piece slides one tile further when it stops
        this.dmgModifier = 0;

        // for rendering dmg/healing and teleport floating text
        this.isHealed = false;
        this.isTeleported = false;

        // animation
        this.dir = 'idle';
        this.facingDir = 'down'; // the last direction the piece moved in. used to aim with no target.
        this.spriteSheetSrc = spriteSheetSrc;
        this.deadSpriteSrc = deadSpriteSrc;

        // health
        this.lives = maxLives;
        this.maxLives = maxLives;
        this.isDead = false;
        this.lastDmgAccTime = 0; // in milliseconds
        this.lastDmgAccTimeInterval = 1000; // in milliseconds
        this.dealsContactDmg = false; // does touching this piece dmg its enemies
        this.isShowHealthBarOnComponent = false;

        // movement
        this.shouldTeleport = false;
        this.isThere = true; // tracks if piece is at the next tile in moveToTiles array
        this.moveSpeed = moveSpeed;
        this.isOnTiles = isOnTiles;
        this.charLocation = { x: 0, y: 0 };
        this.moveFromLocation = { x: 0, y: 0 };
        this.moveToLocation = { x: 0, y: 0 };
        this.moveToTiles = [];
        this.tileIndex = { i: 0, j: 0 };
        // tiles the piece has been on since the last tile update.
        // stops a piece and a status swapping tiles without touching.
        this.touchedTileIndices = [];
        this.linkArrivalTile = undefined; // the linked tile the piece jumped to. it doesn't jump back until it has left.
        this.followDistance = 3 + pieceIndex * 2; // in number of tiles
        this.isDoAvoidEnemy = isDoAvoidEnemy; // does NPC pathing avoid enemies

        /*
            Biases the piece to be closer (negative value) or farther away (positive value) from enemy
        */
        this.enemyDistanceBias = 5; // in number of tiles.
    }

    getIsMoveToTiles() {
        return !!this.moveToTiles.length;
    }

    getZIndex() {
        // walking in (a scene's arrival): it already holds its end tile, so it sorts by where it is now (Jamie: Sewer 2's
        // walkers were drawn over or under the others wrongly)
        if (this.arrivalEnd && this.isVisible) return this.gameManagerProxy.getZIndexAtLocation(this.charLocation);
        return this.gameManagerProxy.getFlattenedArrayIndex(this.tileIndex) + (this.zIndexOffset || 0);
    }

    initCharLocation(isOnTiles = false, spawnTile = undefined) {
        this.isOnTiles = isOnTiles;
        if (isOnTiles) {
            const tileIndex = spawnTile || this.gameManagerProxy.getRandomTileIndexOnBoard();
            const charLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(tileIndex);
            this.charLocation = charLocation;
            this.moveFromLocation = charLocation;
            this.moveToLocation = charLocation;
            this.moveToTiles = [];
            this.isThere = true;
            this.tileIndex = tileIndex;
            this.dir = 'idle';
        } else {
            const { charLocation, tileIndex, dir } = this.gameManagerProxy.getMoveOntoGameBoardMovementData();
            this.charLocation = charLocation;
            this.moveFromLocation = charLocation;
            this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(tileIndex);
            this.moveToTiles = [tileIndex];
            this.isThere = false;
            this.tileIndex = tileIndex;
            this.dir = dir;
        }
    }

    getTileIndex() {
        return this.tileIndex;
    }

    getPieceIndex() {
        return this.pieceIndex;
    }

    getLives() {
        return this.lives;
    }

    setAbilities(abilities) {
        this.abilities = abilities;
    }

    setIsTeamLeader(isTeamLeader) {
        this.isTeamLeader = isTeamLeader;
    }

    getFacingDir() {
        return this.facingDir;
    }

    setDir(dir) {
        this.dir = dir;
        if (dir != 'idle') this.facingDir = dir;
    }

    setTileIndex(tileIndex) {
        this.touchedTileIndices.push(this.tileIndex);
        this.tileIndex = tileIndex;
    }

    setShouldTeleport(shouldTeleport) {
        this.shouldTeleport = shouldTeleport;
    }

    applyDmgFromTouchedTiles(accTime) {
        if (!this.isDead && this.isOnTiles) {
            [...this.touchedTileIndices, this.tileIndex].forEach(tileIndex => {
                const dmg = this.gameManagerProxy.getDmg(this.pieceIndex, tileIndex);
                if (!dmg) return;
                this.lastHitDirs = this.gameManagerProxy.getStatusDirs(tileIndex);
                this.decrementHealth(accTime, dmg);
            });
        }
        this.touchedTileIndices = [];
    }

    movePiece({ accTime, playerInputHandler = undefined }) {
        if (this.isDead) return;
        if (this.isInPortal) return; // between a portal's two ends: nowhere, and no keys move them

        this.accTime = accTime;
        // knocked down by the train: lying where they were thrown until they get up
        if (this.knockedUntil > accTime) {
            this.moveToTiles = [];
            return;
        }
        this.updateCharm(accTime);

        // intention: even the player can be Charmed and lose control for a moment of his piece....
        if (this.isNpc && this.isOnTiles && this.escapeTile) {
            this.runForEscape();
        } else if (this.isNpc && this.isOnTiles && this.walkToTile) {
            // sent somewhere: it goes, using its powers on the way, then fights on
            const { i, j } = this.walkToTile;
            if (this.tileIndex.i == i && this.tileIndex.j == j) this.walkToTile = undefined;
            else if (this.isThere) {
                const path = this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: this.walkToTile, pieceIndex: this.pieceIndex });
                if (path && path.length) this.updateMovmement(path);
                else this.walkToTile = undefined;
            }
            this.useAbilities(accTime);
        } else if (this.isNpc && this.isOnTiles && this.gameManagerProxy.getIsClosedTile(this.tileIndex)) {
            // on tiles that have closed (the Subway's tracks, a train coming): off them first, by the nearest way (Jamie)
            if (this.isThere) {
                const offTile = this.gameManagerProxy.getClosestWalkableTile(this.tileIndex);
                const path = offTile ? this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: offTile, pieceIndex: this.pieceIndex }) : [];
                if (path.length) this.updateMovmement(path);
            }
            this.useAbilities(accTime);
        } else if (this.isNpc && this.isOnTiles && this.gameManagerProxy.getGhostRingMove(this) !== undefined) {
            // inside the ghost ring: the teammate stays in, and steps out of the way of the next ghost
            if (this.isThere) this.moveToTiles = this.gameManagerProxy.getGhostRingMove(this);
            this.useAbilities(accTime);
        } else if (this.isNpc && this.isOnTiles && this.brainAction) {
            // a trained NPC: its model chooses, in place of the rules below
            followBrainAction(this, accTime);
        } else if (this.isNpc && this.isOnTiles) {

            const enemy = this.gameManagerProxy.getClosestEnemy(this.pieceIndex);

            // DETERMINE DESIRED MOVEMENT LOGIC
            // only re-path between tiles. a new path each tick is wasted while walking to the next tile.
            if (this.isThere) {
                // the Rooftop's guardian (no Dispel with the player): stays with the player, whoever is about
                if (!enemy || this.isGuardian) {
                    this.followLeader();
                } else {
                    this.moveWithEnemy(enemy);
                }
            } // - - - - - - - - - - - -

            this.useAbilities(accTime);
        } else if (!this.isNpc) {
            this.handlePlayerInput(playerInputHandler);
        }

        // a direction already held as the Teleport is cast: its line is taken anew from here, not the walk already under way
        // (that one ends at the platform's edge; the Teleport's goes across the gap toward the rival, GameManager.getTeleportAcross)
        if (this.shouldTeleport && !this.isNpc && playerInputHandler && playerInputHandler.getIsCurrentPlayerInput()) {
            const pressedDir = playerInputHandler.getPressedDir();
            const path = pressedDir && pressedDir != 'idle' ? this.getPathFromPressedDir(pressedDir, playerInputHandler) : [];
            if (path.length) this.moveToTiles = path;
        }

        // the player teleports once they have chosen a destination
        if (this.shouldTeleport && (this.isNpc || this.getIsMoveToTiles())) {
            this.teleportPiece();
        }

        // MOVE PIECE
        this.move();

        if (this.isThere) {
            // anyone, on either side, who steps into a Teleport's wormhole comes out of the other end
            if (this.isOnTiles && this.gameManagerProxy.getIsWormholeTile(this.tileIndex)) {
                const wasLinked = this.linkArrivalTile;
                this.followTileLink();
                if (this.linkArrivalTile != wasLinked) this.moveToTiles = []; // it is somewhere else now: a new path next time
            }
            if (this.getIsMoveToTiles()) {
                this.getNextDestination();
            } else if (!this.getIsMoveToTiles()) {
                this.stopMoving();
                if (!this.isNpc) this.followTileLink();
            }
        }

        if (this.isOnTiles) {
            const dmg = this.gameManagerProxy.getDmg(this.pieceIndex);
            if (!!dmg) {
                this.lastHitDirs = this.gameManagerProxy.getStatusDirs(this.tileIndex);
                this.lastHitBy = this.gameManagerProxy.getStatusCaster(this.tileIndex); // -1 for a Kaiju's touch
                this.decrementHealth(accTime, dmg);
            }
        }
    }

    // runs for a way out, ignoring everyone, and is gone once there
    runForEscape() {
        const { i, j } = this.escapeTile;
        if (this.tileIndex.i == i && this.tileIndex.j == j) {
            this.isVisible = false;
            this.isOnTiles = false;
            return;
        }
        if (this.isThere) this.updateMovmement(this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: this.escapeTile }));
    }

    // a charmed piece fights for the other team for a while. the player keeps their piece, but its keys are reversed,
    // and its power keys scrambled.
    updateCharm(accTime) {
        const hasNoOneToFight = this.isNpc && this.isCharmed && !this.gameManagerProxy.getHasAllyOnBoard(this.pieceIndex, this.homeTeamIndex);
        if (this.isCharmed && (accTime >= this.charmEndsAt || hasNoOneToFight)) {
            this.isCharmed = false;
            this.setTeamIndex(this.homeTeamIndex);
            // Spurned: an NPC goes after whoever charmed them, for as long as the charmer lives
            if (this.isNpc) this.spurnedBy = this.charmedBy;
            return;
        }
        if (!this.isOnTiles) return;
        const charmingTeam = this.gameManagerProxy.getCharmingTeam(this.pieceIndex);
        if (charmingTeam === undefined) return;
        const charmer = this.gameManagerProxy.getStatusCaster(this.tileIndex);

        // a Charm is spent on the first enemy it touches
        this.gameManagerProxy.clearTileStatusUnderPiece(this.pieceIndex);
        if (this.isCharmed) return;

        // with no one left on their old side to turn on, it hurts them instead
        if (this.isNpc && !this.gameManagerProxy.getHasAllyOnBoard(this.pieceIndex, this.teamIndex)) {
            this.decrementHealth(accTime, CHARM_ALONE_DMG);
            return;
        }
        this.isCharmed = true;
        this.charmEndsAt = accTime + CHARM_MS;
        // the player's power keys, scrambled while it lasts: no key keeps its own power (PlayerInputHandler)
        if (!this.isNpc) this.abilityScramble = Math.random() < 0.5 ? [1, 2, 0] : [2, 0, 1];
        this.charmedBy = charmer;
        if (this.isNpc) {
            this.setTeamIndex(charmingTeam);
            this.moveToTiles = [];
        }
    }

    getMoveToTiles() {
        return this.moveToTiles;
    }

    getIsAllowedTile(tileIndex) {
        if (!!tileIndex && !this.gameManagerProxy.getIsTileOpenTo(this, tileIndex)) return false; // the level's own rules (the Lab's catwalk)
        return !this.allowedTile || (!!tileIndex && this.allowedTile(tileIndex));
    }

    getNextDestination() {
        const [nextTileIndex, ...tileIndices] = this.moveToTiles;
        // kept to its own ground: the path stops at the edge
        if (!this.getIsAllowedTile(nextTileIndex)) {
            this.moveToTiles = [];
            this.stopMoving();
            return;
        }

        // the path crosses a tile link
        const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
        if (!!linkedTile && linkedTile.i == nextTileIndex.i && linkedTile.j == nextTileIndex.j) {
            // resting from portals: the path ends here, and a new one goes the long way
            if (this.getIsPortalResting()) {
                this.moveToTiles = [];
                this.stopMoving();
                return;
            }
            // the link wouldn't take them (resting, or not theirs): the path ends here. it used to carry on to the far end's
            // next tile, and they walked straight there through the floor (the Mermaid's stairs, Jamie, playtest 18)
            this.moveToTiles = tileIndices;
            if (!this.jumpToLinkedTile(linkedTile)) this.stopMoving();
            return;
        }

        // an NPC's path planned through a link or a portal that has since gone (a Teleport's wormhole shuts after one
        // trip): the next tile isn't beside them. they stop and find a new way, instead of gliding over to it through the
        // air (up to the Lab's catwalk, Jamie, playtest 18)
        if (this.isNpc && !this.gameManagerProxy.getAreTilesAdjacent(this.tileIndex, nextTileIndex)) {
            this.moveToTiles = [];
            this.stopMoving();
            return;
        }

        this.linkArrivalTile = undefined;
        const playerDirection = this.gameManagerProxy.getDirFromTiles(this.tileIndex, nextTileIndex);
        this.setDir(playerDirection);
        this.setTileIndex(nextTileIndex);
        this.moveToTiles = tileIndices;
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(nextTileIndex);
    }

    applyAvatar({ avatar, color, spriteSheetSrc }) {
        this.avatar = avatar;
        this.color = color;
        this.spriteSheetSrc = spriteSheetSrc;
    }

    // starts off-shot, and runs up to where it was standing
    // 'waypoints': the spots it passes on the way, if it has to go round something. 'dir': the way it faces once there.
    startArrival(startLocation, dir = undefined, waypoints = []) {
        this.arrivalEnd = this.charLocation;
        this.arrivalWaypoints = [...waypoints];
        this.arrivalDir = dir;
        this.moveToLocation = this.arrivalWaypoints.shift() || this.arrivalEnd;
        this.charLocation = startLocation;
        this.moveFromLocation = startLocation;
        this.isVisible = true;
        this.faceTowards(this.moveToLocation);
    }

    // one of the six hex directions, the closest to the way it is heading
    faceTowards(location) {
        const dx = location.x - this.charLocation.x;
        const dy = location.y - this.charLocation.y;
        if (!dx && !dy) return;
        const upOrDown = dy < 0 ? 'up' : 'down';
        this.setDir(Math.abs(dx) < Math.abs(dy) * 0.5 ? upOrDown : `${upOrDown}${dx > 0 ? 'Right' : 'Left'}`);
    }

    // says whether it has got there
    stepArrival() {
        if (this.arrivalWaitTicks > 0) {
            this.arrivalWaitTicks -= 1;
            return false;
        }
        const { newLocation, hasArrived } = this.gameManagerProxy.moveTo({
            currentLocation: this.charLocation,
            moveFromLocation: this.moveFromLocation,
            moveToLocation: this.moveToLocation,
            moveSpeed: this.moveSpeed
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        if (!hasArrived) return false;
        if (this.moveToLocation != this.arrivalEnd) {
            this.moveToLocation = this.arrivalWaypoints.shift() || this.arrivalEnd;
            this.faceTowards(this.moveToLocation);
            return false;
        }
        this.setDir(this.arrivalDir || 'idle');
        this.setDir('idle');
        this.arrivalEnd = undefined; // there: it sorts by its tile again
        return true;
    }

    // the tiles changed: the piece doesn't walk onto tiles that have gone
    trimPathToWalkableTiles() {
        if (this.gameManagerProxy.getIsClosedTile(this.tileIndex)) return; // the path may be its way off
        const firstGone = this.moveToTiles.findIndex(tile => !this.gameManagerProxy.getIsInBounds(tile));
        if (firstGone != -1) this.moveToTiles = this.moveToTiles.slice(0, firstGone);
    }

    hitByTrain(accTime, { mode, dmg }, safeTile) {
        this.setLastDmgAccTime(0); // a train hits whatever else has just happened
        this.lastHitDirs = undefined;
        this.decrementHealth(accTime, mode == 'kill' ? this.lives + this.livesModifier : dmg);
        this.moveToTiles = [];
        this.jumpToLinkedTile(safeTile);
    }

    // the player stopped on a linked tile
    followTileLink() {
        const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
        const isJustArrived = !!this.linkArrivalTile && this.linkArrivalTile.i == this.tileIndex.i && this.linkArrivalTile.j == this.tileIndex.j;
        if (!!linkedTile && !isJustArrived) this.jumpToLinkedTile(linkedTile);
    }

    // an NPC just through a portal or a tile link rests from them for a while
    getIsPortalResting() {
        return this.isNpc && (this.accTime || 0) < this.portalRestUntil;
    }

    // a link (by either end) resting for this piece: its own rest after taking it (the Mermaid's stairways: linkRestMs)
    getIsLinkResting(tile) {
        return !!this.linkRests && (this.accTime || 0) < (this.linkRests[`${tile.i} ${tile.j}`] || 0);
    }

    // false: the link didn't take them
    jumpToLinkedTile(linkedTile) {
        if (!this.getIsAllowedTile(linkedTile)) return false;
        if (this.getIsPortalResting() || this.getIsLinkResting(this.tileIndex)) return false;
        if (this.isNpc) this.portalRestUntil = (this.accTime || 0) + PORTAL_REST_MS;
        // this link rests a good while for this piece, both its ends: it'll take another next time (the Mermaid, Jamie)
        if (this.linkRestMs) {
            this.linkRests = this.linkRests || {};
            [this.tileIndex, linkedTile].forEach(({ i, j }) => { this.linkRests[`${i} ${j}`] = (this.accTime || 0) + this.linkRestMs; });
        }
        this.gameManagerProxy.useWormhole(this.tileIndex, this.accTime || 0); // a Teleport's wormhole: one trip, then it shuts
        // the player walks through it, in a little scene of its own (GameManager.startPortalWalk)
        if (!this.isNpc && this.gameManagerProxy.startPortalWalk(this, linkedTile)) return true;
        const location = this.gameManagerProxy.getCharXAndYFromTileIndex(linkedTile);
        this.setTileIndex(linkedTile);
        this.linkArrivalTile = linkedTile;
        this.charLocation = location;
        this.moveFromLocation = location;
        this.moveToLocation = location;
        this.isThere = true;
        return true;
    }

    move() {
        const { newLocation, hasArrived } = this.gameManagerProxy.moveTo({
            currentLocation: this.charLocation,
            moveFromLocation: this.moveFromLocation,
            moveToLocation: this.moveToLocation,
            moveSpeed: Math.max(this.moveSpeed + this.moveSpeedModifier - getWaterSlow(this.waterSlowEnds, this.accTime), 1)
        });
        this.charLocation = newLocation;
        this.moveFromLocation = newLocation;
        this.isThere = hasArrived;
    }

    handlePlayerInput(playerInputHandler) {

        /*
            player ended input.
            wait for 'isThere' to be true; character is fully moved to the next tile.
            stop moving.
         */
        if (this.isThere && playerInputHandler.getIsPastPlayerInput() && !playerInputHandler.getIsCurrentPlayerInput()) {
            playerInputHandler.setIsPastPlayerInput(false);
            playerInputHandler.setPathPressedDir('idle');
            // it walks on to the tile it is assigned, and stops there. slippery, it slides one tile on.
            this.moveToTiles = this.slipperyModifier > 0 ? this.moveToTiles.slice(0, SLIPPERY_SLIDE_TILES) : [];
            this.isThere = false;
        } else if (playerInputHandler.getIsCurrentPlayerInput() && playerInputHandler.getIsChangeOfDirection()) {
            /*
                a new direction was pressed: turn right away.
                'this.tileIndex' is the tile the piece is on, or the tile it is stepping onto.
            */
            playerInputHandler.setIsPastPlayerInput(true);
            const pressedDir = playerInputHandler.getPressedDir();
            playerInputHandler.setPathPressedDir(pressedDir);

            const moveToTiles = this.getPathFromPressedDir(pressedDir, playerInputHandler);
            if (moveToTiles.length) {
                this.gameManagerProxy.clearClickedTileIndex();
                this.updateMovmement(moveToTiles);
            } else {
                // no valid tile
                this.stopMoving();
            }
        }
    }

    // walks the board in the pressed direction until the piece runs out of tiles
    getPathFromPressedDir(pressedDir, playerInputHandler) {
        if (!this.isNpc && this.shouldTeleport) {
            const across = this.gameManagerProxy.getTeleportAcross(this.tileIndex, pressedDir, playerInputHandler);
            if (across) return across;
        }
        const moveToTiles = [];
        const seenTiles = new Set([`${this.tileIndex.i} ${this.tileIndex.j}`]);
        const isLeavingClosedTiles = this.gameManagerProxy.getIsClosedTile(this.tileIndex);
        const getCanStepOnto = tile => this.gameManagerProxy.getIsInBounds(tile) || (isLeavingClosedTiles && this.gameManagerProxy.getIsClosedTile(tile));
        let tileIndex = this.tileIndex;
        while (tileIndex) {
            const fromTile = tileIndex;
            tileIndex = playerInputHandler.getTileDirsFromPressedDir(pressedDir, fromTile)
                .map(dir => {
                    const offset = this.gameManagerProxy.getTileOffsetFromDir(dir, fromTile);
                    return { i: fromTile.i + offset.i, j: fromTile.j + offset.j };
                })
                .find(tile => getCanStepOnto(tile) && !seenTiles.has(`${tile.i} ${tile.j}`));
            if (tileIndex) {
                seenTiles.add(`${tileIndex.i} ${tileIndex.j}`);
                moveToTiles.push(tileIndex);
                // a key's walk stops on a tile link, and stopping there takes it (the Aquarium's floors). otherwise the walk,
                // which goes on until the tiles run out, would carry the player over it.
                if (this.gameManagerProxy.getLinkedTile(tileIndex)) break;
            }
        }
        return moveToTiles;
    }

    updateMovmement(moveToTiles) {
        if (!moveToTiles || !moveToTiles.length) return;
        // the path's first step is through a tile link (the Aquarium's floors): through it, not across the gap to it
        const linkedTile = this.gameManagerProxy.getLinkedTile(this.tileIndex);
        if (!!linkedTile && linkedTile.i == moveToTiles[0].i && linkedTile.j == moveToTiles[0].j) {
            if (this.getIsPortalResting()) return; // not now: it waits, and goes the long way next time
            this.jumpToLinkedTile(linkedTile);
            this.moveToTiles = moveToTiles.slice(1);
            return;
        }
        this.moveToLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(moveToTiles[0]) || this.moveToLocation;
        this.moveFromLocation = this.charLocation;
        this.moveToTiles = moveToTiles;
        this.isThere = false;

        const playerDirection = this.gameManagerProxy.getDirFromTiles(this.tileIndex, moveToTiles[0]);
        this.setDir(playerDirection);
    }

    teleportPiece() {
        // updates useEffect to trigger floating text 'Zip!'
        this.isTeleported = !this.isTeleported;

        // an NPC's own target, when the game gives it one (Punk Guy, trapped by the train: a clear platform)
        const pickedTileIndex = this.isNpc ? (this.teleportTarget || this.gameManagerProxy.getSafeTileIndex(this.pieceIndex, true)) : this.moveToTiles[this.moveToTiles.length - 1];
        this.teleportTarget = undefined;
        const teleportTileIndex = this.getIsAllowedTile(pickedTileIndex) ? pickedTileIndex : undefined;
        if (!teleportTileIndex) this.shouldTeleport = false; // nowhere it may go: the Teleport is spent

        if (teleportTileIndex) {
            // it leaves a wormhole between where it was and where it lands
            const { wormholeMs } = this.gameManagerProxy.getAbilityAndTileStatusData().isTeleportTile;
            if (wormholeMs) this.gameManagerProxy.addWormhole(this.tileIndex, teleportTileIndex, this.accTime, wormholeMs);
            this.linkArrivalTile = teleportTileIndex; // standing on the wormhole's far end doesn't send it straight back
            const teleportLocation = this.gameManagerProxy.getCharXAndYFromTileIndex(teleportTileIndex);
            this.setTileIndex(teleportTileIndex);
            this.shouldTeleport = false;
            this.charLocation = teleportLocation;
            this.moveToLocation = teleportLocation;
            this.moveFromLocation = teleportLocation;
            this.moveToTiles = [];
            this.isThere = true;

            if (!this.isNpc) {
                this.gameManagerProxy.resetHightlightedTiles();
            }

            // teleport passive is triggered after teleport is triggered...
            if (!!this.storedPassive) {
                this.storedPassive();
                this.storedPassive = undefined;
            }
        }
    }

    storePassive(passive){
        this.storedPassive = passive;
    }

    stopMoving() {
        this.setDir('idle');
        this.moveToLocation = this.charLocation;
        this.moveFromLocation = this.charLocation;
        this.moveToTiles = [];

        if (!this.isOnTiles && this.isThere && !this.moveToTiles.length) {
            this.isOnTiles = true;
        }
    }

    useAbilities(accTime) {
        let hasUsedOneAbility = this.getHasUsedOneAbility(accTime);

        if (hasUsedOneAbility) return;

        const moveToTilesToEnemy = this.gameManagerProxy.getPathToClosestEnemy(this.pieceIndex);
        const numTilesToEnemy = moveToTilesToEnemy.length;
        const isInDanger = this.gameManagerProxy.getIsPieceInDanger(this.pieceIndex);
        const isHealRequired = this.gameManagerProxy.getIsTeamDamaged(this.pieceIndex);

        // use abilities
        const isPowersOff = this.gameManagerProxy.getIsPowersOff(this);
        this.abilities.forEach(a => {
            if (!isPowersOff && !hasUsedOneAbility && !a.getIsOnCooldown(accTime, this.isNpc)) {
                const type = a.getType();
                const desiredAIRange = a.getDesiredAIRange();
                const isOffensivePowerAndTargetInRange =
                    type.includes("offensive") &&
                    !!numTilesToEnemy &&
                    desiredAIRange >= numTilesToEnemy;
                const isDefensivePowerAndIsInDanger =
                    type.includes("defensive") && isInDanger;
                const isEscapePowerAndIsInDanger =
                    type.includes("escape") &&
                    (
                        (!!numTilesToEnemy && desiredAIRange > numTilesToEnemy)
                        || isInDanger
                    );
                const isHealPowerAndIsTeammateHealthLow =
                    type.includes("heal") && isHealRequired;

                if (
                    isOffensivePowerAndTargetInRange ||
                    isDefensivePowerAndIsInDanger ||
                    isEscapePowerAndIsInDanger ||
                    isHealPowerAndIsTeammateHealthLow
                ) {

                    hasUsedOneAbility = true;

                    this.storePassive(a.useAbility({
                        accTime,
                        piece: this,
                        registerTimeout: this.gameManagerProxy.registerTimeout,
                        updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus
                    }));
                }
            }
        });
    }

    getHasUsedOneAbility(accTime) {
        return this.abilities.some(v => !!v.accTime && (accTime - v.accTime) < this.abilityAccTimeInterval);
    }

    moveWithEnemy(enemy) {
        const idealDistance = this.getIdealDistanceFromEnemy();
        const moveToTilesToEnemy = this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: enemy.tileIndex, pieceIndex: this.pieceIndex });

        // the furthest a ready attack reaches. without this, two NPCs could settle just out of each other's range for good.
        const attackReach = this.getReadyAttackReach();
        const isOutOfReach = attackReach > 0 && moveToTilesToEnemy.length > attackReach;
        const isEnemyTooFar = moveToTilesToEnemy.length > idealDistance + this.enemyDistanceBias || isOutOfReach;
        const isEnemyTooClose = moveToTilesToEnemy.length < idealDistance;

        if (isEnemyTooFar) {
            // move closer to enemy
            this.setMoveToTilesGivenIdealDistanceFromEnemy(moveToTilesToEnemy, isOutOfReach ? Math.min(idealDistance, attackReach) : idealDistance);
        } else if (isEnemyTooClose) {
            // move closer to safe tile, away from enemy
            const moveToTilesToSafety = this.isDoAvoidEnemy ?
                this.gameManagerProxy.getPathToSafeTileAndAvoidEnemies(this.pieceIndex)
                : this.gameManagerProxy.getPathToSafeTile(this.pieceIndex);
            this.setMoveToTilesGivenIdealDistanceFromEnemy(moveToTilesToSafety, idealDistance);
        }
    }

    setMoveToTilesGivenIdealDistanceFromEnemy(moveToTiles, idealDistance) {
        this.moveToTiles = this.getSpacedPath((moveToTiles.length - idealDistance) > 0 ? moveToTiles.slice(0, moveToTiles.length - idealDistance) : moveToTiles);
    }

    // with spacing on, an NPC stops short rather than end on a tile someone else stands on: groups spread out.
    // not a Kaiju: it hurts by walking into people.
    getSpacedPath(moveToTiles) {
        if (this.avatar == 'kaiju') return moveToTiles;
        const path = [...moveToTiles];
        while (path.length && this.gameManagerProxy.getIsTileTakenForSpacing(this.pieceIndex, path[path.length - 1])) path.pop();
        return path;
    }

    followLeader() {
        // in Sewer 1 the team waits where it rests until the player, heading left, has gone past
        if (this.isWaitingToBePassed) {
            const leader = this.gameManagerProxy.getTeamLeaderPiece(this.pieceIndex);
            if (leader && leader != this && leader.getTileIndex().i >= this.tileIndex.i) {
                this.moveToTiles = [];
                return;
            }
            this.isWaitingToBePassed = false;
        }
        const moveToTiles = this.gameManagerProxy.getPathToTeamLeader(this.pieceIndex);
        this.moveToTiles = this.getSpacedPath(moveToTiles.length > this.followDistance ?
            // ensure piece follows within the range of 'this.followDistance'
            moveToTiles.slice(0, moveToTiles.length - this.followDistance)
            : []);
    }

    getReadyAttackReach() {
        if (this.gameManagerProxy.getIsPowersOff(this)) return 0;
        return this.abilities
            .filter(a => a.getType().includes("offensive") && !a.getIsOnCooldown(this.accTime, this.isNpc))
            .reduce((reach, a) => Math.max(reach, a.getDesiredAIRange()), 0);
    }

    getIdealDistanceFromEnemy() {
        const readyAbilities = this.abilities.filter(a => !a.getIsOnCooldown(this.accTime, this.isNpc));
        return !readyAbilities.length ?
            10 // default to 10 tiles (away from enemy) if all abilities are on cooldown
            // the average range of the powers that are ready
            : readyAbilities.reduce((acc, item) => acc + item.getDesiredAIRange(), 0) / readyAbilities.length;
    }

    decrementHealth(accTime, dmg) {
        if (this.isUnhurtable && dmg > 0) return;
        if (this.getIsDamageable(accTime)) {
            this.setLastDmgAccTime(accTime);

            const isHeal = dmg < 0;
            const isExtraLives = this.livesModifier > 0;
            let remainingDmg = dmg;

            if (!isHeal && isExtraLives) {
                remainingDmg = this.decrementExtraLives(dmg);
            }

            const livesNewVal = this.lives - remainingDmg;
            // constrain health to [0, this.maxLives]
            this.lives = Math.max(Math.min(this.maxLives, livesNewVal), 0);
            // training points (sparring's temporary health, on top) go first, and for good: no healing back (Jamie)
            if (!isHeal && this.trainingBase !== undefined && this.maxLives > this.trainingBase) {
                this.maxLives = Math.max(this.trainingBase, Math.min(this.maxLives, this.lives));
            }

            if (isHeal) {
                // triggers useEffect to show
                this.isHealed = !this.isHealed;
            }

            const lives = this.lives + this.livesModifier;

            if (!this.isDead && lives < 1) {
                if (this.onBeforeDeath && this.onBeforeDeath()) return;
                this.handleDeath();
            }
        }
    }

    decrementExtraLives(dmg) {
        /*
            decrement from extra lives (positive "livesModifier")
                before decrementing from health ("lives")
        */
        const remainingDmg = Math.max(dmg - this.livesModifier, 0);
        this.livesModifier = Math.max(this.livesModifier - dmg, 0);

        // ability gives: positive "livesModifier." clearTimeout as passive has been toggled-off by decrementing extra lives
        const toggledOnPassives = this.abilities.filter(({ gameBoardPieceAbilityData, isPassiveApplied }) => {
            const { fieldToModify, modifierVal } = gameBoardPieceAbilityData;
            return fieldToModify == 'livesModifier' && modifierVal > 0 && !!isPassiveApplied;
        });
        toggledOnPassives.forEach(a => a.clearPassiveTimeout(this.gameManagerProxy.unregisterTimeout));

        return remainingDmg;
    }

    setLastDmgAccTime(accTime) {
        this.lastDmgAccTime = accTime;
    }

    getIsDamageable(accTime) {
        // piece is dead. piece CANNOT be dmged
        if (this.isDead) return false;
        // piece never dmged. piece CAN be dmged
        if (this.lastDmgAccTime == 0) return true;

        // wait until the current game time is greater than the last game time the piece was dmged + the wait time interval
        return accTime > (this.lastDmgAccTime + this.lastDmgAccTimeInterval)
    }

    getNumMoveToTiles() {
        return this.moveToTiles.length;
    }

    getTeamIndex() { return this.teamIndex; }


    // intended for 'Charm' ability -
    setTeamIndex(index) { this.teamIndex = index; }
    setColor(color) { this.color = color; }
    // - - - - - - - - - - - - - - - -

    getColor() {
        return this.color;
    }

    handleDeath() {
        this.setIsDead(true);
        this.spawnDeathPiece();
        // a Kaiju charmed onto the player's team still counts as a kill
        this.gameManagerProxy.updateScore(this.homeTeamIndex);
    }

    spawnDeathPiece() {
        this.isVisible = false;
        /*
            pieceAdded to the board on piece's death.
            representation varies per piece.
            (example: 'Exploding Kaiju' sprite anim.)
        */
        // thrown by how they were moving and by what hit them
        const throwVec = getThrowVec(this.dir, this.lastHitDirs, this.facingDir);
        this.gameManagerProxy.spawnDeathPieceAtLocation(this.charLocation, this.avatar, this.tileIndex, this.color, this.pieceIndex, throwVec, this.spriteSheetSrc);
    }

    getIsDead() {
        return this.isDead;
    }

    setIsDead(isDead) {
        this.isDead = isDead;
    }

    getUiState() {
        const { lives, maxLives, isDead, avatar, livesModifier, moveSpeedModifier, numTilesModifier, tileCountModifier } = this;
        return {
            lives,
            maxLives,
            isDead,
            gender: avatar,
            livesModifier,
            moveSpeedModifier,
            numTilesModifier,
            tileCountModifier,
            isRewardPulse: this.getIsRewardPulse(), // health won sparring: the HUD's portrait glows red a while
            isControlled: !this.isNpc && !this.isDead, // the one the player plays as: only their HUD shows the keys 1 to 3
            abilities: this.abilities.map(a => a.getUiState(this.isNpc, this.accTime))
        };
    }

    /*
        What is on this piece that changes play, for the icons over its head (Jamie, 2026-11-10), each { id, count? }:
        slowed (Ice Slice's passive, or wading in the Aquarium's water: the count is the wading stacks), fast (Discharge's
        passive), burn (Wildfire's stacks: the player's team only), builder (Aegis's next cast is stronger: the player's
        team only), spurned (an NPC hunting whoever charmed it), charmed. (No icon for the Mermaid's unhurtable healing: Jamie.)
    */
    getStatusEffects(playerTeamIndex) {
        const passive = element => this.abilities.find(ability => ability.gameBoardPieceAbilityData.element == element && ability.isPassiveApplied);
        const isTeam = this.homeTeamIndex == playerTeamIndex;
        const wading = getWaterSlow(this.waterSlowEnds, this.accTime);
        const effects = [];
        if (passive('ice') || wading > 0) effects.push({ id: 'slowed', count: wading > 1 ? wading : undefined });
        if (passive('lightning')) effects.push({ id: 'fast' });
        const burn = passive('fire');
        if (isTeam && burn && burn.stacks > 0) effects.push({ id: 'burn', count: burn.stacks });
        if (isTeam && passive('metal')) effects.push({ id: 'builder' });
        const charmer = this.isNpc && this.spurnedBy !== undefined && this.spurnedBy >= 0 ? this.gameManagerProxy.getPiece(this.spurnedBy) : undefined;
        if (charmer && !charmer.getIsDead() && !this.isCharmed) effects.push({ id: 'spurned' });
        if (this.isCharmed) effects.push({ id: 'charmed' });
        return effects;
    }

    // health just won sparring (Jamie): a red glow pulses round them, on the board and on their HUD, until then
    getIsRewardPulse() {
        return (this.accTime || 0) < (this.rewardPulseUntil || 0);
    }

    respawn(accTime) {
        this.isCharmed = false;
        this.setTeamIndex(this.homeTeamIndex);
        this.lives = this.maxLives;
        this.isDead = false;
        // TO-DO: remove dead game piece
        this.isVisible = true;

        // reset passive ability stats
        this.storedPassive = undefined;
        this.livesModifier = 0;
        this.moveSpeedModifier = 0;
        this.numTilesModifier = 0;
        this.tileCountModifier = 0;
        this.slipperyModifier = 0;
        this.dmgModifier = 0;
        // - - - - - - - - - -

        // reset active ability data
        this.lastDmgAccTime = accTime;
        this.shouldTeleport = false;
    }
}