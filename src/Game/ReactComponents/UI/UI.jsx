import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { HudFlock } from "./Hud/HudFlock";

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
  // everyone with a HUD: the team, then the recruits in the order they came (the Hazmat Worker among them: Jamie)
  const all = [
    ...players.map((pd, i) => ({ pd, key: `player ${i}` })),
    ...(recruits || []).map(pd => ({ pd, key: `recruit ${pd.gender}` }))
  ];
  const getHudOrder = () => {
    // only those on the board (a HUD comes a beat after its avatar shows: Jamie), and alive
    const alive = all.filter(({ pd }) => !pd.isDead && pd.isOnBoard !== false);
    // the fight is lost (no one alive, only a restart left): no HUDs (Jamie: the original avatar's came back here)
    if (!alive.length) return [];
    const controlled = alive.find(({ pd }) => pd.isControlled);
    return controlled ? [controlled, ...alive.filter(hud => hud !== controlled)] : alive;
  };
  // the HUDs that show, top to bottom: the one played as at the player's size, the rest teammates', compact in a
  // crowd (more than three: Jamie). The one played as just died, and no one's taken over yet: the top waits for whoever
  // does (their HUD rises into it then). They fly as drones (HudFlock).
  const order = isShowingHuds ? getHudOrder() : [];
  const hasControlled = order.some(({ pd }) => pd.isControlled);
  const hudOrder = order.map(({ pd, key }, k) => ({
    key,
    pd,
    variant: k == 0 && hasControlled ? "player" : order.length > 3 ? "compact" : "teammate"
  }));
  const deadKeys = all.filter(({ pd }) => pd.isDead).map(({ key }) => key);

  const [hudScale, setHudScale] = useState(1);

  useEffect(() => {
    const frame = hudsRef.current.parentElement; // (the game frame: the HUDs scale with it)
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
      <div ref={hudsRef} style={{ display: "contents" }} />
      <HudFlock order={hudOrder} isShowing={isShowingHuds} scale={hudScale} isPaused={isPaused} deadKeys={deadKeys} isTopReserved={order.length > 0 && !hasControlled} />
    </>
  );
};
