import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Hud } from "./Hud";
import { HUD_LOOK, HUD_VARIANTS, PLATES } from "./hudSpec";

/*
  The HUDs fly (Jamie, 2026-11-16, phase 2): each is a little drone with a place in the column (its slot). One small
  physics model moves them all: a spring pulls each to its slot, so they fly in from out of shot, settle with an
  overshoot, rise into the gaps the dead leave, and slide when their size changes; they hover with a slow drift; they
  tip with their sideways speed; they shove each other gently when they touch (the pod race in The Phantom Menace,
  kept subtle so the readouts never get lost); leaving, they thrust off out of shot. Air jets puff from under them,
  down for lift and angled away from the way they're going (one canvas for all of them).
  All in the HUD column's design pixels (the column scales with the game).
*/
export const FLOCK = {
  columnWidth: 400,
  spring: 34, // pull to the slot (per s²)
  damping: 7.5, // per s
  enter: { from: { x: 520, y: -260 }, staggerMs: 130 },
  exit: { to: { x: 640, y: -360 }, thrust: 2600, staggerMs: 110 },
  hover: { amplitude: 2.6, seconds: 3.4 }, // the drift round the slot
  tilt: { perSpeed: 0.035, max: 9, spring: 60, damping: 10 }, // degrees per px/s of sideways speed
  bump: { push: 900, margin: 4 }, // shoving apart when they touch
  jostle: { everyMs: [2200, 5200], kick: 26 }, // now and then, a small knock (air, or a neighbor)
  jets: {
    idlePerSecond: 6, // the hovering trickle: faint and small, so it never distracts
    idleStrength: 0.3,
    movingPerSecond: 70,
    movingFrom: 40, // px/s
    speed: [70, 140], // px/s, down
    sideways: 0.55, // of the HUD's sideways speed, the other way
    lifeMs: [380, 620],
    size: [5, 11],
    color: "232, 240, 246"
  }
};

const between = ([low, high]) => low + Math.random() * (high - low);
const sizeOf = variant => {
  const { plate, scale } = HUD_VARIANTS[variant];
  return { width: PLATES[plate].width * scale, height: PLATES[plate].height * scale };
};

const Column = styled.div`
  position: absolute;
  top: 1cqw;
  right: 13.1cqw;
  z-index: 2147483646;
  width: ${FLOCK.columnWidth}px;
  height: 0;
  transform-origin: top right;
  pointer-events: none;
`;

const Body = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
`;

// the jets' canvas: round the column, with room for HUDs in flight
const JETS_MARGIN = 700;
const JetCanvas = styled.canvas`
  position: absolute;
  left: -${JETS_MARGIN}px;
  top: -${JETS_MARGIN}px;
  pointer-events: none;
`;

/*
  'order': the HUDs that should show, top to bottom: { key, pd, variant }; 'scale': the column's; when one goes from the
  order (or 'isShowing' goes off), it thrusts off out of shot, and only then is it gone.
*/
export const HudFlock = ({ order, isShowing, scale = 1, isPaused }) => {
  const [entries, setEntries] = useState([]); // { key, pd, variant, isLeaving }
  const bodies = useRef(new Map()); // key → { x, y, vx, vy, tilt, vt, born, leftAt, seed }
  const elements = useRef(new Map());
  const canvasRef = useRef(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // the HUDs to draw: those in the order, and those still flying off
  useLayoutEffect(() => {
    setEntries(previous => {
      const shownKeys = new Set(isShowing ? order.map(({ key }) => key) : []);
      const next = (isShowing ? order : []).map(entry => ({ ...entry, isLeaving: false }));
      previous.forEach(entry => {
        if (!shownKeys.has(entry.key)) next.push({ ...entry, isLeaving: true });
      });
      return next;
    });
  }, [isShowing, order.map(({ key, variant, pd }) => `${key}:${variant}:${pd.lives}:${pd.isDead}`).join("|")]);
  // (the HUDs' contents update every frame from their own data: the order's identity is enough above)
  const pdByKey = new Map(order.map(entry => [entry.key, entry.pd]));

  useEffect(() => {
    let frameId;
    let last = performance.now();
    const particles = [];
    const run = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const list = entriesRef.current;
      // the slots: stacked down the column, right-aligned
      let y = 0;
      let leavingIndex = 0;
      const slots = new Map();
      list.forEach(entry => {
        const size = sizeOf(entry.variant);
        if (!entry.isLeaving) {
          slots.set(entry.key, { x: FLOCK.columnWidth - size.width, y, ...size });
          y += size.height + HUD_LOOK.gap;
        } else {
          slots.set(entry.key, { leavingIndex: leavingIndex++, ...size });
        }
      });
      // bring in the new ones, from out of shot, one after another
      let newIndex = 0;
      list.forEach(entry => {
        if (bodies.current.has(entry.key)) return;
        const slot = slots.get(entry.key);
        bodies.current.set(entry.key, {
          x: (slot.x || 0) + FLOCK.enter.from.x, y: (slot.y || 0) + FLOCK.enter.from.y, vx: 0, vy: 0, tilt: -12, vt: 0,
          born: now + newIndex++ * FLOCK.enter.staggerMs, leftAt: undefined, seed: Math.random() * 1000,
          nextKick: now + between(FLOCK.jostle.everyMs)
        });
      });
      const gone = [];
      list.forEach(entry => {
        const body = bodies.current.get(entry.key);
        const slot = slots.get(entry.key);
        if (!body || now < body.born) return;
        let ax;
        let ay;
        if (entry.isLeaving) {
          // thrust off, up and to the right
          if (body.leftAt === undefined) body.leftAt = now + slot.leavingIndex * FLOCK.exit.staggerMs;
          if (now < body.leftAt) {
            ax = -body.vx * FLOCK.damping;
            ay = -body.vy * FLOCK.damping;
          } else {
            const dirX = FLOCK.exit.to.x;
            const dirY = FLOCK.exit.to.y;
            const length = Math.hypot(dirX, dirY);
            ax = (FLOCK.exit.thrust * dirX) / length;
            ay = (FLOCK.exit.thrust * dirY) / length;
          }
          if (body.x > FLOCK.columnWidth + 900 || body.y < -900) gone.push(entry.key);
        } else {
          body.leftAt = undefined;
          // the slot, with a slow drift round it
          const t = (now / 1000 + body.seed) * ((2 * Math.PI) / FLOCK.hover.seconds);
          const target = { x: slot.x + Math.sin(t * 0.7) * FLOCK.hover.amplitude * 0.5, y: slot.y + Math.sin(t) * FLOCK.hover.amplitude };
          ax = FLOCK.spring * (target.x - body.x) - FLOCK.damping * body.vx;
          ay = FLOCK.spring * (target.y - body.y) - FLOCK.damping * body.vy;
          // now and then a small knock
          if (now > body.nextKick) {
            body.vx += (Math.random() - 0.5) * FLOCK.jostle.kick;
            body.vy += (Math.random() - 0.5) * FLOCK.jostle.kick;
            body.nextKick = now + between(FLOCK.jostle.everyMs);
          }
        }
        body.vx += ax * dt;
        body.vy += ay * dt;
      });
      // shoving: two that overlap push each other apart, and pass on some of their speed
      const flying = list.filter(entry => bodies.current.has(entry.key) && now >= bodies.current.get(entry.key).born && !entry.isLeaving);
      for (let i = 0; i < flying.length; i++) {
        for (let j = i + 1; j < flying.length; j++) {
          const a = bodies.current.get(flying[i].key);
          const b = bodies.current.get(flying[j].key);
          const sa = slots.get(flying[i].key);
          const sb = slots.get(flying[j].key);
          const overlapX = Math.min(a.x + sa.width, b.x + sb.width) - Math.max(a.x, b.x) + FLOCK.bump.margin;
          const overlapY = Math.min(a.y + sa.height, b.y + sb.height) - Math.max(a.y, b.y) + FLOCK.bump.margin;
          if (overlapX > 0 && overlapY > 0) {
            // apart along the shallower overlap
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
      // move, tip, and draw
      list.forEach(entry => {
        const body = bodies.current.get(entry.key);
        const element = elements.current.get(entry.key);
        if (!body) return;
        if (now >= body.born) {
          body.x += body.vx * dt;
          body.y += body.vy * dt;
          const tiltTarget = Math.max(-FLOCK.tilt.max, Math.min(FLOCK.tilt.max, body.vx * FLOCK.tilt.perSpeed));
          body.vt += (FLOCK.tilt.spring * (tiltTarget - body.tilt) - FLOCK.tilt.damping * body.vt) * dt;
          body.tilt += body.vt * dt;
        }
        if (element) {
          element.style.visibility = now >= body.born ? "visible" : "hidden";
          element.style.transform = `translate(${body.x}px, ${body.y}px) rotate(${body.tilt}deg)`;
        }
        // the jets: under its two ends, down, and away from the way it's going
        if (now < body.born || isPaused) return;
        const slot = slots.get(entry.key);
        const speed = Math.hypot(body.vx, body.vy);
        const isMoving = speed > FLOCK.jets.movingFrom;
        const rate = isMoving ? FLOCK.jets.movingPerSecond : FLOCK.jets.idlePerSecond;
        const strength = isMoving ? 1 : FLOCK.jets.idleStrength;
        let count = rate * dt;
        while (count > 0) {
          if (count < 1 && Math.random() > count) break;
          count -= 1;
          const side = Math.random() < 0.5 ? 0.18 : 0.62;
          particles.push({
            x: body.x + slot.width * side, y: body.y + slot.height * 0.92,
            vx: -body.vx * FLOCK.jets.sideways + (Math.random() - 0.5) * 30,
            vy: between(FLOCK.jets.speed) + Math.max(0, -body.vy) * 0.4,
            life: between(FLOCK.jets.lifeMs), age: 0, size: between(FLOCK.jets.size) * (isMoving ? 1 : 0.6), strength
          });
        }
      });
      if (gone.length) {
        gone.forEach(key => bodies.current.delete(key));
        setEntries(previous => previous.filter(entry => !gone.includes(entry.key)));
      }
      // the puffs: widening and fading as they go
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let k = particles.length - 1; k >= 0; k--) {
          const p = particles[k];
          p.age += dt * 1000;
          if (p.age > p.life) {
            particles.splice(k, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - 1.5 * dt;
          p.vy *= 1 - 1.2 * dt;
          const share = p.age / p.life;
          const radius = p.size * (0.5 + share * 1.6);
          ctx.fillStyle = `rgba(${FLOCK.jets.color}, ${0.55 * p.strength * (1 - share)})`;
          ctx.beginPath();
          ctx.arc(p.x + JETS_MARGIN, p.y + JETS_MARGIN, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frameId = requestAnimationFrame(run);
    };
    frameId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frameId);
  }, [isPaused]);

  return (
    <Column style={{ transform: `scale(${scale})` }}>
      <JetCanvas ref={canvasRef} width={FLOCK.columnWidth + JETS_MARGIN * 2} height={1400 + JETS_MARGIN} />
      {entries.map(entry => (
        <Body key={entry.key} ref={element => { if (element) elements.current.set(entry.key, element); else elements.current.delete(entry.key); }} style={{ visibility: "hidden" }}>
          <Hud pd={pdByKey.get(entry.key) || entry.pd} variant={entry.variant} isPaused={isPaused} />
        </Body>
      ))}
    </Column>
  );
};
