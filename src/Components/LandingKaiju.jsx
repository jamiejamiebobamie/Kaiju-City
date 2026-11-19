import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import kaijuSea from "./data/kaijuSea.json";

/*
  The landing's Kaiju in the water (Jamie, 2026-11-19): one either side of the Peninsula, standing in the sea up to
  the middle of its thighs (the water hides the rest; the tail curls up out of it, its join to the body under water),
  a wake where it breaks the surface; black with a purple outline, as the logo's walking Kaiju. Now and then it rears
  up and roars, breathing purple fire. From scripts/landingKaiju.py: kaiju-sea.png (frames of one size, feet on one
  line), kaiju-fire.png (upright flames), data/kaijuSea.json (each frame's mouth and its body's spans by row).
  In the Peninsula picture's px: its place is where the water meets it (x: its legs' middle; y: the waterline), its
  'height' how tall it stands out of the water; 'waterRow': where in its frame the water cuts it.
*/
export const SEA_KAIJU = {
  sheet: "/zoom-scene/kaiju-sea.png",
  fireSheet: "/zoom-scene/kaiju-fire.png",
  outline: "rgb(191, 64, 191)",
  frameMs: 420,
  // idle, then the roar: rearing (frames 2-5), holding the widest (with fire), and back down
  idle: [0, 1, 0, 7, 6, 7],
  roar: [2, 3, 4, 5, 5, 5, 5, 4, 3, 2],
  fireOn: [4, 5],
  fire: { angle: 52, length: 1.05, seconds: 1.6 } // (degrees from upright toward its face; its length: of its height)
};

const Holder = styled.div`
  position: absolute;
  pointer-events: none;
  transition: opacity 1500ms ease-in-out;
`;

// the wake: foam along the waterline where the body and the tail break it, flickering, ripples spreading out
const Wake = ({ spans, scale, width }) => {
  const ref = useRef(null);
  const size = { width: Math.ceil(width + 24), height: 12 };
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frameId;
    const run = now => {
      const t = now / 1000;
      ctx.clearRect(0, 0, size.width, size.height);
      spans.forEach(([from, to], k) => {
        const a = 12 + from * scale, b = 12 + to * scale;
        // the foam on it: broken dashes, flickering
        for (let x = a - 2; x < b + 2; x += 1.5) {
          const on = Math.sin(t * 5 + x * 1.7 + k) > -0.2;
          if (!on) continue;
          ctx.fillStyle = `rgba(210, 228, 255, ${0.55 + 0.35 * Math.sin(t * 3 + x)})`;
          ctx.fillRect(Math.round(x), 2, 1.5, 1);
        }
        // ripples spreading out either side, fading
        const spread = (t * 0.6 + k * 0.3) % 1;
        ctx.fillStyle = `rgba(170, 205, 255, ${0.5 * (1 - spread)})`;
        ctx.fillRect(Math.round(a - 2 - spread * 10), 4, Math.round(3 + spread * 3), 1);
        ctx.fillRect(Math.round(b + spread * 10 - 1), 4, Math.round(3 + spread * 3), 1);
        ctx.fillStyle = `rgba(140, 180, 240, ${0.35 * (1 - spread)})`;
        ctx.fillRect(Math.round(a - 4 - spread * 16), 6, Math.round(2 + spread * 4), 1);
        ctx.fillRect(Math.round(b + spread * 16), 6, Math.round(2 + spread * 4), 1);
      });
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [spans, scale, width]);
  return <canvas ref={ref} width={size.width} height={size.height} style={{ position: "absolute", left: -12, top: -2, width: size.width, height: size.height, imageRendering: "pixelated" }} />;
};

// 'isMirrored': it faces left (the one on the right of the Peninsula); 'isShown': in (fades in and out)
export const SeaKaiju = ({ x, y, height, waterRow, isMirrored = false, isShown = true, delayMs = 0 }) => {
  const [step, setStep] = useState(0);
  const [fireStep, setFireStep] = useState(-1);
  const sequence = useRef([...SEA_KAIJU.idle, ...SEA_KAIJU.idle, ...SEA_KAIJU.roar]);
  useEffect(() => {
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => setStep(k => (k + 1) % sequence.current.length), SEA_KAIJU.frameMs);
    }, delayMs);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, []);
  const frame = sequence.current[step];
  const isBreathing = SEA_KAIJU.fireOn.includes(frame);
  // the fire's own frames: growing, roaring, dying away while the mouth is wide
  useEffect(() => {
    if (!isBreathing) { setFireStep(-1); return; }
    if (fireStep >= 0) return;
    let k = 0;
    setFireStep(0);
    const timer = setInterval(() => {
      k += 1;
      // (grow to the biggest, flicker between the two biggest while it lasts, then die away)
      const count = kaijuSea.fire.count;
      const roaring = k < 3 ? k : k < 9 ? (k % 2 ? count - 3 : count - 4) : Math.min(count - 1, k - 9 + count - 3);
      setFireStep(roaring);
      if (k > 12) clearInterval(timer);
    }, (SEA_KAIJU.fire.seconds * 1000) / 13);
    return () => clearInterval(timer);
  }, [isBreathing]);
  const [frameWidth, frameHeight] = kaijuSea.frame;
  const scale = height / waterRow;
  const width = frameWidth * scale;
  const spans = (kaijuSea.frames[frame].spans[Math.round(waterRow)] || []);
  const [mouthX, mouthY] = kaijuSea.frames[frame].mouth;
  const [fireWidth, fireHeight] = kaijuSea.fire.frame;
  const fireScale = (height * SEA_KAIJU.fire.length) / fireHeight;
  return (
    <Holder style={{ left: x - (frameWidth / 2) * scale, top: y - height, width, height, opacity: isShown ? 1 : 0, transform: isMirrored ? "scaleX(-1)" : undefined }}>
      {/* the body, cut by the water */}
      <div style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden", filter: `drop-shadow(0 0 0.6px ${SEA_KAIJU.outline}) drop-shadow(0 0 0.6px ${SEA_KAIJU.outline})` }}>
        <div style={{ width: frameWidth * kaijuSea.frames.length * scale, height: frameHeight * scale, backgroundImage: `url(${SEA_KAIJU.sheet})`, backgroundSize: "100% 100%", transform: `translateX(${-frame * width}px)` }} />
      </div>
      {/* its fire, from its mouth, turned toward its face and up */}
      {fireStep >= 0 && (
        <div style={{ position: "absolute", left: mouthX * scale - (fireWidth * fireScale) / 2, top: mouthY * scale - fireHeight * fireScale, width: fireWidth * fireScale, height: fireHeight * fireScale, transformOrigin: "50% 100%", transform: `rotate(${SEA_KAIJU.fire.angle}deg)`, backgroundImage: `url(${SEA_KAIJU.fireSheet})`, backgroundSize: `${kaijuSea.fire.count * 100}% 100%`, backgroundPosition: `${(fireStep / (kaijuSea.fire.count - 1)) * 100}% 0`, mixBlendMode: "plus-lighter" }} />
      )}
      {/* the wake along the waterline */}
      <div style={{ position: "absolute", left: 0, top: height - 1 }}>
        <Wake spans={spans} scale={scale} width={width} />
      </div>
    </Holder>
  );
};

/*
  The buoy (Jamie, 2026-11-19): a little pixel-art buoy out on the water, bobbing and rocking on the swell, its lamp
  turning: a beam sweeping round, and as it swings toward the viewer the lamp flares. 'onFacing' is called each time
  it faces the viewer (MainMenu flashes the scene on every third). In the Peninsula picture's px: its foot on the
  water, its size.
*/
export const BUOY = { turnSeconds: 3.6, beam: 34, colors: { red: "#b8282e", white: "#d9d6cf", dark: "#2a2732", lamp: "255, 240, 190" } };
export const Buoy = ({ x, y, size, onFacing }) => {
  const ref = useRef(null);
  const facingRef = useRef(onFacing);
  facingRef.current = onFacing;
  const box = { width: 140, height: 70 };
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const start = performance.now();
    let lastTurn = -1;
    let frameId;
    const px = (x0, y0, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x0), Math.round(y0), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    const run = now => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, box.width, box.height);
      const bob = Math.sin(t * 1.3) * 1.2 * size;
      const rock = Math.sin(t * 1.1 + 0.6) * 0.12;
      const baseX = box.width / 2, baseY = box.height - 10 + bob;
      // the lamp's turn: facing the viewer at a quarter past each turn
      const turn = t / BUOY.turnSeconds;
      const angle = turn * Math.PI * 2;
      const facing = Math.max(0, Math.sin(angle)); // (1: straight at us)
      if (Math.floor(turn - 0.25) > lastTurn && turn > 0.25) {
        lastTurn = Math.floor(turn - 0.25);
        facingRef.current && facingRef.current(lastTurn + 1);
      }
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(rock);
      const u = size;
      // the body: a cage on a red and white float, a dark ballast below the water line
      px(-4 * u, -1 * u, 8 * u, 3 * u, BUOY.colors.red);
      px(-3 * u, -3 * u, 6 * u, 2 * u, BUOY.colors.white);
      px(-2 * u, -9 * u, 1 * u, 6 * u, BUOY.colors.dark);
      px(1 * u, -9 * u, 1 * u, 6 * u, BUOY.colors.dark);
      px(-2 * u, -6 * u, 4 * u, 1 * u, BUOY.colors.red);
      px(-2 * u, -10 * u, 4 * u, 1 * u, BUOY.colors.dark);
      // the lamp, its glow brighter as it turns toward us
      const lampX = 0, lampY = -11.5 * u;
      const glow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, (3 + 9 * facing ** 3) * u);
      glow.addColorStop(0, `rgba(${BUOY.colors.lamp}, ${0.5 + 0.5 * facing})`);
      glow.addColorStop(1, `rgba(${BUOY.colors.lamp}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lampX, lampY, (3 + 9 * facing ** 3) * u, 0, Math.PI * 2);
      ctx.fill();
      px(lampX - 1 * u, lampY - 1 * u, 2 * u, 2 * u, `rgb(${BUOY.colors.lamp})`);
      ctx.restore();
      // its beam: sweeping round, seen side on (long) when it points across, short when toward or away from us
      const across = Math.cos(angle);
      const reach = BUOY.beam * u * Math.abs(across);
      if (reach > 1) {
        const tipX = baseX + Math.sign(across) * reach, tipY = baseY - 11.5 * u;
        const beam = ctx.createLinearGradient(baseX, 0, tipX, 0);
        beam.addColorStop(0, `rgba(${BUOY.colors.lamp}, ${0.45 * (1 - facing * 0.5)})`);
        beam.addColorStop(1, `rgba(${BUOY.colors.lamp}, 0)`);
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(baseX, tipY - 0.6 * u);
        ctx.lineTo(tipX, tipY - 2.5 * u);
        ctx.lineTo(tipX, tipY + 2.5 * u);
        ctx.lineTo(baseX, tipY + 0.6 * u);
        ctx.closePath();
        ctx.fill();
      }
      // a ripple ring on the water round its foot
      ctx.fillStyle = `rgba(170, 205, 255, ${0.35 + 0.15 * Math.sin(t * 2)})`;
      ctx.fillRect(Math.round(baseX - 6 * u), Math.round(box.height - 9), Math.round(12 * u), 1);
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [size]);
  return <canvas ref={ref} width={box.width} height={box.height} aria-hidden="true" style={{ position: "absolute", left: x - box.width / 2, top: y - box.height + 10, width: box.width, height: box.height, pointerEvents: "none", imageRendering: "pixelated" }} />;
};
