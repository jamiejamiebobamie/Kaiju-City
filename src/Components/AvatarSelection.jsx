import React, { useState, useEffect, useRef, useContext } from "react";
import { GlobalSettingsContext } from 'Home';
import { useHover } from "Utils/utils";
import styled from "styled-components";

const AvatarSelectionWrapper = styled.div`
    position: absolute;
    flex-direction: column;
    z-index: 1;
    width: 100dvw;
    height: 300px;
    margin-top: 200px;
    align-self: center;
    display: flex;
    justify-content: space-around;

    background-color: #141518;
    border-color: #26282c;
    border-width: 1px;
    border-style: solid;
    border-bottom: 1px solid #26282c;
`;

const SpriteSheet = styled.div`
  cursor: pointer;
  ${props => !props.anim && "pointer-events: none;"}

  ${props =>
    props.gender == 'guy'
      ? 'background: url("spritesheet/player.png");'
      : 'background: url("spritesheet/teammate.png");'}

  height: 230px;
  width: 152px;

  position: absolute;
  z-index: 109;

  ${props => `filter: drop-shadow(0 0 2px color-mix(in srgb, #80EF80 calc(${props.opacity} * 100%), ${props.gender == 'guy' ? "#55AAff" : "#fa8072"}));`}

  -webkit-transition-duration: 0.4s;
  transition-duration: 0.4s;
  transition-property: drop-shadow;
  // -webkit-transition: -webkit-transform 3s ease-in-out;

  background-position: 0 -460px;

  &:hover{
    ${props => `animation: ${props.anim} 1.2s steps(6) -.4s infinite;`}
  }
  
  @keyframes cycleThroughIdleAnims {
    to {
      background-position-x: 0px;
      background-position-y: 0px;
    }
    from {
      background-position-x: 0px;
      background-position-y: 1380px;
    }
  }  
`;

const SpritesWrapper = styled.div`

    transform: translate(-66px, -100px);
    display: flex;
    width: 100%;
    align-self: center;
    justify-content: space-around;

    // the two stand 'spacing' apart: half the width, with space-around
    max-width: ${props => props.spacing * 2}px;
`;

const CenteredLabelsContainer = styled.div`
    display: flex;
    width: 100%;
    justify-content: center;
`;

const LabelContainer = styled.div`

    position: absolute;
    ${props => `z-index: ${props.zIndex};`}
    
    display: flex;
    align-self: center;
    width: ${props => props.spacing + 120}px;

    ${props => props.labelContent == 'Player' ? "justify-content: flex-end;" : "justify-content: flex-start;"}

    transition-property: transform, color;
    transition-duration: 1s;

    color: ${props => props.selectedGender == 'guy' && props.labelContent == 'Player' || props.selectedGender == 'girl' && props.labelContent == 'Teammate' ? "#55AAff" : "#fa8072"};
`;

const SlidingLabel = styled.span`
    display: flex;
    flex-direction: column;
    justify-content: center;

    transition-property: transform;
    transition-duration: 1s;

    ${props => props.selectedGender == 'guy' ? props.labelContent == 'Player' ? "" : "" : props.labelContent == 'Player' ? `transform: translateX(${-props.spacing}px)` : `transform: translateX(${props.spacing}px)`}
`;

const StyledIcon = styled.i`
    align-self: center;
    ${props => props.rotate && `transform: translateY(20px) rotate(${props.rotate}deg);`}
`;

const UpDownAnim = styled.div`
    animation: up-down 1s linear infinite;

    @keyframes up-down {
        0%, 100% {
            transform: translate(0px, 0px);
        }
        50% {
            transform: translate(0px, -10px);
        }
    }
`;

const TopRightBottomLeftAnim = styled.div`
    animation: top-left-bottom-right 1s linear infinite;

    @keyframes top-left-bottom-right {
        0%, 100% {
            transform: translate(0px, 0px);
        }
        50% {
            transform: translate(5px, 5px);
        }
    }
`;

export const BlinkFadeEffect = styled.div`
  animation: blink-fade-${props => `${props.time ? props.time : 5}-${props.low ? props.low : 3}-${props.high ? props.high : 59}`} ${props => props.time ? props.time / 100 : .05}s linear infinite;

  @keyframes blink-fade-${props => `${props.time ? props.time : 5}-${props.low ? props.low : 3}-${props.high ? props.high : 59}`} {
    0% {
      ${props => `opacity: ${props.low ? props.low / 100 : .3};`}
    }
    20% {
      ${props => `opacity: ${props.high ? props.high / 100 : .59};`}
    }
    80% {
      ${props => `opacity: ${props.high ? props.high / 100 : .59};`}
    }
    100% {
      ${props => `opacity: ${props.low ? props.low / 100 : .3};`}
    }   
  }
`;

const DoodadSpriteSheet = styled.div`
  position: absolute;
  ${props => props.zIndex && `z-index: ${props.zIndex};`}
  pointer-events: none;
  ${props => `background: url(${props.src});`}

  width: 344px;
  height: 256px;

  filter: drop-shadow(0 0 5px #80EF80);

  animation: cycleThroughDoodad 1s steps(4) infinite;

  @keyframes cycleThroughDoodad {
    0% {
      background-position-x: 0px;
      background-position-y: 0px;
    }                         
    100% {
      background-position-x: -1376px;
      background-position-y: 0px;
    }
  }  
`;

const GreenGraphDoodad = styled.div`
  position: absolute;

  opacity: .8;

  ${props => props.zIndex && `z-index: ${props.zIndex};`}
  pointer-events: none;
  background: url('GreenGraph.png');

  width: 123px;
  height: 194px;

  filter: drop-shadow(0 0 5px #80EF80);

  transition: transform 1.5s;
  ${props => `transform: scale(${props.scale}) translate(${props.translation});`}

  /* 'isStatic' (the character select, Jamie 2026-11-12): a bad TV signal. It crackles with snow, blurs and
     brightens in fits, and shivers a pixel in place ('translate' adds to the transform above) */
  ${props => props.$isStatic && `
    animation: gridStaticShiver 1.1s steps(1) infinite;
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.28) 0 1px, transparent 1px 3px);
    }
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.6 0 0 0 0 1 0 0 0 0 0.6 0 0 0 2.2 -1'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
      mix-blend-mode: screen;
      opacity: 0.3;
      animation: gridStaticSnow 0.24s steps(1) infinite;
    }
    @keyframes gridStaticShiver {
      0% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      14% { translate: 1px 0; filter: drop-shadow(0 0 5px #80EF80) blur(1.1px) brightness(1.35); }
      18% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.3px); }
      41% { translate: -1px 1px; filter: drop-shadow(0 0 4px #80EF80) blur(0.8px) brightness(0.8); }
      45% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      68% { translate: 2px 0; filter: drop-shadow(0 0 6px #80EF80) blur(1.5px) brightness(1.6); }
      71% { translate: -1px -1px; filter: drop-shadow(0 0 5px #80EF80) blur(0.6px); }
      75% { translate: 0 0; filter: drop-shadow(0 0 5px #80EF80) blur(0.4px); }
      90% { translate: 0 1px; filter: drop-shadow(0 0 5px #80EF80) blur(0.9px) brightness(1.15); }
    }
    @keyframes gridStaticSnow {
      0% { background-position: 0 0; opacity: 0.3; }
      25% { background-position: -37px 21px; opacity: 0.45; }
      50% { background-position: 19px -43px; opacity: 0.22; }
      75% { background-position: -11px 57px; opacity: 0.5; }
    }
  `}
`;

const AlignSelfCenter = styled.div`
    display: flex;
    flex-direction: column;
    align-self: center;
`;

const DoodadsWrapper = styled.div`
    position: absolute;
    ${props => `transform: translate(${props.translation});`}
`;

const StyledMsg = styled.div`
    position: absolute;
    filter: none !important;

    align-self: flex-start;

    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    width: 100%;
    max-width: 1250px;

    ${props => `color: ${props.color ? props.color : '#D1001C'};`}

    ${props => props.color && `filter: drop-shadow(0 0 5px ${props.color});`} 

    ${props => `transform: rotate(${props.rotate});`}
`;

const PopupMsg = styled.span`
    display: flex;
    width: 250px;
    text-align: end;
    font-size: 16px;

    ${props => props.textAlign && `text-align: ${props.textAlign};`}
    ${props => props.fontSize && `font-size: ${props.fontSize};`}

    margin-left: -20px;
`;

const FadeInOutEffect = styled.div`
    transition: opacity ${props => props.ms || 1000}ms;
    ${props => `opacity: ${props.opacity};`} 
`;

const DoodadTransform = styled.div`
  transition: transform ${props => props.ms || 1500}ms ease-out, filter ${props => props.ms || 1500}ms;
  ${props => `transform: scale(${props.scale}) translate(${props.translation});`}
  ${props => props.$isFlash && `filter: brightness(1.9);`}
  ${props => props.$isOff && `opacity: 0;`}
`;

export const CircuitDiscSpriteSheet = styled.div`
  position: absolute;

  ${props => props.zIndex && `z-index: ${props.zIndex};`}

  transform: translate(-220px, 0px) scale(.8, .4);

  ${props => `filter:${props.persistDisc ?
    props.isRed ?
      ' drop-shadow(0 0 5px #fa8072) contrast(40%) saturate(300%)'
      : ' drop-shadow(0px 0px 5px #55aaff) contrast(40%) saturate(300%)'
    : ' drop-shadow(0 0 5px #80EF80) contrast(40%) saturate(300%)'};`}

  pointer-events: none;
  background: url(spritesheet/horizontal_circuit_disc_sprite.png);

  width: 592px;
  height: 359px;

  animation: playSpriteSheet 2s steps(9) infinite;

  @keyframes playSpriteSheet {
    0% {
      background-position-x: 0px;
      background-position-y: 0px;
    }                         
    100% {
      background-position-x: -5328px;
      background-position-y: 0px;
    }
  }  
`;

const PopupSpan = ({ color, msg, textAlign, fontSize }) =>
  <StyledMsg color={color}>
    <BlinkFadeEffect>
      <PopupMsg
        textAlign={textAlign}
        fontSize={fontSize}
      >{!!msg ? msg : 'Click'}
        <br />
          <UpDownAnim>
          <StyledIcon className='fa fa-caret-down' rotate={0} />
          </UpDownAnim>
      </PopupMsg>
    </BlinkFadeEffect>
  </StyledMsg>

const useOpacityEffect = ({ show, opacity, setOpacity, activeInterval, fadeInMs, fadeOutMs }) => useEffect(() => {
  const FADE_SPEED = 100; // 1 seconds to fade in or out
  // a quick fade: straight to 1 or 0, and the css transition (fadeInMs, fadeOutMs) does the fade
  if (show ? fadeInMs : fadeOutMs) {
    clearInterval(activeInterval.current);
    setOpacity(show ? 1 : 0);
    return;
  }
  if (!show && opacity > 0) {
    clearInterval(activeInterval.current);
    activeInterval.current = setInterval(() => {
      setOpacity(o => {
        if (o <= 0) clearInterval(activeInterval.current);
        return o > 0 ? o - .1 : 0
      });
    }, FADE_SPEED);
  } else if (show && opacity < 1) {
    clearInterval(activeInterval.current);
    activeInterval.current = setInterval(() => {
      setOpacity(o => {
        if (o >= 1) clearInterval(activeInterval.current);
        return o >= 1 ? 1 : o + .1
      });
    }, FADE_SPEED);
  }
}, [show]);

const useTranslationEffect = ({ STARTING_POSTIONS, show, setTranslations, activeInterval, accumulator }) => {
  const TRANSLATION_RANGE = 25; // max range // 25
  useEffect(() => {
    activeInterval.current = setInterval(() => {
      if (!show) {
        clearInterval(activeInterval.current);
        accumulator.current = 60;
      }
      setTranslations(ts => ts.map((t, i) => {
        if (i >= STARTING_POSTIONS.length) return t;

        // try to update 1-2 doodad(s) at a time
        // const mod = i + 4;
        // const shouldUpdate = accumulator.current % mod == 0;

        // accumulator.current += 3;

        // if (!shouldUpdate) return t;

        // if (shouldUpdate) {
        const start = STARTING_POSTIONS[i];
        const dx = Math.abs(t.x - start.x);
        const dy = Math.abs(t.y - start.y);

        if (dx > TRANSLATION_RANGE && dy > TRANSLATION_RANGE) {
          return start;
        } else {
          const negX = Math.random() > .5;
          const negY = Math.random() > .5;
          // i == 3 is the green graph doodad. restrict this doodad's movement
          const x = Math.random() * (i == 3 ? TRANSLATION_RANGE / 5 : TRANSLATION_RANGE);
          const y = Math.random() * (i == 3 ? TRANSLATION_RANGE / 5 : TRANSLATION_RANGE);
          return { x: start.x + (negX ? -x : x), y: start.y + (negY ? -y : y) };
        }
        // }
      }));
    }, 500);
  }, [show]);
}

// 'hasDisc': false leaves out the circuit disc on the floor (the character select, Jamie 2026-11-12)
/*
  Shown, the three doodads jump about their places (not the green graph), cut to the quick, uneven beat of a
  title sequence (Jamie, 2026-11-12, after Batman Beyond's intro): hard, near-instant moves on short beats, a held
  beat now and then, a flash on a cut, and now and then one blinks out for a beat.
  Their pointer lines never reach the green graph: a move is held back 'gapPx' from its edge.
*/
const DRIFT = {
  beatsMs: [120, 120, 240, 90, 90, 90, 360, 120, 240, 90, 480], // the rhythm, round and round
  cutMs: 60, // a move's glide: next to a hard cut
  rangePx: 45, // how far one jumps from its place (in the doodad's own pixels; on screen, x0.45)
  flashChance: 0.35,
  offChance: 0.12,
  gapPx: 6, // on screen, between a pointer line's end and the green graph
  count: 3
};
// where each doodad's pointer line ends on its sprite sheet (x, the furthest across its 4 frames): bars, heartbeat, vertices
const POINTER_TIPS_X = [176, 171, 175];
const GREEN_GRAPH = { width: 123, height: 194 };

// x held back so the pointer line's end stays clear of the green graph (it's left or right of it from the start)
const keepOffGraph = (x, start, tipX, graph) => {
  const graphLeft = GREEN_GRAPH.width / 2 + graph.scaleX * (graph.x - GREEN_GRAPH.width / 2);
  const graphRight = GREEN_GRAPH.width / 2 + graph.scaleX * (graph.x + GREEN_GRAPH.width / 2);
  const screenX = tx => start.scaleX * (tipX + tx); // transform: scale() translate(), from the top left
  const isLeft = screenX(start.x) < graphLeft;
  const limit = isLeft ? graphLeft - DRIFT.gapPx : graphRight + DRIFT.gapPx;
  const isClear = isLeft ? screenX(x) <= limit : screenX(x) >= limit;
  return isClear ? x : limit / start.scaleX - tipX;
};

const useDriftEffect = ({ isOn, starts, setTranslations }) => useEffect(() => {
  if (!isOn) {
    setTranslations(starts);
    return;
  }
  let beat = 0;
  let timeout;
  const cut = () => {
    const moving = 1 + Math.floor(Math.random() * DRIFT.count); // one to all three on a cut
    const order = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, moving);
    setTranslations(ts => ts.map((t, i) => {
      if (i >= DRIFT.count) return t;
      if (!order.includes(i)) return { ...t, isFlash: false, isOff: false };
      const start = starts[i];
      const x = start.x + (Math.random() * 2 - 1) * DRIFT.rangePx;
      return {
        ...start,
        x: keepOffGraph(x, start, POINTER_TIPS_X[i], starts[3]),
        y: start.y + (Math.random() * 2 - 1) * DRIFT.rangePx,
        isFlash: Math.random() < DRIFT.flashChance,
        isOff: Math.random() < DRIFT.offChance
      };
    }));
    timeout = setTimeout(cut, DRIFT.beatsMs[beat++ % DRIFT.beatsMs.length]);
  };
  cut();
  return () => clearTimeout(timeout);
}, [isOn]);

// 'isDrifting': the doodads jump about while shown, and the green graph is a staticky TV picture.
// 'fadeInMs', 'fadeOutMs': quicker fades than the 1 s ones
export const Doodads = ({ persistDisc, show, globalTranslation, isRed, opacity, setOpacity, hasPrompt = true, hasDisc = true, isDrifting = false, fadeInMs = undefined, fadeOutMs = undefined }) => {

  const { isAvatarChangedOnce } = useContext(GlobalSettingsContext);
  const STARTING_POSTIONS = [
    { x: -130, y: 30, scaleX: 0.45, scaleY: 0.45 },
    { x: 120, y: -310, scaleX: 0.45, scaleY: -0.45 },
    { x: -220, y: -400, scaleX: -0.45, scaleY: -0.45 },
    { x: 22, y: 25, scaleX: .7, scaleY: .77 }
  ];
  const activeOpacityInterval = useRef();
  const activeTranslationInterval = useRef();
  const accumulator = useRef(60);

  const [translations, setTranslations] = useState(STARTING_POSTIONS);

  // turning-off for now...
  // useTranslationEffect({ STARTING_POSTIONS, show, setTranslations, activeInterval: activeTranslationInterval, accumulator });
  useOpacityEffect({ show, opacity, setOpacity, activeInterval: activeOpacityInterval, fadeInMs, fadeOutMs });
  useDriftEffect({ isOn: isDrifting && show, starts: STARTING_POSTIONS, setTranslations });

  return <DoodadsWrapper translation={globalTranslation}>
    {hasPrompt &&
      !isAvatarChangedOnce &&
      !persistDisc &&
      <FadeInOutEffect opacity={1 - opacity}>
        <PopupSpan
          msg={'Click to change avatar'}
          color={'rgb(196 193 106)'}
          textAlign={'start'}
          fontSize={'13px'}
        />
      </FadeInOutEffect>}
    <FadeInOutEffect opacity={opacity} ms={show ? fadeInMs : fadeOutMs}>
      {hasPrompt && <PopupSpan
        msg={'Click to change avatar'}
        color={'#80EF80'}
        textAlign={'start'}
        fontSize={'13px'}
      />}
      <BlinkFadeEffect high={69} low={40}>
        <DoodadTransform scale={`${STARTING_POSTIONS[0].scaleX}, ${STARTING_POSTIONS[0].scaleY}`} translation={`${translations[0].x}px, ${translations[0].y}px`} ms={isDrifting ? DRIFT.cutMs : undefined} $isFlash={translations[0].isFlash} $isOff={translations[0].isOff}>
          <DoodadSpriteSheet
            src={"spritesheet/doo_dad_bars.png"}
            zIndex={110}
          />
        </DoodadTransform>
        <DoodadTransform scale={`${STARTING_POSTIONS[1].scaleX}, ${STARTING_POSTIONS[1].scaleY}`} translation={`${translations[1].x}px, ${translations[1].y}px`} ms={isDrifting ? DRIFT.cutMs : undefined} $isFlash={translations[1].isFlash} $isOff={translations[1].isOff}>
          <DoodadSpriteSheet
            src={"spritesheet/doo_dad_heartbeat.png"}
            zIndex={111}
          />
        </DoodadTransform>
        <DoodadTransform scale={`${STARTING_POSTIONS[2].scaleX}, ${STARTING_POSTIONS[2].scaleY}`} translation={`${translations[2].x}px, ${translations[2].y}px`} ms={isDrifting ? DRIFT.cutMs : undefined} $isFlash={translations[2].isFlash} $isOff={translations[2].isOff}>
          <DoodadSpriteSheet
            src={"spritesheet/doo_dad_vertices.png"}
            zIndex={112}
          />
        </DoodadTransform>
        <GreenGraphDoodad $isStatic={isDrifting} scale={`${STARTING_POSTIONS[3].scaleX}, ${STARTING_POSTIONS[3].scaleY}`} translation={`${translations[3].x}px, ${translations[3].y}px`} zIndex={108} />
      </BlinkFadeEffect>
      {hasDisc && <BlinkFadeEffect high={20} low={59} time={400}><CircuitDiscSpriteSheet isRed={!!isRed} zIndex={107} /></BlinkFadeEffect>}
      {persistDisc && <BlinkFadeEffect high={59} low={30}><CircuitDiscSpriteSheet isRed={!!isRed} zIndex={106} /></BlinkFadeEffect>}
    </FadeInOutEffect>
    {persistDisc && <BlinkFadeEffect high={59} low={30}><CircuitDiscSpriteSheet persistDisc={true} isRed={!!isRed} zIndex={105} /></BlinkFadeEffect>}
  </DoodadsWrapper>
};

const Sprite = ({ gender, onClick, selectedAvatar, globalTranslation }) => {

  const [setHoverRef, hoverLookupString] = useHover();
  const [opacity, setOpacity] = useState(0);

  return (<div>
    <SpriteSheet
      ref={setHoverRef(gender)}
      onClick={onClick}
      gender={gender}
      anim={gender == selectedAvatar ? "" : 'cycleThroughIdleAnims'}
      opacity={opacity}
    />
    <Doodads
      opacity={opacity}
      setOpacity={setOpacity}
      isRed={gender == 'girl'}
      persistDisc={gender == selectedAvatar}
      globalTranslation={globalTranslation}
      show={hoverLookupString == gender && selectedAvatar != gender} />
  </div>);
}

// 'spacing': how far apart the two stand, in pixels
// 'raise': css length to move the band up by, from where it sits
export const AvatarSelection = ({ spacing = 650, raise = undefined }) => {
  const { selectedAvatar, setSelectedAvatar, setIsAvatarChangedOnce } = useContext(GlobalSettingsContext);

  return <AvatarSelectionWrapper style={raise ? { marginTop: `calc(200px - ${raise})` } : undefined}>
    <SpritesWrapper spacing={spacing}>
      <Sprite
        gender={'girl'}
        onClick={() => {
          setIsAvatarChangedOnce(true);
          setSelectedAvatar('girl');
        }}
        selectedAvatar={selectedAvatar}
        globalTranslation={"-5px, 0px"}
      />
      <Sprite
        gender={'guy'}
        onClick={() => setSelectedAvatar('guy')}
        selectedAvatar={selectedAvatar}
        globalTranslation={"5px, 0px"}
      />
    </SpritesWrapper>
    <CenteredLabelsContainer>
      {/* default is "girl" = "Teammate", "guy" = "Player" */}
      <LabelContainer labelContent={"Teammate"} zIndex={3} selectedGender={selectedAvatar} spacing={spacing}>
        <SlidingLabel
          spacing={spacing}
          selectedGender={selectedAvatar}
          labelContent={"Teammate"}
        >
          <BlinkFadeEffect high={59} low={30}>
            <UpDownAnim>
              <AlignSelfCenter>
                <StyledIcon className="fa fa-caret-up" />
              </AlignSelfCenter>
            </UpDownAnim>
            Teammate
          </BlinkFadeEffect>
        </SlidingLabel>
      </LabelContainer>
      <LabelContainer labelContent={"Player"} zIndex={4} selectedGender={selectedAvatar} spacing={spacing}>
        <SlidingLabel
          spacing={spacing}
          selectedGender={selectedAvatar}
          labelContent={"Player"}
        >
          <BlinkFadeEffect high={59} low={30}>
            <UpDownAnim>
              <AlignSelfCenter>
                <StyledIcon className="fa fa-caret-up" />
              </AlignSelfCenter>
            </UpDownAnim>
            Player
          </BlinkFadeEffect>
        </SlidingLabel>
      </LabelContainer>
    </CenteredLabelsContainer>
  </AvatarSelectionWrapper>
}