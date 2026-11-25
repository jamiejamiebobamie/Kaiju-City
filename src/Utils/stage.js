/*
  The stage (Jamie, 2026-11-25; layout phase 1, option 1B): the whole app is sized from one box, the safe area: the
  biggest 16:9 box that fits the browser window, in its middle. Everything to read and press is inside it and sized
  from it (the game frame is it; the landing's logo is scaled from it); the art (the room, the landing's Peninsula, the
  zoom's pictures) is locked to it too but runs on past it to the window's edges, with a soft dark fade where a picture
  ends. Breakpoints (phase 4) will change what's placed where for other window sizes.
  The reference window: Jamie's, 1528 x 732 CSS px (a 1920 x 1080 display at 125%). Every size moved onto the safe area
  was chosen so it comes out as before there: on a window that wide, the safe area is the window's full height.
  For css: --safe-x, --safe-y (its top left in the window), --safe-w, --safe-h (its size), all px, on the page's root.
*/
export const STAGE = { aspect: 16 / 9, reference: { width: 1528, height: 732 } };

export const getSafeArea = (window_ = typeof window != "undefined" ? window : { innerWidth: STAGE.reference.width, innerHeight: STAGE.reference.height }) => {
  const width = Math.min(window_.innerWidth, window_.innerHeight * STAGE.aspect);
  const height = width / STAGE.aspect;
  return { x: (window_.innerWidth - width) / 2, y: (window_.innerHeight - height) / 2, width, height };
};

const setSafeAreaVars = () => {
  const { x, y, width, height } = getSafeArea();
  const root = document.documentElement.style;
  root.setProperty("--safe-x", `${x}px`);
  root.setProperty("--safe-y", `${y}px`);
  root.setProperty("--safe-w", `${width}px`);
  root.setProperty("--safe-h", `${height}px`);
};

// set once at the start, and on every resize (call once, from the app's root)
let isWatching = false;
export const watchSafeArea = () => {
  if (isWatching || typeof window == "undefined") return;
  isWatching = true;
  setSafeAreaVars();
  window.addEventListener("resize", setSafeAreaVars);
};

// a css length: this many of the safe area's width or height (as cqw or cqh would be, of the safe area)
export const safeW = share => `calc(var(--safe-w) * ${share})`;
export const safeH = share => `calc(var(--safe-h) * ${share})`;

/*
  A picture's soft dark edge (1B): where a picture locked to the stage ends inside the window, it fades to the dark
  ground instead of stopping hard. 'fade': how much of the picture's width and height each edge fades over.
*/
export const getEdgeFade = (fade = 0.03) => {
  const x = `linear-gradient(to right, transparent, black ${fade * 100}%, black ${100 - fade * 100}%, transparent)`;
  const y = `linear-gradient(to bottom, transparent, black ${fade * 100}%, black ${100 - fade * 100}%, transparent)`;
  return { WebkitMaskImage: `${x}, ${y}`, WebkitMaskComposite: "source-in", maskImage: `${x}, ${y}`, maskComposite: "intersect" };
};
