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
  },
  /*
    Beside the monitor (phase 3, Jamie): the column starts just right of the casing, as big as the game allows but
    never over the monitor, and never taller than the frame (it shrinks to fit). Shares of the frame's width.
  */
  place: { gap: 0.012, top: 0.01 },
  /*
    The wires (Jamie): once a HUD has settled, a cable slithers from its left end to its socket on the casing's right
    side, sparking as it plugs in; leaving, the HUD rips it out. Sockets down the casing's side, as shares of its
    height; in design pixels otherwise.
  */
  wires: {
    sockets: { first: 0.22, step: 0.11 },
    plugMs: 700, // the slither to the socket
    arcsMs: 380, // sparking round the plug, then done
    ripMs: 420,
    width: 7,
    color: "#0e0f10",
    shine: "#3b3d41",
    sag: 70,
    arc: "#a8f4ff"
  }
};

const between = ([low, high]) => low + Math.random() * (high - low);
const sizeOf = variant => {
  const { plate, scale } = HUD_VARIANTS[variant];
  return { width: PLATES[plate].width * scale, height: PLATES[plate].height * scale };
};

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
  const columnRef = useRef(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
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
      // the column's place beside the monitor, and its scale (frame px); and the casing's sockets, in the column's px
      const column = columnRef.current;
      const frame = column && column.parentElement;
      const casing = frame && frame.querySelector("[data-tv-casing]");
      let sockets = [];
      if (column && frame) {
        const frameBox = frame.getBoundingClientRect();
        const casingBox = casing && casing.getBoundingClientRect();
        const gap = FLOCK.place.gap * frameBox.width;
        const top = FLOCK.place.top * frameBox.width;
        let columnScale = scaleRef.current;
        let left;
        if (casingBox && casingBox.width > 0) {
          left = casingBox.right - frameBox.left + gap;
          const roomWide = frameBox.right - casingBox.right - 2 * gap;
          columnScale = Math.min(columnScale, roomWide / FLOCK.columnWidth);
        } else {
          left = frameBox.width * 0.869 - FLOCK.columnWidth * columnScale; // (as it was, with no monitor about)
        }
        columnScale = Math.max(0.2, Math.min(columnScale, (frameBox.height - 2 * top) / Math.max(y, 1)));
        column.style.transform = `translate(${left}px, ${top}px) scale(${columnScale})`;
        if (casingBox && casingBox.width > 0) {
          const toColumn = (px, py) => ({ x: (px - frameBox.left - left) / columnScale, y: (py - frameBox.top - top) / columnScale });
          sockets = [...Array(8).keys()].map(k => toColumn(casingBox.right - 4, casingBox.top + casingBox.height * (FLOCK.wires.sockets.first + FLOCK.wires.sockets.step * k)));
        }
      }
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
        drawWires(ctx, list, slots, sockets, now, dt);
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

  /*
    The wires: each settled HUD's cable, from its left end (turned with it) to its socket; slithering in, sparking as it
    plugs in, ripped out as the HUD leaves (the socket end whipping after it).
  */
  const drawWires = (ctx, list, slots, sockets, now, dt) => {
    const { wires } = FLOCK;
    let socketIndex = 0;
    list.forEach(entry => {
      const body = bodies.current.get(entry.key);
      const slot = slots.get(entry.key);
      if (!body || now < body.born) return;
      const socket = entry.isLeaving ? body.wire && body.wire.socket : sockets[socketIndex++];
      if (!socket) return;
      body.wire = body.wire || { progress: 0, pluggedAt: undefined, socket };
      const wire = body.wire;
      if (!entry.isLeaving) wire.socket = socket;
      const settled = !entry.isLeaving && Math.hypot(body.vx, body.vy) < 160 && Math.abs(body.y - slot.y) < 40;
      if (entry.isLeaving) wire.progress = Math.max(0, wire.progress - (dt * 1000) / wires.ripMs);
      else if (settled || wire.progress > 0) wire.progress = Math.min(1, wire.progress + (dt * 1000) / wires.plugMs);
      if (wire.progress >= 1 && wire.pluggedAt === undefined) wire.pluggedAt = now;
      if (wire.progress <= 0) return;
      // the HUD's end: its left end, near the middle, turned with it about its middle
      const angle = (body.tilt * Math.PI) / 180;
      const rel = { x: -slot.width / 2 + 8, y: slot.height * 0.08 };
      const from = {
        x: body.x + slot.width / 2 + rel.x * Math.cos(angle) - rel.y * Math.sin(angle) + JETS_MARGIN,
        y: body.y + slot.height / 2 + rel.x * Math.sin(angle) + rel.y * Math.cos(angle) + JETS_MARGIN
      };
      // ripped: the socket end follows the HUD as it goes, whipping
      const to = entry.isLeaving
        ? { x: from.x + (wire.socket.x + JETS_MARGIN - from.x) * wire.progress, y: from.y + 60 * (1 - wire.progress) + (wire.socket.y + JETS_MARGIN - from.y) * wire.progress }
        : { x: wire.socket.x + JETS_MARGIN, y: wire.socket.y + JETS_MARGIN };
      const c1 = { x: from.x - 40, y: from.y + wires.sag };
      const c2 = { x: to.x + 50, y: to.y + wires.sag };
      const pointAt = t => {
        const u = 1 - t;
        return {
          x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y
        };
      };
      // slithering in: drawn as far as it's got, waving a little
      const reach = entry.isLeaving ? 1 : wire.progress;
      const wave = entry.isLeaving ? 0 : (1 - wire.progress) * 10;
      const points = [...Array(25).keys()].map(k => {
        const t = (k / 24) * reach;
        const point = pointAt(t);
        return { x: point.x, y: point.y + Math.sin(t * 14 + now / 90) * wave };
      });
      const stroke = (color, width, offset) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        points.forEach(({ x, y }, k) => (k ? ctx.lineTo(x + offset, y + offset) : ctx.moveTo(x + offset, y + offset)));
        ctx.stroke();
      };
      stroke(wires.color, wires.width, 0);
      stroke(wires.shine, wires.width * 0.28, -wires.width * 0.18);
      // the plug, in its socket
      if (!entry.isLeaving && wire.progress >= 1) {
        ctx.fillStyle = "#2a2b2e";
        ctx.fillRect(to.x - 4, to.y - 7, 14, 14);
      }
      // sparks: nearing the socket, and a moment after plugging in; and at the socket as it's ripped out
      const isSparking = (!entry.isLeaving && wire.progress > 0.7 && (wire.pluggedAt === undefined || now - wire.pluggedAt < wires.arcsMs))
        || (entry.isLeaving && wire.progress > 0.4);
      if (isSparking) {
        const tip = points[points.length - 1];
        const socketPoint = { x: wire.socket.x + JETS_MARGIN, y: wire.socket.y + JETS_MARGIN };
        ctx.strokeStyle = wires.arc;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = wires.arc;
        ctx.shadowBlur = 8;
        for (let bolt = 0; bolt < 2; bolt++) {
          ctx.beginPath();
          const end = { x: socketPoint.x - 3, y: socketPoint.y + (Math.random() - 0.5) * 22 };
          ctx.moveTo(tip.x, tip.y);
          for (let step = 1; step < 5; step++) {
            const share = step / 5;
            ctx.lineTo(tip.x + (end.x - tip.x) * share + (Math.random() - 0.5) * 8, tip.y + (end.y - tip.y) * share + (Math.random() - 0.5) * 8);
          }
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    });
  };

  return (
    <Column ref={columnRef}>
      <JetCanvas ref={canvasRef} width={FLOCK.columnWidth + JETS_MARGIN * 2} height={1400 + JETS_MARGIN} />
      {entries.map(entry => (
        <Body key={entry.key} ref={element => { if (element) elements.current.set(entry.key, element); else elements.current.delete(entry.key); }} style={{ visibility: "hidden" }}>
          <Hud pd={pdByKey.get(entry.key) || entry.pd} variant={entry.variant} isPaused={isPaused} />
        </Body>
      ))}
    </Column>
  );
};
