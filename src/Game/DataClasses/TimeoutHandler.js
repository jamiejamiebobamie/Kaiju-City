/*
    Timers that run on game time ('accTime'), not on the wall clock.
    They stop while the game is paused, and stay in step with the game loop.
*/
export class TimeoutHandler {
    constructor() {
        this.timeouts = {};
        this.nextRef = 1;
        this.accTime = 0;
    }

    reset() {
        this.timeouts = {};
        this.accTime = 0;
    }

    registerTimeout = (callback, delay) => {
        const timeoutRef = this.nextRef++;
        this.timeouts[timeoutRef] = { callback, dueAccTime: this.accTime + delay };
        return timeoutRef;
    }

    unregisterTimeout = (timeoutRef) => {
        delete this.timeouts[timeoutRef];
    }

    update(accTime) {
        this.accTime = accTime;
        Object.entries(this.timeouts).forEach(([timeoutRef, { callback, dueAccTime }]) => {
            if (accTime >= dueAccTime) {
                delete this.timeouts[timeoutRef];
                callback();
            }
        });
    }
}
