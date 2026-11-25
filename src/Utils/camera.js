/*
  The viewer's camera in the apartment (Jamie, 2026-11-25): the whole scene (the room, the monitor and everything on
  and beside it) moves together, as if the one at the desk looked around.
  - Edge look (Jamie: it follows the mouse, wanting to be back in its place): the view's place follows where the
    mouse is in the edge bands: at a band's inner edge, its usual place; at the window's edge, as far as the apartment
    picture goes that way; between, between (eased). Anywhere else, its usual place. It glides there: slow to start,
    building, and slowing as it arrives, no overshoot (Jamie: the rubber band wasn't right). Left and right, the band
    reaches in to the monitor's casing as it stands unpanned (a bigger trigger area, never over the monitor).
  - Shaky cam (a dev panel setting, F2; on by default): gentle bobbing and drifting, as a person sitting there.
  RoomBackdrop steps it every frame (it knows how far the room picture reaches) and moves its game area by it.
*/
const SHAKY_KEY = "kaiju.shakyCam";

export const CAMERA_TUNING = {
  // the edge bands: shares of the window's width (left, right: at least; out to the casing less 'casingGapPx') and
  // height (top, bottom)
  edge: { across: 0.06, down: 0.08, minPx: 28, casingGapPx: 10 },
  glide: 3, // how quickly it follows (per second: higher is snappier); critically damped, so never past its place
  maxSpeed: 0.9, // window heights per second
  shake: { amplitude: 0.0055 } // window heights
};

const readShaky = () => {
  try {
    const saved = localStorage.getItem(SHAKY_KEY);
    return saved === null ? true : saved == "1";
  } catch {
    return true;
  }
};

export const CAMERA = {
  x: 0, // the scene's offset now (px), pan and shake together
  y: 0,
  isShaky: readShaky()
};
export const setIsShakyCam = isShaky => {
  CAMERA.isShaky = isShaky;
  try {
    localStorage.setItem(SHAKY_KEY, isShaky ? "1" : "0");
  } catch {
    // (no storage: for this visit only)
  }
};

// per axis: where it's panned (px), how fast (px/s), and where it's going (a share of the way to a limit, -1 to 1)
const axes = { x: { at: 0, speed: 0, aim: 0 }, y: { at: 0, speed: 0, aim: 0 } };
const mouse = { x: undefined, y: undefined, isIn: false };
let isListening = false;
const isOverControl = target => !!(target && target.closest && target.closest("button, select, input, textarea, a, label, [role=button]"));

const listen = () => {
  if (isListening || typeof window == "undefined") return;
  isListening = true;
  window.addEventListener("mousemove", event => {
    // (over a control, such as the dev panel, or a button held: it stays where it's going)
    mouse.isIn = !isOverControl(event.target) && event.buttons == 0;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }, { passive: true });
  // (out of the window, often just past its edge: likewise)
  document.documentElement.addEventListener("mouseleave", () => (mouse.isIn = false));
  window.addEventListener("blur", () => (mouse.isIn = false));
};

// where the mouse asks the view to be on an axis: a share of the way to the limit (1: toward the low edge, which
// moves the scene right or down, showing what's left or above; -1: the high edge); 'near', 'far': where the low and
// high bands end (px from the window's left or top)
const smooth = t => t * t * (3 - 2 * t);
const getAim = (position, near, far, size, was) => {
  if (!mouse.isIn || position === undefined) return was;
  if (position < near) return smooth(Math.min(1, (near - position) / Math.max(1, near)));
  if (position > far) return -smooth(Math.min(1, (position - far) / Math.max(1, size - far)));
  return 0;
};
const getBands = (size, share, casing) => {
  const { minPx, casingGapPx } = CAMERA_TUNING.edge;
  const band = Math.max(minPx, size * share);
  if (!casing) return [band, size - band];
  // (out to the casing's sides, where there's room for more than the least band)
  return [Math.max(band, casing.left - casingGapPx), Math.min(size - band, casing.right + casingGapPx)];
};

const stepAxis = (axis, aim, limits, dt, unit) => {
  axis.aim = aim;
  const [low, high] = limits;
  const target = aim > 0 ? aim * high : -aim * low;
  // a critically damped spring to its place: from still it builds, then slows as it arrives, never past it
  const { glide, maxSpeed } = CAMERA_TUNING;
  axis.speed += (glide * glide * (target - axis.at) - 2 * glide * axis.speed) * dt;
  axis.speed = Math.max(-maxSpeed * unit, Math.min(maxSpeed * unit, axis.speed));
  axis.at += axis.speed * dt;
  if (axis.at > high) [axis.at, axis.speed] = [high, Math.min(0, axis.speed)];
  if (axis.at < low) [axis.at, axis.speed] = [low, Math.max(0, axis.speed)];
};

// the shaky cam: a few slow waves on each axis, added up (a breath, a sway, a small fidget)
const getShake = now => {
  if (!CAMERA.isShaky) return { x: 0, y: 0 };
  const t = now / 1000;
  const a = CAMERA_TUNING.shake.amplitude * window.innerHeight;
  const wave = (period, phase) => Math.sin((t * 2 * Math.PI) / period + phase);
  return {
    x: a * (0.6 * wave(4.7, 0) + 0.3 * wave(2.3, 1.3) + 0.1 * wave(0.97, 2.1)),
    y: a * 0.8 * (0.55 * wave(3.3, 0.6) + 0.35 * wave(1.9, 2.4) + 0.1 * wave(0.83, 4))
  };
};

let lastNow;
// a frame: 'limits' how far each way the scene can move and still be all room picture ({ x: [low, high], y: [...] },
// px; the scene's offset); 'isHeld' keeps it in its usual place (the zoom's hand-off); 'casing' the monitor casing's
// left and right, unpanned (px), for the side bands. Returns the offset.
export const stepCamera = (now, limits, isHeld = false, casing = undefined) => {
  listen();
  const dt = lastNow === undefined ? 0 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  if (dt > 0) {
    const unit = window.innerHeight;
    const { innerWidth: width, innerHeight: height } = window;
    stepAxis(axes.x, isHeld ? 0 : getAim(mouse.x, ...getBands(width, CAMERA_TUNING.edge.across, casing), width, axes.x.aim), limits.x, dt, unit);
    stepAxis(axes.y, isHeld ? 0 : getAim(mouse.y, ...getBands(height, CAMERA_TUNING.edge.down), height, axes.y.aim), limits.y, dt, unit);
  }
  const shake = getShake(now);
  CAMERA.x = axes.x.at + shake.x;
  CAMERA.y = axes.y.at + shake.y;
  return CAMERA;
};

// back to the middle, at once (a new arrival in the apartment: the landing's zoom hands off to the still view)
export const resetCamera = () => {
  Object.values(axes).forEach(axis => Object.assign(axis, { at: 0, speed: 0, aim: 0 }));
};

/*
  The look inside the monitor (Jamie, playtest 40: the Lab, walking and at its computer's desk): as the apartment's,
  but inside the main monitor's screen. The mouse in a band along the inside of the screen's edge looks that way (a
  share of the way, -1 left or up to 1 right or down, eased in from the band's inner edge), gliding there and back;
  out of the bands, or off the screen, it settles back to the middle. With the shaky cam on, a gentle bob too, in the
  screen's px. Each scene keeps its own ('key'). 'rect': the screen's box on the page.
*/
export const SCREEN_LOOK = {
  band: 0.16, // of the screen's width and height, in from each edge
  glide: 3, // as CAMERA_TUNING.glide
  shake: 0.006 // of the screen's height
};
const screenLooks = new Map();
export const stepScreenLook = (key, now, rect) => {
  listen();
  const look = screenLooks.get(key) || { x: { at: 0, speed: 0 }, y: { at: 0, speed: 0 }, lastNow: now };
  screenLooks.set(key, look);
  const dt = Math.min(0.05, Math.max(0, (now - look.lastNow) / 1000));
  look.lastNow = now;
  const getAimIn = (position, start, size) => {
    if (!rect || !mouse.isIn || position === undefined || position < start || position > start + size) return 0;
    const band = Math.max(1, size * SCREEN_LOOK.band);
    if (position < start + band) return -smooth(Math.min(1, (start + band - position) / band));
    if (position > start + size - band) return smooth(Math.min(1, (position - (start + size - band)) / band));
    return 0;
  };
  const isOnScreen = !!rect && mouse.y !== undefined && mouse.x !== undefined && mouse.y >= rect.top && mouse.y <= rect.bottom && mouse.x >= rect.left && mouse.x <= rect.right;
  const aims = {
    x: isOnScreen ? getAimIn(mouse.x, rect.left, rect.width) : 0,
    y: isOnScreen ? getAimIn(mouse.y, rect.top, rect.height) : 0
  };
  const { glide } = SCREEN_LOOK;
  ["x", "y"].forEach(name => {
    const axis = look[name];
    axis.speed += (glide * glide * (aims[name] - axis.at) - 2 * glide * axis.speed) * dt;
    axis.at = Math.max(-1, Math.min(1, axis.at + axis.speed * dt));
  });
  // the bob: the room's shake, in this screen's px
  let shake = { x: 0, y: 0 };
  if (CAMERA.isShaky && rect) {
    const t = now / 1000;
    const a = SCREEN_LOOK.shake * rect.height;
    const wave = (period, phase) => Math.sin((t * 2 * Math.PI) / period + phase);
    shake = {
      x: a * (0.6 * wave(4.1, 0.4) + 0.3 * wave(2.1, 2) + 0.1 * wave(0.9, 1)),
      y: a * 0.8 * (0.55 * wave(3.6, 1.1) + 0.35 * wave(1.7, 0.2) + 0.1 * wave(0.77, 3))
    };
  }
  return { x: look.x.at, y: look.y.at, shake };
};
