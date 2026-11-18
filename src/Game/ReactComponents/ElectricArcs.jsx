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
  runMs: [520, 820], // one arc's trip
  letters: [3, 8], // how many letters it winds round
  reach: 0.45, // how far above and below the letters it swings, of their height
  jag: 0.18, // the zigzag between, of the letters' height
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
`;
const Layer = styled.svg`
  position: absolute;
  overflow: visible;
  pointer-events: none;
  left: 0;
  top: 0;
`;
const ArcPath = styled.path`
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: ${ARCS.trail} 200;
  animation: ${run} var(--ms) cubic-bezier(0.4, 0, 0.7, 1) both;
`;

// a path round 'count' letters from 'first': above one, below the next, jagged between (the box's px)
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
    if (points.length) {
      // the zigzag on the way there, through the gap between the letters
      const [px, py] = points[points.length - 1];
      for (let step = 1; step <= 2; step++) {
        const share = step / 3;
        points.push([px + (x - px) * share + (Math.random() - 0.5) * letterWidth * 0.2, py + (y - py) * share + (Math.random() - 0.5) * height * ARCS.jag * 2]);
      }
    }
    points.push([x, y]);
  }
  return points.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
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
      {children}
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
