import { proxy } from 'valtio';

/*
    What React's game UI shows. The engine classes stay plain objects outside this store:
    they change on every tick, and only these values need to reach React.
*/
export const gameUiStore = proxy({
  players: [],
  recruits: [], // called-in recruits: shown under the teammate's HUD
  kaijuKillCount: 0,
  kaijuToWin: 0,
  objectiveText: '', // what the player is to do now: '' for nothing (Objectives.ts)
  isObjectiveKaijuCount: false, // 'Defeat the Kaiju': the display shows the count
  objectiveCount: 0, // a new objective each time it goes up
  takeOverCount: 0, // the player plays on as an ally: each time it goes up, its notice shows (takeOverText)
  takeOverText: '',
  isPaused: false,
  activePhases: [],
  isWideShot: false,
  isCutscene: false,
  unlockMessage: '',
  unlockImage: '',
  speech: null,
  recruitScene: null,
  winner: null,
  isPlayerDead: false,
  dialogueLog: [], // every line said in the scene so far (DialogueLog.ts)
  isDialogueWaiting: false,
  isTalking: false, // talk outside of a cutscene is going on
  isRecruitTalkDone: false,
  speakingPieceIndex: undefined
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
  gameUiStore.recruits = [];
  gameUiStore.kaijuKillCount = 0;
  gameUiStore.kaijuToWin = 0;
  gameUiStore.isPaused = false;
  gameUiStore.activePhases = [];
  gameUiStore.isWideShot = false;
  gameUiStore.isCutscene = false;
  gameUiStore.unlockMessage = '';
  gameUiStore.unlockImage = '';
  gameUiStore.speech = null;
  gameUiStore.recruitScene = null;
  gameUiStore.winner = null;
  gameUiStore.isPlayerDead = false;
  gameUiStore.dialogueLog = [];
  gameUiStore.isDialogueWaiting = false;
};
