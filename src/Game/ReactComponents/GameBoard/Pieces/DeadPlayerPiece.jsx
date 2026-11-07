import React, { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { GAME_TICK } from "Utils/gameState";
import { getTorsoSpot, LIMBS } from "Game/DataClasses/Ragdoll";

// the body moves once a game tick: easing between ticks keeps a thrown body smooth
const TICK_EASE = `${GAME_TICK.pieceMs}ms linear`;

/*
  A thrown body, cut from the avatar's own standing frame: a torso, a head, two arms and two legs.
  Each part turns about its joint on the torso, so the limbs flop as the body flies and lands.
*/
const FRAME = {
  width: 152,
  height: 200,
  idleDownY: 500, // the standing, facing-down frame in every sheet
  scale: 0.4, // as the living sprite is drawn
  glowPx: 8
};

// the figure in each avatar's standing frame, in frame pixels: left, top, right, bottom
const FIGURE_BOXES = {
  guy: [49, 10, 112, 145],
  girl: [39, 10, 105, 142],
  punk: [50, 2, 114, 141],
  black_female: [47, 6, 109, 145],
  mermaid: [42, 7, 103, 139],
  agent: [47, 2, 109, 140],
  hazmat: [38, 7, 105, 144]
};

// each part as a fraction of the figure: its box, and the joint it hangs from on the torso
const PARTS = {
  torso: { box: [0.21, 0.19, 0.81, 0.61], joint: [0.51, 0.40] },
  head: { box: [0.27, 0, 0.75, 0.21], joint: [0.51, 0.21] },
  armLeft: { box: [0, 0.21, 0.3, 0.67], joint: [0.24, 0.24] },
  armRight: { box: [0.7, 0.21, 1, 0.67], joint: [0.78, 0.24] },
  legLeft: { box: [0.21, 0.58, 0.52, 1], joint: [0.37, 0.59] },
  legRight: { box: [0.49, 0.58, 0.81, 1], joint: [0.65, 0.59] }
};

const Wrapper = styled.i`
  display: block;
  position: absolute;
  pointer-events: none;
`;

const Part = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: ${FRAME.width}px;
  height: ${FRAME.height}px;
  background-position: 0 -${FRAME.idleDownY}px;
`;

// fallback, before a body is thrown: the old lying-down art
const StillBody = styled.div`
  width: 70px;
  height: 70px;
  margin: -35px 0 0 -35px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 70px 70px;
`;

const getFigure = avatar => FIGURE_BOXES[avatar] || FIGURE_BOXES.guy;

// a spot in the figure, as a fraction of it, in frame pixels
const toFrame = (avatar, [fx, fy]) => {
  const [left, top, right, bottom] = getFigure(avatar);
  return { x: left + fx * (right - left), y: top + fy * (bottom - top) };
};

const getClip = (avatar, box) => {
  const from = toFrame(avatar, [box[0], box[1]]);
  const to = toFrame(avatar, [box[2], box[3]]);
  return `inset(${from.y}px ${FRAME.width - to.x}px ${FRAME.height - to.y}px ${from.x}px)`;
};

const RagdollParts = ({ avatar, spriteSheetSrc, body, color }) => {
  const torso = toFrame(avatar, PARTS.torso.joint);
  const ease = body.easeMs ? `transform ${body.easeMs}ms ease-in-out` : body.isResting ? "transform 200ms ease-out" : `transform ${TICK_EASE}`;
  const drawPart = (id, angle = 0) => {
    const joint = toFrame(avatar, PARTS[id].joint);
    return (
      <Part key={id} style={{
        backgroundImage: `url(${spriteSheetSrc})`,
        clipPath: getClip(avatar, PARTS[id].box),
        transformOrigin: `${joint.x}px ${joint.y}px`,
        transform: `rotate(${angle}deg)`,
        transition: ease
      }} />
    );
  };
  // the arms and legs behind the torso, the head in front
  const limbs = LIMBS.map((limb, k) => ({ ...limb, angle: body.limbs[k].angle }));
  const getLimb = id => limbs.find(limb => limb.id == id);
  return (
    <div style={{ transform: `rotate(${body.angle}deg)`, transition: ease, filter: `drop-shadow(0 0 ${FRAME.glowPx}px ${color})` }}>
      <div style={{ position: "absolute", transformOrigin: "0 0", transform: `scale(${FRAME.scale}) translate(${-torso.x}px, ${-torso.y}px)` }}>
        {["armLeft", "armRight", "legLeft", "legRight"].map(id => drawPart(id, getLimb(id).angle))}
        {drawPart("torso")}
        {drawPart("head", getLimb("head").angle)}
      </div>
    </div>
  );
};

// the ghost boss's body (Jamie): a ghost's, as her living ghost form is drawn (GameBoardPieceComponent's GhostForm)
const GHOST_FILTER = "grayscale(1) contrast(0.4) brightness(3.2) drop-shadow(0 0 4px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 10px rgba(220, 230, 255, 0.8))";
// at the choice (Jamie): the ghost rises up off her, its arms and legs hanging down as it lifts, and fades away,
// and she lies beneath it as herself
const GHOST_RISE = { delayMs: 600, riseMs: 2600, rowsUp: 1.1, droopMs: 1400 };

const ghostRise = keyframes`
  0% { transform: translateY(0); opacity: 0.75; }
  60% { opacity: 0.55; }
  100% { transform: translateY(-${GHOST_RISE.rowsUp * 40}px); opacity: 0; }
`;

const GhostBody = styled.div`
  ${props => (props.$ghost == "ghost" || props.$ghost == "rising") && css`
    filter: ${GHOST_FILTER};
    opacity: 0.7;
  `}
  ${props => props.$ghost == "rising" && css`
    animation: ${ghostRise} ${GHOST_RISE.riseMs}ms ease-in ${GHOST_RISE.delayMs}ms both;
  `}
`;

// the arms and legs hanging straight down on the screen, however the body lies (a limb at 0 hangs down from the torso)
const getHangingBody = body => ({ ...body, limbs: body.limbs.map(limb => ({ ...limb, angle: -body.angle })), easeMs: GHOST_RISE.droopMs });

// the ghost lifting off the body
const RisingGhost = props => {
  const [isHanging, setIsHanging] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setIsHanging(true), GHOST_RISE.delayMs);
    return () => clearTimeout(timeout);
  }, []);
  return <DeadPlayer {...props} body={isHanging ? getHangingBody(props.body) : props.body} ghost="rising" />;
};

// 'ghost': "ghost" draws it as a ghost; "toBody": the ghost rises off the person, who lies there as themself
export const DeadPlayer = ({
  charLocation,
  color,
  zIndex,
  avatar,
  pieceScale,
  spriteSheetSrc,
  body,
  ghost = undefined
}) => {
  if (ghost == "toBody") {
    const props = { charLocation, color, zIndex, avatar, pieceScale, spriteSheetSrc, body };
    return (
      <>
        <DeadPlayer {...props} />
        {body && spriteSheetSrc && <RisingGhost {...props} zIndex={(zIndex || 0) + 1} />}
      </>
    );
  }
  const spot = body ? getTorsoSpot(body, pieceScale) : charLocation;
  return (
    <Wrapper
      data-ragdoll
      style={{
        zIndex: (zIndex || 0) + 20001, // sorted with the living pieces
        left: `${spot.x}px`,
        top: `${spot.y}px`,
        transform: `scale(${pieceScale})`,
        transformOrigin: "0 0",
        transition: body && !body.isResting ? `left ${TICK_EASE}, top ${TICK_EASE}` : "none"
      }}>
      <GhostBody $ghost={ghost}>
        {body && spriteSheetSrc
          ? <RagdollParts avatar={avatar} spriteSheetSrc={spriteSheetSrc} body={body} color={color} />
          : <StillBody style={{ backgroundImage: `url(/levels/dead/${avatar}.png)`, filter: `drop-shadow(0 0 ${FRAME.glowPx}px ${color})` }} />}
      </GhostBody>
    </Wrapper>
  );
};
