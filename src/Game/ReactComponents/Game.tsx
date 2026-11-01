import React, { useState, useEffect, useRef, useContext } from "react";
import styled from "styled-components";
import { useSnapshot } from "valtio";
import { GlobalSettingsContext } from "Home";
import { GameBoard } from "./GameBoard/GameBoard";
import { FULL_WINDOW, loadPlayWindow, PlayWindow, PORTRAIT_WINDOW, savePlayWindow } from "./GameBoard/PlayWindow";
import { UI } from "./UI/UI";
import { AbilityPicker } from "./AbilityPicker";
import { useKeyPress } from "Utils/utils";
import { ABILITY_KEY_MAPPINGS, GAME_TICK } from "Utils/gameState";
import { FullscreenPage } from "Components/FullscreenPage.jsx";
import { GameManager, GameResult } from '../DataClasses/GameManager';
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

const MATCH_END_DELAY_MS = 2000;

export const Game = ({ handleClickHome, triggerTransition }) => {
  const { selectedAvatar, selectedDifficulty, settingsManager } = useContext(GlobalSettingsContext);
  const { isPaused, winner, isPlayerDead, players, kaijuKillCount, kaijuToWin, activePhases, isWideShot } = useSnapshot(gameUiStore);

  const [levelId, setLevelId] = useState(new URLSearchParams(window.location.search).get('level') || PENINSULA.id);
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

  const endMatch = () => {
    if (gameLoop.current) gameLoop.current.stop();
    gameLoop.current = null;
    gameManager.current = null;
  };

  // the game stops when the player leaves the page
  useEffect(() => endMatch, []);

  const startMatch = (matchLevel = level) => {
    settingsManager.updatePlayerAvatar(selectedAvatar);
    settingsManager.setDifficulty(selectedDifficulty);
    settingsManager.setIsTeammate(isTeammate);

    const gm = new GameManager({ level: matchLevel, settingsManager });
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
  };

  // dev testing: changes level, and a match in progress restarts on it with the same powers
  const switchLevel = id => {
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

  const handleClickPlay = () => {
    setFullScreenPageData({
      text: ["Wild Kaiju have appeared!"],
      buttons: [{ text: "Fight!", onClick: () => startMatch() }],
      image: { src: './story_images/match_start.png', width: '535px', height: '535px' }
    });
    triggerTransition(() => setIsPlayingGame(true));
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
    const playAgainButtons = [{ text: "Yes", onClick: () => triggerTransition(resetMatch) }, { text: "No", onClick: handleClickHome }];
    const page = winner === GameResult.PlayerWon ?
      { text: ["You saved the city!", "Play again ?"], buttons: playAgainButtons, image: { src: './story_images/match_won.png', width: '535px', height: '535px' } }
      : { text: ["You lost...", "Play again ?"], buttons: playAgainButtons, image: { src: './story_images/match_lost.png', width: '535px', height: '535px' } };
    const timeoutRef = setTimeout(() => setFullScreenPageData(page), MATCH_END_DELAY_MS);
    return () => clearTimeout(timeoutRef);
  }, [winner, isPlayingGame]);

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
              />
            </PlayWindow>
            {import.meta.env.DEV && (
              <PhaseToggles style={isEditingTiles && isEditorPanelOnRight ? { left: 'auto', right: '1cqw' } : undefined}>
                <select aria-label="Level" value={level.id} onChange={e => { switchLevel(e.target.value); e.target.blur(); }}>
                  {levelOptions}
                </select>
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
