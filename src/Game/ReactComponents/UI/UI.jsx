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

// beside the monitor, which sits left of the middle so the two are centered together
const Huds = styled.div`
  position: absolute;
  top: 1cqw;
  right: 13.1cqw;
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
  isCountOnBezel = false,
  isPaused
}) => {
  const hudsRef = useRef(null);
  const getHudOrder = (players, recruits) => {
    const all = [
      ...players.map((pd, i) => ({ pd, playerIndex: i, isRecruit: false })),
      ...(recruits || []).map((pd, i) => ({ pd, playerIndex: players.length + i, isRecruit: true }))
    ];
    const alive = all.filter(({ pd }) => !pd.isDead);
    if (!alive.length) return all.slice(0, 1); // the fight is lost: the player's, as it ended
    const controlled = alive.find(({ pd }) => pd.isControlled);
    return controlled ? [controlled, ...alive.filter(hud => hud !== controlled)] : alive;
  };
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
      <TopBar style={{ visibility: isShowingTopBar ? "visible" : "hidden" }}>
        {/* in the monitor, the count is on the casing's display instead */}
        {isKaijuLevel && !isCountOnBezel && <span>{`Kaiju: ${kaijuKillCount} / ${kaijuKilledToWin}`}</span>}
      </TopBar>
      {/* paused: everything fades, and only the word "Paused" shows */}
      <Huds ref={hudsRef} style={{ transform: `scale(${hudScale})` }}>
        {/* the dead's HUDs go, and the rest move up; the one the player plays as is first, at the player's HUD size
            (Jamie, playtest 19; the HUDs breaking apart and falling like drones is for the UI epic) */}
        {isShowingHuds && getHudOrder(players, recruits).map(({ pd, playerIndex, isRecruit }, k) => <PlayerUI
          key={isRecruit ? `recruit ${playerIndex}` : playerIndex}
          pd={pd}
          setDisplayString={setDisplayString}
          playerIndex={playerIndex}
          isTeammate={k > 0}
          isRecruit={isRecruit}
          isPaused={isPaused}
        />)}
      </Huds>
    </>
  );
};
