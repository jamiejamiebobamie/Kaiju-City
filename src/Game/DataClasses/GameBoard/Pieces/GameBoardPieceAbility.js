
// the extra wait before an NPC can use an ability again, in milliseconds
// the passives Clean Slate leaves be: the ones that cost (Lichdom's health, Inclement Weather's speed)
export const CLEAN_SLATE_KEEPS = ['death', 'ice'];
const AI_COOLDOWN_DELAY = 750;

export class GameBoardPieceAbility {
    constructor({
        accTime = 0,
        isPassiveApplied = false,
        gameBoardPieceAbilityData = undefined // GameBoardTileStatusAndAbilityData
    }) {
        this.accTime = accTime;
        this.isPassiveApplied = isPassiveApplied;
        this.gameBoardPieceAbilityData = gameBoardPieceAbilityData;
        this.passiveIds = new Set(); // each passive that is on and still to be toggled off
        this.passiveCount = 0;
        this.stacks = 0;
        this.lockedUntil = 0; // another power can hold this one on cooldown until then
        this.lastCastAt = undefined;
    }

    useAbility({
        accTime,
        piece,
        registerTimeout,
        updateTileWithAbilityStatus
    }) {
        this.accTime = accTime;
        this.lastCastAt = accTime;
        const { buffedCastBonus, isPassiveRefreshed, castStack, isCleanSlate } = this.gameBoardPieceAbilityData;
        // cast again while the passive is on, a stacking power builds up, to a cap
        this.stacks = castStack && this.isPassiveApplied ? Math.min((this.stacks || 0) + 1, castStack.maxStacks) : 0;
        // activate active ability. cast while its own passive is on, some powers come out stronger.
        updateTileWithAbilityStatus({
            pieceIndex: piece.pieceIndex,
            appliedStatus: this.gameBoardPieceAbilityData.appliedStatus,
            accTime,
            isBuffed: !!buffedCastBonus && this.isPassiveApplied,
            stackRange: castStack ? this.stacks * castStack.rangePerStack : 0
        });
        // Bubble's Clean Slate: a Dispel ends the caster's other powers' passives
        if (isCleanSlate) {
            // only the buffs: Haunt's Lichdom and Ice Slice's Inclement Weather (the costs) stay (Jamie)
            const others = piece.abilities.filter(other => other !== this && !CLEAN_SLATE_KEEPS.includes(other.gameBoardPieceAbilityData.element));
            // "Clean Slate!" over them when it wipes something (GameBoardPieceComponent)
            if (others.some(other => other.isPassiveApplied)) piece.cleanSlateCount = (piece.cleanSlateCount || 0) + 1;
            others.forEach(other => other.endAllPassives(piece));
        }

        const triggerPassive = () => {
            // a refreshed passive takes over the one that is on, and starts its time again, instead of stacking
            const isRefresh = isPassiveRefreshed && this.passiveIds.size > 0;
            if (isRefresh) this.passiveIds.clear();
            // stacking to a cap (Lightning's Charged Step): at the cap, the oldest ends as the new one starts
            const { maxPassiveStacks } = this.gameBoardPieceAbilityData;
            if (!isRefresh && maxPassiveStacks && this.passiveIds.size >= maxPassiveStacks) this.endPassive(piece, Math.min(...this.passiveIds));
            else this.gameBoardPieceAbilityData.togglePassive(piece);
            this.isPassiveApplied = true;
            this.passiveCount += 1;
            const passiveId = this.passiveCount;
            this.passiveIds.add(passiveId);
            const delay = this.gameBoardPieceAbilityData.passiveDurationTime ? this.gameBoardPieceAbilityData.passiveDurationTime : this.gameBoardPieceAbilityData.cooldownTimeAI;
            registerTimeout(() => this.endPassive(piece, passiveId), delay);
        }
        if (this.gameBoardPieceAbilityData.isTriggerPassiveImmediately) {
            triggerPassive();
        } else {
            return triggerPassive;
        }
    }

    // toggles one passive off, unless it was already ended or taken over
    endPassive(piece, passiveId) {
        if (!this.passiveIds.delete(passiveId)) return;
        const toggleOff = true;
        this.gameBoardPieceAbilityData.togglePassive(piece, toggleOff);
        if (!this.passiveIds.size) {
            this.isPassiveApplied = false;
            this.stacks = 0;
        }
    }

    // every passive of this power ends now
    endAllPassives(piece) {
        [...this.passiveIds].forEach(passiveId => this.endPassive(piece, passiveId));
    }

    // the passive was used up (eg. 'Healthy' extra lives taking dmg). it no longer needs toggling-off.
    clearPassiveTimeout() {
        this.passiveIds.clear();
        this.isPassiveApplied = false;
    }

    getIsOnCooldown(accTime, isNpc) {
        if (accTime < this.lockedUntil) return true;
        if (!this.accTime) return false; // never used
        const { cooldownTimeAI, cooldownTimePlayer } = this.gameBoardPieceAbilityData;
        const cooldown = isNpc ? cooldownTimeAI + AI_COOLDOWN_DELAY : cooldownTimePlayer;
        return (accTime - this.accTime) < cooldown * (this.cooldownScale || 1); // 'cooldownScale': a rival's own (levels.ts)
    }

    getType() {
        return this.gameBoardPieceAbilityData.type;
    }

    getDesiredAIRange() {
        return this.gameBoardPieceAbilityData.desiredAIRange;
    }

    // 'now': the game's time. the HUD shows the cooldown by it, not by the wall clock, so pauses, wide shots and slow motion can't put them out of step
    getUiState(isNpc, now = 0) {
        const { element, color, activeName, passiveName, cooldownTimeAI, cooldownTimePlayer } = this.gameBoardPieceAbilityData;
        return {
            isOnCooldown: this.getIsOnCooldown(now, isNpc),
            element,
            color,
            activeName,
            passiveName,
            accTime: this.accTime,
            isPassiveApplied: this.isPassiveApplied,
            cooldownTime: (isNpc ? cooldownTimeAI + AI_COOLDOWN_DELAY : cooldownTimePlayer) * (this.cooldownScale || 1)
        };
    }
}
