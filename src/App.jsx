import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Home } from "./Home";
import { SplashScreen } from "./Components/SplashScreen";
import { CloudTransition, CLOUD_TIMING } from "./Components/CloudTransition";
import "./App.css";
import "./font-awesome-4.7.0/css/font-awesome.css";
import "./font-awesome-7.3.1/fa7.css";

// a tool for making levels. it is not part of the built game.
const isLevelEditor = import.meta.env.DEV && window.location.pathname == "/level-editor";
const LevelEditor = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/Levels/LevelEditor").then(({ LevelEditor }) => ({ default: LevelEditor }))) : null;
// every line of the story, to read and edit. it is not part of the built game either.
const isDialogueViewer = import.meta.env.DEV && window.location.pathname == "/dialogue";
const DialogueViewer = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/Dialogue/DialogueViewer").then(({ DialogueViewer }) => ({ default: DialogueViewer }))) : null;

const App = () => {
  const [shouldPlayAnim, setShouldPlayAnim] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const isTransitioning = useRef(false);

  // show splash screen for 5 seconds on first load of site
  useEffect(() => {
    const timeoutRef = setTimeout(() => {
      setTimeout(() => setIsFirstLoad(false), 750);
      triggerTransition();
    }, 5000);
    return () => clearTimeout(timeoutRef);
  }, []);

  const triggerTransition = callback => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setShouldPlayAnim(true);
    const { inMs, holdMs, outMs } = CLOUD_TIMING;
    setTimeout(() => {
      isTransitioning.current = false;
      setShouldPlayAnim(false);
    }, inMs + holdMs + outMs);
    // the next screen is made once the clouds cover the whole screen
    callback && setTimeout(() => callback(), inMs + 30);
  };

  const appContent = isFirstLoad ? <SplashScreen /> : <Home triggerTransition={triggerTransition} />;

  if (isLevelEditor) return <Suspense fallback={null}><LevelEditor /></Suspense>;
  if (isDialogueViewer) return <Suspense fallback={null}><DialogueViewer /></Suspense>;

  return (
    <div className="App">
      <CloudTransition isPlaying={shouldPlayAnim} />
      {appContent}
    </div>
  );
};

export default App;
