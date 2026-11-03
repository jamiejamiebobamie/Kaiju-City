import { NO_CAST, TileContender } from 'Game/DataClasses/GameBoard/Tile/TileContender';
import {
    TILE_DIRS,
    TILE_DIR_NORM_VECS,
    TILE_DIR_ROTATIONS_IN_DEGREES,
    TILE_STATUS_RANKS,
    ICON_ROTATION_METHODS
} from 'Utils/gameState';
import { getRandomIntInRange } from 'Game/utils'

export class GameBoardTile {
    constructor({
        tileIndex = { i: 0, j: 0 },
        isVisible = true,
        tileLocation = { x: 0, y: 0 },
        zIndex = 0,
        scale = 1,
        isHighlighted = false,
        tileStatus = undefined,
        currCount = 0,
        targetIndex = -1,
        teamIndex = -1,
        dirs = [],
        dmgMultiplier = 1,
        updateKey = 0
    }) {

        // CACHED ON INIT - - - - - - - -
        // { i, j } // i = col, j = row
        this.tileIndex = tileIndex;

        this.isVisible = isVisible; // ** may update with "Zoom feature"

        // 'getTileXAndY'
        this.tileLocation = tileLocation; // ** may update with "Zoom feature"

        // = i + j + rowLength
        this.zIndex = zIndex;
        this.key = zIndex;

        this.scale = scale;  // ** may update with "Zoom feature"
        // - - - - - - - - - - - - - - - -

        this.isHighlighted = isHighlighted; // replaces: 'isHighlighted0'

        // CLASS: 'GameBoardTileStatusAndAbilityData' (shared "flyweight" instances)
        this.tileStatus = tileStatus;

        // per-tile status info
        this.currCount = currCount;
        this.targetIndex = targetIndex;
        this.teamIndex = teamIndex;
        this.dirs = dirs;
        this.dmgMultiplier = dmgMultiplier;
        this.wall = undefined; // where a wall status set off from. false once it has bounced apart.
        this.trailAge = 0; // tile updates since the status stopped moving
        this.cast = NO_CAST; // see 'NO_CAST'

        // stored accTime of last tileStatus update
        this.updateKey = updateKey;

        // shown while the player is choosing where to teleport
        this.teleportTileStatus = undefined;
    }

    getAngleOfRotationFromTileDirs() {
        const dirs = this.dirs;
        const normVecs = dirs.map(d => {
            const i = TILE_DIRS.indexOf(d)
            if (i != -1) {
                return TILE_DIR_NORM_VECS[i];
            } else {
                return null;
            }
        });
        const accNormVec = normVecs.filter(v => !!v).reduce((acc, item) => {
            acc.x += item.x;
            acc.y += item.y;
            return acc;
        }, { x: 0, y: 0 });

        const avgNormVec = { x: accNormVec.x / dirs.length, y: accNormVec.y / dirs.length };

        // Math.cos(avgNormVec.x) // faster way to determine angle from norm vec: x/y?
        // Math.sin(avgNormVec.y)
        const indexOfClosestDir = TILE_DIR_NORM_VECS.reduce((acc, item, i) => {
            const dot = (item.x * avgNormVec.x) + (item.y * avgNormVec.y) / 2
            if (dot > acc.largestDot)
                return { largestDot: dot, i };
            return acc;
        }, { largestDot: -1, i: -1 }).i;

        if (indexOfClosestDir != -1)
            return TILE_DIR_ROTATIONS_IN_DEGREES[indexOfClosestDir]
        else
            return 0;
    };

    getAppliedStatus() {
        return this.tileStatus ? this.tileStatus.getAppliedStatus() : ''
    }

    getColor() {
        if (this.teleportTileStatus) return this.teleportTileStatus.getColor();
        return this.tileStatus ? this.tileStatus.getColor() : ''
    }

    getRotation() {
        if (!!this.tileStatus) {
            // each tile icon uses the dirs rotation in a different way (sometimes overwriting it)
            const perIconRotation = ICON_ROTATION_METHODS[this.tileStatus.getRotationShift()]
            const { i, j } = this.tileIndex;
            const startCount = this.tileStatus.range;
            const rotation = perIconRotation(this.getAngleOfRotationFromTileDirs(), this.currCount, startCount, this.updateKey, i, j);
            return Number.isFinite(rotation) ? rotation : 0;
        }
        return 0;
    }

    getRotationShift() {
        return this.tileStatus ? this.tileStatus.getRotationShift() : ''
    }

    getActiveIcon() {
        if (this.teleportTileStatus) return this.teleportTileStatus.getActiveIcon();
        return this.tileStatus ? this.tileStatus.getActiveIcon() : ''
    }

    setTeleportTileStatus(teleportTileStatus) {
        this.teleportTileStatus = teleportTileStatus;
    }

    getIsVisible() {
        return this.isVisible;
    }

    getIsHighlighted() {
        return this.isHighlighted && !this.teleportTileStatus;
    }

    getZIndex() {
        return this.zIndex;
        // return this.gameManagerProxy.getFlattenedArrayIndex(this.tileIndex);
    }

    updateIsVisible(isVisible) {
        this.isVisible = isVisible;
    }

    updateTileLocation(tileLocation) {
        this.tileLocation = tileLocation;
    }

    updateScale(scale) {
        this.scale = scale;
    }

    setIsHighlighted(isHighlighted) {
        this.isHighlighted = isHighlighted;
    }

    getIsDmgTile(teamIndex) {
        if (!this.tileStatus) return 0;
        const dmg = this.tileStatus.getDmgAmt();
        const isDmg = this.teamIndex != teamIndex && dmg > 0;
        const isHeal = this.teamIndex == teamIndex && dmg < 0;
        return isHeal || isDmg;
    }

    getDmgAmt() {
        const dmg = this.tileStatus.getDmgAmt();
        // only apply the 'dmgMultiplier' to dmg (and not heals...)
        return dmg > 0 ? dmg * this.dmgMultiplier : dmg;
    }

    getTileStatus() {
        return this.tileStatus;
    }

    clearTileStatus() {
        this.tileStatus = undefined;

        this.currCount = 0;
        this.targetIndex = -1;
        this.teamIndex = -1;
        this.dirs = [];
        this.wall = undefined;
        this.trailAge = 0;
        this.cast = NO_CAST;
    }

    getCurrCount() {
        return this.currCount;
    }

    setUpdateKey(updateKey) {
        this.updateKey = updateKey;
    }

    setTileStatus(tileStatus) {
        this.tileStatus = tileStatus;
    }

    getDirs() {
        return this.dirs;
    }

    updateTileStatus({ updateKey, tileStatus, currCount, dirs, teamIndex, targetIndex, wall = undefined, trailAge = 0, cast = NO_CAST }) {
        this.setUpdateKey(updateKey);
        this.setTileStatus(tileStatus);

        this.currCount = currCount;
        this.dirs = dirs;
        this.teamIndex = teamIndex;
        this.targetIndex = targetIndex;
        this.wall = wall;
        this.trailAge = trailAge;
        this.cast = cast;
    }

    getTileContenderFromTile({ currCount, newDirs, wall, trailAge, cast }) {
        return new TileContender({
            tileStatus: this.tileStatus,
            currCount: currCount ?? Math.max(this.currCount - 1, 0), // SIDE EFFECT: decrement count
            targetIndex: this.targetIndex,
            teamIndex: this.teamIndex,
            dirs: newDirs || this.dirs,
            wall: wall ?? this.wall,
            trailAge,
            cast: cast || this.cast
        });
    }

    // true if 'tileStatus' does not lose to the tile's current status
    getCanApplyStatus(tileStatus) {
        if (!this.tileStatus) return true;
        return TILE_STATUS_RANKS[tileStatus.getAppliedStatus()] <= TILE_STATUS_RANKS[this.tileStatus.getAppliedStatus()];
    }

}
