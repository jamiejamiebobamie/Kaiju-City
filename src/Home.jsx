import React, { useState, useEffect, createContext } from "react";
import { MainMenu } from "./MainMenu";
import { ZOOM_BACK } from "./Components/ZoomThrough";
import { Game } from "./Game/ReactComponents/Game";
import { Settings } from "./Settings/Settings";
import { SettingsManager } from "./Game/DataClasses/SettingsManager";
import { loadTeamAvatars } from "./Game/DataClasses/Avatars";

const PAGES = Object.freeze({
  Home: 'Home',
  Game: 'Game',
  Settings: 'Settings'
});

export const Difficulty = Object.freeze({
  Easy: 1,
  Medium: 2,
  Hard: 3,
  Xtreme: 4
});

export const GlobalSettingsContext = createContext({
  settingsManager: undefined,
  selectedAvatar: "guy",
  setSelectedAvatar: _avatar => { },
  selectedTeammate: "girl",
  setSelectedTeammate: _avatar => { },
  isAvatarChangedOnce: false,
  setIsAvatarChangedOnce: () => { },
  selectedDifficulty: Difficulty.Hard,//Medium,
  setSelectedDifficulty: () => { },
});

export const Home = ({ triggerTransition }) => {
  const [settingsManager] = useState(() => new SettingsManager());
  const [selectedAvatar, setSelectedAvatar] = useState(() => loadTeamAvatars().player || "guy");
  const [selectedTeammate, setSelectedTeammate] = useState(() => loadTeamAvatars().teammate || "girl");
  const [selectedDifficulty, setSelectedDifficulty] = useState(Difficulty.Hard);
  const [isAvatarChangedOnce, setIsAvatarChangedOnce] = useState(false);
  const [currPage, setCurrPage] = useState(PAGES.Home);
  // Quit in a game: the game page made anew, its monitor booting to the start screen (Game's quitToStart. Jamie, 2026-11-25)
  const [gameKey, setGameKey] = useState(0);
  // the landing slides in from the right when the view shifts back to it from the monitor (the end of the game)
  const [isLandingShifting, setIsLandingShifting] = useState(false);
  const handleShiftHome = () => {
    setIsLandingShifting(true);
    handleClickHome();
  };

  const handleClickHome = () => {
    setCurrPage(PAGES.Home)
    window.history.pushState({}, "Kaiju City", `/home${window.location.search}`); // (keeps the address's ?settings: the dev trials ?screen= and ?zoom= were lost here)
  };
  const handleClickGame = () => {
    setCurrPage(PAGES.Game)
    window.history.pushState({}, "Kaiju City", `/game${window.location.search}`);
  };
  const handleClickSettings = () => {
    setCurrPage(PAGES.Settings)
    window.history.pushState({}, "Kaiju City", "/settings");
  };

  const { pathname } = window.location;
  useEffect(() => {
    switch (pathname) {
      case "/game":
        currPage != PAGES.Game && handleClickGame();
        break;
      case "/settings":
        currPage != PAGES.Settings && handleClickSettings();
        break;
      default:
        handleClickHome();
    }
  }, [pathname]);

  return <GlobalSettingsContext.Provider
            value={{
              settingsManager,
              selectedAvatar,
              setSelectedAvatar,
              selectedTeammate,
              setSelectedTeammate,
              isAvatarChangedOnce,
              setIsAvatarChangedOnce,
              selectedDifficulty,
              setSelectedDifficulty,
              isLandingShifting,
              setIsLandingShifting
            }}>
    {currPage == PAGES.Settings ? (
        <Settings
          triggerTransition={triggerTransition}
          handleClickHome={() => triggerTransition(handleClickHome)}
          handleClickGame={() => triggerTransition(handleClickGame)}
        />
      ) : currPage == PAGES.Game ? (
        <Game
          key={gameKey}
          handleQuitToStart={() => setGameKey(key => key + 1)}
          triggerTransition={triggerTransition}
          handleClickHome={() => triggerTransition(handleClickHome)}
          handleZoomHome={() => { ZOOM_BACK.isPending = true; handleClickHome(); } /* Leave: the zoom backwards (Jamie) */}
          handleShiftHome={handleShiftHome}
        />
      ) : (
        <MainMenu
          handleClickGame={() => triggerTransition(handleClickGame)}
          playClouds={() => triggerTransition()}
          enterRoom={handleClickGame /* the zoom ends in the room, the monitor in its spot: no clouds (Jamie) */}
          handleClickSettings={() => triggerTransition(handleClickSettings)}
        />
      )}
  </GlobalSettingsContext.Provider>
};
