// FLYWEIGHT
export class GameBoardTileStatusAndAbilityData {
    constructor({
        appliedStatus, // string tile status, eg. "isWet", "isOnFire", etc.
        bounceCountResetVal = 0,
        isPersistent = true,
        dmgAmt = 1,
        isBouncy = false,
        bounceLogic = undefined, // TO-DO...
        isLeaveTrail = false,
        isRotating = [/* example: { tickFrom: 3, tickTo: 6 } */],
        isConserveDirections = [/* example: { tickFrom: 3, tickTo: 6 } */],
        isTracking = [/* example: { tickFrom: 3, tickTo: 6 } */],
        turnSteps = undefined, // tracking: how far its way can turn in one step, in sixths of a turn. undefined: straight at the target
        isSpread = [/* example: { tick: 3, dirs: [1-6] } */],
        isReverseDirection = [/* example, tick(s): 3, 4, 5 */],
        isWall = false, // spreads as a straight front that widens, not as separate lines
        branchCount = undefined, // how far the status travels in every direction after its first
        trailTicks = undefined, // how long a persistent status stays on a tile, in tile updates. forever if undefined
        buffedCastBonus = undefined, // { range, trailTicks }: added to a cast made while this power's own passive is on
        isPassiveRefreshed = false, // casting again while the passive is on restarts its time, instead of stacking
        hasForwardWave = false, // a second wave starts a tile ahead of the first, and never turns around
        isCleanSlate = false, // Bubble: a Dispel ends the caster's other passives
        wormholeMs = 0, // Teleport: how long the wormhole it leaves stays open
        castStack = undefined, // { rangePerStack, maxStacks }: each cast while the passive is on goes further, to a cap
        hasSmokeOnBounce = false, // where it hits an edge it turns to smoke and burns out
        color,
        passiveName,
        activeName,
        passiveIcon,
        activeIcon,
        passiveDesc,
        activeDesc,
        passiveEffect1,
        passiveEffect2,
        activeEffect1,
        activeEffect2,
        desiredAIRange,
        range,
        area,
        type,
        displayLookup,
        element,
        cooldownTimeAI,
        cooldownTimePlayer,
        passiveDurationTime,
        isTriggerPassiveImmediately = true,
        modifierVal = 0,
        maxPassiveStacks = undefined,
        fieldToModify = '',
        rotationShift = 'doNotRotate' // method name to apply to tile status icon to handle status icon rotation on tile
    }) {
        this.appliedStatus = appliedStatus;

        this.range = range; // tileCount / totalCount / startCount / count
        this.area = area; // numTiles
        this.dmgAmt = dmgAmt;

        // BOOLEANS
        this.isPersistent = isPersistent;
        this.isBouncy = isBouncy;
        this.isLeaveTrail = isLeaveTrail;
        // - - - -

        this.bounceCountResetVal = bounceCountResetVal;
        this.bounceLogic = bounceLogic;

        // TICK RANGES
        this.isRotating = isRotating;
        this.isConserveDirections = isConserveDirections;
        this.isTracking = isTracking;
        this.turnSteps = turnSteps;
        // - - - -

        // TICK EVENTS
        this.isSpread = isSpread;
        this.isReverseDirection = isReverseDirection;
        // - - - -

        this.isWall = isWall;
        this.branchCount = branchCount;
        this.trailTicks = trailTicks;
        this.buffedCastBonus = buffedCastBonus;
        this.isPassiveRefreshed = isPassiveRefreshed;
        this.hasForwardWave = hasForwardWave;
        this.isCleanSlate = isCleanSlate;
        this.wormholeMs = wormholeMs;
        this.castStack = castStack;
        this.hasSmokeOnBounce = hasSmokeOnBounce;

        // status color
        this.color = color;

        // ability UI data
        this.passiveName = passiveName;
        this.activeName = activeName;
        this.passiveIcon = passiveIcon;
        this.activeIcon = activeIcon;
        this.passiveDesc = passiveDesc;
        this.activeDesc = activeDesc;
        this.passiveEffect1 = passiveEffect1;
        this.passiveEffect2 = passiveEffect2;
        this.activeEffect1 = activeEffect1;
        this.activeEffect2 = activeEffect2;
        this.displayLookup = displayLookup; // example: "abilityGlass"
        this.element = element; // 'glass'
        this.rotationShift = rotationShift; // method name to apply to tile status icon to handle status icon rotation on tile

        // NPC AI
        this.desiredAIRange = desiredAIRange; // ideal number of tiles away from enemy given ability
        this.type = type; // array of ability types: 'offensive', 'defensive', 'escape', 'heal'
        this.cooldownTimeAI = cooldownTimeAI;
        // - - -

        this.cooldownTimePlayer = cooldownTimePlayer;

        // PASSIVE ability
        this.passiveDurationTime = passiveDurationTime;
        this.isTriggerPassiveImmediately = isTriggerPassiveImmediately;
        this.modifierVal = modifierVal;
        this.maxPassiveStacks = maxPassiveStacks;
        this.fieldToModify = fieldToModify;
    }

    getColor() {
        return this.color;
    }

    getRotationShift() {
        return this.rotationShift;
    }

    getActiveIcon() {
        return this.activeIcon;
    }

    getPassiveIcon() {
        return this.passiveIcon;
    }

    getAppliedStatus() {
        return this.appliedStatus;
    }

    updateTotalCount(totalCount) {
        this.totalCount = totalCount;
    }

    updateIsPersistent(isPersistent) {
        this.isPersistent = isPersistent;
    }

    updateIsBouncy(isBouncy) {
        this.isBouncy = isBouncy;
    }

    updateIsLeaveTrail(isLeaveTrail) {
        this.isLeaveTrail = isLeaveTrail;
    }

    updateIsRotating(ticks) {
        this.isRotating = ticks.map(([tickStart, tickEnd]) => ({ tickStart, tickEnd }));
    }

    updateIsConserveDirections(ticks) {
        this.isConserveDirections = ticks.map(([tickStart, tickEnd]) => ({ tickStart, tickEnd }));
    }

    updateIsTracking(ticks) {
        this.isTracking = ticks.map(([tickStart, tickEnd]) => ({ tickStart, tickEnd }));
    }

    updateIsSpread(ticks) {
        this.isSpread = ticks.map(([triggerTick, dirs]) => ({ triggerTick, dirs }));
    }

    updateIsReverseDirection(triggerTicks) {
        this.isReverseDirection = triggerTicks;
    }

    updateDmgAmt(dmgAmt) {
        this.dmgAmt = dmgAmt;
    }

    getColor() {
        return this.color;
    }

    getDmgAmt() {
        return this.dmgAmt;
    }

    getIsPersistent() {
        return this.isPersistent;
    }

    getIsBouncy() {
        return this.isBouncy;
    }

    getIsLeaveTrail() {
        return this.isLeaveTrail;
    }

    getElementUppercase() {
        return this.element[0].toUpperCase() + this.element.slice(1);
    }

    togglePassive(piece, toggleOff) {
        this.modifyStats(piece, toggleOff);
    }

    modifyStats(piece, toggleOff) {
        if (!this.fieldToModify) return;
        const mod = (toggleOff ? -1 : 1) * this.modifierVal;
        const modification = piece[this.fieldToModify] + mod;
        piece[this.fieldToModify] = modification;
    };

    rotateStatus(count) {
        const newDir =
            ["up",
                "up right",
                "down right",
                "down",
                "down left",
                "up left"
            ][count % 6];
        return [newDir];
    }

    reverseDir(currDir) {
        const dirs = [
            "up",
            "up right",
            "down right",
            "down",
            "down left",
            "up left"
        ];

        const i = dirs.indexOf(currDir);

        if (i == -1) return [currDir]; // failure... do not reverse

        const newDir = dirs[(i + 3) % 6];
        return [newDir];
    }

    reflectDir(currDir) {
        const dirs = [
            "up",
            "up right",
            "down right",
            "down",
            "down left",
            "up left"
        ];

        const i = dirs.indexOf(currDir);

        if (i == -1) return [currDir]; // failure... do not reflect

        const ri = i > 2 ? i - 2 : i + 2; // TO-DO: use this.bounceLogic here...
        const rd = dirs[ri];

        return [rd];
    }

    getBounceCount(currCount) {
        return currCount > this.bounceCountResetVal ? this.bounceCountResetVal : currCount - 1;
    }

    isInRange(range, currCount) {
        const currTick = this.getCurrTick(currCount);
        return currTick >= range.tickFrom && currTick <= range.tickTo;
    }

    getCurrTick(currCount) {
        /*
            'currCount,' counts down from maxCount
            'range,' equals the maxCount
            'tick,' counts from 0 up to maxCount, equals: maxCount - currCount
        */
        const tick = this.range - currCount;
        return tick;
    }

    // isRotating: [{ tickFrom: 1, tickTo: 7 }],
    getIsRotating(currCount) {
        return this.isRotating.some(range => this.isInRange(range, currCount))
    }

    // isConserveDirections: [{ tickFrom: 0, tickTo: 20 }],
    getIsConserveDirections(currCount) {
        return this.isConserveDirections.some(range => this.isInRange(range, currCount))
    }

    getIsWall() {
        return this.isWall;
    }

    // undefined if the status travels as far in this direction as in any other
    getBranchCount(dirIndex) {
        return dirIndex > 0 ? this.branchCount : undefined;
    }

    getIsTrailFaded(trailAge) {
        return this.trailTicks !== undefined && trailAge >= this.trailTicks;
    }

    // isTracking: [{ tickFrom: 8, tickTo: 25 }],
    getTurnSteps() {
        return this.turnSteps;
    }

    getIsTracking(currCount) {
        return this.isTracking.some(range => this.isInRange(range, currCount))
    }

    // isSpread: [{ tick: 1, area: 1 }], // example: at TICK 1, reduce directions to 1 tile.
    getIsSpread(currCount) {
        const currTick = this.getCurrTick(currCount);
        return this.isSpread.some(({ tick }) => tick == currTick);
    }

    // isReverseDirection: [0, 5], // example: send backward at tick 0, then reverse at tick 5 (like a building wave...)
    getIsReverseDirection(currCount) {
        const currTick = this.getCurrTick(currCount);
        return this.isReverseDirection.includes(currTick);
    }

    // isSpread: [{ tick: 1, area: 1 }], // example: at TICK 1, reduce directions to 1 tile.
    getSpreadArea(currCount) {
        const currTick = this.getCurrTick(currCount);
        const spread = this.isSpread.find(({ tick }) => tick == currTick)
        return !!spread ? spread.area : 0;
    }

}