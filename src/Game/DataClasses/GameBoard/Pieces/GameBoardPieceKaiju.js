import { GameBoardPieceBase } from './GameBoardPieceBase';

export class GameBoardPieceKaiju extends GameBoardPieceBase {
    constructor(params) {
        super(params);
        this.isGoingToSpewFire = false;
        this.spewFireCoolDown = params.spewFireCoolDown;
        this.isOnTiles = false;
        this.isShowHealthBarOnComponent = true;
        this.lastDmgAccTimeInterval = 400; // in milliseconds
        this.dealsContactDmg = true;

        this.pieceClass = 'Kaiju!';
        this.pieceClassDescription = 'They come every night from the sea!';
        this.elements = 'kaijuFire';
    }

    useAbilities(accTime) {
        if (!this.isOnTiles) return;

        this.abilities.forEach(a => {
            const isCooldownOver =
                (((accTime - a.accTime) >= this.spewFireCoolDown) || (accTime < a.accTime));

            if (isCooldownOver) {
                const numTilesToEnemy = this.gameManagerProxy.getPathToClosestEnemy(this.pieceIndex).length;

                const isOffensivePowerAndTargetInRange =
                    a.getType().includes("offensive") &&
                    !!numTilesToEnemy &&
                    a.getDesiredAIRange() >= numTilesToEnemy;
                if (isOffensivePowerAndTargetInRange) {
                    a.useAbility({
                        accTime,
                        piece: this,
                        registerTimeout: this.gameManagerProxy.registerTimeout,
                        updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus
                    });
                }
            } else {
                this.determineIfIsGoingToSpewFire(a, accTime);
            }
        });
    }

    determineIfIsGoingToSpewFire(a, accTime) {
        const { KAIJU_COOL_DOWN } = this.gameManagerProxy.determineKaijuDetails();

        const showFireTime = a.accTime // last game time the fire was spewed
            + KAIJU_COOL_DOWN // a.cooldownTimeAI // fire spew cooldown (12 seconds)
            * 0.75; // show the fire after 3/4 of the cooldown time (9 seconds)
        this.isGoingToSpewFire = !a.accTime || accTime > showFireTime;
    }

    respawn(accTime) {
        super.respawn(accTime);
        this.initCharLocation(); // reset Kaiju position to off screen
    }

    moveWithEnemy(enemy) {
        const otherKaijuTileIndices = this.gameManagerProxy.getTeamPieces(this.teamIndex)
                                                                .filter(({ isOnTiles }) => !!isOnTiles)
                                                                .map(({ tileIndex }) => tileIndex);
        const moveToTilesToEnemy = this.gameManagerProxy.getPathFromTileToTile({ fromTile: this.tileIndex, toTile: enemy.tileIndex, avoidTiles: otherKaijuTileIndices });
        // run directly into enemy (Kaiju-behavior)
        this.setMoveToTilesGivenIdealDistanceFromEnemy(moveToTilesToEnemy, 0);
    }
}