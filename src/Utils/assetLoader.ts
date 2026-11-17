import manifest from '../assetManifest.json';

/*
  The two loads (Jamie, playtest 29): the landing's own (the landing, the zoom into the room, the pre-game screens)
  before the landing shows, behind the splash; the rest (the game's levels, sprite sheets, story pictures) as the
  monitor boots, behind the game's logo. Each image is fetched once and kept warm in the browser's cache.
*/
export type AssetSet = 'landing' | 'game';
const loaded: Record<AssetSet, boolean> = { landing: false, game: false };
const pending: Partial<Record<AssetSet, Promise<void>>> = {};

const loadImage = (url: string) => new Promise<void>(resolve => {
  const image = new Image();
  image.onload = () => resolve();
  image.onerror = () => resolve(); // (a missing image mustn't hold the game up)
  image.src = url;
});

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
    pending[set] = Promise.all(urls.map(url => loadImage(url).then(() => {
      done += 1;
      listeners.forEach(listener => listener(done / Math.max(urls.length, 1)));
    }))).then(() => {
      loaded[set] = true;
    });
  }
  (pending as any)[set + 'Listeners'].add(onProgress);
  return pending[set] as Promise<void>;
};

export const getIsLoaded = (set: AssetSet) => loaded[set];
