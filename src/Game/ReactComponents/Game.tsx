import React, { useState, useEffect, useRef, useContext } from "react";
import { GHOST_BOSS } from 'Game/DataClasses/GhostBoss';
import { AQUARIUM_FLOOD } from 'Game/DataClasses/AquariumFlood';
import { GIANT_KAIJU } from 'Game/DataClasses/GiantKaiju';
import { Credits, CREDITS_TIMING } from './Credits';
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { useSnapshot } from "valtio";
import { GlobalSettingsContext } from "Home";
import { GameBoard } from "./GameBoard/GameBoard";
import { BezelButton, KaijuCounter, FULL_WINDOW, loadPlayWindow, PlayWindow, PORTRAIT_WINDOW, savePlayWindow } from "./GameBoard/PlayWindow";
import { UI } from "./UI/UI";
import { RadioCall } from "./RadioCall";
import { IrradiationVat } from "./IrradiationVat";
import { RecruitCalls } from "./RecruitCalls";
import { AvatarChoice } from "./AvatarChoice";
import { ControlsOverlay } from "./UI/ControlsOverlay";
import { NpcModelDriver } from "Game/DataClasses/npcBrain/npcModel";
import { getIsClickThrough, setIsClickThrough, setIsDialogueLog } from "Game/DataClasses/DialogueLog";
import { getIsSpacing, setIsSpacing } from "Game/DataClasses/SpacingTest";
import { BREAK_TOTAL_MS, DialogueLogPanel } from "./DialogueLogPanel";
import { ChoiceButton } from "./GameBoard/GameBoard";
import { DEFAULT_AGGRESSION } from "Game/DataClasses/npcBrain/brain";
import { getKaijuSpeedMode, KaijuSpeedMode, setKaijuSpeedMode } from "../DataClasses/KaijuSpeedTest";
import { getAvatarColor, saveAvatarColor, saveTeamAvatars, unlockEverything, unlockRecruitSkill, unlockSkill, unlockTool } from "../DataClasses/Avatars";
import { AbilityPicker } from "./AbilityPicker";
import { useKeyPress } from "Utils/utils";
import { ABILITY_KEY_CODES, GAME_TICK, PIECES_INFO, TILE_STATUSES_AND_ABILITY_DATA } from "Utils/gameState";
import { FullscreenPage } from "Components/FullscreenPage.jsx";
import { GameManager, GameResult } from '../DataClasses/GameManager';
import { getActiveHotspots } from "./GameBoard/SceneElements";
import { addUnlock, getBattlegroundUnlockId, getRecruitChoices, getWonBattlegrounds, resetUnlocks, saveRecruitChoice } from '../DataClasses/Unlocks';

// the map walks show the battlegrounds already won on, from whatever was saved
updateMapWalkSites(getWonBattlegrounds());
import { CAMPAIGN_SECTIONS, getIsLastSection } from '../DataClasses/Campaign';
import { GameLoop } from '../DataClasses/GameLoop';
import { applyLevelFile, LAB_TALK_PHASE, LEVEL_FILES, LEVELS, PENINSULA, updateMapWalkSites } from '../DataClasses/Levels/levels';
import { TileEditor } from './Levels/TileEditor';
import { gameUiStore, publishGameUi, resetGameUi } from '../DataClasses/gameUiStore';

const GameArea = styled.div`
  position: relative;
  width: 100dvw;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0c0e;
`;

// everything in the game sits in this box, and scales with it
const GameFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  min-width: 0;
  width: 100%;
  max-width: calc(100dvh * 16 / 9);
  max-height: 100dvh;
  overflow: hidden;
  container-type: inline-size;
  background: #000;
  transition: transform 0.9s ease-in, opacity 0.9s ease-in;
  @media (orientation: portrait) {
    aspect-ratio: auto;
    height: 100dvh;
    max-width: none;
  }
`;

// dev only, and beside the game rather than over it
const PhaseToggles = styled.div`
  flex: 0 0 200px;
  box-sizing: border-box;
  align-self: stretch;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  font-size: 10px;
  text-align: left;
  color: #dfe;
  background: #16181c;
`;

// moves on from a walking scene, until scenes have their own triggers
const ContinueButton = styled.button`
  position: absolute;
  bottom: 2cqw;
  right: 2cqw;
  z-index: 2147483646;
  padding: 0.6cqw 1.4cqw;
  font-family: gameboy;
  font-size: 1.3cqw;
  cursor: pointer;
`;

const cardFade = keyframes`
  0% { opacity: 0; }
  8%, 80% { opacity: 1; }
  100% { opacity: 0; }
`;

// notices sit a quarter of the way down: high enough to clear the titles in the middle, low enough to be seen
const NOTICE_TOP = "25%";

// a notice that comes and goes on its own, in the style of the speech bubbles
const UnlockCard = styled.div`
  position: absolute;
  top: ${NOTICE_TOP};
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 1cqw;
  padding: 0.7cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.3cqw;
  white-space: nowrap;
  pointer-events: none;
  color: #101018;
  background: #fbfbf0;
  border: 0.3cqw solid #101018;
  box-shadow: 0.35cqw 0.35cqw 0 rgba(0, 0, 0, 0.5);
  animation: ${cardFade} 5s linear forwards;
`;

// a power's unlock card shows its tile, as it looks on the board: a hex in the power's color with its icon
const PowerTile = styled.div`
  flex-shrink: 0;
  width: 3.4cqw;
  height: 3cqw;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  font-size: 1.5cqw;
  color: #fbfbf0;
  text-shadow: 0 0 0.3cqw rgba(0, 0, 0, 0.8);
`;

const getPowerLook = element => TILE_STATUSES_AND_ABILITY_DATA.find(data => data.element == element);

const UnlockPortrait = styled.img`
  width: 3cqw;
  height: 4cqw;
  object-fit: cover;
  object-position: 50% 0;
  image-rendering: pixelated;
`;

// in the play window, sized from it
const EndScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3cqw;
  container-type: inline-size;
`;

const titleArrive = keyframes`
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
`;

const EndTitle = styled.div`
  font-family: gameboy;
  font-size: min(5.2cqw, 4.3vw);
  text-transform: uppercase;
  text-align: center;
  color: #ff2a4d;
  -webkit-text-stroke: 0.12cqw #ffb3c4;
  /* a deep block shadow down and to the left, stepped like an extrusion, with a black edge: it reads on bright scenes and dark */
  text-shadow:
    0 0 0.6cqw #ff5c8a,
    -0.12cqw 0.12cqw 0 #8a0020, -0.24cqw 0.24cqw 0 #6e0019, -0.36cqw 0.36cqw 0 #520012, -0.48cqw 0.48cqw 0 #3a000c,
    -0.6cqw 0.6cqw 0 #22000a, -0.72cqw 0.72cqw 0 black, -0.9cqw 0.9cqw 0.6cqw rgba(0, 0, 0, 0.8),
    0 0 2.5cqw #ff0040;
  animation: ${titleArrive} 1.4s ease-out both;
`;

const EndButtons = styled.div`
  display: flex;
  gap: 1cqw;
`;

const EndButton = styled.button`
  padding: 0.7em 1.6em;
  font-family: gameboy;
  font-size: min(2cqw, 1.4vw);
  cursor: pointer;
  color: #fbfbf0;
  background: #5c0013;
  border: 0.2cqw solid #ff5c8a;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// several notices at once, one above the other
// notices stack at the screen's right, one after another, like a project tracker's updates
const CardStack = styled.div`
  position: absolute;
  right: 4cqw;
  bottom: 5cqw;
  max-width: 72%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.8cqw;
`;

// an unlock's card: at the top right of the screen (Jamie)
const UnlockStack = styled(CardStack)`
  top: 3cqw;
  bottom: auto;
  z-index: 2147483646;
`;

const toastIn = keyframes`
  from { opacity: 0; transform: translateX(30%); }
  to { opacity: 1; transform: translateX(0); }
`;

const Toast = styled.div`
  display: flex;
  align-items: center;
  gap: 1cqw;
  max-width: 100%;
  padding: 0.7cqw 1.2cqw;
  font-family: gameboy;
  font-size: 1.1cqw;
  line-height: 1.4;
  color: #101018;
  background: #fbfbf0;
  border: 0.25cqw solid #101018;
  box-shadow: 0.35cqw 0.35cqw 0 rgba(0, 0, 0, 0.5);
  animation: ${toastIn} 0.45s ease-out both;
`;

const FadeToBlack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  animation: ${fadeIn} 0.9s ease-in both;
`;

// between scenes. the clouds pass over these.
const SCENE_FADE = {
  outMs: 450,
  blackMs: 250, // the screen stays black this long before the new scene comes up
  inMs: 800
};

const SceneCover = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  background: black;
`;

const fadeOutOfBlack = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const SceneFadeOut = styled(SceneCover)`
  animation: ${fadeIn} ${SCENE_FADE.outMs}ms ease-in both;
`;

const SceneFadeIn = styled(SceneCover)`
  animation: ${fadeOutOfBlack} ${SCENE_FADE.inMs}ms ease-out ${SCENE_FADE.blackMs}ms both;
`;

const WIPE_MS = 1800;

// black rises up from the bottom edge, holds, and carries on up to show the next shot.
// the band is 260% of the screen's height, with 40% of it black, or 104% of the screen.
const blackWipe = keyframes`
  from { transform: translateY(38.5%); }
  40%, 60% { transform: translateY(-30.8%); }
  to { transform: translateY(-100%); }
`;

// the screen's edge holds still while the scene slides inside it, so the slide never passes over the monitor's border
const SlideClip = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 1.8cqw;
`;

// how long the Lab scene takes to slide away to one of its screens
const LAB_SLIDE_MS = 900;

const SlideAway = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  transition: transform 0.9s ease-in, opacity 0.9s ease-in;
`;

// keeps the wipe on the monitor's screen
const ScreenClip = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147482996;
  overflow: hidden;
  pointer-events: none;
`;

const BlackWipe = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 260%;
  z-index: 2147483647;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  animation: ${blackWipe} ${WIPE_MS}ms ease-in-out both;
`;

const DevShowButton = styled.button`
  position: fixed;
  left: 6px;
  bottom: 6px;
  z-index: 2147483647;
  padding: 2px 6px;
  font-size: 10px;
  opacity: 0.35;
  &:hover {
    opacity: 1;
  }
`;

const LevelPicker = styled.select`
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 2147483647;
`;

export const FloatingEffect = styled.div<{ styles?: string; duration?: string }>`

  ${props => !!props.styles && props.styles}

  animation: float-animation ${props => !!props.duration ? props.duration : "4"}s ease-in-out infinite;

@keyframes float-animation {
  0%, 100% {
    transform: translateY(0);
  }
  12.5% {
    transform: translateY(-2px);
  }
  25% {
    transform: translateY(-5px);
  }
  37.5% {
    transform: translateY(-3px);
  }
  50% {
    transform: translateY(-6px);
  }
  62.5% {
    transform: translateY(-4px);
  }
  75% {
    transform: translateY(-5px);
  }
  87.5% {
    transform: translateY(-2px);
  }
}`;

const MATCH_END_DELAY_MS = 700;
const SCENE_SLIDE_MS = 900;

// a rising pair of notes, for finding something
const playUnlockDing = () => {
  try {
    const audio = new AudioContext();
    [[880, 0], [1320, 0.12]].forEach(([frequency, startSeconds]) => {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      tone.type = "square";
      volume.gain.setValueAtTime(0.08, audio.currentTime + startSeconds);
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + startSeconds + 0.35);
      tone.connect(volume).connect(audio.destination);
      tone.start(audio.currentTime + startSeconds);
      tone.stop(audio.currentTime + startSeconds + 0.35);
    });
  } catch { /* (no sound) */ }
};

const RECRUIT_TIMING = {
  titleMs: 2800, // how long the title and slow motion last before the choice
  confirmMs: 5000, // the choice locks in and the screen washes over in its color, held, then fades to black
  cardMs: 6300 // the unlock cards come in over 1.3 s, then hold 5 s to be read
};

const RECRUIT_CARDS = {
  punk: { avatar: 'punk', label: 'Punk Guy' },
  black_female: { avatar: 'black_female', label: 'Punk Girl' },
  mermaid: { avatar: 'mermaid', label: 'Aquarium Worker' }
};

// after the last win's title holds a while, the credits roll over it
const FinaleCredits = ({ title, onDone }) => {
  const [isRolling, setIsRolling] = useState(false);
  useEffect(() => {
    const roll = setTimeout(() => setIsRolling(true), CREDITS_TIMING.titleMs);
    return () => clearTimeout(roll);
  }, []);
  return isRolling ? createPortal(<Credits onDone={onDone} />, document.querySelector("[data-play-screen]") || document.body) : <EndTitle>{title}</EndTitle>;
};

export const Game = ({ handleClickHome, triggerTransition }) => {
  const { selectedAvatar, setSelectedAvatar, selectedTeammate, setSelectedTeammate, selectedDifficulty, settingsManager } = useContext(GlobalSettingsContext);
  const { isPaused, winner, isPlayerDead, players, recruits, kaijuKillCount, kaijuToWin, activePhases, isWideShot, isCutscene, unlockMessage, unlockImage, speech, recruitScene, dialogueLog, isDialogueWaiting, isTalking, isRecruitTalkDone, speakingPieceIndex } = useSnapshot(gameUiStore);
  const [isRadioAlarm, setIsRadioAlarm] = useState(false); // the radio call has told of Kaiju coming: the siren glows
  const recruitChoiceFrom = useRef(undefined); // where the pressed Recruit or Terminate button was, for its word to fly from
  const [isClickThrough, setClickThrough] = useState(getIsClickThrough); // a playtest: each line in the log waits for a key or a click
  const [spacing, setSpacing] = useState(() => ({ walking: getIsSpacing("walking"), battle: getIsSpacing("battle") })); // a playtest: NPCs don't bunch up
  const toggleSpacing = kind => {
    setIsSpacing(kind, !spacing[kind]);
    setSpacing({ ...spacing, [kind]: !spacing[kind] });
  };

  const startingLevelId = new URLSearchParams(window.location.search).get('level');
  const [levelId, setLevelId] = useState(startingLevelId || PENINSULA.id);
  const [campaignIndex, setCampaignIndex] = useState(startingLevelId ? null : 0); // null: playing one level on its own
  useEffect(() => setIsRadioAlarm(false), [campaignIndex]);
  const level = LEVELS[levelId] || PENINSULA;
  const togglePhase = id => {
    gameManager.current.togglePhase(id);
    publishGameUi(gameManager.current.getUiState());
  };

  const gameManager = useRef<any>(null);
  const gameLoop = useRef<GameLoop | null>(null);

  const [isTeammate, setIsTeammate] = useState(true);
  const [isShowingControls, setIsShowingControls] = useState(false);
  const isPausedForControls = useRef(false);
  const [kaijuSpeedMode, setKaijuSpeedModeState] = useState(getKaijuSpeedMode); // dev playtest
  const [isChoosingAvatar, setIsChoosingAvatar] = useState(!startingLevelId); // a new campaign starts with the guy or the girl
  const isPickingPowersInLab = useRef(false);
  const [isLabPicker, setIsLabPicker] = useState(false);
  const [isLogClosing, setIsLogClosing] = useState(false); // the HUDs wait for the log to come apart
  const [isLogBuilt, setIsLogBuilt] = useState(false); // a speaker shakes only once their words are in the log // the picker was opened from the Lab's tanks: it goes back there
  const [isWholeScene, setIsWholeScene] = useState(false);
  const [isMouseLook, setIsMouseLook] = useState(true);
  const [isEnemyZoom, setIsEnemyZoom] = useState(true);
  const [isTeamColors, setIsTeamColors] = useState(true); // a playtest: statuses in their side's color
  // who is recruited this playthrough (Jamie: React state, not saved). The dev panel switches each on or off.
  const [recruitedAvatars, setRecruitedAvatars] = useState<Array<string>>([]);
  const toggleRecruited = avatar => setRecruitedAvatars(list => list.includes(avatar) ? list.filter(id => id != avatar) : [...list, avatar]);
  const [isAutoRecruits, setIsAutoRecruits] = useState(true); // dev toggle (Jamie): every recruit in every fight, and walking with the team; no call buttons
  const [isTrainedNpcs, setIsTrainedNpcs] = useState(false); // off by default (Jamie, 2026-11-06). NPCs play by the trained model in public/models in fights with no Kaiju; against a Kaiju they hand back to the rules
  const [isDevHidden, setIsDevHidden] = useState(false); // the dev tools tucked away, to see the game as it will ship
  const [npcAggression, setNpcAggression] = useState(DEFAULT_AGGRESSION); // the trained NPCs', 0 careful to 1 reckless
  // the ghost boss's ring, tuned in the dev panel: its size, and the ghosts in each phase's ring (the next ring uses them)
  const [ghostRadiusRows, setGhostRadiusRows] = useState(GHOST_BOSS.ringRadiusRows);
  const [ghostRings, setGhostRings] = useState(GHOST_BOSS.rings.join(', '));
  // the Aquarium's flood, tuned in the dev panel (the next flood uses them)
  const [floodSeconds, setFloodSeconds] = useState(AQUARIUM_FLOOD.floodMs / 1000);
  const [floodStyle, setFloodStyle] = useState(AQUARIUM_FLOOD.flowStyle);
  // the final battle's giant: how fast it marches (the map's size is GIANT_KAIJU.mapScale, set when the game loads)
  const [giantMarch, setGiantMarch] = useState(GIANT_KAIJU.marchRowsPerSecond);
  const npcAggressionRef = useRef(npcAggression);
  npcAggressionRef.current = npcAggression;
  const [isMonitorAlways, setIsMonitorAlways] = useState(true); // a playtest: the TV never opens up, and wide shots play inside it
  const [isAdjustingWindow, setIsAdjustingWindow] = useState(false);
  const [playWindow, setPlayWindow] = useState(() => loadPlayWindow()); // the saved shape, in production too
  const updatePlayWindow = next => {
    setPlayWindow(next);
    savePlayWindow(next);
  };
  const [isEditingTiles, setIsEditingTiles] = useState(false);
  const [matchCount, setMatchCount] = useState(0); // the board starts fresh with each match
  const [pickedAbilities, setPickedAbilities] = useState([]);
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [fullScreenPageData, setFullScreenPageData] = useState(undefined);
  const [radioLines, setRadioLines] = useState(undefined);
  const [matchEnd, setMatchEnd] = useState(undefined); // the title over the board once a match is decided
  const [recruitChoice, setRecruitChoice] = useState(undefined);
  const [leavingFor, setLeavingFor] = useState(undefined); // the Lab screen the scene is sliding away for
  const [isResumingRadio, setIsResumingRadio] = useState(false);
  const isOnLabDetour = useRef(false); // the Lab, or a battleground visited again, off a map walk
  const detourSpot = useRef(undefined); // where that site is on the map: the walk carries on from beside it
  const [labScreen, setLabScreen] = useState(undefined); // 'colors'
  const [labCover, setLabCover] = useState(undefined); // 'in' or 'out': the Lab screen's fade from or to black
  const [fadeCards, setFadeCards] = useState(undefined); // the screen is fading to black, and these are the unlocks shown on it
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const isLeavingScene = useRef(false);

  const endMatch = () => {
    if (gameLoop.current) gameLoop.current.stop();
    gameLoop.current = null;
    gameManager.current = null;
    isLeavingScene.current = false;
    setIsFadingOut(false);
    setIsWiping(false);
  };

  // the next scene only ever comes up out of a black screen
  const fadeOutThen = callback => {
    if (isLeavingScene.current) return;
    isLeavingScene.current = true;
    setIsFadingOut(true);
    setTimeout(callback, SCENE_FADE.outMs);
  };

  const leaveWithClouds = callback => {
    fadeOutThen(callback);
    triggerTransition();
  };

  // the game stops when the player leaves the page
  useEffect(() => endMatch, []);

  // a clicked button lets go of the focus, so Enter or Space can't press it again in the middle of play
  useEffect(() => {
    const letGo = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button, select, input");
      if (button) setTimeout(() => (button as HTMLElement).blur(), 0);
    };
    document.addEventListener("click", letGo, true);
    return () => document.removeEventListener("click", letGo, true);
  }, []);

  const startMatch = (matchLevel = level, hasArrival = false, killsToWin = undefined, { returnSpot = undefined, isRetry = false } = {}) => {
    settingsManager.updatePlayerAvatar(selectedAvatar);
    settingsManager.setTeammateAvatar(selectedTeammate);
    settingsManager.setDifficulty(selectedDifficulty);
    settingsManager.setIsTeammate(isTeammate);

    setIsDialogueLog(isMonitorAlways); // in the monitor, conversations go to the log beside it
    const gm = new GameManager({ level: matchLevel, settingsManager, hasArrival, killsToWin, returnSpot, isRetry, autoRecruits: isAutoRecruits ? getCallableRecruits() : [], recruits: recruitedAvatars });
    gm.initGame();
    gameManager.current = gm;
    if (import.meta.env.DEV) (window as any).__kaijuGame = gm; // dev only: a handle for scripted browser checks
    resetGameUi();
    publishGameUi(gm.getUiState());

    gameLoop.current = new GameLoop({
      steps: [
        { everyMs: GAME_TICK.pieceMs, run: () => gm.stepPieces() },
        { everyMs: GAME_TICK.tileMs, run: () => gm.stepTiles() }
      ],
      maxCatchUpMs: GAME_TICK.maxCatchUpMs,
      onAdvanced: () => {
        gm.notifyBoard();
        publishGameUi(gm.getUiState());
      }
    });
    gameLoop.current.start();
    isLeavingScene.current = false;
    setIsFadingOut(false);
    if (matchLevel.id == 'labIntro') unlockTool('abilityEditor');
    setIsEditingTiles(false);
    setMatchCount(count => count + 1);
    setFullScreenPageData(undefined);
    setRadioLines(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
  };

  // dev testing: changes level, and a match in progress restarts on it with the same powers
  const switchLevel = id => {
    setCampaignIndex(null);
    setLevelId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('level', id);
    window.history.replaceState({}, "Kaiju City", url);
    if (gameManager.current) {
      endMatch();
      startMatch(LEVELS[id]);
    }
  };

  const setIsEditing = isEditing => {
    gameManager.current.setIsEditingTiles(isEditing);
    publishGameUi(gameManager.current.getUiState());
    setIsEditingTiles(isEditing);
  };

  const playSavedLevel = file => {
    applyLevelFile(file);
    endMatch();
    startMatch(LEVELS[file.id]);
  };

  const cycleLevel = step => {
    const ids = Object.keys(LEVELS);
    switchLevel(ids[(ids.indexOf(level.id) + step + ids.length) % ids.length]);
  };

  useEffect(() => {
    if (unlockMessage) playUnlockDing();
  }, [unlockMessage]);

  // a walking scene's hotspots: their number keys click them (Jamie), when no one is talking
  useEffect(() => {
    if (!level.isWalkingLevel) return;
    const onKey = event => {
      const match = /^(Digit|Numpad)([1-9])$/.exec(event.code);
      if (!match || isCutscene || recruitScene || isTalking || isDialogueWaiting || labScreen || isPaused) return;
      const hotspot = getActiveHotspots(level, activePhases)[Number(match[2]) - 1];
      if (!hotspot) return;
      event.preventDefault();
      openLabScreen(hotspot.action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // only those recruited this playthrough
  const getCallableRecruits = () => recruitedAvatars;

  const levelOptions = Object.values(LEVELS).map(({ id, name }) => <option key={id} value={id}>{name}</option>);

  const resetMatch = () => {
    endMatch();
    resetGameUi();
    setPickedAbilities([]);
    setIsPlayingGame(false);
    setFullScreenPageData(undefined);
  };

  const getRadioContext = () => {
    settingsManager.initAbilityStatusData(); // the first call comes before any match has loaded the powers
    const [ability] = settingsManager.getPlayerChosenAbilities();
    return {
      powerName: ability ? ability.gameBoardPieceAbilityData.activeName : "powers",
      choices: getRecruitChoices(),
      avatar: selectedAvatar
    };
  };

  const showSection = index => {
    const { levelId: sectionLevelId, radio, kills } = CAMPAIGN_SECTIONS[index];
    endMatch();
    resetGameUi();
    setCampaignIndex(index);
    setLevelId(sectionLevelId);
    setFullScreenPageData(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setIsResumingRadio(false);
    if (radio) setRadioLines(radio(getRadioContext()));
    else startMatch(LEVELS[sectionLevelId], false, kills);
  };

  // after a loss: the same fight again, without the call or the opening words a second time
  const retrySection = index => {
    const { levelId: sectionLevelId, kills } = CAMPAIGN_SECTIONS[index];
    // lost to the teammate's Kaiju (or already in that fight): again from its start, without the Kaiju or the words (Jamie)
    if (level.id == "finalTurnFight" || (gameManager.current && gameManager.current.finalTurnState == "fighting")) {
      showFinalTurnFight();
      return;
    }
    endMatch();
    resetGameUi();
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setRadioLines(undefined);
    startMatch(LEVELS[sectionLevelId], false, kills, { isRetry: true });
  };

  // the last fight, from the teammate's turn: a Retry after losing it, and the dev list's jump
  const showFinalTurnFight = () => {
    endMatch();
    resetGameUi();
    setCampaignIndex(CAMPAIGN_SECTIONS.length - 1);
    setLevelId("finalTurnFight");
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCards(undefined);
    setRadioLines(undefined);
    startMatch(LEVELS.finalTurnFight, false, undefined, { isRetry: true });
  };

  // goes back through the ability picker, which returns to this section's call
  // back into the walking Lab, beside the tanks, with the talk there already had
  const returnToLab = () => {
    isPickingPowersInLab.current = false;
    const labLevel = LEVELS[level.id];
    const tank = (labLevel.sceneElements || []).find(({ action }) => action == "powers");
    const returnSpot = tank ? { x: tank.x + tank.width / 2, y: tank.y + tank.height } : undefined;
    triggerTransition(() => {
      setIsLabPicker(false); // only once the clouds cover the picker: its other buttons don't flash up first
      startMatch(labLevel, false, undefined, { returnSpot, isRetry: true });
      setIsPlayingGame(true);
    });
  };

  const handleChangePowers = lastLine => {
    setRadioLines([lastLine]);
    setIsResumingRadio(true);
    setIsPlayingGame(false);
  };

  const handleClickPlay = () => {
    if (isPickingPowersInLab.current) {
      returnToLab();
      return;
    } else if (isResumingRadio) {
      // back to the end of the call
    } else if (campaignIndex !== null) {
      showSection(campaignIndex);
    } else {
      setFullScreenPageData({
        text: ["Wild Kaiju have appeared!"],
        buttons: [{ text: "Fight!", onClick: () => startMatch() }],
        image: { src: './story_images/match_start.png', width: '535px', height: '535px' }
      });
    }
    triggerTransition(() => setIsPlayingGame(true));
  };

  const getWinTitle = () => {
    if (level.rival) return "Target Subdued";
    return level.agentDrops ? "Agents Terminated" : "Kaiju Terminated";
  };

  const getMatchEnd = isWon => {
    const title = isWon ? getWinTitle() : "You Lost";
    // the end of the game: the title, then the credits, then the landing screen
    // the last fight's ends: the city saved, or (the player turned, with no teammate left to) destroyed (Jamie)
    const isDestroyed = !!gameManager.current && gameManager.current.finalTurnState == "destroyed";
    if (isWon && (level.giantKaiju || (campaignIndex !== null && getIsLastSection(campaignIndex)))) return { title: isDestroyed ? "You destroyed the city!" : "You saved the city!", buttons: [], isFinale: true };
    if (campaignIndex === null) {
      return { title, buttons: [{ text: "Play again", onClick: () => triggerTransition(resetMatch) }, { text: "Leave", onClick: handleClickHome }] };
    }
    if (!isWon) {
      return { title, buttons: [{ text: "Try again", onClick: () => fadeOutThen(() => retrySection(campaignIndex)) }, { text: "Leave", onClick: handleClickHome }] };
    }
    if (getIsLastSection(campaignIndex)) {
      return { title: "You saved the city!", buttons: [{ text: "Play again", onClick: () => { setCampaignIndex(0); triggerTransition(resetMatch); } }, { text: "Leave", onClick: handleClickHome }] };
    }
    return { title, buttons: [{ text: "Continue", onClick: () => fadeOutThen(() => showSection(campaignIndex + 1)) }] };
  };

  // a stop off a map walk: the Lab, or a battleground won on before. the walk carries on after.
  const visitSite = site => {
    const visitLevelId = site.visitLevelId || 'labIntro';
    isOnLabDetour.current = true;
    detourSpot.current = site.spot;
    setLevelId(visitLevelId);
    endMatch();
    startMatch(LEVELS[visitLevelId]);
  };

  const openLabScreen = screen => {
    if (screen == "exit") {
      leaveWithClouds(leaveLevel);
      return;
    }
    if (screen == "agentTalk") {
      gameManager.current.startNewLog(); // a new conversation: the welcome is gone, and the Agent's face and name show again
      gameManager.current.setPhase(LAB_TALK_PHASE, true);
      return;
    }
    // the power picker, and back into the Lab with the new powers
    if (screen == "powers") {
      isPickingPowersInLab.current = true;
      setIsLabPicker(true);
      setPickedAbilities([...settingsManager.getSortedPlayerChosenAbilityElementsString()]); // the powers they have now, picked already
      // the scene slides away to the right, as if the camera turned left to the tanks, as it slides left for the color vat
      setLeavingFor(screen);
      setTimeout(() => {
        endMatch(); // the Lab starts again with the new powers
        setIsPlayingGame(false);
        setLeavingFor(undefined);
      }, LAB_SLIDE_MS);
      return;
    }
    unlockTool(screen);
    setLeavingFor(screen);
    setTimeout(() => {
      setLabScreen(screen);
      setLabCover("in");
    }, SCENE_SLIDE_MS);
  };

  const closeLabScreen = () => {
    setLabCover("out");
    setTimeout(() => {
      setLabScreen(undefined);
      setLabCover(undefined);
      setLeavingFor(undefined);
    }, SCENE_FADE.outMs);
  };

  const chooseTeam = (player, teammate) => {
    setSelectedAvatar(player);
    setSelectedTeammate(teammate);
    saveTeamAvatars(player, teammate);
    if (gameManager.current) gameManager.current.changeTeamAvatars(player, teammate);
  };

  const irradiate = color => {
    saveAvatarColor(selectedAvatar, color);
    gameManager.current.getPieces()[0].setColor(color);
  };

  const leaveLevel = () => {
    if (isOnLabDetour.current) {
      isOnLabDetour.current = false;
      const { levelId: mapLevelId } = CAMPAIGN_SECTIONS[campaignIndex];
      setLevelId(mapLevelId);
      endMatch();
      startMatch(LEVELS[mapLevelId], false, undefined, { returnSpot: detourSpot.current });
    } else if (campaignIndex !== null) showSection(campaignIndex + 1);
    else resetMatch();
  };

  // confirmed, then fade to black, then what the choice gave: a power, or someone to call in
  const handleChooseRecruit = choice => {
    if (recruitChoice) return;
    const { avatar, label } = RECRUIT_CARDS[level.rival.avatar];
    setRecruitChoice(choice);
    saveRecruitChoice(level.rival.avatar, choice);
    if (choice == "recruit") setRecruitedAvatars(list => list.includes(level.rival.avatar) ? list : [...list, level.rival.avatar]);
    addUnlock(level.rival.avatar);
    // Terminate: their power is yours. Recruit: they can be called into fights, and their power stays closed.
    const skill = choice == "terminate" ? unlockRecruitSkill(level.rival.avatar) : undefined;
    const choiceLabel = skill ? `${skill.name} power unlocked!` : `${label} recruited! Call them in during fights.`;
    // the fight's battleground opens for versus, whichever way the player chose
    addUnlock(getBattlegroundUnlockId(level.id));
    updateMapWalkSites(getWonBattlegrounds());
    const portrait = `/levels/portraits/${avatar}.png`;
    // no card for the character: only the place, and what the choice gave
    const cards = [
      { label: `${level.name} Unlocked`, image: level.layers[0] && level.layers[0].src },
      // a power: its tile, in its color. a recruit: their face.
      skill ? { label: choiceLabel, power: skill.element } : { label: choiceLabel, image: portrait }
    ];
    setTimeout(() => setFadeCards(cards), RECRUIT_TIMING.confirmMs);
    setTimeout(leaveLevel, RECRUIT_TIMING.confirmMs + RECRUIT_TIMING.cardMs);
  };

  // the game holds still while the controls are up
  const openControls = () => {
    if (!gameManager.current || isShowingControls) return;
    isPausedForControls.current = !isPaused && winner === null;
    if (isPausedForControls.current) {
      gameManager.current.togglePauseGame();
      publishGameUi(gameManager.current.getUiState());
    }
    setIsShowingControls(true);
  };

  const closeControls = () => {
    setIsShowingControls(false);
    if (isPausedForControls.current && gameManager.current) {
      gameManager.current.togglePauseGame();
      publishGameUi(gameManager.current.getUiState());
    }
    isPausedForControls.current = false;
  };

  // each match gets its own driver, so a new match starts with a clean slate
  useEffect(() => {
    const gm = gameManager.current;
    if (!gm) return;
    gm.setNpcModelDriver(isTrainedNpcs ? new NpcModelDriver(gm.getTrainablePieces, () => npcAggressionRef.current) : undefined);
  }, [isTrainedNpcs, matchCount, levelId, campaignIndex]);

  // the first Peninsula fight opens with the controls, once the teammate's arrival has played
  const hasShownFirstControls = useRef(false);
  useEffect(() => {
    const isFirstFight = campaignIndex === 0 && level.id == PENINSULA.id && isPlayingGame && !radioLines && !!gameManager.current;
    if (!isFirstFight || isCutscene || hasShownFirstControls.current) return;
    hasShownFirstControls.current = true;
    openControls();
  }, [campaignIndex, level, isPlayingGame, radioLines, isCutscene, matchCount]);

  const handleClickPause = () => {
    if (isShowingControls) {
      closeControls();
      return;
    }
    if (!gameManager.current || winner !== null) return;
    gameManager.current.togglePauseGame();
    publishGameUi(gameManager.current.getUiState());
  };

  useKeyPress({ keyCodes: "Escape", keyUpCallback: handleClickPause, isCharacterDead: false });

  // a cutscene's line waiting in the log moves on with any key. Enter does it through its Continue bar, below; Escape pauses.
  useEffect(() => {
    const handleKeyDown = ({ code, repeat }) => {
      const gm = gameManager.current;
      if (repeat || !gm || !gm.cutscene || ["Enter", "NumpadEnter", "Escape"].includes(code)) return;
      if (gm.getIsDialogueWaiting()) gm.advanceDialogue();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Enter presses whatever moves things on: a Continue button, the radio's next line, or a cutscene's next line
  useKeyPress({
    keyCodes: ["Enter", "NumpadEnter"],
    keyUpCallback: () => {
      const button = document.querySelector<HTMLElement>('[data-choice-key="1"]') || document.querySelector<HTMLElement>("[data-enter]");
      if (button) button.click();
      else if (gameManager.current) gameManager.current.advanceDialogue();
    },
    isCharacterDead: false
  });

  // 1, 2...: the number keys press the buttons showing them, wherever there is a choice or a Continue.
  // powers are off whenever these show, so the keys never do both
  useKeyPress({
    keyCodes: [1, 2, 3, 4].flatMap(n => [`Digit${n}`, `Numpad${n}`]),
    keyUpCallback: code => {
      const button = document.querySelector<HTMLElement>(`[data-choice-key="${code.slice(-1)}"]`);
      if (button) button.click();
      else if (code.endsWith("1") && gameManager.current && gameManager.current.cutscene) gameManager.current.advanceDialogue(); // 1 moves a scene on, as Enter does
    },
    isCharacterDead: false
  });

  // F2 hides the dev tools, or brings them back
  useKeyPress({
    keyCodes: ["F2"],
    keyDownCallback: () => setIsDevHidden(isHidden => !isHidden),
    isCharacterDead: !import.meta.env.DEV
  });

  useKeyPress({
    keyCodes: ["BracketLeft", "BracketRight"],
    keyDownCallback: code => cycleLevel(code == "BracketRight" ? 1 : -1),
    isCharacterDead: !import.meta.env.DEV
  });

  useKeyPress({
    keyCodes: ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
    keyDownCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().addKey(code),
    keyUpCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().removeKey(code),
    isCharacterDead: isPaused || isPlayerDead
  });

  useKeyPress({
    keyCodes: ABILITY_KEY_CODES,
    keyDownCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().usePlayerAbility(code, gameManager.current.getAccTime()),
    isCharacterDead: isPaused || level.isWalkingLevel
  });

  useEffect(() => {
    if (winner === null || !isPlayingGame) return;
    const isWon = winner === GameResult.PlayerWon;
    if (isWon && level.skillOnLeave) unlockSkill(level.skillOnLeave); // the Street's Teleport
    if (level.isWalkingLevel && isWon) {
      const site = gameManager.current && gameManager.current.reachedSite;
      leaveWithClouds(site && site.isDetour ? () => visitSite(site) : leaveLevel);
      return;
    }
    if (isWon && level.agentDrops) unlockRecruitSkill("agent");
    if (isWon && campaignIndex !== null && getIsLastSection(campaignIndex)) addUnlock("agent");
    const titleTimeoutRef = setTimeout(() => setMatchEnd(getMatchEnd(isWon)), MATCH_END_DELAY_MS);
    if (!isWon || !level.rival) return () => clearTimeout(titleTimeoutRef);

    // black rises over the fight. the scene is set while it is dark, with everyone and the camera already in place.
    const wipeTimeoutRef = setTimeout(() => setIsWiping(true), MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs);
    const sceneTimeoutRef = setTimeout(() => {
      setMatchEnd(undefined);
      gameManager.current.startRecruitScene();
      publishGameUi(gameManager.current.getUiState());
    }, MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs + WIPE_MS / 2);
    const wipeEndRef = setTimeout(() => setIsWiping(false), MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs + WIPE_MS);
    return () => {
      [titleTimeoutRef, wipeTimeoutRef, sceneTimeoutRef, wipeEndRef].forEach(clearTimeout);
    };
  }, [winner, isPlayingGame, campaignIndex]);

  const isWindowOpen = !isMonitorAlways && (isWideShot || (level.isWalkingLevel && !level.isMapWalk));

  const sceneFades = isPlayingGame && createPortal(
    <>
      <SceneFadeIn key={radioLines ? `radio ${campaignIndex}` : `match ${matchCount}`} />
      {isFadingOut && <SceneFadeOut />}
      {labCover == "in" && <SceneFadeIn style={{ zIndex: 2147483647 }} />}
      {labCover == "out" && <SceneFadeOut style={{ zIndex: 2147483647 }} />}
    </>,
    document.body
  );

  // hidden dev tools leave one small button in the corner to bring them back
  const devShowButton = import.meta.env.DEV && isDevHidden && (
    <DevShowButton onClick={() => setIsDevHidden(false)} title="Show dev options (F2)">dev</DevShowButton>
  );

  const screen = (
    !isPlayingGame && isChoosingAvatar ?
      <AvatarChoice onChoose={(player, teammate) => {
        chooseTeam(player, teammate);
        triggerTransition(() => setIsChoosingAvatar(false));
      }} />
    : !isPlayingGame ?
      <>
      {import.meta.env.DEV && !isDevHidden && (
        <LevelPicker value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
          {levelOptions}
        </LevelPicker>
      )}
      <AbilityPicker
        handleClickHome={handleClickHome}
        pickedAbilities={pickedAbilities}
        setPickedAbilities={setPickedAbilities}
        handleClickPlay={handleClickPlay}
        playLabel={isLabPicker ? "Back to Lab" : undefined}
        onBack={isLabPicker ? returnToLab : undefined}
        isTeammate={isTeammate}
        setIsTeammate={setIsTeammate}
      />
      </>
      : radioLines ?
        <GameArea>
          <GameFrame data-game-frame>
            {/* the alarm only when the call sends the team into a Kaiju fight */}
            <PlayWindow playWindow={playWindow} setPlayWindow={updatePlayWindow} isAdjusting={false} isOpen={false} isSiren={isRadioAlarm}>
              <RadioCall
                key={campaignIndex}
                lines={radioLines}
                playerAvatar={selectedAvatar}
                teammateAvatar={selectedTeammate}
                isResuming={isResumingRadio}
                onGo={() => {
                  const { levelId: sectionLevelId, hasArrival, kills } = CAMPAIGN_SECTIONS[campaignIndex];
                  fadeOutThen(() => startMatch(LEVELS[sectionLevelId], hasArrival, kills));
                }}
                onChangePowers={handleChangePowers}
                onAlarm={() => setIsRadioAlarm(true)}
                kaijuCount={CAMPAIGN_SECTIONS[campaignIndex].kills || 0}
              />
            </PlayWindow>
          </GameFrame>
        </GameArea>
      : fullScreenPageData ?
        <FullscreenPage
          text={fullScreenPageData.text}
          buttons={fullScreenPageData.buttons}
          image={fullScreenPageData.image}
        />
        : !gameManager.current ? null : (<GameArea>
          {import.meta.env.DEV && !isDevHidden && (
            <PhaseToggles>
              <button onClick={() => setIsDevHidden(true)}>Hide dev options (F2)</button>
              <a href="/dialogue" target="_blank" rel="noreferrer" style={{ color: "#6dffa0" }}>Dialogue viewer</a>
              <a href="/classes" target="_blank" rel="noreferrer" style={{ color: "#6dffa0" }}>Class review</a>
              <select aria-label="Level" value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
                {levelOptions}
              </select>
              <select aria-label="Section" value={level.id == "finalTurnFight" ? "finalTurn" : campaignIndex ?? ""} onChange={e => {
                // dev: "Credits" plays the ending from "You saved the city!"; the teammate's fight on its own (Jamie)
                if (e.target.value == "credits") setMatchEnd({ title: "You saved the city!", buttons: [], isFinale: true });
                else if (e.target.value == "finalTurn") showFinalTurnFight();
                else showSection(Number(e.target.value));
                e.target.blur();
              }}>
                {campaignIndex === null && <option value="">Campaign section</option>}
                {CAMPAIGN_SECTIONS.map(({ label }, index) => <option key={label} value={index}>{index + 1}. {label}</option>)}
                <option value="finalTurn">{CAMPAIGN_SECTIONS.length + 1}. Final battle: the teammate</option>
                <option value="credits">{CAMPAIGN_SECTIONS.length + 2}. Credits</option>
              </select>
              {campaignIndex !== null && !getIsLastSection(campaignIndex) && <button onClick={() => showSection(campaignIndex + 1)}>Skip section</button>}
              {level.phases.map(({ id, label }) => (
                <label key={id}>
                  <input type="checkbox" checked={activePhases.includes(id)} onChange={() => togglePhase(id)} /> {label}
                </label>
              ))}
              {level.giantKaiju && (
                <>
                  <button onClick={() => gameManager.current.devDrainGiant()}>Drain the giant</button>
                  <label>
                    <input type="range" min={0.1} max={2} step={0.05} value={giantMarch} onChange={event => {
                      const speed = Number(event.target.value);
                      setGiantMarch(speed);
                      GIANT_KAIJU.marchRowsPerSecond = speed;
                    }} />
                    {' '}March {giantMarch.toFixed(2)} rows/s
                  </label>
                </>
              )}
              {level.aquariumFlood && (
                <>
                  <button onClick={() => gameManager.current.devDownRival()}>Mermaid to zero</button>
                  <label>
                    Flood{' '}
                    <input aria-label="Flood seconds" type="number" min={5} max={180} style={{ width: 52 }} value={floodSeconds} onChange={event => {
                      const seconds = Number(event.target.value);
                      setFloodSeconds(seconds);
                      if (seconds > 0) AQUARIUM_FLOOD.floodMs = seconds * 1000;
                    }} /> s
                  </label>
                  <select aria-label="Water style" value={floodStyle} onChange={event => {
                    const style = event.target.value as 'flow' | 'bounce';
                    setFloodStyle(style);
                    AQUARIUM_FLOOD.flowStyle = style;
                    event.target.blur();
                  }}>
                    <option value="flow">Water flows</option>
                    <option value="bounce">Water bounces</option>
                  </select>
                </>
              )}
              {level.ghostBoss && (
                <>
                  <button onClick={() => gameManager.current.devDownRival()}>Punk Girl to zero</button>
                  <label>
                    <input type="range" min={1.5} max={7} step={0.1} value={ghostRadiusRows} onChange={event => {
                      const rows = Number(event.target.value);
                      setGhostRadiusRows(rows);
                      GHOST_BOSS.ringRadiusRows = rows;
                    }} />
                    {' '}Ghost ring {ghostRadiusRows.toFixed(1)} rows
                  </label>
                  <label>
                    Ghosts per ring{' '}
                    <input aria-label="Ghosts per ring" style={{ width: 70 }} value={ghostRings} onChange={event => {
                      setGhostRings(event.target.value);
                      const counts = event.target.value.split(',').map(count => Math.round(Number(count))).filter(count => count > 0);
                      if (counts.length) GHOST_BOSS.rings = counts;
                    }} />
                  </label>
                </>
              )}
              <label>
                <input type="checkbox" checked={isWholeScene} onChange={() => setIsWholeScene(!isWholeScene)} /> Whole scene
              </label>
              <label>
                <input type="checkbox" checked={isMouseLook} onChange={() => setIsMouseLook(!isMouseLook)} /> Mouse look
              </label>
              <label>
                <input type="checkbox" checked={isEnemyZoom} onChange={() => setIsEnemyZoom(!isEnemyZoom)} /> Enemy zoom
              </label>
              <label>
                <input type="checkbox" checked={isTeamColors} onChange={() => setIsTeamColors(!isTeamColors)} /> Team colors
              </label>
              <label>
                <input type="checkbox" checked={isTrainedNpcs} onChange={() => setIsTrainedNpcs(!isTrainedNpcs)} /> Trained NPCs
              </label>
              <label>
                <input type="checkbox" checked={isAutoRecruits} onChange={() => setIsAutoRecruits(!isAutoRecruits)} /> Recruits auto-summoned
              </label>
              {/* dev: who is recruited, this playthrough (from the next match on) */}
              {[["punk", "Punk Guy"], ["black_female", "Punk Girl"], ["mermaid", "Aquarium Worker"]].map(([avatar, name]) => (
                <label key={avatar}>
                  <input type="checkbox" checked={recruitedAvatars.includes(avatar)} onChange={() => toggleRecruited(avatar)} /> Recruit: {name}
                </label>
              ))}
              {isTrainedNpcs && (
                <label>
                  <input type="range" min={0} max={1} step={0.05} value={npcAggression} onChange={event => setNpcAggression(Number(event.target.value))} />
                  {' '}Aggression {npcAggression.toFixed(2)}
                </label>
              )}
              <label>
                <input type="checkbox" checked={isMonitorAlways} onChange={() => setIsMonitorAlways(!isMonitorAlways)} /> Monitor always
              </label>
              <label>
                <input type="checkbox" checked={isClickThrough} onChange={() => { setIsClickThrough(!isClickThrough); setClickThrough(!isClickThrough); }} /> Click through
              </label>
              <label>
                <input type="checkbox" checked={spacing.walking} onChange={() => toggleSpacing("walking")} /> Spacing: walking
              </label>
              <label>
                <input type="checkbox" checked={spacing.battle} onChange={() => toggleSpacing("battle")} /> Spacing: battle
              </label>
              <label>
                <input type="checkbox" checked={isAdjustingWindow} onChange={() => setIsAdjustingWindow(!isAdjustingWindow)} /> Adjust window
              </label>
              {isAdjustingWindow && <button onClick={() => updatePlayWindow(PORTRAIT_WINDOW)}>Portrait window</button>}
              {isAdjustingWindow && <button onClick={() => updatePlayWindow(FULL_WINDOW)}>Full window</button>}
              {LEVEL_FILES[level.id] && (
                <label>
                  <input type="checkbox" checked={isEditingTiles} onChange={() => setIsEditing(!isEditingTiles)} /> Edit tiles
                </label>
              )}
              <button onClick={() => { resetUnlocks(); updateMapWalkSites([]); }}>Reset unlocks</button>
              <button onClick={() => { unlockEverything(['rapidTransit', 'rooftop', 'aquarium']); updateMapWalkSites(getWonBattlegrounds()); setRecruitedAvatars(["punk", "black_female", "mermaid"]); }}>Unlock everything</button>
              <select aria-label="Kaiju speed" value={kaijuSpeedMode} onChange={e => { const mode = e.target.value as KaijuSpeedMode; setKaijuSpeedMode(mode); setKaijuSpeedModeState(mode); e.target.blur(); }}>
                <option value="rampage">Kaiju: fast after fire</option>
                <option value="windUp">Kaiju: fast while glowing</option>
                <option value="off">Kaiju: steady speed</option>
              </select>
              {isEditingTiles && (
                <TileEditor
                  key={`${level.id} ${matchCount}`}
                  levelId={level.id}
                  playWindow={playWindow}
                  onSaved={playSavedLevel}
                  onCancel={() => setIsEditing(false)}
                />
              )}
            </PhaseToggles>
          )}
          <GameFrame data-game-frame>
            <PlayWindow playWindow={playWindow} setPlayWindow={updatePlayWindow} isAdjusting={isAdjustingWindow} isOpen={isWindowOpen} isCut={!!recruitScene} isSiren={!!level.kaijuEntry && winner === null && !isPaused} buttons={!isEditingTiles && (
              <>
                <BezelButton title="Pause" onClick={handleClickPause}>Pause</BezelButton>
                <BezelButton title="How to play" onClick={openControls}>Controls</BezelButton>
                <BezelButton title="Goodbye!" onClick={handleClickHome}>Leave</BezelButton>
                {!isWindowOpen && level.kaijuEntry && !isCutscene && !recruitScene && (
                  <KaijuCounter count={kaijuKillCount} toWin={kaijuToWin} />
                )}
              </>
            )}>
              {/* for a Lab screen, the scene slides away inside the monitor, and the screen takes its place there */}
              <SlideClip><SlideAway style={leavingFor ? { transform: `translateX(${leavingFor == "colors" ? -45 : 45}%)`, opacity: 0 } : undefined}>
              <GameBoard
                key={`${level.id} ${matchCount}`}
                choiceFromRef={recruitChoiceFrom}
                // a line in the log: they shake once it shows there. a balloon (a shout across the street) shows at once
                speakingPieceIndex={isMonitorAlways && !isLogBuilt && !(speech && speech.isShout) ? undefined : speakingPieceIndex}
                isWindowOpen={isWindowOpen}
                isPaused={isPaused}
                gameManager={gameManager.current}
                level={level}
                activePhases={activePhases as Array<string>}
                isWholeScene={isWholeScene}
                playWindow={playWindow}
                isShowingWindowSize={isAdjustingWindow}
                isEditingTiles={isEditingTiles}
                isMouseLook={isMouseLook}
                isEnemyZoom={isEnemyZoom}
                isTeamColors={isTeamColors}
                isSlowMotion={winner !== null && !level.isWalkingLevel}
                speech={speech}
                recruitScene={recruitScene}
                recruitChoice={recruitChoice}
                onChooseRecruit={handleChooseRecruit}
                onHotspot={openLabScreen}
              />
              </SlideAway></SlideClip>
              {matchEnd && (
                <EndScreen>
                  {matchEnd.isFinale ? <FinaleCredits title={matchEnd.title} onDone={handleClickHome} /> : <EndTitle>{matchEnd.title}</EndTitle>}
                  {(!level.rival || winner !== GameResult.PlayerWon) && <EndButtons>{matchEnd.buttons.map(({ text, onClick }, index) => <EndButton key={text} data-enter={index == 0 ? "" : undefined} onClick={onClick}>{text}</EndButton>)}</EndButtons>}
                </EndScreen>
              )}
              {isWiping && <ScreenClip><BlackWipe /></ScreenClip>}
              {unlockMessage && <UnlockStack><UnlockCard style={{ position: "static", transform: "none" }}><UnlockPortrait src={unlockImage} />{unlockMessage}</UnlockCard></UnlockStack>}
              {fadeCards && <FadeToBlack><CardStack>{fadeCards.map(({ label, image, power }, index) => (
                <Toast key={label} style={{ animationDelay: `${0.4 + index * 0.45}s` }}>
                  {power ? (() => {
                    const look = getPowerLook(power);
                    return look ? <PowerTile style={{ background: look.color }}><i className={`fa ${look.activeIcon}`} /></PowerTile> : null;
                  })() : image && <UnlockPortrait src={image} />}
                  {label}
                </Toast>
              ))}</CardStack></FadeToBlack>}
              {campaignIndex !== null && level.isWalkingLevel && !level.sites && !level.exit && !level.walkIn && !isEditingTiles && (
                <ContinueButton data-enter onClick={() => showSection(campaignIndex + 1)}>Continue</ContinueButton>
              )}
              {!isAutoRecruits && !level.isWalkingLevel && !isEditingTiles && !recruitScene && winner === null && getCallableRecruits().length > 0 && (
                <RecruitCalls key={matchCount} recruits={getCallableRecruits()} onCall={avatar => !!gameManager.current && gameManager.current.callRecruit(avatar)} isDisabled={isPaused} />
              )}
            </PlayWindow>
            {labScreen == "colors" && <IrradiationVat avatar={selectedAvatar} startColor={getAvatarColor(selectedAvatar) || PIECES_INFO[selectedAvatar].color} onIrradiate={irradiate} onClose={closeLabScreen} />}
            {isShowingControls && <ControlsOverlay onClose={closeControls} />}
            <DialogueLogPanel
              footer={recruitScene && isMonitorAlways && isRecruitTalkDone && (
                <>
                  {["recruit", "terminate"].map(choice => (
                    <ChoiceButton key={choice} choice={choice} recruitChoice={recruitChoice} onChooseRecruit={(chosen, box) => { recruitChoiceFrom.current = box; handleChooseRecruit(chosen); }} />
                  ))}
                </>
              )}
              entries={dialogueLog}
              isWaiting={isDialogueWaiting}
              isVisible={labScreen != "colors" && (isCutscene || !!recruitScene || isTalking)} // paused, it stays as it was (Jamie)
              onContinue={() => gameManager.current && gameManager.current.advanceDialogue()}
              onBuilt={setIsLogBuilt}
              onClosing={isClosing => {
                setIsLogClosing(isClosing);
                // a fight waits for the log to finish coming apart before it starts
                if (isClosing && gameManager.current && !level.isWalkingLevel) gameManager.current.holdFor(BREAK_TOTAL_MS);
              }}
            />
            {!isEditingTiles && !isLogClosing && <UI
              players={players}
              recruits={recruits}
              kaijuKillCount={kaijuKillCount}
              kaijuKilledToWin={kaijuToWin}
              isKaijuLevel={!!level.kaijuEntry}
              isCountOnBezel={!isWindowOpen}
              isShowingHuds={!level.isWalkingLevel && !isCutscene && !recruitScene}
              isShowingTopBar={!isCutscene && !recruitScene}
              isPaused={isPaused}
            />}
          </GameFrame>
        </GameArea>)
  );

  return <>{screen}{sceneFades}{devShowButton}</>;
};
