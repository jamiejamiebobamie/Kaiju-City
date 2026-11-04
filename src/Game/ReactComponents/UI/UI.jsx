import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { PlayerUI } from "./PlayerUI/PlayerUI";

// the game width the HUDs are drawn for. they scale with the game from this size.
const HUD_DESIGN_WIDTH = 1200;

const TopBar = styled.div`
  position: absolute;
  top: 1cqw;
  left: 1cqw;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  gap: 1cqw;
  font-size: 1.5cqw;
  color: #71ff71;
  text-shadow: 0 0 0.3cqw black;
`;

const Huds = styled.div`
  position: absolute;
  top: 1cqw;
  right: 1cqw;
  z-index: 2147483646;
  width: 400px;
  display: flex;
  flex-direction: column;
  transform-origin: top right;
  pointer-events: none;
`;

export const UI = ({
  players,
  recruits,
  kaijuKillCount,
  kaijuKilledToWin,
  isKaijuLevel,
  isShowingHuds,
  isShowingTopBar = true,
  isPaused
}) => {
  const hudsRef = useRef(null);
  const [hudScale, setHudScale] = useState(1);
  const [, setDisplayString] = useState(null);

  useEffect(() => {
    const frame = hudsRef.current.parentElement;
    const observer = new ResizeObserver(() => setHudScale(frame.clientWidth / HUD_DESIGN_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* hidden in cutscenes, like the HUDs, so it never covers anyone's words */}
      <TopBar style={{ visibility: isShowingTopBar ? "visible" : "hidden", opacity: isPaused ? 0 : 1, transition: "opacity 0.3s" }}>
        {isKaijuLevel && <span>{`Kaiju: ${kaijuKillCount} / ${kaijuKilledToWin}`}</span>}
      </TopBar>
      {/* paused: everything fades, and only the word "Paused" shows */}
      <Huds ref={hudsRef} style={{ transform: `scale(${hudScale})`, opacity: isPaused ? 0 : 1, transition: "opacity 0.3s" }}>
        {isShowingHuds && players.map((pd, i) => <PlayerUI
          key={i}
          pd={pd}
          setDisplayString={setDisplayString}
          playerIndex={i}
          isTeammate={i > 0}
          isPaused={isPaused}
        />)}
        {/* recruits fight on their own: their HUDs are teammate-sized, without keys */}
        {isShowingHuds && (recruits || []).map((pd, i) => <PlayerUI
          key={`recruit ${i}`}
          pd={pd}
          setDisplayString={setDisplayString}
          playerIndex={players.length + i}
          isTeammate={true}
          isRecruit={true}
          isPaused={isPaused}
        />)}
      </Huds>
    </>
  );
};
