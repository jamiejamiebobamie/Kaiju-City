import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";

const Wrapper = styled.i.attrs(({ zIndex, charLocation, isVisible, pieceScale, $isFaded }) => ({
  style: {
    transform: `scale(${pieceScale})`,
    transformOrigin: "0 0",
    zIndex: (zIndex || 0) + 20001,
    left: `${charLocation.x + 3.5}px`,
    top: `${charLocation.y}px`,
    display: isVisible ? "flex" : "none",
    // Sewer 2's climax: they fade back into the parts' light
    opacity: $isFaded ? 0 : 1,
    transition: $isFaded ? "opacity 2.5s ease-in" : undefined
  }
}))`
  position: absolute;
  color: ${props => props.color};
  pointer-events: none;
`;

const HealthBarWrapper = styled.div`
  display: ${props => (props.lives > 0 ? "flex" : "none")};
  width: 40px;
  justify-content: center;
  margin-top: -70px;
  margin-left: -15px;
`;

const Bar = styled.div`
  display: ${props => (props.lives > 0 ? "flex" : "none")};
  width: 7px;
  height: 3px;
  margin: 1px;
  margin-top: -5px;
  align-self: center;
  border-radius: 3px;
  border-style: solid;
  border-width: thin;
  background: linear-gradient(45deg, #d22b2b, #880808);
  border-color: #880808;
  pointer-events: none;
  margin-top: -15px;
`;

// a single frame in place of the run cycle, sized to match it
const FallingFrame = styled.img`
  position: absolute;
  left: 2px;
  top: 12px;
  width: 43px;
  height: 53px;
  pointer-events: none;
  image-rendering: pixelated;
`;

const SpriteSheet = styled.div`
  position: relative;
  pointer-events: none;

  ${props => `background: url(${props.spriteSheetSrc});`}

  ${props => props.avatar == 'kaiju' ?
    `transform: scale(0.4) translate(-169px, -169px); height: 230.33px; width: 180px;`
    : `transform: scale(.4) translate(-130px, -165px); height: 200px; width: 152px;`
  }

  ${props => `filter: drop-shadow(0 0 20px ${props.color});`}
  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  -webkit-transition: -webkit-transform 3s ease-in-out;
  ${props => `animation: ${props.anim} 1s steps(10) infinite;`};


    &::before {
    content: "";
    position: absolute;
    height: 230.33px;
    width: 180px;
    pointer-events: none;

    background: url("spritesheet/kaiju_sprite_FIRE1.png");
    background-position: center;

    ${props => `animation: ${props.anim} 1s steps(10) infinite;`};

    opacity: ${props => (props.isGoingToSpewFire ? 1 : 0)};
    transition: opacity 0.5s ease-in-out;
  }

  @keyframes upRight {
    from {
      background-position-x: -152px;
      background-position-y: 0px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 0px;
    }
  }
  @keyframes up {
    from {
      background-position-x: -152px;
      background-position-y: 220px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 220px;
    }
  }
  @keyframes upLeft {
    from {
      background-position-x: -152px;
      background-position-y: 440px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 440px;
    }
  }
  @keyframes downLeft {
    from {
      background-position-x: -152px;
      background-position-y: 660px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 660px;
    }
  }
  @keyframes down {
    from {
      background-position-x: -152px;
      background-position-y: 880px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 880px;
    }
  }
  @keyframes downRight {
    from {
      background-position-x: -152px;
      background-position-y: 1100px;
    }
    to {
      background-position-x: -1682px;
      background-position-y: 1100px;
    }
  }

  @keyframes idleupRight {
    from {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 0px;
    }
  }
  @keyframes idleup {
    from {
      background-position-x: 0px;
      background-position-y: 220px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 220px;
    }
  }
  @keyframes idleupLeft {
    from {
      background-position-x: 0px;
      background-position-y: 440px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 440px;
    }
  }
  @keyframes idledownLeft {
    from {
      background-position-x: 0px;
      background-position-y: 660px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 660px;
    }
  }
  @keyframes idledown {
    from {
      background-position-x: 0px;
      background-position-y: 880px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 880px;
    }
  }
  @keyframes idledownRight {
    from {
      background-position-x: 0px;
      background-position-y: 1100px;
    }
    to {
      background-position-x: 0px;
      background-position-y: 1100px;
    }
  }


  @keyframes upRightKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 0px;
    }
  }
  @keyframes upKaiju  {
    from {
      background-position-x: 0px;
      background-position-y: 230.33px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 230.33px;
    }
  }
  @keyframes upLeftKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 460.66px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 460.66px;
    }
  }
  @keyframes downLeftKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 691px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 691px;
    }
  }
  @keyframes downKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 921.33px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 921.33px;
    }
  }
  @keyframes downRightKaiju {
    from {
      background-position-x: 0px;
      background-position-y: 1151.66px;
    }
    to {
      background-position-x: -1800px;
      background-position-y: 1151.66px;
    }
  }

`;
// the ghost boss's last phase: Ghost Girl is a ghost, milk-white and see-through, and drifts as she stands
const ghostDrift = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0.62; }
  50% { transform: translateY(-3px); opacity: 0.5; }
`;

// health won sparring (Jamie): a red outline, pulsing, round the body
const rewardPulse = keyframes`
  0%, 100% { filter: drop-shadow(0 0 1px #ff2a3c) drop-shadow(0 0 3px #ff2a3c); }
  50% { filter: drop-shadow(0 0 2px #ff5c6c) drop-shadow(0 0 9px #ff0020) drop-shadow(0 0 14px #ff0020); }
`;

const RewardPulse = styled.div`
  position: absolute;
  inset: 0;
  ${props => props.$isOn && css`animation: ${rewardPulse} 0.9s ease-in-out infinite;`}
`;

const GhostForm = styled.div`
  position: absolute;
  inset: 0;
  ${props => props.$isGhost && css`
    /* an off-black outline round the white, so her edges show (Jamie, playtest 19), then the glow */
    filter: grayscale(1) contrast(0.4) brightness(3.2)
      drop-shadow(1px 0 0 #14141c) drop-shadow(-1px 0 0 #14141c) drop-shadow(0 1px 0 #14141c) drop-shadow(0 -1px 0 #14141c)
      drop-shadow(0 0 4px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 10px rgba(220, 230, 255, 0.7));
    animation: ${ghostDrift} 2.4s ease-in-out infinite;
  `}
`;

/*
  Walking through a portal: only the body on this side of its edge is drawn. The clip is in the character box's own
  units: the box sits 20 left of and 45 above where the piece stands, scaled by 'pieceScale' (see Wrapper and Character).
*/
const getPortalClip = ({ point, behind }, charLocation, pieceScale) => {
  const local = { x: (point.x - (charLocation.x + 3.5)) / pieceScale + 20, y: (point.y - charLocation.y) / pieceScale + 45 };
  const across = { x: -behind.y, y: behind.x };
  const far = 600;
  const corners = [
    { x: local.x + across.x * far, y: local.y + across.y * far },
    { x: local.x + across.x * far - behind.x * far, y: local.y + across.y * far - behind.y * far },
    { x: local.x - across.x * far - behind.x * far, y: local.y - across.y * far - behind.y * far },
    { x: local.x - across.x * far, y: local.y - across.y * far }
  ];
  return `polygon(${corners.map(({ x, y }) => `${x}px ${y}px`).join(", ")})`;
};

const Character = styled.div`
    margin-left: -20px;
    margin-top: -45px;
    width: 50px;
    height: 75px;
    position: absolute;
    z-index: 1;
  pointer-events: none;
  animation-iteration-count: 2s;
  ${props => props.isDamaged ? "animation: shake 0.5s;" : props.isSpeaking ? "animation: speakShake 0.35s steps(2) infinite;" : ""};
  /* talking: a small jitter, like a character in an old game when they have the floor */
  @keyframes speakShake {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1px, -1px); }
    50% { transform: translate(1px, 0); }
    75% { transform: translate(0, -1px); }
  }
  @keyframes shake {
    0% {
      transform: translate(1px, 1px) rotate(0deg);
    }
    10% {
      transform: translate(-1px, -2px) rotate(-1deg);
    }
    20% {
      transform: translate(-3px, 0px) rotate(1deg);
    }
    30% {
      transform: translate(3px, 2px) rotate(0deg);
    }
    40% {
      transform: translate(1px, -1px) rotate(1deg);
    }
    50% {
      transform: translate(-1px, 2px) rotate(-1deg);
    }
    60% {
      transform: translate(-3px, 1px) rotate(0deg);
    }
    70% {
      transform: translate(3px, 1px) rotate(-1deg);
    }
    80% {
      transform: translate(-1px, -1px) rotate(1deg);
    }
    90% {
      transform: translate(1px, 2px) rotate(0deg);
    }
    100% {
      transform: translate(1px, -2px) rotate(-1deg);
    }
  }
}
`;
// a number over someone, in the Hotline Miami manner: it pops in small, grows as it rises away, and fades.
// it is drawn over the whole monitor, not inside the screen, so it can float on past the screen's edge.
const NUMBER_LOOK = {
  seconds: 0.9,
  size: "2.3cqw", // of the monitor's frame
  zipScale: 0.55 // "Zip!" is smaller
};

const numberRise = keyframes`
  0% { opacity: 0; transform: translate(-50%, 0) scale(0.35); }
  12% { opacity: 1; transform: translate(calc(-50% - 2px), -0.4cqw) scale(0.8); }
  40% { transform: translate(calc(-50% + 3px), -1.4cqw) scale(1); }
  65% { opacity: 1; transform: translate(calc(-50% - 2px), -2.3cqw) scale(1.1); }
  100% { opacity: 0; transform: translate(calc(-50% + 2px), -3.6cqw) scale(1.2); }
`;

const ModiferText = styled.p`
  position: absolute;
  margin: 0;
  z-index: 2147483300;
  pointer-events: none;
  white-space: nowrap;
  font-family: gameboy;
  color: ${props => props.color};
  background: linear-gradient(to bottom, #ffffff 0%, ${props => props.color} 55%, ${props => props.color} 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: 1.2px #140409;
  filter: drop-shadow(1.5px 2px 0 rgba(0, 0, 0, 0.85)) drop-shadow(0 0 4px ${props => props.color});
  transform-origin: 50% 80%;
  opacity: 0;
  animation: ${numberRise} ${NUMBER_LOOK.seconds}s ease-out forwards;
`;

// where a number starts: just over the head, in the scene
/*
  Effects that change play, over the head (Jamie, 2026-11-10): an icon for each while it lasts, and a word as it starts.
  The pieces' own effects: GameBoardPieceBase.getStatusEffects.
*/
const STATUS_LOOK = {
  slowed: { icon: "fa-hourglass-half", color: "#5fb4ff", word: "Slowed!" },
  fast: { icon: "fa-angle-double-right", color: "#6dff6d", word: "Speed up!" },
  burn: { icon: "fa-fire", color: "#ff8a2a" },
  builder: { icon: "fa-shield", color: "#d8dde6" },
  spurned: { icon: "fa-frown-o", color: "#ff4040" },
  charmed: { icon: "fa-heart", color: "#ff7ad9", word: "Charmed!" }
};
const STATUS_WORD_GAP_MS = 450;
// a speaker's shake: as long as the line (per letter, within bounds), then a rest, and again (Jamie)
const SPEAK_SHAKE = { msPerChar: 45, minMs: 600, maxMs: 3000, restMs: 4000 }; // two words at once: the second a moment after the first

const StatusRow = styled.div`
  position: absolute;
  left: -15px;
  /* lower, nearer the head (Jamie, playtest 19); over a health bar, right on top of it */
  top: ${props => props.$isAboveBar ? "-80px" : "-60px"};
  width: 40px;
  display: flex;
  justify-content: center;
  gap: 2px;
  pointer-events: none;
  z-index: 2;
`;

const StatusIcon = styled.span`
  position: relative;
  font-size: 10px;
  line-height: 1;
  filter: drop-shadow(0 0 1px black) drop-shadow(0 0 2px black) drop-shadow(0 0 3px var(--glow));
`;

const StatusCount = styled.span`
  position: absolute;
  right: -5px;
  bottom: -4px;
  font-family: gameboy;
  font-size: 6px;
  color: white;
  text-shadow: 0 0 2px black, 1px 1px 0 black;
`;

const NumberAnchor = styled.span`
  position: absolute;
  left: 22px;
  top: -14px;
  width: 0;
  height: 0;
`;

// placed once, where the head was when it showed, then left to float up on its own
const FloatingNumber = ({ anchorRef, color, text, sizeScale = 1 }) => {
  const [spot, setSpot] = useState(undefined);
  useEffect(() => {
    const frame = document.querySelector("[data-game-frame]");
    if (!frame || !anchorRef.current) return;
    const anchorBox = anchorRef.current.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    setSpot({ frame, x: anchorBox.left - frameBox.left + (Math.random() - 0.5) * 12, y: anchorBox.top - frameBox.top });
  }, []);
  if (!spot) return null;
  return createPortal(
    <ModiferText color={color} style={{ left: `${spot.x}px`, top: `${spot.y}px`, fontSize: `calc(${NUMBER_LOOK.size} * ${sizeScale})` }}>{text}</ModiferText>,
    spot.frame
  );
};

export const GameBoardPieceComponent = ({
  zIndex,
  charLocation,
  avatar,
  color,
  isVisible,
  isHealed,
  isCharmed, // future feature...
  isTeleported,
  isFalling,
  dir,
  spriteSheetSrc,
  lives,
  isGoingToSpewFire,
  isShowHealthBarOnComponent,
  facingDir,
  pieceScale,
  isQuiet = false, // the Recruit or Terminate choice: no shaking, and no numbers
  isSpeaking = false, // their line is up: they jitter as they talk
  isGhostForm = false, // the ghost boss's last phase
  portalMask = undefined, // walking through a portal: { point, behind } in level pixels. the body past that edge isn't drawn
  isOnBoard = true, // not yet on the tiles (a Kaiju still walking in): no numbers
  isRewardPulse = false, // health just won sparring: a red outline pulses round them
  statusEffects = [], // what is on them that changes play: icons over the head (STATUS_LOOK)
  cleanSlateCount = 0, // goes up each time their Dispel wipes their other passives
  isPlayer = false,
  hitLives = undefined, // health without the passives' (Haunt's Lichdom): what the "-1" and the shake follow
  isFaded = false,
  speakingLineLength = 0
}) => {
  // talking: they shake as long as their line takes, then rest a moment, and again (Jamie)
  const [isShaking, setIsShaking] = useState(false);
  useEffect(() => {
    if (!isSpeaking) {
      setIsShaking(false);
      return;
    }
    const shakeMs = Math.min(Math.max(speakingLineLength * SPEAK_SHAKE.msPerChar, SPEAK_SHAKE.minMs), SPEAK_SHAKE.maxMs);
    let timeout;
    const shake = () => {
      setIsShaking(true);
      timeout = setTimeout(() => {
        setIsShaking(false);
        timeout = setTimeout(shake, SPEAK_SHAKE.restMs);
      }, shakeMs);
    };
    shake();
    return () => clearTimeout(timeout);
  }, [isSpeaking, speakingLineLength]);
  const numberAnchor = React.useRef(null);
  const [modifierText, setModifierText] = useState([]);
  const [isDamaged, setIsDamaged] = useState(null);
  const [isHealedLocal, setIsHealedLocal] = useState(false);
  const [isHealedCached, setIsHealedCached] = useState(isHealed);
  const [isTeleportedLocal, setIsTeleportedLocal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const getAnim = () => {
    if (avatar == 'kaiju') return dir == 'idle' ? 'downKaiju' : `${dir}Kaiju`;
    return dir == 'idle' ? `idle${facingDir}` : dir;
  };
  const anim = getAnim();
  // a number only for a life lost while still standing: not for the last one, and not when a Kaiju from the pool comes back
  // a word floats up as an effect starts (Jamie): "Slowed!", "Charmed!", and for the player "Keys scrambled!" too
  const effectKey = statusEffects.map(({ id }) => id).join(" ");
  const lastEffects = React.useRef(new Set(statusEffects.map(({ id }) => id)));
  useEffect(() => {
    const now = new Set(statusEffects.map(({ id }) => id));
    const started = [...now].filter(id => !lastEffects.current.has(id));
    lastEffects.current = now;
    if (isQuiet || !isOnBoard) return;
    const words = started.flatMap(id => {
      const look = STATUS_LOOK[id];
      if (!look || !look.word) return [];
      return id == "charmed" && isPlayer ? [look, { word: "Keys scrambled!", color: look.color }] : [look];
    });
    words.forEach(({ word, color }, k) => setTimeout(() => setModifierText(previous => [
      ...previous,
      <FloatingNumber key={Math.random()} anchorRef={numberAnchor} color={color} text={word} sizeScale={NUMBER_LOOK.zipScale} />
    ]), k * STATUS_WORD_GAP_MS));
  }, [effectKey]);
  const lastCleanSlate = React.useRef(cleanSlateCount);
  useEffect(() => {
    const isNew = cleanSlateCount > lastCleanSlate.current;
    lastCleanSlate.current = cleanSlateCount;
    if (!isNew || isQuiet || !isOnBoard) return;
    setModifierText(previous => [
      ...previous,
      <FloatingNumber key={Math.random()} anchorRef={numberAnchor} color="#f4f8ff" text="Buffs Removed!" sizeScale={NUMBER_LOOK.zipScale} />
    ]);
  }, [cleanSlateCount]);
  const shownHealth = hitLives === undefined ? lives : hitLives;
  const lastLives = React.useRef(shownHealth);
  useEffect(() => {
    const isLostWhileStanding = shownHealth < lastLives.current && shownHealth > 0;
    lastLives.current = shownHealth;
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (isLostWhileStanding && isHealed === isHealedCached && !isDamaged && !isQuiet && isOnBoard) {
        setIsDamaged(true);
        setModifierText(prevText => [
          ...prevText,
          <FloatingNumber key={Math.random()} anchorRef={numberAnchor} color={"#FF383B"} text="-1" />
        ]);
        setTimeout(() => setIsDamaged(null), 2000);
      }
    }
  }, [shownHealth]);
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (!isHealedLocal && !isQuiet && isOnBoard) {
        setIsHealedLocal(true);
        setTimeout(() => setIsHealedLocal(false), 2000);
        setModifierText(prevText => [
          ...prevText,
          <FloatingNumber key={Math.random()} anchorRef={numberAnchor} color={"#9FEA4F"} text="+1" />
        ]);
      }
    }
    setIsHealedCached(isHealed);
  }, [isHealed]);
  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
    } else {
      if (!isTeleportedLocal) {
        setIsTeleportedLocal(true);
        setTimeout(() => setIsTeleportedLocal(false), 2000);
        setModifierText(prevText => [
          ...prevText,
          <FloatingNumber key={Math.random()} anchorRef={numberAnchor} color={"#9338E9"} text="Zip!" sizeScale={NUMBER_LOOK.zipScale} />
        ]);
      }
    }
  }, [isTeleported]);

  const bars = !isShowHealthBarOnComponent ? undefined : Array(lives).fill(0).map((_, i) => <Bar lives={lives} key={i} />)
  const isBarShown = !!isShowHealthBarOnComponent && lives > 0;
  return (
    <Wrapper zIndex={zIndex} isVisible={isVisible} charLocation={charLocation} pieceScale={pieceScale} $isFaded={isFaded}>
      <NumberAnchor ref={numberAnchor} />
      {!isQuiet && modifierText}
      <HealthBarWrapper lives={lives}>{bars}</HealthBarWrapper>
      {/* what is on them that changes play: over the head, above the health bar where there is one */}
      {statusEffects.length > 0 && !isQuiet && (
        <StatusRow $isAboveBar={isBarShown}>
          {statusEffects.map(({ id, count }) => {
            const look = STATUS_LOOK[id];
            return look && <StatusIcon key={id} style={{ "--glow": look.color }}>
              <i className={`fa ${look.icon}`} style={{ color: look.color }} />
              {count && <StatusCount>{count}</StatusCount>}
            </StatusIcon>;
          })}
        </StatusRow>
      )}
      <Character isDamaged={isDamaged && !isQuiet} isSpeaking={isSpeaking && isShaking} style={portalMask ? { clipPath: getPortalClip(portalMask, charLocation, pieceScale) } : undefined}>
        {isFalling ? <FallingFrame src="/levels/npcs/agentFalling.png" /> : <RewardPulse $isOn={isRewardPulse}><GhostForm $isGhost={isGhostForm}><SpriteSheet
          avatar={avatar}
          spriteSheetSrc={spriteSheetSrc}
          isGoingToSpewFire={isGoingToSpewFire} // Kaiju-only
          lives={lives}
          anim={anim}
          color={color}
        /></GhostForm></RewardPulse>}
      </Character>
    </Wrapper>
  );
};

