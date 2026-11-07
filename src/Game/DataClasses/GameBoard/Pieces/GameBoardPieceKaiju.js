import { GameBoardPieceBase } from './GameBoardPieceBase';
import { getKaijuSpeedBoost, getKaijuSpeedMode, KAIJU_SPEED } from 'Game/DataClasses/KaijuSpeedTest';

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
        this.rampageEndsAt = 0;
        this.speedBoost = 0; // on top of 'moveSpeedModifier', from the speed playtest
    }

    useAbilities(accTime) {
        if (!this.isOnTiles) return;
        if (this.castEveryMs) return this.useOneAbility(accTime);

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
                    if (getKaijuSpeedMode() == 'rampage') this.rampageEndsAt = accTime + KAIJU_SPEED.rampageMs;
                }
            } else {
                this.determineIfIsGoingToSpewFire(a, accTime);
            }
        });
        this.updateSpeedBoost(accTime);
    }

    /*
        The teammate turned Kaiju (the last fight), with every power: one at a time, every 'castEveryMs', a different one
        each time, so each is seen. All at once, they land on the same tiles together and seem like nothing at all (Jamie).
    */
    useOneAbility(accTime) {
        const sinceCast = accTime - (this.lastCastAt ?? -Infinity);
        if (sinceCast >= this.castEveryMs) {
            // an enemy right on top of it (it walks into them) is in reach too: an empty path there isn't 'no one to fight'
            const enemy = this.gameManagerProxy.getClosestEnemy(this.pieceIndex);
            const numTilesToEnemy = !enemy ? 0 : Math.max(this.gameManagerProxy.getPathToClosestEnemy(this.pieceIndex).length, 1);
            const ready = this.abilities.filter(a => a.getType().includes("offensive") && !!numTilesToEnemy && a.getDesiredAIRange() >= numTilesToEnemy
                && ((accTime - a.accTime) >= this.spewFireCoolDown || accTime < a.accTime || !a.accTime));
            const fresh = ready.filter(a => a != this.lastCast);
            const pool = fresh.length ? fresh : ready;
            const ability = pool[Math.floor(Math.random() * pool.length)];
            if (ability) {
                ability.useAbility({
                    accTime,
                    piece: this,
                    registerTimeout: this.gameManagerProxy.registerTimeout,
                    updateTileWithAbilityStatus: this.gameManagerProxy.updateTileWithAbilityStatus
                });
                this.lastCast = ability;
                this.lastCastAt = accTime;
            }
        }
        this.isGoingToSpewFire = accTime - (this.lastCastAt ?? -Infinity) >= this.castEveryMs * 0.6;
        this.updateSpeedBoost(accTime);
    }

    updateSpeedBoost(accTime) {
        const boost = getKaijuSpeedBoost({ accTime, rampageEndsAt: this.rampageEndsAt, isGoingToSpewFire: this.isGoingToSpewFire });
        this.moveSpeedModifier += boost - this.speedBoost;
        this.speedBoost = boost;
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
        this.speedBoost = 0; // respawning clears 'moveSpeedModifier'
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