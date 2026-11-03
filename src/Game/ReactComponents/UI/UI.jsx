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

const Button = styled.div`
  padding: 0.4cqw 1cqw;
  cursor: pointer;
  border-radius: 0.4cqw;
  border: 0.2cqw solid #5a8a7a;
  color: #dfe;
  background-color: #376e5b;
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
  handleClickHome,
  handleClickPause,
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
      <TopBar>
        <Button title="Pause" onClick={handleClickPause}>Pause</Button>
        <Button title="Goodbye!" onClick={handleClickHome}>Leave</Button>
        {isKaijuLevel && <span>{`Kaiju: ${kaijuKillCount} / ${kaijuKilledToWin}`}</span>}
      </TopBar>
      <Huds ref={hudsRef} style={{ transform: `scale(${hudScale})` }}>
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
