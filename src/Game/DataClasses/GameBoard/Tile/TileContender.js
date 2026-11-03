export class TileContender {
    constructor({
        tileStatus,
        currCount,
        targetIndex,
        teamIndex,
        dirs,
        wall,
        trailAge = 0,
        trailBonus = 0,
        isForwardWave = false
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
        this.trailBonus = trailBonus; // extra tile updates it stays, from a buffed cast
        this.isForwardWave = isForwardWave; // the second wave of a cast: it never turns around
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
            trailBonus: this.trailBonus,
            isForwardWave: this.isForwardWave
        }
    }
}