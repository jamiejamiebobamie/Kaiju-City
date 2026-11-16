import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { Hud } from "./Hud/Hud";

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

/*
  The HUDs are drones (Jamie, UI epic): each flies in from out of shot, up and to the right, overshoots a little and
  settles, then hovers in place, bobbing; one after another. When they go, they lift off and fly back out.
  (In the HUDs' own design pixels: they scale with the game.)
*/
const DRONE = { inMs: 900, outMs: 600, staggerMs: 130, hoverMs: 2400 };

const droneIn = keyframes`
  0% { transform: translate(520px, -260px) rotate(-14deg) scale(0.85); opacity: 0; }
  15% { opacity: 1; }
  60% { transform: translate(-14px, 10px) rotate(4deg) scale(1.01); }
  80% { transform: translate(5px, -4px) rotate(-1.5deg); }
  100% { transform: none; opacity: 1; }
`;

const droneHover = keyframes`
  from { translate: 0 -2px; }
  to { translate: 0 3px; }
`;

const droneOut = keyframes`
  0% { transform: none; opacity: 1; }
  25% { transform: translate(-8px, 6px) rotate(3deg); }
  100% { transform: translate(560px, -300px) rotate(12deg) scale(0.85); opacity: 0; }
`;

const Drone = styled.div`
  ${props => props.$isLeaving
    ? css`animation: ${droneOut} ${DRONE.outMs}ms ease-in forwards;`
    : css`animation: ${droneIn} ${DRONE.inMs}ms cubic-bezier(0.25, 0.8, 0.3, 1) both, ${droneHover} ${DRONE.hoverMs}ms ease-in-out ${DRONE.inMs}ms infinite alternate;`}
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
    // the fight is lost (no one alive, only a restart left): no HUDs (Jamie: the original avatar's came back here)
    if (!alive.length) return [];
    const controlled = alive.find(({ pd }) => pd.isControlled);
    return controlled ? [controlled, ...alive.filter(hud => hud !== controlled)] : alive;
  };
  // the HUDs that show; as they go, the last ones stay a moment to fly out
  const order = isShowingHuds ? getHudOrder(players, recruits) : [];
  const lastOrder = useRef([]);
  if (isShowingHuds) lastOrder.current = order;
  const [isLeaving, setIsLeaving] = useState(false);
  useLayoutEffect(() => {
    if (isShowingHuds || !lastOrder.current.length) {
      setIsLeaving(false);
      return;
    }
    setIsLeaving(true);
    const gone = setTimeout(() => {
      setIsLeaving(false);
      lastOrder.current = [];
    }, DRONE.outMs + (lastOrder.current.length - 1) * DRONE.staggerMs);
    return () => clearTimeout(gone);
  }, [isShowingHuds]);
  const shown = isShowingHuds ? order : isLeaving ? lastOrder.current : [];

  const [hudScale, setHudScale] = useState(1);

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
        {shown.map(({ pd, playerIndex, isRecruit }, k) => (
          <Drone
            key={isRecruit ? `recruit ${playerIndex}` : playerIndex}
            $isLeaving={!isShowingHuds}
            style={{ animationDelay: isShowingHuds ? `${k * DRONE.staggerMs}ms, ${DRONE.inMs + k * DRONE.staggerMs}ms` : `${k * DRONE.staggerMs}ms` }}
          >
            {/* the one played as: the player's HUD; the rest teammates', compact in a crowd (more than three: Jamie) */}
            <Hud pd={pd} variant={k == 0 ? "player" : shown.length > 3 ? "compact" : "teammate"} isPaused={isPaused} />
          </Drone>
        ))}
      </Huds>
    </>
  );
};
