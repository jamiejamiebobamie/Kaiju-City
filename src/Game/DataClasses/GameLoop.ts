type LoopStep = { everyMs: number; run: () => void };

type LoopProps = {
  steps: Array<LoopStep>;
  maxCatchUpMs: number;
  onAdvanced?: () => void; // called once per frame, after any steps have run
};

/*
    Fixed-timestep game loop: runs each step on its own fixed interval of game time,
    however fast or slow the device or its display is.
*/
export class GameLoop {
  private steps: Array<LoopStep & { pendingMs: number }>;
  private maxCatchUpMs: number;
  private onAdvanced?: () => void;
  private frameRef: number | undefined = undefined;
  private lastFrameMs: number | undefined = undefined;

  constructor({ steps, maxCatchUpMs, onAdvanced }: LoopProps) {
    this.steps = steps.map(step => ({ ...step, pendingMs: 0 }));
    this.maxCatchUpMs = maxCatchUpMs;
    this.onAdvanced = onAdvanced;
  }

  // clamped so a stalled or hidden tab pauses the game, rather than fast-forwarding it on return
  advance(elapsedMs: number) {
    const clampedMs = Math.min(elapsedMs, this.maxCatchUpMs);
    let hasRun = false;
    this.steps.forEach(step => {
      step.pendingMs += clampedMs;
      while (step.pendingMs >= step.everyMs) {
        step.pendingMs -= step.everyMs;
        step.run();
        hasRun = true;
      }
    });
    if (hasRun && this.onAdvanced) this.onAdvanced();
  }

  start() {
    if (this.frameRef !== undefined) return;
    this.lastFrameMs = undefined;
    const frame = (nowMs: number) => {
      if (this.lastFrameMs !== undefined) this.advance(nowMs - this.lastFrameMs);
      this.lastFrameMs = nowMs;
      this.frameRef = requestAnimationFrame(frame);
    };
    this.frameRef = requestAnimationFrame(frame);
  }

  stop() {
    if (this.frameRef !== undefined) cancelAnimationFrame(this.frameRef);
    this.frameRef = undefined;
  }
}
