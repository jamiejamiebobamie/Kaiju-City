import { TILE_DIRS, TILE_DIR_NORM_VECS } from 'Utils/gameState';

/*
  A body thrown when a person dies: pushed by how they were moving and by the power that hit them.
  The torso flies, hops and slides. The head, arms and legs hang from their joints and swing:
  gravity pulls them down the screen while the body is in the air, and every jolt (the throw, a landing, the slide)
  throws them about, until they settle where they lie.
  It runs on game time, so slow motion slows it, and the camera can follow it.
  Distances are in rows, so it looks the same at every level's scale.
*/
export const RAGDOLL = {
  moveWeight: 1, // how much the way they were running pushes them
  powerWeight: 1.6, // how much the power that hit them pushes them
  speedRows: 2, // rows per second at full push: heavy bodies that slide, not fly (was 5)
  hopRows: 0.35, // how high the first hop goes (was 1.4)
  gravityRows: 14, // rows per second per second
  bounce: 0.15, // how much of the fall comes back up on landing (was 0.35)
  minBounceRows: 1, // a slower landing doesn't bounce
  slideFriction: 0.06, // what is left of the slide's speed after a second on the ground
  spinDegrees: 220, // degrees per second, at full push (was 540)
  restSpeedRows: 0.15,
  wallBounce: 0.6, // at the edge of the play area, it bounces back in, so it stays in the shot
  // the limbs
  maxJoltRows: 60, // the biggest jolt a limb feels, in rows per second per second
  airDamping: 1.2, // how fast a swing dies down, per second, in the air
  groundDamping: 7, // and on the ground
  limitBounce: 0.35, // a limb at the end of its joint's reach swings back with this much of its speed
  restSwingDegrees: 8 // a limb swinging slower than this, in degrees per second, is still
};

// each part hangs from its joint on the torso. 'reach' is how far it can turn from hanging straight, either way.
// 'lengthRows' sets how slowly it swings: longer swings slower.
export const LIMBS = [
  { id: 'head', reach: 50, lengthRows: 0.25 },
  { id: 'armLeft', reach: 90, lengthRows: 0.5 }, // no more than a quarter turn, so a body never looks broken
  { id: 'armRight', reach: 90, lengthRows: 0.5 },
  { id: 'legLeft', reach: 90, lengthRows: 0.6 },
  { id: 'legRight', reach: 90, lengthRows: 0.6 }
] as const;

export type Vec = { x: number; y: number };

export type Limb = {
  angle: number; // from the torso, in degrees. 0 is as they stand: the head up, the rest hanging down.
  swing: number; // degrees per second, as seen on screen
};

export type Bounds = { left: number; top: number; right: number; bottom: number };

export type Ragdoll = {
  x: number;
  y: number;
  height: number; // above the ground, in scene pixels
  vx: number;
  vy: number;
  vHeight: number;
  angle: number; // the torso's turn, in degrees. 0 is standing.
  spin: number;
  limbs: Array<Limb>;
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
    angle: 0,
    spin: (throwVec.x < 0 ? -1 : 1) * RAGDOLL.spinDegrees * Math.max(push, 0.5),
    // the throw catches every limb at once: they all start swinging back against it
    limbs: LIMBS.map(() => ({ angle: 0, swing: 0 })),
    isResting: false
  };
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// standing, the middle of the torso is this far above and right of the feet, at a 'pieceScale' of 1: as the living sprite draws it.
// lying down, it is on the ground. the camera and the drawing both use this, so the shot is on the body itself.
const TORSO_STANDING = { x: 9.5, y: -25.4 };
export const getTorsoSpot = ({ x, y, height, angle }: Ragdoll, pieceScale: number): Vec => {
  const upright = Math.abs(Math.cos(toRadians(angle)));
  return { x: x + TORSO_STANDING.x * pieceScale, y: y - height + TORSO_STANDING.y * pieceScale * upright };
};

/*
  One part swinging from its joint, like a pendulum. 'pull' is what it feels on screen: gravity, less the torso's own jolt.
  A part's angle is turned like css: positive is clockwise. Hanging straight, it points down the screen (up, for the head).
*/
const swingLimb = (limb: Limb, { reach, lengthRows }: typeof LIMBS[number], isHead: boolean, torsoAngle: number, torsoSpin: number, pull: Vec, damping: number, seconds: number, rowPx: number): Limb => {
  const screenAngle = toRadians(torsoAngle + limb.angle + (isHead ? 180 : 0));
  // which way along its swing a pull turns it: the part points along (-sin, cos)
  const along = -pull.x * Math.cos(screenAngle) - pull.y * Math.sin(screenAngle);
  const length = lengthRows * rowPx * (2 / 3); // a rod swings like a pendulum two thirds its length
  let swing = limb.swing + (along / length) * (180 / Math.PI) * seconds;
  swing *= Math.exp(-damping * seconds);
  // the torso turning carries the joint round with it: on screen, the part lags behind
  let angle = limb.angle + (swing - torsoSpin) * seconds;
  if (Math.abs(angle) > reach) {
    angle = Math.sign(angle) * reach;
    swing = torsoSpin - (swing - torsoSpin) * RAGDOLL.limitBounce;
  }
  return { angle, swing };
};

// 'bounds': the play area, in scene pixels. a body that would leave it bounces back in.
export const stepRagdoll = (body: Ragdoll, seconds: number, rowPx: number, bounds?: Bounds): Ragdoll => {
  const isLimbsStill = body.limbs.every(({ swing }) => Math.abs(swing - body.spin) < RAGDOLL.restSwingDegrees);
  if (body.isResting && isLimbsStill) return body;
  let { x, y, height, vx, vy, vHeight, angle, spin } = body;
  const lastScreenVel = { x: vx, y: vy - vHeight };
  if (!body.isResting) {
    x += vx * seconds;
    y += vy * seconds;
    angle += spin * seconds;
    if (bounds) {
      if ((x < bounds.left && vx < 0) || (x > bounds.right && vx > 0)) vx = -vx * RAGDOLL.wallBounce;
      if ((y < bounds.top && vy < 0) || (y > bounds.bottom && vy > 0)) vy = -vy * RAGDOLL.wallBounce;
    }
    const isSliding = height == 0 && vHeight == 0; // down for good: it stays on the ground
    if (!isSliding) {
      vHeight -= RAGDOLL.gravityRows * rowPx * seconds;
      height += vHeight * seconds;
    }
    if (height <= 0) {
      height = 0;
      // a rebound smaller than one tick of gravity would only land again: it would hop for ever, and never slide
      const isBouncing = -vHeight > RAGDOLL.minBounceRows * rowPx && -vHeight * RAGDOLL.bounce > RAGDOLL.gravityRows * rowPx * seconds;
      vHeight = isBouncing ? -vHeight * RAGDOLL.bounce : 0;
      spin *= 0.5;
      if (!isBouncing) {
        const friction = Math.pow(RAGDOLL.slideFriction, seconds);
        vx *= friction;
        vy *= friction;
      }
    }
  }
  const isOnGround = height <= 0 && vHeight == 0;
  const isResting = body.isResting || (isOnGround && Math.hypot(vx, vy) < RAGDOLL.restSpeedRows * rowPx);
  if (isResting) spin = 0;
  // they come to rest lying on one side or the other
  if (isResting && !body.isResting) angle = Math.round((angle - 90) / 180) * 180 + 90;

  // the jolt the torso has just had, and gravity while it is in the air: lying on the ground, the limbs only feel the slide
  const maxJolt = RAGDOLL.maxJoltRows * rowPx;
  const clampJolt = (value: number) => Math.max(Math.min(value, maxJolt), -maxJolt);
  const jolt = { x: clampJolt((vx - lastScreenVel.x) / seconds), y: clampJolt(((vy - vHeight) - lastScreenVel.y) / seconds) };
  const gravity = isOnGround ? 0 : RAGDOLL.gravityRows * rowPx;
  const pull = { x: -jolt.x, y: gravity - jolt.y };
  const damping = isOnGround ? RAGDOLL.groundDamping : RAGDOLL.airDamping;
  const limbs = body.limbs.map((limb, k) => swingLimb(limb, LIMBS[k], LIMBS[k].id == 'head', angle, spin, pull, damping, seconds, rowPx));
  return { x, y, height, vx, vy, vHeight, angle, spin, limbs, isResting };
};
