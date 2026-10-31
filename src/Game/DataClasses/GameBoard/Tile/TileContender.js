export class TileContender {
    constructor({
        tileStatus,
        currCount,
        targetIndex,
        teamIndex,
        dirs,
        wall,
        trailAge = 0
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
            trailAge: this.trailAge
        }
    }
}