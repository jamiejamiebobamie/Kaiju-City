import manifest from '../assetManifest.json';

/*
  The two loads (Jamie, playtest 29): the landing's own (the landing, the zoom into the room, the pre-game screens)
  before the landing shows, behind the splash; the rest (the game's levels, sprite sheets, story pictures) as the
  monitor boots, behind the game's logo. Each image is fetched once and kept warm in the browser's cache.
*/
export type AssetSet = 'landing' | 'game';
const loaded: Record<AssetSet, boolean> = { landing: false, game: false };
const pending: Partial<Record<AssetSet, Promise<void>>> = {};

// the sprite sheets, decoded and kept so (Jamie, mobile playtest 1: the Street's avatars blurry at first on an iPhone,
// which decodes a picture the first time it's shown). Only these: the level pictures are too big to keep decoded on a phone
const keptSheets: Array<HTMLImageElement> = [];
const loadImage = (url: string) => new Promise<void>(resolve => {
  const image = new Image();
  const isSheet = url.startsWith('/spritesheet/') && !url.includes('/_ORIGINALS/');
  image.onload = () => {
    if (!isSheet || !image.decode) return resolve();
    keptSheets.push(image);
    image.decode().then(() => resolve(), () => resolve());
  };
  image.onerror = () => resolve(); // (a missing image mustn't hold the game up)
  image.src = url;
});
// a sound: fetched whole, into the browser's cache
const loadSound = (url: string) => fetch(url).then(response => response.blob()).then(() => undefined, () => undefined);
const loadFile = (url: string) => (/\.(mp3|wav|ogg|m4a)$/i.test(url) ? loadSound(url) : loadImage(url));

// the fonts (index.css, Font Awesome): with the landing's load, so no word shows in a stand-in font first (Jamie,
// 2026-11-18, as QuickCast's loader does)
const FONTS = ["1em gameboy", "1em bangers", "1em green_fuz", "1em FontAwesome"];
const loadFonts = () => Promise.all(FONTS.map(font => document.fonts.load(font).catch(() => undefined))).then(() => undefined);

// 'onProgress': 0 to 1 as they come in
export const loadAssets = (set: AssetSet, onProgress: (share: number) => void = () => {}): Promise<void> => {
  if (loaded[set]) {
    onProgress(1);
    return Promise.resolve();
  }
  if (!pending[set]) {
    const urls: Array<string> = (manifest as any)[set] || [];
    let done = 0;
    const listeners = new Set<(share: number) => void>();
    (pending as any)[set + 'Listeners'] = listeners;
    const files = urls.map(url => loadFile(url).then(() => {
      done += 1;
      listeners.forEach(listener => listener(done / Math.max(urls.length, 1)));
    }));
    pending[set] = Promise.all(set == 'landing' && typeof document != 'undefined' && document.fonts ? [...files, loadFonts()] : files).then(() => {
      loaded[set] = true;
    });
  }
  (pending as any)[set + 'Listeners'].add(onProgress);
  return pending[set] as Promise<void>;
};

export const getIsLoaded = (set: AssetSet) => loaded[set];
