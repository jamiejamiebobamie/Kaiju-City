import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Home } from "./Home";
import { SplashScreen } from "./Components/SplashScreen";
import styled, { css } from "styled-components";
import "./App.css";
import "./font-awesome-4.7.0/css/font-awesome.css";
import "./font-awesome-7.3.1/fa7.css";

const TransitionWrapper = styled.div`
  position: absolute;
  width: 100dvw;
  height: 100dvh;
  z-index: 2147483647;
  pointer-events: none;
`;
const TransitionStrip = styled.div`
  position: absolute;
  height: 150px;
  border-radius: 150px;
    // box-shadow: 3px 7px 10px black;
  ${props =>
    props.duration !== undefined && `z-index: ${2147483647 + props.duration};`}
  @keyframes moveRight {
    0% {
      right: -100dvw;
      width: 100dvw;
    }
    45% {
      right: 25dvw;
      ${props =>
    props.duration !== undefined && `width: ${90 / props.duration}dvw;`}
    }
    50% {
      right: 50dvw;
    }
    55% {
      right: 25dvw;
      ${props =>
    props.duration !== undefined && `width: ${90 / props.duration}dvw;`}
    }
    100% {
      right: -100dvw;
      width: 100dvw;
    }
  }

  @keyframes moveLeft {
    0% {
      left: -100dvw;
      width: 100dvw;
    }
    45% {
      left: 25dvw;
      ${props =>
    props.duration !== undefined && `width: ${90 / props.duration}dvw;`}
    }
    50% {
      left: 50dvw;
    }
    55% {
      left: 25dvw;
      ${props =>
    props.duration !== undefined && `width: ${90 / props.duration}dvw;`}
    }
    100% {
      left: -100dvw;
      width: 100dvw;
    }
  }

  ${props =>
    props.duration !== undefined && ` animation-duration: ${props.duration}s;`}
  ${props => props.top !== undefined && `top: ${props.top * 50}px;`}
  ${props =>
    props.shouldPlay &&
    css`
      ${props.isLeft
        ? `
      left: -100dvw;
      animation-name: moveLeft;
      // #c7e2fe
      // #b5d9fe
      // 181, 218, 254
      background: linear-gradient(to right, rgba(181, 218, 254, 1), rgba(181, 218, 254, 1));
      `
        : `
      right: 100dvw;
      animation-name: moveRight;
      background: linear-gradient(to left, rgba(181, 218, 254, 1), rgba(181, 218, 254, 1));
      `}
    `}
`;

// a tool for making levels. it is not part of the built game.
const isLevelEditor = import.meta.env.DEV && window.location.pathname == "/level-editor";
const LevelEditor = import.meta.env.DEV ? lazy(() => import("./Game/ReactComponents/Levels/LevelEditor").then(({ LevelEditor }) => ({ default: LevelEditor }))) : null;

const App = () => {
  const ANIM_DELAY_MILLI = 1500;
  const [transition, setTransition] = useState([]);
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

  useEffect(() => {
    const seconds = ANIM_DELAY_MILLI / 1000;
    const durations = Array(44)
      .fill(0)
      .map((_, i) => Math.random() * seconds + seconds);
    const transition = Array(44)
      .fill(0)
      .map((_, i) => (
        <TransitionStrip
          key={i}
          isLeft={!(i % 2)}
          duration={durations[i]}
          top={i - (i % 2) - 1}
          shouldPlay={shouldPlayAnim}
        />
      ));
    setTransition(transition);
  }, [shouldPlayAnim]);

  const triggerTransition = callback => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setShouldPlayAnim(true);
    setTimeout(() => {
      isTransitioning.current = false;
      setShouldPlayAnim(false);
    }, 3000);
    callback && setTimeout(() => callback(), 500);
  };

  const appContent = isFirstLoad ? <SplashScreen /> : <Home triggerTransition={triggerTransition} />;

  if (isLevelEditor) return <Suspense fallback={null}><LevelEditor /></Suspense>;

  return (
    <div className="App">
      <TransitionWrapper>{transition}</TransitionWrapper>
      {appContent}
    </div>
  );
};

export default App;
