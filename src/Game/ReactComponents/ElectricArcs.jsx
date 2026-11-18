import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";

/*
  Electric arcs round a line of words (Jamie, playtest 34, after title cards with ghostly trails): now and then a
  shock snakes its way round some of the letters, over one and under the next, a bright head with a short trail,
  and is gone. Several at once, each on its own. Light purple and white.
  Wrap the words: <ElectricArcs text="Choose your character">Choose your character</ElectricArcs>
*/
const ARCS = {
  gapMs: [250, 900], // between one arc starting and the next
  runMs: [240, 400], // one arc's trip (twice as quick: Jamie, playtest 34; was 520 to 820)
  letters: [3, 8], // how many letters it winds round
  reach: 0.14, // how far above and below the letters it swings, of their height (hugging them: Jamie; was 0.45)
  jag: 0.1, // the zigzag between, of the letters' height (was 0.18)
  trail: 34, // its lit length, of 100 along its path
  strokes: { halo: 0.45, glow: 0.2, core: 0.08 }, // widths, of the letters' height
  core: "#ffffff",
  glow: "#d6a8ff"
};
const between = ([low, high]) => low + Math.random() * (high - low);

const run = keyframes`
  0% { stroke-dashoffset: 100; opacity: 0; }
  8% { opacity: 1; }
  45% { opacity: 0.85; }
  52% { opacity: 1; }
  100% { stroke-dashoffset: -${ARCS.trail}; opacity: 0.2; }
`;

const Wrap = styled.span`
  position: relative;
  display: inline-block;
  isolation: isolate;
`;
// the words over the arcs (Jamie, playtest 34: the arcs behind the text)
const Words = styled.span`
  position: relative;
  z-index: 1;
`;
const Layer = styled.svg`
  position: absolute;
  overflow: visible;
  pointer-events: none;
  left: 0;
  top: 0;
  z-index: 0;
`;
const ArcPath = styled.path`
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: ${ARCS.trail} 200;
  animation: ${run} var(--ms) cubic-bezier(0.4, 0, 0.7, 1) both;
`;

// a path round 'count' letters from 'first': over one, under the next, each stretch a curve bending round its
// letter, with a harsh corner where one curve meets the next (Jamie, playtest 34: curved, not a zigzag)
const makeArc = (width, height, letterCount) => {
  const letterWidth = width / Math.max(1, letterCount);
  const count = Math.round(between(ARCS.letters));
  const first = Math.floor(Math.random() * Math.max(1, letterCount - 1));
  const last = Math.min(letterCount, first + count);
  const isOverFirst = Math.random() < 0.5;
  const points = [];
  for (let k = first; k <= last; k++) {
    const x = k * letterWidth + (Math.random() - 0.5) * letterWidth * 0.3;
    const isOver = (k - first) % 2 == 0 ? isOverFirst : !isOverFirst;
    const y = isOver ? -height * ARCS.reach * (0.4 + Math.random() * 0.6) : height * (1 + ARCS.reach * (0.4 + Math.random() * 0.6));
    points.push([x, y]);
  }
  const fmt = n => n.toFixed(1);
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let k = 1; k < points.length; k++) {
    const [ax, ay] = points[k - 1];
    const [bx, by] = points[k];
    // leaving flat along its edge of the letters, swinging round, arriving flat on the other edge: an S round the
    // letter between; its handles pulled out unevenly, so each bend is its own
    const pull = letterWidth * (0.55 + Math.random() * 0.5);
    const wobble = () => (Math.random() - 0.5) * height * ARCS.jag * 2;
    d += ` C${fmt(ax + pull)} ${fmt(ay + wobble())} ${fmt(bx - pull * (0.6 + Math.random() * 0.6))} ${fmt(by + wobble())} ${fmt(bx)} ${fmt(by)}`;
  }
  return d;
};

export const ElectricArcs = ({ text, children, isOn = true }) => {
  const ref = useRef(null);
  const [arcs, setArcs] = useState([]); // { key, d, ms }
  useEffect(() => {
    if (!isOn) return;
    let timeout;
    let key = 0;
    const spawn = () => {
      const box = ref.current;
      if (box && box.offsetWidth > 0) {
        const ms = between(ARCS.runMs);
        const arc = { key: key++, d: makeArc(box.offsetWidth, box.offsetHeight, text.length), ms, size: Math.max(8, box.offsetHeight) };
        setArcs(list => [...list, arc]);
        setTimeout(() => setArcs(list => list.filter(other => other !== arc)), ms + 50);
      }
      timeout = setTimeout(spawn, between(ARCS.gapMs));
    };
    timeout = setTimeout(spawn, between(ARCS.gapMs));
    return () => clearTimeout(timeout);
  }, [isOn, text]);
  return (
    <Wrap ref={ref}>
      <Words>{children}</Words>
      <Layer width="1" height="1" aria-hidden="true">
        {arcs.map(({ key, d, ms, size }) => (
          <g key={key} style={{ "--ms": `${ms}ms` }}>
            <ArcPath d={d} pathLength="100" stroke={ARCS.glow} strokeWidth={size * ARCS.strokes.halo} style={{ filter: `blur(${size * 0.12}px)` }} />
            <ArcPath d={d} pathLength="100" stroke={ARCS.glow} strokeWidth={size * ARCS.strokes.glow} />
            <ArcPath d={d} pathLength="100" stroke={ARCS.core} strokeWidth={Math.max(1.2, size * ARCS.strokes.core)} style={{ filter: `drop-shadow(0 0 ${size * 0.1}px ${ARCS.glow})` }} />
          </g>
        ))}
      </Layer>
    </Wrap>
  );
};
