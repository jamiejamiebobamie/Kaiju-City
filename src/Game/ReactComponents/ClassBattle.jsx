import React, { useEffect, useMemo, useState } from "react";
import { GameManager } from "../DataClasses/GameManager";
import { SettingsManager } from "../DataClasses/SettingsManager";
import { GameLoop } from "../DataClasses/GameLoop";
import { buildBattlePreviewLevel } from "../DataClasses/Levels/levels";
import { GAME_TICK } from "Utils/gameState";
import { GameBoard } from "./GameBoard/GameBoard";

/*
  The class's battle preview (Jamie, 2026-11-15): on the side monitor, under the class, the player's avatar with the
  three picked powers fights Kaiju on a little patch of hex tiles, a taste of the build. It's the game's own engine:
  a GameManager of its own on its own loop (not the game's UI store), on a rectangle of the Peninsula's grid (its tiles
  as big as the Peninsula's: Jamie). Kaiju come in from the left or right every 5 to 10 s. The avatar plays itself and
  can't die (its health never goes down; it doesn't show).
  'playWindow': the arena's place in the game frame, as fractions of it (the board sizes its view from it).
*/
// (the board as before the steadicam, so the Kaiju reach the avatar as soon: Jamie, playtest 28; room round it for the camera)
const PREVIEW_BOARD = { pad: 6 };
// (Kaiju seen whenever they're in the shot, their own rings lit as the avatar's: Jamie, playtest 28)
const PREVIEW_VIEW = { hexes: 9, hexRings: [1, 0.3] };

export const ClassBattle = ({ powers, avatar, playWindow }) => {
  // (Jamie, playtest 26: in close on the avatar, about 6 hexes round it, the camera following; a wider board for it to
  // roam, the Kaiju coming in from its sides, seen once within 3 tiles)
  // (only the avatar's tile and its neighbors, and the next ring dim: Jamie, playtest 27)
  const level = useMemo(() => ({ ...buildBattlePreviewLevel(PREVIEW_BOARD), hexRings: PREVIEW_VIEW.hexRings }), []);
  const [gameManager, setGameManager] = useState(null);
  const powersKey = powers.join(",");

  useEffect(() => {
    const settings = new SettingsManager();
    settings.playerAvatar = avatar;
    settings.setSortedPlayerChosenAbilityElementsString([...powers].sort((a, b) => a.localeCompare(b)));
    settings.setIsTeammate(false);
    const manager = new GameManager({ level, settingsManager: settings, killsToWin: 99999 });
    manager.initGame();
    // it plays itself, and can't be beaten
    const player = manager.gameBoardPiecesManager.getPlayerPiece();
    if (player) {
      player.isNpc = true;
      player.decrementHealth = () => {};
    }
    const loop = new GameLoop({
      steps: [
        { everyMs: GAME_TICK.pieceMs, run: () => manager.stepPieces() },
        { everyMs: GAME_TICK.tileMs, run: () => manager.stepTiles() }
      ],
      maxCatchUpMs: GAME_TICK.maxCatchUpMs,
      onAdvanced: () => manager.notifyBoard()
    });
    loop.start();
    setGameManager(manager);
    return () => {
      loop.stop();
      setGameManager(null);
    };
  }, [powersKey, avatar]);

  if (!gameManager) return null;
  return (
    <GameBoard
      key={powersKey}
      gameManager={gameManager}
      level={level}
      isPaused={false}
      isWindowOpen={false}
      activePhases={[]}
      isWholeScene={false}
      viewHexes={PREVIEW_VIEW.hexes}
      playWindow={playWindow}
      isShowingWindowSize={false}
      isEditingTiles={false}
      isMouseLook={false}
      isEnemyZoom={false}
      isTeamColors={true}
      controlMarker="outline"
      isSlowMotion={false}
      speech={undefined}
      recruitScene={undefined}
      recruitChoice={undefined}
      onChooseRecruit={() => {}}
      onHotspot={() => {}}
    />
  );
};
