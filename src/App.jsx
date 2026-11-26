import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Home } from "./Home";
import { SplashScreen } from "./Components/SplashScreen";
import { CloudTransition, CLOUD_TIMING } from "./Components/CloudTransition";
import { loadAssets } from "./Utils/assetLoader";
import { watchSafeArea } from "./Utils/stage";
import { installEyeCursor } from "./Utils/eyeCursor";
import { installUiSounds } from "./Utils/uiSounds";
import "./App.css";
import "./font-awesome-4.7.0/css/font-awesome.css";
import "./font-awesome-7.3.1/fa7.css";

// a tool for making levels. it is not part of the built game.
const isLevelEditor = import.meta.env.DEV && window.location.pathname == "/level-editor";
const LevelEditor = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/Levels/LevelEditor").then(({ LevelEditor }) => ({ default: LevelEditor }))) : null;
// every line of the story, to read and edit. it is not part of the built game either.
const isDialogueViewer = import.meta.env.DEV && window.location.pathname == "/dialogue";
// picking a class name for each power combo. not part of the built game.
const isClassReview = import.meta.env.DEV && window.location.pathname == "/classes";
const ClassReview = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/ClassReview/ClassReview").then(({ ClassReview }) => ({ default: ClassReview }))) : null;
// laying out the room behind the Kaiju-Vision by hand (Jamie, 2026-11-24). not part of the built game.
const isApartmentMockup = import.meta.env.DEV && window.location.pathname == "/apartment";
const ApartmentMockup = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/ApartmentMockup/ApartmentMockup").then(({ ApartmentMockup }) => ({ default: ApartmentMockup }))) : null;
// the tab icon tool (dev only, Jamie 2026-11-25)
const isIconTool = import.meta.env.DEV && window.location.pathname == "/icon";
const IconTool = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/IconTool/IconTool").then(({ IconTool }) => ({ default: IconTool }))) : null;
// the sound review: every proposed sound effect to hear and judge (dev only, Jamie 2026-11-25)
const isSoundReview = import.meta.env.DEV && window.location.pathname == "/sounds";
const SoundReview = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/SoundReview/SoundReview").then(({ SoundReview }) => ({ default: SoundReview }))) : null;
// the music review: every theme in both styles, to hear and judge (dev only, Jamie 2026-11-26)
const isMusicReview = import.meta.env.DEV && window.location.pathname == "/music";
const MusicReview = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/MusicReview/MusicReview").then(({ MusicReview }) => ({ default: MusicReview }))) : null;
const DialogueViewer = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/Dialogue/DialogueViewer").then(({ DialogueViewer }) => ({ default: DialogueViewer }))) : null;

// the stage's safe area, for everything sized from it (Utils/stage.js: layout phase 1)
watchSafeArea();
installEyeCursor(); // (the eye over the apartment: Jamie, 2026-11-25)
// every button's hover tick and click (Jamie, 2026-11-26), but on the sound and music reviews (their buttons play sounds)
if (!isSoundReview && !isMusicReview) installUiSounds();

const SPLASH_FADE_MS = 700;
const SPLASH_MIN_MS = 1500;

const App = () => {
  const [shouldPlayAnim, setShouldPlayAnim] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const isTransitioning = useRef(false);

  // show splash screen for 5 seconds on first load of site; then its words and logo fade out and the landing fades in
  // (Jamie, 2026-11-16: no clouds here, they're in the landing's zoom now)
  // (Jamie, playtest 29: until the landing's own images are in, the landing, the zoom, the room and the pre-game screens,
  // and at least SPLASH_MIN_MS; was a flat 5 s)
  const [isSplashLeaving, setIsSplashLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let isCancelled = false;
    const minimum = new Promise(resolve => setTimeout(resolve, SPLASH_MIN_MS));
    Promise.all([loadAssets("landing", share => !isCancelled && setProgress(share)), minimum]).then(() => {
      if (isCancelled) return;
      setIsSplashLeaving(true);
      setTimeout(() => setIsFirstLoad(false), SPLASH_FADE_MS);
    });
    return () => { isCancelled = true; };
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
    callback && setTimeout(() => callback(), CLOUD_TIMING.coveredMs);
  };

  const appContent = isFirstLoad
    ? <div className="app-page" style={{ opacity: isSplashLeaving ? 0 : 1, transition: `opacity ${SPLASH_FADE_MS}ms ease-out` }}><SplashScreen progress={progress} /></div>
    : <div className={isSplashLeaving ? "app-page landing-fade-in" : "app-page"}><Home triggerTransition={triggerTransition} /></div>;

  if (isLevelEditor) return <Suspense fallback={null}><LevelEditor /></Suspense>;
  if (isDialogueViewer) return <Suspense fallback={null}><DialogueViewer /></Suspense>;
  if (isClassReview) return <Suspense fallback={null}><ClassReview /></Suspense>;
  if (isApartmentMockup) return <Suspense fallback={null}><ApartmentMockup /></Suspense>;
  if (isIconTool) return <Suspense fallback={null}><IconTool /></Suspense>;
  if (isSoundReview) return <Suspense fallback={null}><SoundReview /></Suspense>;
  if (isMusicReview) return <Suspense fallback={null}><MusicReview /></Suspense>;

  return (
    <div className="App">
      <CloudTransition isPlaying={shouldPlayAnim} />
      {appContent}
    </div>
  );
};

export default App;
