import { TILE_DIRS, TILE_DIR_NORM_VECS } from 'Utils/gameState';

/*
  A body thrown when a person dies: pushed by how they were moving and by the power that hit them.
  It runs on game time, so slow motion slows it, and the camera can follow it.
  Distances are in rows, so it looks the same at every level's scale.
*/
export const RAGDOLL = {
  moveWeight: 1, // how much the way they were running pushes them
  powerWeight: 1.6, // how much the power that hit them pushes them
  speedRows: 5, // rows per second at full push
  hopRows: 1.4, // how high the first hop goes
  gravityRows: 14, // rows per second per second
  bounce: 0.35, // how much of the fall comes back up on landing
  minBounceRows: 1, // a slower landing doesn't bounce
  slideFriction: 0.06, // what is left of the slide's speed after a second on the ground
  spinDegrees: 540, // degrees per second, at full push
  restSpeedRows: 0.15
};

export type Vec = { x: number; y: number };

export type Ragdoll = {
  x: number;
  y: number;
  height: number; // above the ground, in scene pixels
  vx: number;
  vy: number;
  vHeight: number;
  angle: number;
  spin: number;
  isResting: boolean;
};

const ANIM_DIR_VECS: Record<string, Vec> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

// eg. 'downRight' or 'up right'. nothing for 'idle'.
export const getDirVec = (dir: string | undefined): Vec => {
  if (!dir || dir == 'idle') return { x: 0, y: 0 };
  const tileDir = dir.replace(/([A-Z])/, ' $1').toLowerCase();
  if (ANIM_DIR_VECS[tileDir]) return ANIM_DIR_VECS[tileDir];
  const index = TILE_DIRS.indexOf(tileDir);
  return index == -1 ? { x: 0, y: 0 } : TILE_DIR_NORM_VECS[index];
};

// the way a status was travelling, from its tile's directions
export const getStatusVec = (dirs: Array<string> = []): Vec => {
  const sum = dirs.map(getDirVec).reduce((acc, { x, y }) => ({ x: acc.x + x, y: acc.y + y }), { x: 0, y: 0 });
  const length = Math.hypot(sum.x, sum.y);
  return length ? { x: sum.x / length, y: sum.y / length } : { x: 0, y: 0 };
};

// with nothing pushing them, they still fall back a little
export const getThrowVec = (moveDir: string | undefined, statusDirs: Array<string> | undefined, facingDir: string): Vec => {
  const move = getDirVec(moveDir);
  const power = getStatusVec(statusDirs);
  const x = move.x * RAGDOLL.moveWeight + power.x * RAGDOLL.powerWeight;
  const y = move.y * RAGDOLL.moveWeight + power.y * RAGDOLL.powerWeight;
  if (Math.hypot(x, y) > 0.01) return { x, y };
  const facing = getDirVec(facingDir);
  return { x: -facing.x * 0.5, y: -facing.y * 0.5 || 0.3 };
};

export const startRagdoll = ({ x, y }: Vec, throwVec: Vec, rowPx: number): Ragdoll => {
  const push = Math.min(Math.hypot(throwVec.x, throwVec.y), RAGDOLL.moveWeight + RAGDOLL.powerWeight);
  return {
    x,
    y,
    height: 0,
    vx: throwVec.x * RAGDOLL.speedRows * rowPx,
    vy: throwVec.y * RAGDOLL.speedRows * rowPx,
    vHeight: Math.sqrt(2 * RAGDOLL.gravityRows * RAGDOLL.hopRows) * rowPx,
    angle: 90, // the death art lies head-left: turned a quarter, it stands
    spin: (throwVec.x < 0 ? -1 : 1) * RAGDOLL.spinDegrees * Math.max(push, 0.5),
    isResting: false
  };
};

export const stepRagdoll = (body: Ragdoll, seconds: number, rowPx: number): Ragdoll => {
  if (body.isResting) return body;
  let { x, y, height, vx, vy, vHeight, angle, spin } = body;
  x += vx * seconds;
  y += vy * seconds;
  angle += spin * seconds;
  const isSliding = height == 0 && vHeight == 0; // down for good: it stays on the ground
  if (!isSliding) {
    vHeight -= RAGDOLL.gravityRows * rowPx * seconds;
    height += vHeight * seconds;
  }
  const isOnGround = height <= 0;
  if (isOnGround) {
    height = 0;
    const isBouncing = -vHeight > RAGDOLL.minBounceRows * rowPx;
    vHeight = isBouncing ? -vHeight * RAGDOLL.bounce : 0;
    spin *= 0.5;
    if (!isBouncing) {
      const friction = Math.pow(RAGDOLL.slideFriction, seconds);
      vx *= friction;
      vy *= friction;
    }
  }
  const isResting = isOnGround && vHeight == 0 && Math.hypot(vx, vy) < RAGDOLL.restSpeedRows * rowPx;
  // they come to rest flat: lying as the art has them, one way up or the other
  if (isResting) angle = Math.round(angle / 180) * 180;
  return { x, y, height, vx, vy, vHeight, angle, spin, isResting };
};
