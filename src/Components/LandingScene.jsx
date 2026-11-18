import React, { useLayoutEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { TrafficLights } from "../Game/ReactComponents/GameBoard/TrafficLights";
import landingTraffic from "./data/landingTraffic.json";

/*
  The landing's scene (Jamie, 2026-11-18): the Lab windows' Peninsula, but seen straight up its middle (one-point
  perspective), the logo's own skyline standing on its tip, the moon over it, cars on its roads and glints on the water.
  It is placed by the logo's zoom spot (MainMenu's CITY_ZOOM.spot) and zooms about it with the skyline. Its own
  vanishing point (Jamie's mock-up): under the skyline's middle, on the horizon just above the skyline's ground, so the
  Peninsula runs straight up the screen's middle, the sea either side free (for the Kaiju sprites, a ship or buoy).
  The picture (scripts/labWindowView.py, LANDING=1) is drawn at half size and shown at twice it, pixelated; 'vanish':
  the zoom spot's point in it, in its own px.
*/
export const LANDING_VIEW = { src: "/zoom-scene/0-peninsula.png", size: { width: 1700, height: 1000 }, vanish: { x: 850, y: 380 }, scale: 2, fadeInMs: 1400 };

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Stage = styled.div`
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
`;

// the vanishing point: the zoom scales about it ('$zoom': MainMenu's zoom in or out, the logo's own keyframes)
const Anchor = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  ${props => props.$zoom}
`;

const View = styled.div`
  position: absolute;
  left: ${-LANDING_VIEW.vanish.x * LANDING_VIEW.scale}px;
  top: ${-LANDING_VIEW.vanish.y * LANDING_VIEW.scale}px;
  width: ${LANDING_VIEW.size.width}px;
  height: ${LANDING_VIEW.size.height}px;
  transform: scale(${LANDING_VIEW.scale});
  transform-origin: 0 0;
  background: url(${LANDING_VIEW.src}) 0 0 / 100% 100%;
  image-rendering: pixelated;
`;

const Fade = styled.div`
  position: absolute;
  inset: 0;
  animation: ${fadeIn} ${LANDING_VIEW.fadeInMs}ms ease-out both;
`;

// 'spot': the zoom spot, as shares across and down the logo's image ([data-landing-logo]); 'zoom': the css that zooms
// it (in on leaving, back out after Leave); 'isBack': the landing came back by the zoom out (no fade in then)
export const LandingScene = ({ spot, zoom, isBack = false }) => {
  const stageRef = useRef(null);
  const [vanish, setVanish] = useState(undefined);
  useLayoutEffect(() => {
    // placed from the logo's box (its wrapper's, and its offsets in it: they leave out the zoom's transforms) and the
    // stage's own (so a shift of the whole landing moves both alike)
    const place = () => {
      const logo = document.querySelector("[data-landing-logo]");
      const stage = stageRef.current;
      if (!logo || !logo.offsetParent || !stage) return;
      const holder = logo.offsetParent.getBoundingClientRect();
      const own = stage.getBoundingClientRect();
      setVanish({
        x: holder.left - own.left + logo.offsetLeft + spot.x * logo.offsetWidth,
        y: holder.top - own.top + logo.offsetTop + spot.y * logo.offsetHeight
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);
  const content = (
    <View>
      <TrafficLights paths={landingTraffic.paths} glints={landingTraffic.glints} width={LANDING_VIEW.size.width} height={LANDING_VIEW.size.height} zIndex={1} />
    </View>
  );
  return (
    <Stage ref={stageRef} aria-hidden="true">
      {vanish && (
        <Anchor $zoom={zoom} style={{ left: vanish.x, top: vanish.y }}>
          {isBack ? content : <Fade>{content}</Fade>}
        </Anchor>
      )}
    </Stage>
  );
};
