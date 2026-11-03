/*
    What one cast carries with it as it spreads, the same on every tile it reaches:
    casterIndex: who cast it. trailBonus: extra tile updates a trail stays. isForwardWave: the second wave never turns.
    rangeBonus: how much further than its range it started, so ticks are counted from where it really started.
    isSmoke: it has hit an edge and is burning out.
*/
export const NO_CAST = Object.freeze({ casterIndex: -1, trailBonus: 0, isForwardWave: false, rangeBonus: 0, isSmoke: false });

export class TileContender {
    constructor({
        tileStatus,
        currCount,
        targetIndex,
        teamIndex,
        dirs,
        wall,
        trailAge = 0,
        cast = NO_CAST
    }) {
        // CLASS: 'GameBoardTileStatusAndAbilityData' (shared "flyweight" instances)
        this.tileStatus = tileStatus;

        // per-tile status info
        this.currCount = currCount;
        this.targetIndex = targetIndex;
        this.teamIndex = teamIndex;
        this.dirs = dirs;
        this.wall = wall;
        this.trailAge = trailAge; // tile updates since the status stopped moving
        this.cast = cast; // shared by every tile of one cast. see 'NO_CAST'.
    }

    getTileStatus() {
        return this.tileStatus;
    }

    getCurrCount(){
        return this.currCount;
    }

    getAppliedStatus() {
        return this.tileStatus.getAppliedStatus();
    }

    getTileStatusValues() {
        return {
            tileStatus: this.tileStatus,
            currCount: this.currCount,
            targetIndex: this.targetIndex,
            teamIndex: this.teamIndex,
            dirs: this.dirs,
            wall: this.wall,
            trailAge: this.trailAge,
            cast: this.cast
        }
    }
}