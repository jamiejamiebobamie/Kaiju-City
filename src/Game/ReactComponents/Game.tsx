import React, { useState, useEffect, useRef, useContext } from "react";
import styled, { keyframes } from "styled-components";
import { useSnapshot } from "valtio";
import { GlobalSettingsContext } from "Home";
import { GameBoard } from "./GameBoard/GameBoard";
import { FULL_WINDOW, loadPlayWindow, PlayWindow, PORTRAIT_WINDOW, savePlayWindow } from "./GameBoard/PlayWindow";
import { UI } from "./UI/UI";
import { RadioCall } from "./RadioCall";
import { AbilityPicker } from "./AbilityPicker";
import { useKeyPress } from "Utils/utils";
import { ABILITY_KEY_MAPPINGS, GAME_TICK } from "Utils/gameState";
import { FullscreenPage } from "Components/FullscreenPage.jsx";
import { GameManager, GameResult } from '../DataClasses/GameManager';
import { addUnlock, getRecruitChoices, saveRecruitChoice } from '../DataClasses/Unlocks';
import { CAMPAIGN_SECTIONS, getIsLastSection } from '../DataClasses/Campaign';
import { GameLoop } from '../DataClasses/GameLoop';
import { applyLevelFile, LEVELS, PENINSULA } from '../DataClasses/Levels/levels';
import { TileEditor } from './Levels/TileEditor';
import { gameUiStore, publishGameUi, resetGameUi } from '../DataClasses/gameUiStore';

const GameArea = styled.div`
  position: relative;
  width: 100dvw;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a1224;
`;

// everything in the game sits in this box, and scales with it
const GameFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  max-width: calc(100dvh * 16 / 9);
  max-height: 100dvh;
  overflow: hidden;
  container-type: inline-size;
  background: #000;
  @media (orientation: portrait) {
    aspect-ratio: auto;
    height: 100dvh;
    max-width: none;
  }
`;

const PhaseToggles = styled.div`
  position: absolute;
  top: 4.5cqw;
  left: 1cqw;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 0.3cqw;
  padding: 0.5cqw 0.8cqw;
  border-radius: 0.4cqw;
  font-size: 1.2cqw;
  color: #dfe;
  background: rgba(0, 0, 0, 0.6);
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

// a notice that comes and goes on its own, in the style of the speech bubbles
const UnlockCard = styled.div`
  position: absolute;
  top: 1.2cqw;
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

const UnlockPortrait = styled.img`
  width: 3cqw;
  height: 4cqw;
  object-fit: cover;
  object-position: 50% 0;
  image-rendering: pixelated;
`;

const EndScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3cqw;
`;

const titleArrive = keyframes`
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
`;

const EndTitle = styled.div`
  font-family: gameboy;
  font-size: 6.5cqw;
  text-transform: uppercase;
  text-align: center;
  color: #ff2a4d;
  -webkit-text-stroke: 0.12cqw #ffb3c4;
  text-shadow: 0 0 0.6cqw #ff5c8a, 0.25cqw 0.25cqw 0 #5c0013, 0 0 2.5cqw #ff0040;
  animation: ${titleArrive} 1.4s ease-out both;
`;

const EndButtons = styled.div`
  display: flex;
  gap: 1cqw;
`;

const EndButton = styled.button`
  padding: 0.7cqw 1.6cqw;
  font-family: gameboy;
  font-size: 1.4cqw;
  cursor: pointer;
  color: #fbfbf0;
  background: #5c0013;
  border: 0.2cqw solid #ff5c8a;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
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

const RECRUIT_TIMING = {
  titleMs: 2800, // how long the title and slow motion last before the choice
  confirmMs: 900,
  cardMs: 3800
};

const RECRUIT_CARDS = {
  punk: { avatar: 'punk', label: 'Punk' },
  black_female: { avatar: 'black_female', label: 'New recruit' },
  mermaid: { avatar: 'mermaid', label: 'Mermaid' }
};

export const Game = ({ handleClickHome, triggerTransition }) => {
  const { selectedAvatar, selectedDifficulty, settingsManager } = useContext(GlobalSettingsContext);
  const { isPaused, winner, isPlayerDead, players, kaijuKillCount, kaijuToWin, activePhases, isWideShot, unlockMessage, unlockImage, speech, recruitScene } = useSnapshot(gameUiStore);

  const startingLevelId = new URLSearchParams(window.location.search).get('level');
  const [levelId, setLevelId] = useState(startingLevelId || PENINSULA.id);
  const [campaignIndex, setCampaignIndex] = useState(startingLevelId ? null : 0); // null: playing one level on its own
  const level = LEVELS[levelId] || PENINSULA;
  const togglePhase = id => {
    gameManager.current.togglePhase(id);
    publishGameUi(gameManager.current.getUiState());
  };

  const gameManager = useRef<any>(null);
  const gameLoop = useRef<GameLoop | null>(null);

  const [isTeammate, setIsTeammate] = useState(true);
  const [isWholeScene, setIsWholeScene] = useState(false);
  const [isMouseLook, setIsMouseLook] = useState(true);
  const [isEnemyZoom, setIsEnemyZoom] = useState(true);
  const [isAdjustingWindow, setIsAdjustingWindow] = useState(false);
  const [playWindow, setPlayWindow] = useState(() => import.meta.env.DEV ? loadPlayWindow() : FULL_WINDOW);
  const updatePlayWindow = next => {
    setPlayWindow(next);
    savePlayWindow(next);
  };
  const [isEditingTiles, setIsEditingTiles] = useState(false);
  const [isEditorPanelOnRight, setIsEditorPanelOnRight] = useState(false);
  const [matchCount, setMatchCount] = useState(0); // the board starts fresh with each match
  const [pickedAbilities, setPickedAbilities] = useState([]);
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [fullScreenPageData, setFullScreenPageData] = useState(undefined);
  const [radioLines, setRadioLines] = useState(undefined);
  const [matchEnd, setMatchEnd] = useState(undefined); // the title over the board once a match is decided
  const [recruitChoice, setRecruitChoice] = useState(undefined);
  const [fadeCard, setFadeCard] = useState(undefined); // the screen is fading to black, and this is the unlock shown on it

  const endMatch = () => {
    if (gameLoop.current) gameLoop.current.stop();
    gameLoop.current = null;
    gameManager.current = null;
  };

  // the game stops when the player leaves the page
  useEffect(() => endMatch, []);

  const startMatch = (matchLevel = level, hasArrival = false) => {
    settingsManager.updatePlayerAvatar(selectedAvatar);
    settingsManager.setDifficulty(selectedDifficulty);
    settingsManager.setIsTeammate(isTeammate);

    const gm = new GameManager({ level: matchLevel, settingsManager, hasArrival });
    gm.initGame();
    gameManager.current = gm;
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
    setIsEditingTiles(false);
    setMatchCount(count => count + 1);
    setFullScreenPageData(undefined);
    setRadioLines(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCard(undefined);
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
      choices: getRecruitChoices()
    };
  };

  const showSection = index => {
    const { levelId: sectionLevelId, radio } = CAMPAIGN_SECTIONS[index];
    endMatch();
    resetGameUi();
    setCampaignIndex(index);
    setLevelId(sectionLevelId);
    setFullScreenPageData(undefined);
    setMatchEnd(undefined);
    setRecruitChoice(undefined);
    setFadeCard(undefined);
    if (radio) setRadioLines(radio(getRadioContext()));
    else startMatch(LEVELS[sectionLevelId]);
  };

  // goes back through the ability picker, which returns to this section's call
  const handleChangePowers = () => {
    setRadioLines(undefined);
    setIsPlayingGame(false);
  };

  const handleClickPlay = () => {
    if (campaignIndex !== null) {
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
    if (campaignIndex === null) {
      return { title, buttons: [{ text: "Play again", onClick: () => triggerTransition(resetMatch) }, { text: "Leave", onClick: handleClickHome }] };
    }
    if (!isWon) {
      return { title, buttons: [{ text: "Try again", onClick: () => showSection(campaignIndex) }, { text: "Leave", onClick: handleClickHome }] };
    }
    if (getIsLastSection(campaignIndex)) {
      return { title: "You saved the city!", buttons: [{ text: "Play again", onClick: () => { setCampaignIndex(0); triggerTransition(resetMatch); } }, { text: "Leave", onClick: handleClickHome }] };
    }
    return { title, buttons: [{ text: "Continue", onClick: () => showSection(campaignIndex + 1) }] };
  };

  const leaveLevel = () => {
    if (campaignIndex !== null) showSection(campaignIndex + 1);
    else triggerTransition(resetMatch);
  };

  // confirmed, then fade to black, then the recruit's avatar: unlocked whichever way the player chose
  const handleChooseRecruit = choice => {
    if (recruitChoice) return;
    const { avatar, label } = RECRUIT_CARDS[level.rival.avatar];
    setRecruitChoice(choice);
    saveRecruitChoice(level.rival.avatar, choice);
    addUnlock(level.rival.avatar);
    setTimeout(() => setFadeCard({ label: `${label} unlocked!`, image: `/levels/portraits/${avatar}.png` }), RECRUIT_TIMING.confirmMs);
    setTimeout(leaveLevel, RECRUIT_TIMING.confirmMs + RECRUIT_TIMING.cardMs);
  };

  const handleClickPause = () => {
    if (!gameManager.current || winner !== null) return;
    gameManager.current.togglePauseGame();
    publishGameUi(gameManager.current.getUiState());
  };

  const handleUseAbility = (playerIndex, abilityIndex) => {
    if (!gameManager.current || isPaused || level.isWalkingLevel) return;
    gameManager.current.getPlayerInputHandler().usePlayerAbilityFromIndex(playerIndex * 3 + abilityIndex, gameManager.current.getAccTime());
  };

  useKeyPress({ keyCodes: "Escape", keyUpCallback: handleClickPause, isCharacterDead: false });

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
    keyCodes: ABILITY_KEY_MAPPINGS,
    keyDownCallback: code => gameManager.current && gameManager.current.getPlayerInputHandler().usePlayerAbility(code, gameManager.current.getAccTime()),
    isCharacterDead: isPaused || level.isWalkingLevel
  });

  useEffect(() => {
    if (winner === null || !isPlayingGame) return;
    if (level.isWalkingLevel) {
      leaveLevel();
      return;
    }
    const isWon = winner === GameResult.PlayerWon;
    const titleTimeoutRef = setTimeout(() => setMatchEnd(getMatchEnd(isWon)), MATCH_END_DELAY_MS);
    if (!isWon || !level.rival) return () => clearTimeout(titleTimeoutRef);

    const sceneTimeoutRef = setTimeout(() => {
      setMatchEnd(undefined);
      gameManager.current.startRecruitScene();
      publishGameUi(gameManager.current.getUiState());
    }, MATCH_END_DELAY_MS + RECRUIT_TIMING.titleMs);
    return () => {
      clearTimeout(titleTimeoutRef);
      clearTimeout(sceneTimeoutRef);
    };
  }, [winner, isPlayingGame, campaignIndex]);

  return (
    !isPlayingGame ?
      <>
      {import.meta.env.DEV && (
        <LevelPicker value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
          {levelOptions}
        </LevelPicker>
      )}
      <AbilityPicker
        handleClickHome={handleClickHome}
        pickedAbilities={pickedAbilities}
        setPickedAbilities={setPickedAbilities}
        handleClickPlay={handleClickPlay}
        playerData={[]}
        numAbilitiesToPick={3}
        isTeammate={isTeammate}
        setIsTeammate={setIsTeammate}
      />
      </>
      : radioLines ?
        <RadioCall
          key={campaignIndex}
          lines={radioLines}
          playerAvatar={selectedAvatar}
          onGo={() => startMatch(LEVELS[CAMPAIGN_SECTIONS[campaignIndex].levelId], CAMPAIGN_SECTIONS[campaignIndex].hasArrival)}
          onChangePowers={handleChangePowers}
        />
      : fullScreenPageData ?
        <FullscreenPage
          text={fullScreenPageData.text}
          buttons={fullScreenPageData.buttons}
          image={fullScreenPageData.image}
        />
        : !gameManager.current ? null : (<GameArea>
          <GameFrame data-game-frame>
            <PlayWindow playWindow={playWindow} setPlayWindow={updatePlayWindow} isAdjusting={isAdjustingWindow} isOpen={isWideShot || level.isWalkingLevel}>
              <GameBoard
                key={`${level.id} ${matchCount}`}
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
                isSlowMotion={winner === GameResult.PlayerWon && !level.isWalkingLevel}
                speech={speech}
                recruitScene={recruitScene}
                recruitChoice={recruitChoice}
                onChooseRecruit={handleChooseRecruit}
              />
            </PlayWindow>
            {import.meta.env.DEV && (
              <PhaseToggles style={isEditingTiles && isEditorPanelOnRight ? { left: 'auto', right: '1cqw' } : undefined}>
                <select aria-label="Level" value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
                  {levelOptions}
                </select>
                <select aria-label="Section" value={campaignIndex ?? ""} onChange={e => { showSection(Number(e.target.value)); e.target.blur(); }}>
                  {campaignIndex === null && <option value="">Campaign section</option>}
                  {CAMPAIGN_SECTIONS.map(({ label }, index) => <option key={label} value={index}>{index + 1}. {label}</option>)}
                </select>
                {campaignIndex !== null && !getIsLastSection(campaignIndex) && <button onClick={() => showSection(campaignIndex + 1)}>Skip section</button>}
                {level.phases.map(({ id, label }) => (
                  <label key={id}>
                    <input type="checkbox" checked={activePhases.includes(id)} onChange={() => togglePhase(id)} /> {label}
                  </label>
                ))}
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
                  <input type="checkbox" checked={isAdjustingWindow} onChange={() => setIsAdjustingWindow(!isAdjustingWindow)} /> Adjust window
                </label>
                {isAdjustingWindow && <button onClick={() => updatePlayWindow(PORTRAIT_WINDOW)}>Portrait window</button>}
                {isAdjustingWindow && <button onClick={() => updatePlayWindow(FULL_WINDOW)}>Full window</button>}
                <label>
                  <input type="checkbox" checked={isEditingTiles} onChange={() => setIsEditing(!isEditingTiles)} /> Edit tiles
                </label>
                {isEditingTiles && (
                  <TileEditor
                    key={`${level.id} ${matchCount}`}
                    levelId={level.id}
                    playWindow={playWindow}
                    onSaved={playSavedLevel}
                    onCancel={() => setIsEditing(false)}
                    onMovePanel={() => setIsEditorPanelOnRight(!isEditorPanelOnRight)}
                  />
                )}
              </PhaseToggles>
            )}
            {unlockMessage && <UnlockCard><UnlockPortrait src={unlockImage} />{unlockMessage}</UnlockCard>}
            {matchEnd && !level.rival && (
              <EndScreen>
                <EndTitle>{matchEnd.title}</EndTitle>
                <EndButtons>{matchEnd.buttons.map(({ text, onClick }) => <EndButton key={text} onClick={onClick}>{text}</EndButton>)}</EndButtons>
              </EndScreen>
            )}
            {matchEnd && level.rival && (
              <EndScreen>
                <EndTitle>{matchEnd.title}</EndTitle>
                {winner !== GameResult.PlayerWon && <EndButtons>{matchEnd.buttons.map(({ text, onClick }) => <EndButton key={text} onClick={onClick}>{text}</EndButton>)}</EndButtons>}
              </EndScreen>
            )}
            {fadeCard && <FadeToBlack><UnlockCard style={{ position: "static", transform: "none" }}><UnlockPortrait src={fadeCard.image} />{fadeCard.label}</UnlockCard></FadeToBlack>}
            {campaignIndex !== null && level.isWalkingLevel && !level.goalTiles.length && !level.exit && !isEditingTiles && (
              <ContinueButton onClick={() => showSection(campaignIndex + 1)}>Continue</ContinueButton>
            )}
            {!isEditingTiles && <UI
              players={players}
              kaijuKillCount={kaijuKillCount}
              kaijuKilledToWin={kaijuToWin}
              isKaijuLevel={!!level.kaijuEntry}
              isShowingHuds={!level.isWalkingLevel}
              handleClickHome={handleClickHome}
              handleClickPause={handleClickPause}
              onUseAbility={handleUseAbility}
              isPaused={isPaused}
            />}
          </GameFrame>
        </GameArea>)
  );
};
