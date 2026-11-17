import React, { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { ICON_LOOKUP as PASSIVE_ICONS, PIECES_INFO } from "Utils/gameState";
import { getAvatarColor } from "Game/DataClasses/Avatars";
import { HUD_LAYERS, HUD_LOOK, HUD_VARIANTS, PLATES } from "./hudSpec";

/*
  A HUD (Jamie, 2026-11-16, rebuilt): the console art, and in its holes the portrait, the health, the powers and the
  passives. All of it is placed and sized from hudSpec.js, in the art's pixels.
*/

// each power's icons: as cast (active), waiting (its cooldown's loader)
const ACTIVE_ICONS = {
  wink: "fa-two-hearts", love: "fa-plus", glass: "fa-ravelry", fire: "fa-free-code-camp", water: "fa-tint", wood: "fa-leaf",
  lightning: "fa-bolt", death: "fa-snapchat-ghost", bubble: "fa-question-circle-o", metal: "fa-shield", ice: "fa-snowflake-o",
  kaijuFire: "fa-free-code-camp"
};
const LOADER_ICON = "fa-spinner";

// a part's box, in the art's pixels, and its layer
const place = (box, layer) => ({ left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, zIndex: HUD_LAYERS[layer] });

// the avatar's color: its radiation color if it has been irradiated, else its own
export const getHudColor = avatar => getAvatarColor(avatar) || (PIECES_INFO[avatar] || {}).color || "#9fd8ff";

const getPortraitSrc = avatar => avatar == "guy" ? "/player_avatar.png" : avatar == "girl" ? "/teammate_avatar.png" : `/levels/portraits/hud-${avatar}.png`;

const Root = styled.div`
  position: relative;
  transition: width 400ms ease, height 400ms ease; /* (a size change eases: a crowd's compact HUDs) */
  pointer-events: none; /* only the HUD's own buttons take clicks; the rest passes to the board */
`;

// the art, at its own size, scaled to the HUD's
const Art = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  transition: transform 400ms ease;
`;

const Part = styled.div`
  position: absolute;
`;

const Plate = styled(Part)`
  background-size: 100% 100%;
`;

// damaged (phase 4, Jamie): the metal and the portrait's disc flicker, dipping by '--dip' (the readouts never do)
const malfunction = keyframes`
  0%, 100% { filter: brightness(1); }
  7% { filter: brightness(calc(1 - var(--dip))); }
  9% { filter: brightness(1.15); }
  11% { filter: brightness(1); }
  46% { filter: brightness(1); }
  48% { filter: brightness(calc(1 - var(--dip) * 0.6)); }
  51% { filter: brightness(1); }
  83% { filter: brightness(calc(1 - var(--dip) * 0.8)); }
  85% { filter: brightness(1); }
`;
const flickering = css`
  animation: ${malfunction} var(--flicker-ms) steps(1) infinite;
`;
// dying (Jamie): the readouts blink and fade into the dark, and stay dark: its power's gone
const powerDown = keyframes`
  0% { filter: brightness(1); }
  12% { filter: brightness(0.25); }
  18% { filter: brightness(1.1); }
  34% { filter: brightness(0.2); }
  40% { filter: brightness(0.8); }
  62% { filter: brightness(0.12); }
  68% { filter: brightness(0.45); }
  100% { filter: brightness(0.04); }
`;
// everything in the holes, as one layer under the metal
const Readouts = styled(Part)`
  ${props => props.$isDamaged && !props.$isPoweringDown && flickering}
  ${props => props.$isPoweringDown && css`animation: ${powerDown} var(--power-down-ms) linear forwards;`}
`;

// ---- the portrait: a circuit disc in the avatar's color, its glow, and the figure ----
const discTurn = keyframes`
  from { -webkit-mask-position: 0 50%; mask-position: 0 50%; }
  to { -webkit-mask-position: 100% 50%; mask-position: 100% 50%; }
`;
const PortraitBack = styled(Part)`
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--color) ${HUD_LOOK.portraitGlow * 100}%, transparent), #05070a 72%);
  &::before {
    content: "";
    position: absolute;
    inset: -15%;
    opacity: ${HUD_LOOK.disc.opacity};
    background: var(--color);
    -webkit-mask: url(${HUD_LOOK.disc.src}) 0 50% / ${HUD_LOOK.disc.frames * 100}% 100% no-repeat;
    mask: url(${HUD_LOOK.disc.src}) 0 50% / ${HUD_LOOK.disc.frames * 100}% 100% no-repeat;
    animation: ${discTurn} ${HUD_LOOK.disc.seconds}s steps(${HUD_LOOK.disc.frames - 1}) infinite;
  }
`;
const Portrait = styled(Part)`
  border-radius: 50%;
  overflow: hidden;
  background: no-repeat center top / ${HUD_LOOK.portraitImageWidth * 100}% auto;
  filter: drop-shadow(0 0 6px var(--color));
`;
const rewardPulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px ${HUD_LOOK.reward.color}, 0 0 8px 2px ${HUD_LOOK.reward.color}; }
  50% { box-shadow: 0 0 0 4px #ff5c6c, 0 0 22px 8px ${HUD_LOOK.reward.glow}; }
`;
const RewardGlow = styled(Part)`
  border-radius: 50%;
  animation: ${rewardPulse} 0.9s ease-in-out infinite;
`;

// ---- the health: capsules across the slot ----
const HUD_LOOK_FLICKER = HUD_LOOK.healthFlicker;
// (the hologram flicker it always had)
const hologramFlicker = keyframes`
  0%, 100% { opacity: ${HUD_LOOK_FLICKER.low}; }
  20%, 80% { opacity: ${HUD_LOOK_FLICKER.high}; }
`;
const HealthRow = styled(Part)`
  animation: ${hologramFlicker} ${HUD_LOOK_FLICKER.ms}ms linear infinite;
  display: flex;
  align-items: center;
  gap: 2%;
  padding: 0 3%;
  box-sizing: border-box;
`;
const Capsule = styled.div`
  flex: none;
  height: 55%;
  border-radius: 999px;
  background: linear-gradient(45deg, var(--from), var(--to));
`;
const Count = styled.span`
  font-family: gameboy;
  font-size: 15px;
  color: #ffe0e0;
  text-shadow: 1px 1px 0 black, 0 0 4px #ff2a3c, 0 0 8px #d22b2b;
`;
const DeathWords = styled(Part)`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  color: ${HUD_LOOK.deathWords.color};
  -webkit-text-stroke: 0.5px ${HUD_LOOK.deathWords.color};
`;

// 4 or fewer: their own size; 5 or more: shrunk to fill the whole slot, gaps and all (Jamie, playtest 26: a blank was
// left at the right). (The row's gap is 2% of it.)
const getCapsuleShare = total => total <= HUD_LOOK.health.equalFrom ? 100 / (HUD_LOOK.health.equalFrom + 1) : (100 - 2 * (total - 1)) / total;

const Health = ({ box, health = 0, modifier = 0 }) => {
  const { maxCapsules, from, to, bonus, lost } = HUD_LOOK.health;
  const shown = modifier > 0 ? health + modifier : health;
  const share = getCapsuleShare(health + modifier);
  const colorsOf = index => modifier > 0 && index + 1 > health ? bonus
    : modifier < 0 && (health + modifier < 0 || index + 1 > health + modifier) ? lost
    : [from, to];
  const capsule = (index, width) => {
    const [a, b] = colorsOf(index);
    return <Capsule key={index} style={{ width: `${width}%`, "--from": a, "--to": b }} />;
  };
  return (
      <HealthRow style={place(box, "health")}>
        {shown > maxCapsules
          ? <>{capsule(0, 100 / (HUD_LOOK.health.equalFrom + 1))}<Count>x{health + modifier}</Count></>
          : Array.from({ length: Math.max(0, shown) }, (_, index) => capsule(index, share))}
      </HealthRow>
  );
};

// ---- a power: a ring of its color in its socket, its icon (spinning through its cooldown), its key ----
const popTurn = keyframes`
  0% { transform: rotate3d(0, 1, 0, 0deg); }
  50% { transform: rotate3d(0, 1, 0, 90deg); }
  100% { transform: rotate3d(0, 1, 0, 0deg); }
`;
const cooldownSpin = keyframes`
  5% { transform: rotate(0deg) scale(1); }
  80% { transform: rotate(648deg) scale(1); opacity: 1; }
  100% { transform: rotate(900deg) scale(2); opacity: 0; }
`;
const ActiveSocket = styled(Part)`
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 50%;
  border: solid var(--color);
  pointer-events: auto;
  ${props => props.$isPopping && css`animation: ${popTurn} 0.5s linear;`}
`;
const ActiveIcon = styled.i`
  color: var(--color);
  ${props => props.$cooldownMs && css`animation: ${cooldownSpin} ${props.$cooldownMs}ms linear;`}
  animation-play-state: ${props => props.$isPaused ? "paused" : "running"};
`;
const Key = styled(Part)`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color);
  color: ${HUD_LOOK.keyText};
  font-weight: bold;
`;

const Active = ({ box, keyBox, ability, keyNum, isPaused }) => {
  const { activeName, cooldownTime, element, color, accTime, isOnCooldown } = ability;
  const [isPopping, setIsPopping] = useState(false);
  const [isJustUsed, setIsJustUsed] = useState(false);
  // the press: a pop, and the loader shows a moment later (the cooldown itself is the game's)
  useEffect(() => {
    if (!accTime) return;
    setIsPopping(true);
    setIsJustUsed(true);
    const timeouts = [setTimeout(() => setIsPopping(false), 500), setTimeout(() => setIsJustUsed(false), 250)];
    return () => timeouts.forEach(clearTimeout);
  }, [accTime]);
  const icon = isOnCooldown && !isJustUsed ? LOADER_ICON : ACTIVE_ICONS[element];
  return (
    <>
      <ActiveSocket title={activeName} $isPopping={isPopping} style={{ ...place(box, "actives"), "--color": color, borderWidth: `${box.width * HUD_LOOK.activeRing}px` }}>
        {/* a new icon each cast, so its spin starts again (an NPC that recasts at once is never seen off cooldown) */}
        <ActiveIcon key={accTime || 0} className={`fa ${icon}`} $cooldownMs={isOnCooldown ? cooldownTime : 0} $isPaused={isPaused} style={{ fontSize: `${box.width * HUD_LOOK.activeIcon}px` }} />
      </ActiveSocket>
      {keyNum !== undefined && keyBox && (
        <Key style={{ ...place(keyBox, "keys"), "--color": color, fontSize: `${keyBox.height * 0.62}px` }}>{keyNum}</Key>
      )}
    </>
  );
};

// ---- a passive: dim until it has worked, then lit; smoke rising from it the first time ----
const PassiveSocket = styled(Part)`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color);
  color: #152642;
  pointer-events: auto;
  filter: brightness(${props => props.$isLit ? 1 : HUD_LOOK.passiveDim});
  transition: filter 0.2s;
`;
const smokePlay = keyframes`
  0% { opacity: 1; -webkit-mask-position: 0 0; mask-position: 0 0; }
  90% { opacity: 1; }
  100% { opacity: 0; -webkit-mask-position: 100% 0; mask-position: 100% 0; }
`;
const Smoke = styled(Part)`
  background: var(--color);
  -webkit-mask: url(${HUD_LOOK.smoke.src}) 0 0 / ${HUD_LOOK.smoke.frames * 100}% 100% no-repeat;
  mask: url(${HUD_LOOK.smoke.src}) 0 0 / ${HUD_LOOK.smoke.frames * 100}% 100% no-repeat;
  pointer-events: none;
  opacity: 0;
  ${props => props.$isPlaying && css`animation: ${smokePlay} ${HUD_LOOK.smoke.ms}ms steps(${HUD_LOOK.smoke.frames - 1}) forwards;`}
`;

const PassiveSmoke = ({ box, ability }) => {
  const { color, isPassiveApplied, accTime } = ability;
  const [isSmoking, setIsSmoking] = useState(false);
  const smokeKey = useRef(0);
  // the smoke each time it works anew
  useEffect(() => {
    if (!isPassiveApplied) return;
    smokeKey.current += 1;
    setIsSmoking(true);
    const done = setTimeout(() => setIsSmoking(false), HUD_LOOK.smoke.ms + 50);
    return () => clearTimeout(done);
  }, [isPassiveApplied, accTime]);
  const smokeBox = getSmokeBox(box);
  return isSmoking ? <Smoke key={smokeKey.current} $isPlaying style={{ ...place(smokeBox, "passiveSmoke"), "--color": color }} /> : null;
};

// the smoke's box: its ring round the passive's icon, centered on it
export const getSmokeBox = box => {
  const { smoke } = HUD_LOOK;
  const width = (Math.max(box.width, box.height) * smoke.ringOverIcon) / smoke.ring.width;
  const height = width * (smoke.frameHeight / smoke.frameWidth);
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return { x: middle.x - width / 2, y: middle.y - height * smoke.ring.y, width, height };
};

const Passive = ({ box, ability }) => {
  const { element, passiveName, color, isPassiveApplied } = ability;
  return (
    <PassiveSocket title={passiveName} $isLit={!!isPassiveApplied} style={{ ...place(box, "passives"), "--color": color, fontSize: `${box.height * HUD_LOOK.passiveIcon}px` }}>
      <i className={`fa ${PASSIVE_ICONS[element]}`} />
    </PassiveSocket>
  );
};

/*
  'pd': the piece's HUD data (GameBoardPieceBase.getUiState); 'variant': "player", "teammate" or "compact"
  (HUD_VARIANTS); 'isControlled': the one the player plays as (only its powers show their keys).
*/
// 'damage': 0 (whole) to 1 (dead): how much its readouts flicker; 'powerDownMs': dying, its readouts go dark over this long
export const Hud = ({ pd, variant = "player", isPaused, damage = 0, powerDownMs = undefined }) => {
  const isDamaged = damage > 0.05;
  const damageStyle = { ...(isDamaged ? { "--dip": String(0.12 + 0.28 * damage), "--flicker-ms": `${Math.round(2600 - 1700 * damage)}ms` } : {}), ...(powerDownMs ? { "--power-down-ms": `${powerDownMs}ms` } : {}) };
  const { plate: plateId, scale } = HUD_VARIANTS[variant];
  const plate = PLATES[plateId];
  const color = getHudColor(pd.gender);
  const abilities = pd.abilities || [];
  return (
      <Root style={{ width: `${plate.width * scale}px`, height: `${plate.height * scale}px` }}>
        <Art style={{ width: `${plate.width}px`, height: `${plate.height}px`, transform: `scale(${scale})`, "--color": color }}>
          <Plate style={{ ...place({ x: 0, y: 0, width: plate.width, height: plate.height }, "plateBack"), backgroundImage: `url(${plate.back})`, filter: HUD_LOOK.plateBackFilter }} />
          <Readouts $isDamaged={isDamaged} $isPoweringDown={!!powerDownMs} style={{ ...place({ x: 0, y: 0, width: plate.width, height: plate.height }, "readouts"), ...damageStyle }}>
            <PortraitBack style={place(plate.portrait, "portraitBack")} />
            <Portrait style={{ ...place(plate.portrait, "portrait"), backgroundImage: `url(${getPortraitSrc(pd.gender)})` }} />
            {!pd.isDead && <Health box={plate.health} health={pd.lives} modifier={pd.livesModifier} />}
            {abilities.slice(0, plate.actives.length).map((ability, k) => (
              <Active key={k} box={plate.actives[k]} keyBox={plate.keys[k]} ability={ability} keyNum={pd.isControlled ? k + 1 : undefined} isPaused={isPaused} />
            ))}
            {abilities.slice(0, plate.passives.length).map((ability, k) => (
              <Passive key={k} box={plate.passives[k]} ability={ability} />
            ))}
          </Readouts>
          <Plate style={{ ...place({ x: 0, y: 0, width: plate.width, height: plate.height }, "plateFront"), backgroundImage: `url(${plate.front})` }} />
          {!powerDownMs && abilities.slice(0, plate.passives.length).map((ability, k) => (
            <PassiveSmoke key={k} box={plate.passives[k]} ability={ability} />
          ))}
          {pd.isRewardPulse && <RewardGlow style={place(plate.portrait, "rewardGlow")} />}
          {pd.isDead && <DeathWords style={place(plate.health, "deathWords")}>{HUD_LOOK.deathWords.text}</DeathWords>}
        </Art>
      </Root>
  );
};
