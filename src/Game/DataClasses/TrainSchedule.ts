import { getRandomIntInRange } from 'Game/utils';

/*
  How the subway's trains run. Each time is a range in milliseconds of game time: a value is picked at random.
  idle -> warning (signal lights flash) -> train -> clearing (lights still flash) -> idle
*/
export const TRAIN_SCHEDULE = {
  idleMs: { min: 20000, max: 40000 },
  warningMs: { min: 5000, max: 10000 },
  trainMs: { min: 8000, max: 14000 },
  clearingMs: { min: 5000, max: 10000 }
};

// what a train does to a piece on the tracks. 'mode' is 'shove' (dmg, then pushed to the platform) or 'kill'.
export const TRAIN_HIT = {
  mode: 'shove',
  dmg: 2
};

const NEXT_STAGE = { idle: 'warning', warning: 'train', train: 'clearing', clearing: 'idle' };

type TrainScheduleProps = {
  onStageChange: (stage: string, accTime: number) => void;
};

export class TrainSchedule {
  stage = 'idle';
  private stageEndsAt: number;
  private onStageChange: TrainScheduleProps['onStageChange'];

  constructor({ onStageChange }: TrainScheduleProps) {
    this.onStageChange = onStageChange;
    this.stageEndsAt = this.getStageLength('idle');
  }

  private getStageLength(stage: string) {
    return getRandomIntInRange(TRAIN_SCHEDULE[`${stage}Ms`]);
  }

  setStage(stage: string, accTime: number) {
    this.stage = stage;
    this.stageEndsAt = accTime + this.getStageLength(stage);
    this.onStageChange(stage, accTime);
  }

  update(accTime: number) {
    if (accTime >= this.stageEndsAt) this.setStage(NEXT_STAGE[this.stage], accTime);
  }

  // dev testing: sends the train in, or away, right now
  setIsTrainIn(isTrainIn: boolean, accTime: number) {
    this.setStage(isTrainIn ? 'train' : 'clearing', accTime);
  }
}
