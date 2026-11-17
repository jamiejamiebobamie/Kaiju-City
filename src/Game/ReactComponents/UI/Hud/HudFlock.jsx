import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { getSmokeBox, Hud } from "./Hud";
import { HUD_LOOK, HUD_VARIANTS, PLATES } from "./hudSpec";
import { triggerHudExplosion } from "./HudExplosions";

/*
  The HUDs fly (Jamie, 2026-11-16): each is a little drone with a place in the column (its slot). One small physics
  model moves them all: a spring pulls each to its slot, so they fly in from out of shot, settle with an overshoot,
  rise into the gaps the dead leave, and slide when their size changes; they hover with a drift; they tip with their
  sideways speed; settled, they shove each other when they touch (the pod race in The Phantom Menace, kept subtle so
  the readouts never get lost). Leaving a scene, they thrust off out of shot.
  - Energy: casting powers livens a HUD up (a bigger drift, more knocks, more jostling); it settles down again.
  - Damage: the lower its avatar's health, the more it struggles to stay up (sagging, wobbling, its jets sputtering),
    with smoke trailing off its console and welder's sparks spraying from it, over it (its readouts flicker: Hud).
  - Dying: its readouts blink and fade to dark; then, its power gone, it drops like a jet that's lost its thrust,
    slowly at first, not turning, then faster, and tumbles hard off to the lower right; out of shot, it explodes
    (HudExplosions).
  Steam jets puff from under them (the side units' puffs), down for lift and away from the way they're going; cables
  (the side monitor's) slither from each to the monitor's side and plug in, sparking. All in the HUD column's design
  pixels (the column scales with the game).
*/
export const FLOCK = {
  columnWidth: 400,
  spring: 34, // pull to the slot (per s²)
  damping: 7.5, // per s
  enter: { from: { x: 520, y: -260 }, delayMs: 450, staggerMs: 130 }, // (a beat after its avatar shows on the board)
  exit: { to: { x: 640, y: -360 }, thrust: 2600, staggerMs: 110 },
  hover: { amplitude: 2.6, seconds: 3.4 }, // the drift round the slot
  tilt: { perSpeed: 0.035, max: 9, spring: 60, damping: 10 }, // degrees per px/s of sideways speed
  // shoving apart when they touch: only settled HUDs (near their slots), an overlap counted up to 'maxOverlap' px, and
  // a top speed, so a reflow never flings one off
  bump: { push: 900, margin: 4, maxOverlap: 10, settledWithin: 60 },
  maxSpeed: 1400,
  jostle: { everyMs: [2200, 5200], kick: 26 }, // now and then, a small knock (air, or a neighbor)
  // casting: each cast adds 'perCast' energy (up to 'max'), which drains 'decay' a second; at full energy the drift is
  // 'hover' times bigger, knocks come 'knocks' times as often and 'kick' times as hard
  energy: { perCast: 0.55, max: 1.6, decay: 0.32, hover: 3, knocks: 4, kick: 3.2 },
  // low health: a drunken flight. 'sag': how far below its slot it hangs at worst; sputtering (jets cutting out) now
  // and then, dropping, then catching
  struggle: { from: 0.15, sag: 16, wobble: 9, sputterEveryMs: [500, 1600], sputterMs: [180, 520], drop: 520 },
  // the steam jets (the side units' puffs: soft, white at the heart): down, away from the way it's going
  jets: {
    idlePerSecond: 7,
    idleStrength: 0.32,
    movingPerSecond: 60,
    movingFrom: 40, // px/s
    speed: [80, 150], // px/s, down
    sideways: 0.55, // of the HUD's sideways speed, the other way
    lifeMs: [360, 520],
    size: [9, 16], // its width, as it starts (it widens 2.2 times)
    color: [240, 246, 250],
    edge: [200, 214, 224]
  },
  // beside the monitor: just right of the casing, never over it, never taller than the frame. Shares of the frame's
  // width. 'smokeRoom': how much of the top HUD's passive smoke the column leaves room for (Jamie: some cut is fine)
  place: { gap: 0.012, top: 0.01, smokeRoom: 0.4 },
  // a crowd (compact HUDs): two to a row, each row after the first set over half a HUD, into the gap above (Jamie)
  crowd: { perRow: 2, gap: 10, rowGap: 8 },
  damage: {
    from: 0.85, // the health share where it starts
    // smoke off the console: soft wisps, stretched and turning, swaying as they rise and spread, a trail behind it
    smokePerSecond: 34,
    smoke: { rise: [36, 80], lifeMs: [1300, 2400], size: [10, 18], growth: 3.4, sway: 22, colors: [[96, 94, 92], [84, 68, 54], [40, 38, 41]], alpha: 0.42 },
    // the character select's sparks, washed-out yellow: bright dots with a glow, thrown up in an arc and falling
    burstsPerSecond: 1.6,
    spark: { perBurst: [4, 9], speed: [160, 380], arc: 0.6, lifeMs: [500, 900], gravity: 1100, size: 3, color: [242, 230, 176], glow: [216, 194, 122] }
  },
  // dying: dark over 'powerDownMs', then the drop; turning once it's moving 'spinFrom' px/s, faster and faster
  dying: { powerDownMs: 900, gravity: [90, 2200], rampMs: 1500, drift: 40, spinFrom: 330, spin: [160, 760], smokePerSecond: 80 },
  // the cables (the side monitor's): slithering from the HUD's left end to its socket, sparking as they plug in; ripped
  // out as the HUD leaves. In the frame's cqw (as the side monitor's), but for the sockets (shares of the casing's height)
  wires: {
    sockets: { first: 0.22, step: 0.11 },
    plugMs: 1100,
    arcsMs: 380,
    ripMs: 420,
    width: 0.75, shine: 0.16, sag: 5,
    color: "#0e0f10", shineColor: "#3b3d41",
    plug: { width: 1.3, height: 1.1, fill: "#2a2b2e", rim: "#4a4542" },
    arc: { color: "168, 244, 255", bolts: 2, spread: 2.6, jag: 0.7 }
  }
};

const between = ([low, high]) => low + Math.random() * (high - low);
// how far the top HUD's passive smoke reaches above it (column px): the column starts lower by a share of that
const SMOKE_HEADROOM = (() => {
  const { plate, scale } = HUD_VARIANTS.player;
  return Math.max(0, -Math.min(...PLATES[plate].passives.map(box => getSmokeBox(box).y)) * scale);
})();
export const getHudDamage = pd => {
  const health = pd && pd.maxLives ? pd.lives / pd.maxLives : 1;
  return Math.max(0, Math.min(1, (FLOCK.damage.from - health) / FLOCK.damage.from));
};
const sizeOf = variant => {
  const { plate, scale } = HUD_VARIANTS[variant];
  return { width: PLATES[plate].width * scale, height: PLATES[plate].height * scale };
};
const getCastSum = pd => (pd && pd.abilities ? pd.abilities.reduce((sum, { accTime }) => sum + (accTime || 0), 0) : 0);

const Column = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2147483646;
  width: ${FLOCK.columnWidth}px;
  height: 0;
  transform-origin: 0 0;
  pointer-events: none;
`;

const Body = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
`;

// the canvases round the column, with room for HUDs in flight: the back one (cables, jets) under the HUDs, the front
// one (smoke, sparks) over them
const MARGIN = 700;
const Canvas = styled.canvas`
  position: absolute;
  left: -${MARGIN}px;
  top: -${MARGIN}px;
  pointer-events: none;
`;

// a soft puff: a gradient blob (no hard edge), stretched and turned
const softPuff = (ctx, x, y, radius, [r, g, b], alpha, stretch = 1, angle = 0, edge = undefined) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1 / stretch);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  if (edge) gradient.addColorStop(0.55, `rgba(${edge[0]}, ${edge[1]}, ${edge[2]}, ${alpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/*
  'order': the HUDs that should show, top to bottom: { key, pd, variant }. 'deadKeys': whose avatars are dead (their
  HUDs die and fall); others gone from the order, or all of them when 'isShowing' goes off, fly off. 'isTopReserved':
  the controlled avatar has died and no one's taken over yet: the top slot waits for the next one.
*/
export const HudFlock = ({ order, isShowing, scale = 1, isPaused, deadKeys = [], isTopReserved = false }) => {
  const [entries, setEntries] = useState([]); // { key, pd, variant, isLeaving, isDying }
  const bodies = useRef(new Map());
  const elements = useRef(new Map());
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const columnRef = useRef(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const reservedRef = useRef(isTopReserved);
  reservedRef.current = isTopReserved;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const dead = new Set(deadKeys);

  // the HUDs to draw: those in the order, and those still dying or flying off
  useLayoutEffect(() => {
    setEntries(previous => {
      const shownKeys = new Set(isShowing ? order.map(({ key }) => key) : []);
      const next = (isShowing ? order : []).map(entry => ({ ...entry, isLeaving: false, isDying: false }));
      previous.forEach(entry => {
        if (shownKeys.has(entry.key)) return;
        next.push({ ...entry, isLeaving: true, isDying: entry.isDying || (!entry.isLeaving && dead.has(entry.key)) });
      });
      return next;
    });
  }, [isShowing, deadKeys.join("|"), order.map(({ key, variant }) => `${key}:${variant}`).join("|")]);
  const pdByKey = new Map(order.map(entry => [entry.key, entry.pd]));
  const pdRef = useRef(pdByKey);
  pdRef.current = pdByKey;
  const placeRef = useRef(undefined);

  useEffect(() => {
    let frameId;
    let last = performance.now();
    const back = []; // jets
    const front = []; // smoke, sparks
    const run = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const list = entriesRef.current;

      // the slots: the player's at the top (or room kept for it), the rest down the column, right-aligned; a crowd's
      // compact ones two to a row, staggered
      const slots = new Map();
      let y = 0;
      const live = list.filter(entry => !entry.isLeaving);
      if (reservedRef.current && live.length && live[0].variant != "player") y = sizeOf("player").height + HUD_LOOK.gap;
      let crowdIndex = 0;
      let crowdTop;
      live.forEach(entry => {
        const size = sizeOf(entry.variant);
        if (entry.variant == "compact") {
          if (crowdTop === undefined) crowdTop = y;
          const { perRow, gap, rowGap } = FLOCK.crowd;
          const row = Math.floor(crowdIndex / perRow);
          const col = crowdIndex % perRow;
          // (rows right-aligned; every other one set over half a HUD toward the monitor, into the gap above)
          const offset = row % 2 ? -(size.width + gap) / 2 : 0;
          const x = FLOCK.columnWidth - (perRow - col) * (size.width + gap) + gap + offset;
          slots.set(entry.key, { x, y: crowdTop + row * (size.height + rowGap), ...size });
          y = crowdTop + (row + 1) * (size.height + rowGap);
          crowdIndex += 1;
        } else {
          slots.set(entry.key, { x: FLOCK.columnWidth - size.width, y, ...size });
          y += size.height + HUD_LOOK.gap;
        }
      });
      // a crowd's rows can reach past the column's left: the column then starts that much further right of the monitor
      const reachLeft = Math.max(0, -Math.min(0, ...[...slots.values()].map(slot => slot.x)));
      let leavingIndex = 0;
      list.filter(entry => entry.isLeaving).forEach(entry => slots.set(entry.key, { leavingIndex: leavingIndex++, ...sizeOf(entry.variant) }));

      // the column's place beside the monitor, and its scale; the casing's sockets, in the column's px
      const column = columnRef.current;
      const frame = column && column.parentElement;
      const casing = frame && frame.querySelector("[data-tv-casing]");
      let sockets = [];
      let hole; // the casing, in the column's px: the wires go under it (Jamie, playtest 26: the plugs were over the monitor)
      let cqw = 1;
      if (column && frame) {
        const frameBox = frame.getBoundingClientRect();
        const casingBox = casing && casing.getBoundingClientRect();
        const gap = FLOCK.place.gap * frameBox.width;
        const top = FLOCK.place.top * frameBox.width;
        let columnScale = scaleRef.current;
        let left;
        if (casingBox && casingBox.width > 0) {
          columnScale = Math.min(columnScale, (frameBox.right - casingBox.right - 2 * gap) / (FLOCK.columnWidth + reachLeft));
          left = casingBox.right - frameBox.left + gap + reachLeft * columnScale;
        } else {
          left = frameBox.width * 0.869 - FLOCK.columnWidth * columnScale;
        }
        const headroom = SMOKE_HEADROOM * FLOCK.place.smokeRoom;
        columnScale = Math.max(0.2, Math.min(columnScale, (frameBox.height - 2 * top) / Math.max(y + headroom, 1)));
        const columnTop = top + headroom * columnScale;
        column.style.transform = `translate(${left}px, ${columnTop}px) scale(${columnScale})`;
        placeRef.current = { frameBox, left, top: columnTop, columnScale };
        cqw = frameBox.width / 100 / columnScale;
        if (casingBox && casingBox.width > 0) {
          const toColumn = (px, py) => ({ x: (px - frameBox.left - left) / columnScale, y: (py - frameBox.top - columnTop) / columnScale });
          const corner = toColumn(casingBox.left, casingBox.top);
          const far = toColumn(casingBox.right, casingBox.bottom);
          hole = { left: corner.x, top: corner.y, right: far.x, bottom: far.y };
          sockets = [...Array(10).keys()].map(k => toColumn(casingBox.right - 2, casingBox.top + casingBox.height * (FLOCK.wires.sockets.first + FLOCK.wires.sockets.step * k)));
        }
      }

      // bring in the new ones, from out of shot, a beat after their avatars show, one after another
      let newIndex = 0;
      list.forEach(entry => {
        if (bodies.current.has(entry.key)) return;
        const slot = slots.get(entry.key);
        bodies.current.set(entry.key, {
          x: (slot.x || 0) + FLOCK.enter.from.x, y: (slot.y || 0) + FLOCK.enter.from.y, vx: 0, vy: 0, tilt: -12, vt: 0,
          born: now + FLOCK.enter.delayMs + newIndex++ * FLOCK.enter.staggerMs, seed: Math.random() * 1000,
          nextKick: now + between(FLOCK.jostle.everyMs), energy: 0, casts: getCastSum(entry.pd),
          sputterUntil: 0, nextSputter: now + between(FLOCK.struggle.sputterEveryMs)
        });
      });

      const gone = [];
      list.forEach(entry => {
        const body = bodies.current.get(entry.key);
        const slot = slots.get(entry.key);
        if (!body || now < body.born) return;
        const pd = pdRef.current.get(entry.key) || entry.pd;
        // energy from casting
        const casts = getCastSum(pd);
        if (casts != body.casts) {
          body.energy = Math.min(FLOCK.energy.max, body.energy + FLOCK.energy.perCast);
          body.casts = casts;
        }
        body.energy = Math.max(0, body.energy - FLOCK.energy.decay * dt);
        body.damage = entry.isLeaving ? 0 : getHudDamage(pd);
        let ax;
        let ay;
        if (entry.isDying) {
          // dark first, hanging there; then the drop
          body.diedAt = body.diedAt ?? now;
          const sinceDeath = now - body.diedAt;
          if (sinceDeath < FLOCK.dying.powerDownMs) {
            ax = -body.vx * 3;
            ay = 60 - body.vy * 2;
          } else {
            const ramp = Math.min(1, (sinceDeath - FLOCK.dying.powerDownMs) / FLOCK.dying.rampMs);
            ax = FLOCK.dying.drift * ramp;
            ay = FLOCK.dying.gravity[0] + (FLOCK.dying.gravity[1] - FLOCK.dying.gravity[0]) * ramp * ramp;
          }
          const place = placeRef.current;
          if (place) {
            const screen = {
              x: place.frameBox.left + place.left + (body.x + slot.width / 2) * place.columnScale,
              y: place.frameBox.top + place.top + body.y * place.columnScale
            };
            if (screen.y > place.frameBox.bottom + 20 || screen.x > place.frameBox.right + slot.width * place.columnScale) {
              gone.push(entry.key);
              triggerHudExplosion({ x: Math.min(screen.x, place.frameBox.right - 170), y: window.innerHeight });
            }
          }
        } else if (entry.isLeaving) {
          // thrust off, up and to the right
          if (body.leftAt === undefined) body.leftAt = now + slot.leavingIndex * FLOCK.exit.staggerMs;
          if (now < body.leftAt) {
            ax = -body.vx * FLOCK.damping;
            ay = -body.vy * FLOCK.damping;
          } else {
            const length = Math.hypot(FLOCK.exit.to.x, FLOCK.exit.to.y);
            ax = (FLOCK.exit.thrust * FLOCK.exit.to.x) / length;
            ay = (FLOCK.exit.thrust * FLOCK.exit.to.y) / length;
          }
          if (body.x > FLOCK.columnWidth + 900 || body.y < -900) gone.push(entry.key);
        } else {
          body.leftAt = undefined;
          // the slot, with a drift round it: bigger with energy; sagging and wobbling when hurt
          const struggle = Math.max(0, (body.damage - FLOCK.struggle.from) / (1 - FLOCK.struggle.from));
          const t = (now / 1000 + body.seed) * ((2 * Math.PI) / FLOCK.hover.seconds);
          const amplitude = FLOCK.hover.amplitude * (1 + FLOCK.energy.hover * body.energy) + FLOCK.struggle.wobble * struggle;
          const target = {
            x: slot.x + Math.sin(t * 0.7) * amplitude * 0.5 + Math.sin(t * 2.3) * struggle * FLOCK.struggle.wobble * 0.6,
            y: slot.y + Math.sin(t) * amplitude + struggle * FLOCK.struggle.sag
          };
          const spring = FLOCK.spring * (1 - 0.45 * struggle);
          ax = spring * (target.x - body.x) - FLOCK.damping * body.vx;
          ay = spring * (target.y - body.y) - FLOCK.damping * body.vy;
          // sputtering: the jets cut out a moment, and it drops
          if (struggle > 0 && now > body.nextSputter) {
            if (Math.random() < struggle) body.sputterUntil = now + between(FLOCK.struggle.sputterMs);
            body.nextSputter = now + between(FLOCK.struggle.sputterEveryMs);
          }
          if (now < body.sputterUntil) ay += FLOCK.struggle.drop * struggle;
          // knocks: more often, and harder, with energy
          if (now > body.nextKick) {
            const kick = FLOCK.jostle.kick * (1 + FLOCK.energy.kick * body.energy);
            body.vx += (Math.random() - 0.5) * kick;
            body.vy += (Math.random() - 0.5) * kick;
            body.nextKick = now + between(FLOCK.jostle.everyMs) / (1 + FLOCK.energy.knocks * body.energy);
          }
        }
        body.vx += ax * dt;
        body.vy += ay * dt;
      });

      // shoving: settled ones that overlap push each other apart, and pass on some of their speed
      const settled = list.filter(entry => {
        const body = bodies.current.get(entry.key);
        const slot = slots.get(entry.key);
        return body && now >= body.born && !entry.isLeaving && Math.hypot(body.x - slot.x, body.y - slot.y) < FLOCK.bump.settledWithin;
      });
      for (let i = 0; i < settled.length; i++) {
        for (let j = i + 1; j < settled.length; j++) {
          const a = bodies.current.get(settled[i].key);
          const b = bodies.current.get(settled[j].key);
          const sa = slots.get(settled[i].key);
          const sb = slots.get(settled[j].key);
          const overlapX = Math.min(FLOCK.bump.maxOverlap, Math.min(a.x + sa.width, b.x + sb.width) - Math.max(a.x, b.x) + FLOCK.bump.margin);
          const overlapY = Math.min(FLOCK.bump.maxOverlap, Math.min(a.y + sa.height, b.y + sb.height) - Math.max(a.y, b.y) + FLOCK.bump.margin);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapY < overlapX) {
              const sign = a.y < b.y ? -1 : 1;
              a.vy += sign * FLOCK.bump.push * overlapY * dt;
              b.vy -= sign * FLOCK.bump.push * overlapY * dt;
            } else {
              const sign = a.x < b.x ? -1 : 1;
              a.vx += sign * FLOCK.bump.push * overlapX * dt;
              b.vx -= sign * FLOCK.bump.push * overlapX * dt;
            }
            const share = (b.vx - a.vx) * 0.15;
            a.vx += share;
            b.vx -= share;
          }
        }
      }

      // move, tip, and draw; emit jets, smoke and sparks
      list.forEach(entry => {
        const body = bodies.current.get(entry.key);
        const element = elements.current.get(entry.key);
        if (!body) return;
        const slot = slots.get(entry.key);
        if (now >= body.born) {
          const speed = Math.hypot(body.vx, body.vy);
          if (speed > FLOCK.maxSpeed && !entry.isLeaving) {
            body.vx *= FLOCK.maxSpeed / speed;
            body.vy *= FLOCK.maxSpeed / speed;
          }
          body.x += body.vx * dt;
          body.y += body.vy * dt;
          if (entry.isDying) {
            // not turning until it's really dropping; then tumbling, faster and faster
            if (body.vy > FLOCK.dying.spinFrom) {
              body.spinSince = body.spinSince ?? now;
              const spun = Math.min(1, (now - body.spinSince) / 900);
              body.tilt += (FLOCK.dying.spin[0] + (FLOCK.dying.spin[1] - FLOCK.dying.spin[0]) * spun) * dt;
            }
          } else {
            const struggle = Math.max(0, ((body.damage || 0) - FLOCK.struggle.from) / (1 - FLOCK.struggle.from));
            const tiltTarget = Math.max(-FLOCK.tilt.max, Math.min(FLOCK.tilt.max, body.vx * FLOCK.tilt.perSpeed))
              + Math.sin(now / 260 + body.seed) * 4 * struggle;
            body.vt += (FLOCK.tilt.spring * (tiltTarget - body.tilt) - FLOCK.tilt.damping * body.vt) * dt;
            body.tilt += body.vt * dt;
          }
        }
        if (element) {
          element.style.visibility = now >= body.born ? "visible" : "hidden";
          element.style.transform = `translate(${body.x}px, ${body.y}px) rotate(${body.tilt}deg)`;
        }
        if (now < body.born || isPaused) return;

        // smoke off its console: a trail of soft wisps (a dying one's, thick)
        const damage = entry.isDying ? 1 : body.damage || 0;
        if (damage > 0) {
          const { smoke } = FLOCK.damage;
          let count = (entry.isDying ? FLOCK.dying.smokePerSecond : FLOCK.damage.smokePerSecond * damage) * dt;
          while (count > 0) {
            if (count < 1 && Math.random() > count) break;
            count -= 1;
            front.push({
              kind: "smoke", x: body.x + slot.width * between([0.15, 0.6]), y: body.y + slot.height * between([0.25, 0.6]),
              vx: between([-10, 18]), vy: -between(smoke.rise), life: between(smoke.lifeMs), age: 0, size: between(smoke.size),
              color: smoke.colors[Math.floor(Math.random() * smoke.colors.length)], stretch: between([1.2, 2]), angle: Math.random() * Math.PI,
              spin: (Math.random() - 0.5) * 1.2, phase: Math.random() * 6
            });
          }
          // the character select's sparks, washed out: thrown up in an arc off its edge, falling
          if (!entry.isDying && Math.random() < FLOCK.damage.burstsPerSecond * damage * dt) {
            const { spark } = FLOCK.damage;
            const out = Math.random() < 0.5 ? -1 : 1;
            const from = { x: body.x + (out < 0 ? slot.width * 0.04 : slot.width * 0.7), y: body.y + slot.height * between([0.2, 0.8]) };
            const count2 = Math.round(between(spark.perBurst));
            for (let k = 0; k < count2; k++) {
              const speed = between(spark.speed);
              front.push({ kind: "spark", x: from.x, y: from.y, vx: out * speed * between([0.4, 1]), vy: -speed * spark.arc * Math.random(), life: between(spark.lifeMs), age: 0 });
            }
          }
        }
        if (entry.isDying) return; // (no jets: its power's gone)

        // the steam jets: under its two ends, down and away from its motion; sputtering when it's struggling
        if (now < body.sputterUntil) return;
        const speed = Math.hypot(body.vx, body.vy);
        const isMoving = speed > FLOCK.jets.movingFrom;
        const struggle = Math.max(0, ((body.damage || 0) - FLOCK.struggle.from) / (1 - FLOCK.struggle.from));
        let count = (isMoving ? FLOCK.jets.movingPerSecond : FLOCK.jets.idlePerSecond * (1 + body.energy * 2)) * (1 - 0.5 * struggle) * dt;
        const strength = isMoving ? 1 : FLOCK.jets.idleStrength + 0.3 * Math.min(1, body.energy);
        while (count > 0) {
          if (count < 1 && Math.random() > count) break;
          count -= 1;
          const side = Math.random() < 0.5 ? 0.18 : 0.62;
          back.push({
            kind: "jet", x: body.x + slot.width * side, y: body.y + slot.height * 0.9,
            vx: -body.vx * FLOCK.jets.sideways + (Math.random() - 0.5) * 30,
            vy: between(FLOCK.jets.speed) + Math.max(0, -body.vy) * 0.4,
            life: between(FLOCK.jets.lifeMs), age: 0, size: between(FLOCK.jets.size) * (isMoving ? 1 : 0.7), strength
          });
        }
      });
      if (gone.length) {
        gone.forEach(key => bodies.current.delete(key));
        setEntries(previous => previous.filter(entry => !gone.includes(entry.key)));
      }

      // draw: under the HUDs the cables and the jets; over them the smoke and the sparks
      const backCanvas = backRef.current;
      if (backCanvas) {
        const ctx = backCanvas.getContext("2d");
        ctx.clearRect(0, 0, backCanvas.width, backCanvas.height);
        // the wires (their plugs, their sparks) under the monitor's casing: nothing drawn inside it
        ctx.save();
        if (hole) {
          ctx.beginPath();
          ctx.rect(0, 0, backCanvas.width, backCanvas.height);
          ctx.rect(hole.left + MARGIN, hole.top + MARGIN, hole.right - hole.left, hole.bottom - hole.top);
          ctx.clip("evenodd");
        }
        drawWires(ctx, list, slots, sockets, now, dt, cqw);
        ctx.restore();
        for (let k = back.length - 1; k >= 0; k--) {
          const p = back[k];
          p.age += dt * 1000;
          if (p.age > p.life) {
            back.splice(k, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - 1.5 * dt;
          p.vy *= 1 - 1.2 * dt;
          const share = p.age / p.life;
          // (the side units' puff: a soft white heart, widening and fading)
          softPuff(ctx, p.x + MARGIN, p.y + MARGIN, (p.size / 2) * (0.35 + 1.85 * share), FLOCK.jets.color, 0.9 * p.strength * (1 - share), 1, 0, FLOCK.jets.edge);
        }
      }
      const frontCanvas = frontRef.current;
      if (frontCanvas) {
        const ctx = frontCanvas.getContext("2d");
        ctx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
        for (let k = front.length - 1; k >= 0; k--) {
          const p = front[k];
          p.age += dt * 1000;
          if (p.age > p.life) {
            front.splice(k, 1);
            continue;
          }
          const share = p.age / p.life;
          if (p.kind == "spark") {
            const { spark } = FLOCK.damage;
            p.vy += spark.gravity * dt;
            p.vx *= 1 - 0.8 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const alpha = share < 0.65 ? 1 : 1 - (share - 0.65) / 0.35;
            const size = spark.size * (1 - 0.6 * share);
            ctx.save();
            ctx.shadowColor = `rgba(${spark.glow.join(", ")}, ${alpha})`;
            ctx.shadowBlur = 7;
            ctx.fillStyle = `rgba(${spark.color.join(", ")}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x + MARGIN, p.y + MARGIN, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            continue;
          }
          // smoke: rising and slowing, swaying, spreading, turning; thin at first, then fading
          const { smoke } = FLOCK.damage;
          p.vy *= 1 - 0.35 * dt;
          p.x += (p.vx + Math.sin(p.phase + p.age / 300) * smoke.sway) * dt;
          p.y += p.vy * dt;
          p.angle += p.spin * dt;
          const alpha = smoke.alpha * (share < 0.2 ? share / 0.2 : 1 - (share - 0.2) / 0.8);
          softPuff(ctx, p.x + MARGIN, p.y + MARGIN, p.size * (0.6 + share * smoke.growth), p.color, alpha, p.stretch, p.angle);
        }
      }
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [isPaused]);

  /*
    The cables (the side monitor's look): from each HUD's left end (turned with it) to its socket, slithering in as
    they're drawn, a plug at the socket, arcs of current near the end and a moment after it plugs in; ripped out as the
    HUD leaves, the socket end whipping after it. Sizes in the frame's cqw ('cqw': column px in one).
  */
  const drawWires = (ctx, list, slots, sockets, now, dt, cqw) => {
    const { wires } = FLOCK;
    // each wire keeps its socket from the first plug-in until its HUD goes (Jamie, playtest 26: when one died, the others
    // re-plugged, each moving up a socket): a new one takes the first socket free
    const taken = new Set(list.map(entry => (bodies.current.get(entry.key) || {}).wire).filter(Boolean).map(wire => wire.socketIndex));
    list.forEach(entry => {
      const body = bodies.current.get(entry.key);
      const slot = slots.get(entry.key);
      if (!body || now < body.born) return;
      if (!body.wire) {
        if (entry.isLeaving) return;
        let socketIndex = 0;
        while (taken.has(socketIndex)) socketIndex += 1;
        taken.add(socketIndex);
        body.wire = { progress: 0, pluggedAt: undefined, socketIndex };
      }
      const wire = body.wire;
      // (the socket's point, from where the monitor is now: it moves)
      const socket = sockets[wire.socketIndex];
      if (!socket) return;
      wire.socket = socket;
      const isSettled = !entry.isLeaving && Math.hypot(body.vx, body.vy) < 160 && Math.abs(body.y - slot.y) < 40;
      // (a dying one's comes out as its power goes)
      if (entry.isLeaving) wire.progress = Math.max(0, wire.progress - (dt * 1000) / wires.ripMs);
      else if (isSettled || wire.progress > 0) wire.progress = Math.min(1, wire.progress + (dt * 1000) / wires.plugMs);
      if (wire.progress >= 1 && wire.pluggedAt === undefined) wire.pluggedAt = now;
      if (wire.progress <= 0) return;
      const angle = (body.tilt * Math.PI) / 180;
      const rel = { x: -slot.width / 2 + 8, y: slot.height * 0.08 };
      const from = {
        x: body.x + slot.width / 2 + rel.x * Math.cos(angle) - rel.y * Math.sin(angle) + MARGIN,
        y: body.y + slot.height / 2 + rel.x * Math.sin(angle) + rel.y * Math.cos(angle) + MARGIN
      };
      const socketPoint = { x: wire.socket.x + MARGIN, y: wire.socket.y + MARGIN };
      const to = entry.isLeaving
        ? { x: from.x + (socketPoint.x - from.x) * wire.progress, y: from.y + 6 * cqw * (1 - wire.progress) + (socketPoint.y - from.y) * wire.progress }
        : socketPoint;
      // the side monitor's curve, waving as it slithers in (5, -4, 2, 0 cqw)
      const drawn = entry.isLeaving ? 1 : 1 - Math.pow(1 - wire.progress, 2.2);
      const waveKeys = [5, -4, 2, 0];
      const at = Math.min(0.999, wire.progress) * (waveKeys.length - 1);
      const wave = (entry.isLeaving ? 0 : waveKeys[Math.floor(at)] + (waveKeys[Math.ceil(at)] - waveKeys[Math.floor(at)]) * (at % 1)) * cqw;
      const c1 = { x: from.x + wave, y: from.y + wires.sag * cqw };
      const c2 = { x: to.x + 6 * cqw - wave, y: to.y + wave * 0.6 };
      const pointAt = t => {
        const u = 1 - t;
        return {
          x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y
        };
      };
      const points = [...Array(29).keys()].map(k => pointAt((k / 28) * drawn));
      const stroke = (color, width, offset) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        points.forEach(({ x, y }, k) => (k ? ctx.lineTo(x + offset, y + offset) : ctx.moveTo(x + offset, y + offset)));
        ctx.stroke();
      };
      stroke(wires.color, wires.width * cqw, 0);
      stroke(wires.shineColor, wires.shine * cqw, -0.12 * cqw);
      // the plug, as the side monitor's: at the socket once it's in
      if (!entry.isLeaving && wire.progress > 0.85) {
        const { plug } = wires;
        ctx.globalAlpha = Math.min(1, (wire.progress - 0.85) / 0.15);
        ctx.fillStyle = plug.fill;
        ctx.strokeStyle = plug.rim;
        ctx.lineWidth = 0.1 * cqw;
        ctx.beginPath();
        ctx.roundRect(to.x - 0.2 * cqw, to.y - 0.55 * cqw, plug.width * cqw, plug.height * cqw, 0.2 * cqw);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // arcs, as the side monitor's: jagged, a glow and a white core, redrawn each frame
      const isSparking = (!entry.isLeaving && wire.progress > 0.6 && (wire.pluggedAt === undefined || now - wire.pluggedAt < wires.arcsMs))
        || (entry.isLeaving && wire.progress > 0.4);
      if (isSparking) {
        const { arc } = wires;
        const tip = points[points.length - 1];
        for (let bolt = 0; bolt < arc.bolts; bolt++) {
          const end = { x: socketPoint.x - 0.05 * cqw, y: socketPoint.y + (Math.random() - 0.5) * arc.spread * cqw };
          const path = [tip];
          for (let step = 1; step < 5; step++) {
            const share = step / 5;
            path.push({ x: tip.x + (end.x - tip.x) * share + (Math.random() - 0.5) * arc.jag * cqw, y: tip.y + (end.y - tip.y) * share + (Math.random() - 0.5) * arc.jag * 2 * cqw });
          }
          path.push(end);
          const line = (color, width) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            path.forEach(({ x, y }, k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
          };
          ctx.save();
          ctx.shadowColor = `rgba(${arc.color}, 0.9)`;
          ctx.shadowBlur = 0.5 * cqw;
          line(`rgba(${arc.color}, 0.55)`, 0.32 * cqw);
          ctx.restore();
          line("white", 0.1 * cqw);
        }
      }
    });
  };

  return (
    <Column ref={columnRef}>
      <Canvas ref={backRef} width={FLOCK.columnWidth + MARGIN * 2} height={1400 + MARGIN} />
      {entries.map(entry => (
        <Body key={entry.key} ref={element => { if (element) elements.current.set(entry.key, element); else elements.current.delete(entry.key); }} style={{ visibility: "hidden" }}>
          <Hud
            pd={entry.isDying ? { ...entry.pd, lives: 0 } : pdByKey.get(entry.key) || entry.pd}
            variant={entry.variant}
            isPaused={isPaused}
            damage={entry.isDying ? 1 : getHudDamage(pdByKey.get(entry.key) || entry.pd)}
            powerDownMs={entry.isDying ? FLOCK.dying.powerDownMs : undefined}
          />
        </Body>
      ))}
      <Canvas ref={frontRef} width={FLOCK.columnWidth + MARGIN * 2} height={1400 + MARGIN} />
    </Column>
  );
};
