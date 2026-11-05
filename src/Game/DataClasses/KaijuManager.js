import { Difficulty, PIECES_INFO } from 'Utils/gameState';
import { GameBoardPieceKaiju } from 'Game/DataClasses/GameBoard/Pieces/GameBoardPieceKaiju';

const KAIJU_SPAWN = {
    spawnIntervalMs: 11000, // time between new Kaiju
    respawnIntervalMs: 1100 // time between attempts to bring back dead Kaiju
};

export class KaijuManager {
    constructor({
        gameManagerProxy,
        kaijuTeamIndex = 1
    }) {
        this.kaijuPieces = [];
        this.kaijuTeamIndex = kaijuTeamIndex;
        this.lastSpawnAccTime = -KAIJU_SPAWN.spawnIntervalMs; // the first comes as soon as the fight starts
        this.lastRespawnAccTime = 0;
        this.gameManagerProxy = gameManagerProxy;
    }

    reset() {
        this.kaijuPieces = [];
        this.lastSpawnAccTime = -KAIJU_SPAWN.spawnIntervalMs;
        this.lastRespawnAccTime = 0;
    }

    update(accTime, killCount) {
        const { MAX_AT_ONCE, MAX_TO_WIN } = this.gameManagerProxy.determineKaijuDetails();

        // never more Kaiju than are left to win: the fight doesn't end with some still standing
        const getRemainingNeeded = () => MAX_TO_WIN - (killCount + this.kaijuPieces.filter(piece => !piece.getIsDead()).length);
        if (accTime >= this.lastSpawnAccTime + KAIJU_SPAWN.spawnIntervalMs) {
            this.lastSpawnAccTime = accTime;
            if (this.kaijuPieces.length < MAX_AT_ONCE && getRemainingNeeded() > 0) this.addKaijuPiece(accTime);
        }

        if (accTime >= this.lastRespawnAccTime + KAIJU_SPAWN.respawnIntervalMs) {
            this.lastRespawnAccTime = accTime;
            let remainingNeeded = getRemainingNeeded();
            this.kaijuPieces.filter(piece => piece.getIsDead()).forEach(piece => {
                if (remainingNeeded > 0) {
                    remainingNeeded -= 1;
                    piece.respawn(accTime);
                }
            });
        }
    }

    determineKaijuDetailsFromDifficulty = (difficulty) => {
        let MAX_AT_ONCE, MAX_TO_WIN, KAIJU_MAX_HEALTH, KAIJU_MAX_SPEED, KAIJU_COOL_DOWN = undefined;
        switch (difficulty) {
            case Difficulty.Easy:
                MAX_AT_ONCE = 2;
                MAX_TO_WIN = 5;
                KAIJU_MAX_HEALTH = 2;
                KAIJU_MAX_SPEED = 2;
                KAIJU_COOL_DOWN = 12000;
                break;
            case Difficulty.Hard:
                MAX_AT_ONCE = 4;
                MAX_TO_WIN = 20;
                KAIJU_MAX_HEALTH = 3;
                KAIJU_MAX_SPEED = 3;
                KAIJU_COOL_DOWN = 9000;
                break;
            case Difficulty.Xtreme:
                MAX_AT_ONCE = 5;
                MAX_TO_WIN = 50;
                KAIJU_MAX_HEALTH = 3;
                KAIJU_MAX_SPEED = 3;
                KAIJU_COOL_DOWN = 6000;
                break;
            default: // Difficulty.Medium
                MAX_AT_ONCE = 3;
                MAX_TO_WIN = 10;
                KAIJU_MAX_HEALTH = 3;
                KAIJU_MAX_SPEED = 2;
                KAIJU_COOL_DOWN = 12000;
        }
        return { MAX_AT_ONCE, MAX_TO_WIN, KAIJU_MAX_HEALTH, KAIJU_MAX_SPEED, KAIJU_COOL_DOWN };
    }

    addKaijuPiece(accTime) {
        const { KAIJU_MAX_HEALTH, KAIJU_MAX_SPEED, KAIJU_COOL_DOWN } = this.gameManagerProxy.determineKaijuDetails();

        const teamIndex = this.kaijuTeamIndex;
        const pieceInfo = {
            ...PIECES_INFO['kaiju'],
            abilities: this.gameManagerProxy.getKaijuAbilities(accTime),
            spewFireCoolDown: KAIJU_COOL_DOWN,
            maxLives: KAIJU_MAX_HEALTH,
            moveSpeed: KAIJU_MAX_SPEED,
            isDoAvoidEnemy: false,
        };

        const newKaiju = this.gameManagerProxy.addPiece({ pieceInfo, teamIndex, pieceClass: GameBoardPieceKaiju });
        newKaiju.initCharLocation();
        this.kaijuPieces.push(newKaiju);
    }
}
