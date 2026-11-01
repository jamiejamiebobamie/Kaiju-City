import { proxy } from 'valtio';

/*
    What React's game UI shows. The engine classes stay plain objects outside this store:
    they change on every tick, and only these values need to reach React.
*/
export const gameUiStore = proxy({
  players: [],
  kaijuKillCount: 0,
  kaijuToWin: 0,
  isPaused: false,
  activePhases: [],
  isWideShot: false,
  unlockMessage: '',
  unlockImage: '',
  speech: null,
  recruitScene: null,
  winner: null,
  isPlayerDead: false
});

// writes only the values that changed, so valtio only notifies the components that care
const assign = (target, source) => {
  Object.entries(source).forEach(([key, value]) => {
    const isNested = typeof value === 'object' && value !== null;
    if (isNested && typeof target[key] === 'object' && target[key] !== null) {
      assign(target[key], value);
      if (Array.isArray(value)) target[key].length = value.length;
    } else if (target[key] !== value) {
      target[key] = value;
    }
  });
};

export const publishGameUi = uiState => assign(gameUiStore, uiState);

export const resetGameUi = () => {
  gameUiStore.players = [];
  gameUiStore.kaijuKillCount = 0;
  gameUiStore.kaijuToWin = 0;
  gameUiStore.isPaused = false;
  gameUiStore.activePhases = [];
  gameUiStore.isWideShot = false;
  gameUiStore.unlockMessage = '';
  gameUiStore.unlockImage = '';
  gameUiStore.speech = null;
  gameUiStore.recruitScene = null;
  gameUiStore.winner = null;
  gameUiStore.isPlayerDead = false;
};
