// the extra wait before an NPC can use an ability again, in milliseconds
const AI_COOLDOWN_DELAY = 750;

export class GameBoardPieceAbility {
    constructor({
        accTime = 0,
        isPassiveApplied = false,
        gameBoardPieceAbilityData = undefined // GameBoardTileStatusAndAbilityData
    }) {
        this.accTime = accTime;
        this.toggleOffPassiveTimeoutRef = undefined;
        this.isPassiveApplied = isPassiveApplied;
        this.gameBoardPieceAbilityData = gameBoardPieceAbilityData;
    }

    useAbility({
        accTime,
        piece,
        registerTimeout,
        updateTileWithAbilityStatus
    }) {
        // update accTime
        this.accTime = accTime;
        // activate active ability
        updateTileWithAbilityStatus({
            pieceIndex: piece.pieceIndex,
            appliedStatus: this.gameBoardPieceAbilityData.appliedStatus,
            accTime
        });
        const triggerPassive = () => {
            // toggle-on passive ability
            this.gameBoardPieceAbilityData.togglePassive(piece);
            this.isPassiveApplied = true;
            // toggle-off passive ability
            const delay = this.gameBoardPieceAbilityData.passiveDurationTime ? this.gameBoardPieceAbilityData.passiveDurationTime : this.gameBoardPieceAbilityData.cooldownTimeAI;
            const toggleOffPassive = () => {
                const toggleOff = true;
                this.gameBoardPieceAbilityData.togglePassive(piece, toggleOff);
                this.isPassiveApplied = false;
                this.toggleOffPassiveTimeoutRef = undefined;
            }
            this.toggleOffPassiveTimeoutRef = registerTimeout(toggleOffPassive, delay);
        }
        if (this.gameBoardPieceAbilityData.isTriggerPassiveImmediately) {
            triggerPassive();
        } else {
            return triggerPassive;
        }
    }

    // the passive was used up (eg. 'Healthy' extra lives taking dmg). it no longer needs toggling-off.
    clearPassiveTimeout(unregisterTimeout) {
        unregisterTimeout(this.toggleOffPassiveTimeoutRef);
        this.toggleOffPassiveTimeoutRef = undefined;
        this.isPassiveApplied = false;
    }

    getIsOnCooldown(accTime, isNpc) {
        if (!this.accTime) return false; // never used
        const { cooldownTimeAI, cooldownTimePlayer } = this.gameBoardPieceAbilityData;
        const cooldown = isNpc ? cooldownTimeAI + AI_COOLDOWN_DELAY : cooldownTimePlayer;
        return (accTime - this.accTime) < cooldown;
    }

    getType() {
        return this.gameBoardPieceAbilityData.type;
    }

    getDesiredAIRange() {
        return this.gameBoardPieceAbilityData.desiredAIRange;
    }

    getUiState(isNpc) {
        const { element, color, activeName, passiveName, cooldownTimeAI, cooldownTimePlayer } = this.gameBoardPieceAbilityData;
        return {
            element,
            color,
            activeName,
            passiveName,
            accTime: this.accTime,
            isPassiveApplied: this.isPassiveApplied,
            cooldownTime: isNpc ? cooldownTimeAI + AI_COOLDOWN_DELAY : cooldownTimePlayer
        };
    }
}
