import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import LAYOUT from "./mockup.json";
import { ROOM } from "Components/RoomScene";
import { TV_LOOK } from "../GameBoard/PlayWindow";

/*
  The apartment mock-up (Jamie, 2026-11-24; dev only, at /apartment): a tool to lay out the room behind the
  Kaiju-Vision by hand, from the parts cut out of Jamie's apartment pictures (scripts/apartmentParts.py), over one of
  the pictures as a base. The main monitor, the coffee and the clock start where they are now.
  - Whole scene: the room picture, with the parts of it each camera shows outlined.
  - Game view: the room as the game places it behind the monitor, with the side elements turned on or off (the monitor
    moves aside for them, and the room with it, panned as the game does), zoomed out at will.
  - Export: the room picture as a PNG (public/apartment-scene/exports), for Jamie to regenerate with its lighting. That
    picture replaces the room (public/zoom-scene/3-room.png).
  The UI elements are pictures of the real ones (taken from the game at 1920 x 1080, by the capture script), placed as
  they were.
  Keys: arrows nudge (Shift: 10 px), + and - scale, F flip, H hide, Delete remove, [ and ] lower and raise,
  Ctrl+Z undo, Ctrl+S save.
*/
const ROOM_W = ROOM.size.width;
const ROOM_H = ROOM.size.height;
const VIEW = { width: 1920, height: 1080 }; // the captured game's screen (its 16:9 game frame filled it)
// the browser window the game is seen in, in its CSS px (Jamie's: a 1920 x 1080 display at 125%: 1528 x 732). The game
// frame is 16:9 in its middle, as big as fits (times the screen zoom); the room shows round it (Jamie, 2026-11-25)
const WINDOWS = { "Jamie's (1528 x 732)": { width: 1528, height: 732 }, "1920 x 1080": { width: 1920, height: 1080 }, "1366 x 768": { width: 1366, height: 768 } };
const PAN_MS = 900; // the room's slide when the monitor moves aside (as the game's, ROOM.settleMs)
const DRAFT_KEY = "kaiju-dev-apartment-mockup-draft";
// a short fingerprint of a layout: the draft remembers which saved layout it grew from
const getFingerprint = layout => {
  const text = JSON.stringify(layout);
  let hash = 0;
  for (let k = 0; k < text.length; k++) hash = (hash * 31 + text.charCodeAt(k)) | 0;
  return `${text.length}:${hash}`;
};
// the casing's border on the captured 1920-wide screen, in px (TV_LOOK.casingWidth: 3.2 cqw)
const TV_CASING_PX = (TV_LOOK.casingWidth / 100) * 1920;
const STAND_DROP = ROOM.stand.shelfTop - ROOM.monitor.bottom; // the stand's foot, below the monitor's bottom
const CLOCK_DIGITS = { src: "/zoom-scene/3-room-clock.png", dx: 2, dy: 2, width: 100, height: 50 }; // over the clock part
const ELEMENTS = [
  { id: "monitor", label: "Main monitor", from: "start" },
  { id: "side-monitor", label: "Side monitor", from: "picker", isSide: true },
  { id: "console", label: "Side console", from: "picker", isSide: true },
  { id: "dialogue", label: "Dialogue panel", from: "dialogue", isSide: true },
  { id: "huds", label: "HUDs", from: "fight", isSide: true }
];

const images = {};
const getImage = (src, onLoad) => {
  if (!images[src]) {
    const image = new Image();
    image.onload = onLoad;
    image.src = src;
    images[src] = image;
  }
  return images[src];
};
const isReady = image => !!image && image.complete && image.naturalWidth > 0;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const copy = value => JSON.parse(JSON.stringify(value));

// a layer's size and look, in the room's px
const getPartOf = (layout, parts, layer) => parts[layer.part] || (layout.customParts || []).find(part => part.id == layer.part);
const getLayerBox = (part, layer) => {
  const scale = layer.scale || 1;
  const box = part.box || part;
  return { x: layer.x, y: layer.y, width: box.width * scale, height: box.height * scale };
};

// the screen's shape as captured (the casing's width over its height); 'monitor.aspect' reshapes it (a preview: the
// game's own shape is playWindow.json, set with its "adjust window" dev option; drawMonitorPicture says how it'd look)
const getAspectStretch = (monitor, casing) => (monitor.aspect ? monitor.aspect / (casing.width / casing.height) : 1);

// where the monitor stands in the room, and the game's casing round it (the start screen's, as captured)
const getMonitorBox = (monitor, casing) => {
  const k = monitor.height / casing.height;
  const width = casing.width * k * getAspectStretch(monitor, casing);
  return { x: monitor.centerX - width / 2, y: monitor.bottom - monitor.height, width, height: monitor.height, k };
};

// the room's place on the game's screen for a casing there (as RoomScene's getRoomViewFor)
const getRoomRect = (monitor, casing) => {
  const k = casing.height / monitor.height;
  return { left: casing.x + casing.width / 2 - monitor.centerX * k, top: casing.y + casing.height - monitor.bottom * k, scale: k };
};

// every layout has the monitor as one of its layers (what's above it in the list is in front of it)
// and its stand, a layer of its own (Jamie: things between the stand and the screen), just under it to start with
const withMonitorLayer = layout => {
  let layers = layout.layers.some(layer => layer.type == "monitor") ? layout.layers : [...layout.layers, { key: "monitor", type: "monitor" }];
  if (!layers.some(layer => layer.type == "stand")) {
    const index = layers.findIndex(layer => layer.type == "monitor");
    layers = [...layers.slice(0, index), { key: "stand", type: "stand" }, ...layers.slice(index)];
  }
  return { ...layout, layers };
};
// the stand's box in the room (its neck and foot)
const getStandBox = monitor => {
  const { footWidth } = ROOM.stand;
  const shelfTop = monitor.bottom + STAND_DROP * (monitor.height / ROOM.monitor.height);
  return { x: monitor.centerX - footWidth / 2, y: monitor.bottom - 4, width: footWidth, height: shelfTop - monitor.bottom + 4 };
};

const tracePoly = (ctx, poly) => {
  ctx.beginPath();
  poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
};
const isInPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) != (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// a cover-up's box, in the room (its outline moved by its x and y)
const getPatchBox = layer => {
  const xs = layer.poly.map(([x]) => x), ys = layer.poly.map(([, y]) => y);
  return { x: Math.min(...xs) + layer.x, y: Math.min(...ys) + layer.y, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

const drawStand = (ctx, monitor) => {
  const { neckWidth, footWidth, footHeight, collarWidth, collarHeight } = ROOM.stand;
  const shelfTop = monitor.bottom + STAND_DROP * (monitor.height / ROOM.monitor.height);
  const x = monitor.centerX;
  const neck = ctx.createLinearGradient(x - neckWidth / 2, 0, x + neckWidth / 2, 0);
  [[0, "#121110"], [0.3, TV_LOOK.casing], [0.55, "#2a2725"], [0.8, TV_LOOK.casing], [1, "#121110"]].forEach(([at, color]) => neck.addColorStop(at, color));
  ctx.fillStyle = neck;
  ctx.fillRect(x - neckWidth / 2, monitor.bottom - 4, neckWidth, shelfTop - footHeight - monitor.bottom + 6);
  ctx.fillStyle = TV_LOOK.casing;
  ctx.beginPath();
  ctx.ellipse(x, monitor.bottom - 2 + collarHeight / 2, collarWidth / 2, collarHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - footWidth / 2, shelfTop - footHeight, footWidth, footHeight, [footHeight * 0.7, footHeight * 0.7, 3, 3]);
  ctx.fill();
};

/*
  The captured monitor at another screen shape, as the game would make it (Jamie, 2026-11-24):
  - the casing's border stays its thickness (TV_LOOK.casingWidth, in cqw of the frame), its corners and the things on it
    (Pause, Controls, Quit, the display, the label, the light, the knob) their shape and place: the casing grows or
    shrinks only in a plain strip of its top and bottom borders ('band', the captured picture's px)
  - the picture on the screen stays its size (the play camera's zoom is from the whole frame, not the screen): more of
    the scene shows at the sides. Here: the captured screen, centered, the new room at its sides filled with its own edges
    mirrored (a stand-in for "more of the same")
  'extra': how much wider (or narrower, below 0) the casing is, in the picture's px. Drawn with its top left at (x, y),
  'k' times the picture's size.
*/
const MONITOR_PICTURE = { band: [915, 935], screen: { x: 111, y: 88, right: 1005, bottom: 995, radius: 34, shade: 28 } };
const drawMonitorPicture = (ctx, image, x, y, k, extra) => {
  const [b0, b1] = MONITOR_PICTURE.band;
  const w = image.naturalWidth, h = image.naturalHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, b0, h, 0, 0, b0, h);
  const middle = Math.max(0, b1 - b0 + extra);
  if (middle > 0) ctx.drawImage(image, b0, 0, b1 - b0, h, b0, 0, middle, h);
  ctx.drawImage(image, b1, 0, w - b1, h, b1 + extra, 0, w - b1, h);
  if (extra != 0) {
    // the screen: the captured picture, centered, and its edges mirrored out to the new sides
    const { x: sx0, y: sy0, right: sx1, bottom: sy1, radius } = MONITOR_PICTURE.screen;
    const sw = sx1 - sx0, sh = sy1 - sy0, side = extra / 2;
    ctx.beginPath();
    ctx.roundRect(sx0, sy0, sw + extra, sh, radius);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(sx0, sy0, sw + extra, sh);
    // (the screen's own dark edge, 'shade' px in, left out of the joins: it showed as a seam; drawn again at the new edges)
    const shade = MONITOR_PICTURE.screen.shade;
    if (side >= 0) {
      const inner = { x0: sx0 + shade, x1: sx1 - shade };
      ctx.drawImage(image, inner.x0, sy0, inner.x1 - inner.x0, sh, inner.x0 + side, sy0, inner.x1 - inner.x0, sh);
      const strip = Math.min(side + shade, inner.x1 - inner.x0);
      ctx.save();
      ctx.translate(inner.x0 + side, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, inner.x0, sy0, strip, sh, 0, sy0, strip, sh);
      ctx.restore();
      ctx.save();
      ctx.translate(inner.x1 + side, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, inner.x1 - strip, sy0, strip, sh, -strip, sy0, strip, sh);
      ctx.restore();
      // (the stand-in sides dimmed, so they read as "more of the scene here", not as the screen's own)
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(sx0, sy0, side + shade, sh);
      ctx.fillRect(sx1 + side - shade, sy0, side + shade, sh);
      [[sx0, 1], [sx1 + extra, -1]].forEach(([edge, way]) => {
        const gradient = ctx.createLinearGradient(edge, 0, edge + way * shade, 0);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(way > 0 ? edge : edge - shade, sy0, shade, sh);
      });
    } else {
      // narrower: the middle of the picture, its sides cut off
      ctx.drawImage(image, sx0 - side, sy0, sw + extra, sh, sx0, sy0, sw + extra, sh);
    }
  }
  ctx.restore();
};
// the casing's extra width, in the captured picture's px, for the monitor's screen shape
const getMonitorExtra = (monitor, casing) => casing.width * (getAspectStretch(monitor, casing) - 1);

// the game view's monitor: the captured one, reshaped
const MonitorPiece = ({ src, extra, style }) => {
  const ref = useRef(null);
  const image = getImage(src);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !isReady(image)) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMonitorPicture(ctx, image, 0, 0, 1, extra);
  });
  return <canvas ref={ref} width={Math.max(1, Math.round(image.naturalWidth + extra))} height={image.naturalHeight || 1} style={style} />;
};

const drawMonitor = (ctx, monitor, states) => {
  if (monitor.look == "none" || !states) return;
  const start = states.start;
  const box = getMonitorBox(monitor, start.casing);
  if (monitor.look == "game") {
    const layer = start.layers.monitor;
    const image = getImage(layer.src);
    if (isReady(image)) drawMonitorPicture(ctx, image, box.x + (layer.x - start.casing.x) * box.k, box.y + (layer.y - start.casing.y) * box.k, box.k, getMonitorExtra(monitor, start.casing));
  } else {
    // off: the casing, its screen black (as the room's stand-in)
    ctx.fillStyle = TV_LOOK.casing;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, box.height * 0.06);
    ctx.fill();
    ctx.fillStyle = "#050606";
    ctx.beginPath();
    ctx.roundRect(box.x + box.width * 0.05, box.y + box.height * 0.09, box.width * 0.9, box.height * 0.84, box.height * 0.035);
    ctx.fill();
  }
};

/*
  The room picture: the base, then the layers in order (the monitor among them).
  'only': "all"; "back" (the base and what's behind the monitor, the monitor itself if 'withMonitor'); "front" (only
  what's in front of the monitor, on a clear ground: the game would draw it over its own monitor).
*/
const drawRoom = (ctx, { layout, parts, sources, states, isDigitsOn = true, only = "all", withMonitor = true }) => {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ROOM_W, ROOM_H);
  if (only != "front") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    const base = sources.find(({ id }) => id == layout.base);
    const baseImage = base && getImage(base.src);
    if (isReady(baseImage)) {
      ctx.globalAlpha = layout.baseOpacity ?? 1;
      ctx.drawImage(baseImage, 0, 0, ROOM_W, ROOM_H);
      ctx.globalAlpha = 1;
    }
  }
  const monitorIndex = layout.layers.findIndex(layer => layer.type == "monitor");
  layout.layers.forEach((layer, index) => {
    if (layer.hidden) return;
    const isFront = index > monitorIndex;
    if ((only == "back" && isFront) || (only == "front" && !isFront)) return;
    if (layer.type == "monitor") {
      if (withMonitor) drawMonitor(ctx, layout.monitor, states);
      return;
    }
    if (layer.type == "stand") {
      if (layout.monitor.look != "none") drawStand(ctx, layout.monitor);
      return;
    }
    if (layer.type == "patch") {
      // a cover-up: inside its outline, the source picture from 'dx', 'dy' away (a clone stamp)
      const source = sources.find(({ id }) => id == layer.source);
      const image = source && getImage(source.src);
      if (!isReady(image)) return;
      ctx.save();
      ctx.translate(layer.x, layer.y);
      tracePoly(ctx, layer.poly);
      ctx.translate(-layer.x, -layer.y);
      ctx.clip();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.drawImage(image, -layer.dx, -layer.dy, ROOM_W, ROOM_H);
      ctx.restore();
      return;
    }
    const part = getPartOf(layout, parts, layer);
    if (!part) return;
    const box = getLayerBox(part, layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.brightness !== undefined && layer.brightness != 1) ctx.filter = `brightness(${layer.brightness})`;
    ctx.translate(box.x + (layer.flip ? box.width : 0), box.y);
    ctx.scale((layer.flip ? -1 : 1) * (layer.scale || 1), layer.scale || 1);
    if (part.poly) {
      // a part cut in this tool: its outline over its source picture
      const source = sources.find(({ id }) => id == part.source);
      const image = source && getImage(source.src);
      ctx.translate(-part.box.x, -part.box.y);
      tracePoly(ctx, part.poly);
      ctx.clip();
      if (isReady(image)) ctx.drawImage(image, 0, 0, ROOM_W, ROOM_H);
    } else {
      const image = getImage(part.src);
      if (isReady(image)) ctx.drawImage(image, 0, 0, part.width, part.height);
    }
    ctx.restore();
    if (layer.part == "clock" && isDigitsOn) {
      const digits = getImage(CLOCK_DIGITS.src);
      const scale = layer.scale || 1;
      if (isReady(digits)) {
        ctx.save();
        ctx.shadowColor = "rgba(255, 40, 30, 0.9)";
        ctx.shadowBlur = 3;
        ctx.drawImage(digits, box.x + CLOCK_DIGITS.dx * scale, box.y + CLOCK_DIGITS.dy * scale, CLOCK_DIGITS.width * scale, CLOCK_DIGITS.height * scale);
        ctx.restore();
      }
    }
  });
};

// is the room point on the layer (a non-clear pixel of it)
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const isOnLayer = (layout, parts, states, layer, point) => {
  if (layer.hidden) return false;
  if (layer.type == "stand") {
    if (layout.monitor.look == "none") return false;
    const box = getStandBox(layout.monitor);
    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  }
  if (layer.type == "monitor") {
    if (layout.monitor.look == "none" || !states) return false;
    const box = getMonitorBox(layout.monitor, states.start.casing);
    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  }
  if (layer.type == "patch") return isInPoly(layer.poly, point.x - layer.x, point.y - layer.y);
  const part = getPartOf(layout, parts, layer);
  if (!part) return false;
  const box = getLayerBox(part, layer);
  if (point.x < box.x || point.y < box.y || point.x > box.x + box.width || point.y > box.y + box.height) return false;
  let u = (point.x - box.x) / (layer.scale || 1);
  const v = (point.y - box.y) / (layer.scale || 1);
  if (layer.flip) u = (box.width / (layer.scale || 1)) - u;
  if (part.poly) return isInPoly(part.poly, u + part.box.x, v + part.box.y);
  const image = getImage(part.src);
  if (!isReady(image)) return true;
  probe.canvas.width = 1;
  probe.canvas.height = 1;
  probe.clearRect(0, 0, 1, 1);
  probe.drawImage(image, Math.floor(u), Math.floor(v), 1, 1, 0, 0, 1, 1);
  return probe.getImageData(0, 0, 1, 1).data[3] > 24;
};

// ---- the look of the tool ----
const ui = {
  page: { position: "fixed", inset: 0, display: "flex", background: "#15161a", color: "#ddd", font: "13px system-ui, sans-serif", userSelect: "none" },
  side: { width: 270, flex: "none", overflowY: "auto", padding: 10, boxSizing: "border-box", borderRight: "1px solid #2c2e35", background: "#1b1c21" },
  right: { width: 300, flex: "none", overflowY: "auto", padding: 10, boxSizing: "border-box", borderLeft: "1px solid #2c2e35", background: "#1b1c21" },
  stage: { position: "relative", flex: 1, overflow: "hidden", background: "repeating-conic-gradient(#202127 0 25%, #1a1b20 0 50%) 0 0 / 24px 24px" },
  h: { margin: "12px 0 6px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#8fd18a" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 },
  thumb: { position: "relative", height: 62, background: "#0d0e11 center / contain no-repeat", border: "1px solid #333", borderRadius: 4, cursor: "pointer" },
  thumbLabel: { position: "absolute", left: 2, right: 2, bottom: 1, fontSize: 9, color: "#bbb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 0 3px #000" },
  button: { background: "#2b2d35", color: "#eee", border: "1px solid #444", borderRadius: 4, padding: "4px 8px", cursor: "pointer", font: "inherit" },
  on: { background: "#2f5a33", border: "1px solid #5dbb5a" },
  row: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "4px 0" },
  layer: { display: "flex", gap: 4, alignItems: "center", padding: "2px 4px", borderRadius: 3, cursor: "pointer" },
  input: { width: 62, background: "#101114", color: "#eee", border: "1px solid #444", borderRadius: 3, padding: "2px 4px", font: "inherit" }
};
const Button = ({ isOn = false, style = undefined, ...props }) => <button type="button" {...props} style={{ ...ui.button, ...(isOn ? ui.on : {}), ...style }} />;
const Num = ({ value, onChange, step = 1 }) => (
  <input type="number" step={step} value={Math.round(value * 1000) / 1000} onChange={({ target }) => target.value !== "" && onChange(Number(target.value))} style={ui.input} />
);

// ---- cutting a new part, or a cover-up: click round it on a source picture ----
// 'mode': "part" (with 'isLift': the part, and a cover-up where it was) or "cover"
const Cutter = ({ sources, sourceId, mode = "part", onDone, onCancel }) => {
  const [id, setId] = useState(sourceId);
  const [points, setPoints] = useState([]);
  const [label, setLabel] = useState("");
  const [isLift, setIsLift] = useState(true);
  const boxRef = useRef(null);
  const source = sources.find(each => each.id == id) || sources[0];
  const toPoint = event => {
    const box = boxRef.current.getBoundingClientRect();
    return [Math.round(((event.clientX - box.left) / box.width) * ROOM_W), Math.round(((event.clientY - box.top) / box.height) * ROOM_H)];
  };
  const finish = () => {
    if (points.length < 3) return;
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    onDone({ id: `cut-${Date.now().toString(36)}`, label: label || `Cut from ${source.id}`, source: source.id, poly: points, box }, mode == "part" && isLift);
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", padding: 16, gap: 8 }}>
      <div style={ui.row}>
        <b>{mode == "cover" ? "Cover up:" : "Cut a part:"}</b> {mode == "cover" ? "click round what to cover, then Finish (then Alt+drag on it to pick the wall that shows)." : "click round it on the picture, then Finish."} Source:
        {sources.map(each => <Button key={each.id} isOn={each.id == source.id} onClick={() => { setId(each.id); setPoints([]); }}>{each.id}</Button>)}
      </div>
      <div style={ui.row}>
        {mode == "part" && <input placeholder="Name" value={label} onChange={({ target }) => setLabel(target.value)} style={{ ...ui.input, width: 200 }} />}
        {mode == "part" && <label style={{ cursor: "pointer" }}><input type="checkbox" checked={isLift} onChange={() => setIsLift(on => !on)} /> Lift it out (cover where it was)</label>}
        <Button onClick={() => setPoints(list => list.slice(0, -1))}>Undo point</Button>
        <Button onClick={() => setPoints([])}>Clear</Button>
        <Button isOn={points.length >= 3} onClick={finish}>Finish ({points.length} points)</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div ref={boxRef} onClick={event => setPoints(list => [...list, toPoint(event)])}
          style={{ position: "relative", height: "100%", maxWidth: "100%", aspectRatio: `${ROOM_W} / ${ROOM_H}`, background: `url(${source.src}) 0 0 / 100% 100%`, imageRendering: "pixelated", cursor: "crosshair" }}>
          <svg viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <polygon points={points.map(point => point.join(",")).join(" ")} fill="rgba(93,187,90,0.25)" stroke="#5dff5a" strokeWidth="1.5" />
            {points.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={3} fill={k ? "#5dff5a" : "#ff0"} />)}
          </svg>
        </div>
      </div>
    </div>
  );
};

export const ApartmentMockup = () => {
  // (a draft kept in the browser as it changes, so a reload loses nothing; Save writes it to the repo)
  // (the draft is dropped when the saved file has changed since: Claude's edits of it show)
  const basis = useRef(getFingerprint(LAYOUT));
  const [layout, setLayout] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (draft && draft.basis == basis.current && draft.layout && Array.isArray(draft.layout.layers)) return withMonitorLayer(draft.layout);
    } catch (error) { /* (no draft) */ }
    return withMonitorLayer(copy(LAYOUT));
  });
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ basis: basis.current, layout })); }, [layout]);
  const [history, setHistory] = useState([]);
  const [data, setData] = useState({ parts: {}, partList: [], sources: [], states: null });
  const [selected, setSelected] = useState(undefined); // a layer's key, or "monitor"
  const [mode, setMode] = useState("game"); // game, scene
  const [shown, setShown] = useState({ monitor: true, "side-monitor": false, console: false, dialogue: false, huds: false });
  const [zoom, setZoom] = useState(1);
  const [isPanelsHidden, setIsPanelsHidden] = useState(false); // (Tab: more room for the room)
  const [isDimmed, setIsDimmed] = useState(true); // the game's own darkening of the room (ROOM.brightness)
  const [isCutting, setIsCutting] = useState(false); // false, "part" or "cover"
  const [exportWhat, setExportWhat] = useState("all"); // all, nomonitor, front
  // (the clock's 12:00 left out of the export: the game draws it, blinking, over the clock: Jamie, 2026-11-24)
  const [isDigitsExported, setIsDigitsExported] = useState(false);
  const [status, setStatus] = useState("");
  const [exportName, setExportName] = useState("apartment-mockup");
  const [exportScale, setExportScale] = useState(1);
  const [, setTick] = useState(0);
  const redraw = () => setTick(k => k + 1);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const frontRef = useRef(null); // game view: what's in front of the monitor, over the game's own monitor
  const [stage, setStage] = useState({ width: 800, height: 600 });

  useEffect(() => {
    Promise.all(["/apartment-scene/parts.json", "/apartment-scene/sources/sources.json", "/apartment-scene/ui/states.json"].map(url => fetch(url).then(response => response.json())))
      .then(([partList, sources, states]) => {
        const all = [{ id: "00", src: "/apartment-scene/sources/00-current.png", original: "the room now (3-room.png)" }, ...sources];
        setData({ parts: Object.fromEntries(partList.map(part => [part.id, part])), partList, sources: all, states });
      });
  }, []);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setStage({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  // every picture loaded draws again
  useEffect(() => {
    const srcs = [...data.partList.map(({ src }) => src), ...data.sources.map(({ src }) => src), CLOCK_DIGITS.src];
    if (data.states) Object.values(data.states).forEach(state => Object.values(state.layers).forEach(({ src }) => srcs.push(src)));
    srcs.forEach(src => getImage(src, redraw));
  }, [data]);

  // the clock's 12:00 blinks, as in the game
  const [isDigitsOn, setIsDigitsOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setIsDigitsOn(on => !on), 500);
    return () => clearInterval(id);
  }, []);

  // (drawn after every render: the layout, a picture loaded, the clock's blink)
  const isSplit = mode == "game" && shown.monitor;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.states) return;
    const common = { layout, parts: data.parts, sources: data.sources, states: data.states, isDigitsOn };
    drawRoom(canvas.getContext("2d"), { ...common, only: isSplit ? "back" : "all", withMonitor: !isSplit });
    if (frontRef.current) drawRoom(frontRef.current.getContext("2d"), { ...common, only: "front" });
  });

  // ---- changes, with undo ----
  const change = (update, isTracked = true) => {
    if (isTracked) setHistory(list => [...list.slice(-60), copy(layout)]);
    setLayout(current => { const next = copy(current); update(next); return next; });
  };
  const undo = () => setHistory(list => {
    if (!list.length) return list;
    setLayout(list[list.length - 1]);
    return list.slice(0, -1);
  });
  const updateLayer = (key, update, isTracked = true) => change(next => { const layer = next.layers.find(each => each.key == key); if (layer) update(layer); }, isTracked);
  const addLayer = part => {
    const key = `l${Date.now().toString(36)}`;
    const box = part.box || part;
    change(next => {
      const monitorIndex = next.layers.findIndex(layer => layer.type == "monitor");
      next.layers.splice(monitorIndex < 0 ? next.layers.length : monitorIndex, 0, { key, part: part.id, x: box.x, y: box.y, scale: 1 });
    });
    setSelected(key);
  };
  // a cover-up over the base: the wall from just left of it, to start with (Alt+drag picks another)
  const addCover = ({ poly, box }, source) => {
    const key = `p${Date.now().toString(36)}`;
    change(next => { next.layers.unshift({ key, type: "patch", poly, x: 0, y: 0, source: source || next.base || "02", dx: -(box.width + 10), dy: 0 }); });
    return key;
  };
  const moveLayer = (key, by) => change(next => {
    const index = next.layers.findIndex(each => each.key == key);
    const to = Math.max(0, Math.min(next.layers.length - 1, index + by));
    const [layer] = next.layers.splice(index, 1);
    next.layers.splice(to, 0, layer);
  });

  // ---- the camera: centered, or moved aside for the side elements (and the room panned with it) ----
  const isSideUp = ELEMENTS.some(({ id, isSide }) => isSide && shown[id]);
  const states = data.states;
  const stretch = states ? getAspectStretch(layout.monitor, states.start.casing) : 1;
  // (Jamie, 2026-11-24: each camera placed by hand, 'layout.cameras': { alone, side }, each { dx, dy } in the screen's px)
  const cameras = { alone: { dx: 0, dy: 0 }, side: { dx: 0, dy: 0 }, ...(layout.cameras || {}) };
  const getCameraCasing = isSide => {
    if (!states) return { x: 0, y: 0, width: 1, height: 1 };
    const captured = isSide ? states.picker.casing : states.start.casing;
    const { dx = 0, dy = 0 } = cameras[isSide ? "side" : "alone"];
    return { ...captured, width: captured.width * stretch, x: (isSide ? captured.x : captured.x - (captured.width * (stretch - 1)) / 2) + dx, y: captured.y + dy };
  };
  const targetCasing = getCameraCasing(isSideUp);
  const [casing, setCasing] = useState(targetCasing);
  const casingRef = useRef(casing);
  casingRef.current = casing;
  useEffect(() => {
    if (!states) return;
    const from = casingRef.current;
    const to = targetCasing;
    const start = performance.now();
    let frame;
    const step = () => {
      const t = ease(Math.min((performance.now() - start) / PAN_MS, 1));
      setCasing({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, width: from.width + (to.width - from.width) * t, height: from.height + (to.height - from.height) * t });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    if (from.width <= 1) setCasing(to);
    else frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isSideUp, !!states, stretch, JSON.stringify(cameras)]);

  // ---- where the room is drawn on the stage ----
  const fit = Math.min(stage.width / ROOM_W, stage.height / ROOM_H) * 0.96;
  // the screen zoom (Jamie, 2026-11-24): the whole game frame drawn smaller on the player's screen, round its middle,
  // the monitor and the side elements with it; the room follows the casing (as RoomBackdrop does), so more of it shows.
  // In the game: ?zoom= (dev), the game frame's size
  const screenZoom = layout.screenZoom || 1;
  // the window, and the game frame in it: the captured screen's px (the frame's, 1920 x 1080) to the window's
  const win = layout.window || WINDOWS["Jamie's (1528 x 732)"];
  const frameWidth = Math.min(win.width, (win.height * 16) / 9) * screenZoom;
  const frameK = frameWidth / VIEW.width;
  const frameAt = { x: (win.width - frameWidth) / 2, y: (win.height - frameWidth * 9 / 16) / 2 };
  const zoomBox = box => ({ ...box, x: frameAt.x + box.x * frameK, y: frameAt.y + box.y * frameK, width: box.width * frameK, height: box.height * frameK });
  const viewCasing = zoomBox(casing);
  // the game view's elements, in the game screen's px: each as captured, moved with the casing (the monitor reshaped
  // round it, from the start screen's; the side elements kept beside its right edge), then zoomed
  const elementBoxes = !states ? [] : ELEMENTS.filter(({ id }) => shown[id]).map(element => {
    const state = states[element.from];
    const layer = state.layers[element.id];
    if (!layer) return null;
    if (element.id == "monitor") {
      const extra = getMonitorExtra(layout.monitor, states.start.casing);
      return { ...element, layer, extra, x: casing.x + (layer.x - state.casing.x), y: layer.y, width: layer.width + extra, height: layer.height };
    }
    return { ...element, layer, x: layer.x + (casing.x + casing.width) - (state.casing.x + state.casing.width), y: layer.y, width: layer.width, height: layer.height };
  }).filter(Boolean).map(zoomBox);
  // fitted so the screen and everything shown is in view, between the panels (Jamie: a wider monitor pushed the side
  // monitor off it)
  // (and both cameras' screens, outlined over the room: the other one sits where the room pans to for it)
  const cameraScreens = !states ? [] : [false, true].map(isSide => {
    const captured = isSide ? states.picker.casing : states.start.casing;
    const other = getRoomRect(layout.monitor, zoomBox(getCameraCasing(isSide)));
    const now = getRoomRect(layout.monitor, viewCasing);
    return { x: now.left - other.left, y: now.top - other.top, width: win.width, height: win.height };
  });
  const bounds = [...elementBoxes, ...cameraScreens].reduce((all, box) => ({
    x0: Math.min(all.x0, box.x), y0: Math.min(all.y0, box.y), x1: Math.max(all.x1, box.x + box.width), y1: Math.max(all.y1, box.y + box.height)
  }), { x0: 0, y0: 0, x1: win.width, y1: win.height });
  const viewScale = Math.min((stage.width - 16) / (bounds.x1 - bounds.x0), (stage.height - 16) / (bounds.y1 - bounds.y0)) * zoom; // game view: stage px per screen px
  const frame = { left: stage.width / 2 - ((bounds.x0 + bounds.x1) / 2) * viewScale, top: stage.height / 2 - ((bounds.y0 + bounds.y1) / 2) * viewScale };
  const roomRect = states ? getRoomRect(layout.monitor, viewCasing) : { left: 0, top: 0, scale: 1 };
  const world = mode == "scene"
    ? { left: (stage.width - ROOM_W * fit) / 2, top: (stage.height - ROOM_H * fit) / 2, scale: fit }
    : { left: frame.left + roomRect.left * viewScale, top: frame.top + roomRect.top * viewScale, scale: roomRect.scale * viewScale };
  const toRoom = event => {
    const box = stageRef.current.getBoundingClientRect();
    return { x: (event.clientX - box.left - world.left) / world.scale, y: (event.clientY - box.top - world.top) / world.scale };
  };

  // ---- dragging ----
  const drag = useRef(null);
  const onPointerDown = event => {
    if (event.button != 0 || !states) return;
    const point = toRoom(event);
    const hit = [...layout.layers].reverse().find(layer => isOnLayer(layout, data.parts, states, layer, point));
    const target = hit && hit.key;
    setSelected(target);
    if (!target || target == "stand") return;
    setHistory(list => [...list.slice(-60), copy(layout)]);
    const layer = layout.layers.find(each => each.key == target);
    // (Alt on a cover-up: moves what wall shows in it, not the cover-up)
    drag.current = { target, from: point, isSource: layer.type == "patch" && event.altKey, start: target == "monitor" ? { ...layout.monitor } : { x: layer.x, y: layer.y, dx: layer.dx, dy: layer.dy } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const startCameraDrag = (event, box) => {
    event.stopPropagation();
    if (event.button != 0) return;
    setHistory(list => [...list.slice(-60), copy(layout)]);
    drag.current = { camera: box.camera, k: box.k, from: toRoom(event), start: { ...cameras[box.camera] } };
    stageRef.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = event => {
    if (!drag.current) return;
    const point = toRoom(event);
    if (drag.current.camera) {
      const { camera, k, from, start } = drag.current;
      // (the outline moved right over the room: the room moved left behind the monitor, so the monitor sits further right)
      const moved = Math.round((point.x - from.x) * k);
      change(next => { next.cameras = { ...cameras, [camera]: { ...start, dx: start.dx - moved } }; }, false);
      return;
    }
    const dx = Math.round(point.x - drag.current.from.x), dy = Math.round(point.y - drag.current.from.y);
    const { target, start, isSource } = drag.current;
    if (target == "monitor") change(next => { next.monitor.centerX = start.centerX + dx; next.monitor.bottom = start.bottom + dy; }, false);
    else if (isSource) updateLayer(target, layer => { layer.dx = start.dx - dx; layer.dy = start.dy - dy; }, false);
    else updateLayer(target, layer => { layer.x = start.x + dx; layer.y = start.y + dy; }, false);
  };
  const onPointerUp = () => { drag.current = null; };
  const scaleSelected = factor => {
    if (selected == "monitor") change(next => { next.monitor.height = Math.round(next.monitor.height * factor); });
    else if (selected) updateLayer(selected, layer => {
      if (layer.type == "patch") return;
      const part = getPartOf(layout, data.parts, layer);
      const box = getLayerBox(part, layer);
      const scale = Math.max(0.05, (layer.scale || 1) * factor);
      // about its middle
      layer.x = Math.round(box.x + box.width / 2 - ((part.box || part).width * scale) / 2);
      layer.y = Math.round(box.y + box.height / 2 - ((part.box || part).height * scale) / 2);
      layer.scale = Math.round(scale * 1000) / 1000;
    });
  };
  const onWheel = event => {
    if (!selected) return;
    scaleSelected(event.deltaY < 0 ? 1.04 : 1 / 1.04);
  };

  // ---- saving and exporting ----
  const save = async () => {
    setStatus("Saving...");
    const response = await fetch("/__apartment/save", { method: "POST", body: JSON.stringify(layout) });
    if (response.ok) {
      // (the file is this layout now: the draft grows from it)
      basis.current = getFingerprint(JSON.parse(JSON.stringify(layout)));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ basis: basis.current, layout }));
    }
    setStatus(response.ok ? `Saved ${new Date().toLocaleTimeString()} (src/Game/ReactComponents/ApartmentMockup/mockup.json)` : `Not saved: ${await response.text()}`);
  };
  const exportPng = async () => {
    const out = document.createElement("canvas");
    out.width = ROOM_W * exportScale;
    out.height = ROOM_H * exportScale;
    const ctx = out.getContext("2d");
    ctx.scale(exportScale, exportScale);
    drawRoom(ctx, { layout, parts: data.parts, sources: data.sources, states: data.states, isDigitsOn: isDigitsExported, only: exportWhat == "front" ? "front" : "all", withMonitor: exportWhat == "all" });
    const dataUrl = out.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${exportName}.png`;
    link.click();
    const response = await fetch("/__apartment/export", { method: "POST", body: JSON.stringify({ name: exportName, dataUrl }) });
    setStatus(response.ok ? `Exported: ${await response.text()} (and downloaded)` : `Downloaded, but not written: ${await response.text()}`);
  };

  // ---- keys ----
  const keysRef = useRef(null);
  keysRef.current = event => {
    if (isCutting || ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (event.key == "Tab") { event.preventDefault(); setIsPanelsHidden(hidden => !hidden); return; }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() == "z") { event.preventDefault(); undo(); return; }
    if (ctrl && event.key.toLowerCase() == "s") { event.preventDefault(); save(); return; }
    if (!selected) return;
    const step = event.shiftKey ? 10 : 1;
    const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (nudge) {
      event.preventDefault();
      if (selected == "monitor" || selected == "stand") change(next => { next.monitor.centerX += nudge[0]; next.monitor.bottom += nudge[1]; });
      else updateLayer(selected, layer => { layer.x += nudge[0]; layer.y += nudge[1]; });
    } else if (event.key == "+" || event.key == "=") scaleSelected(1.02);
    else if (event.key == "-") scaleSelected(1 / 1.02);
    else if (selected != "monitor" && selected != "stand" && (event.key == "f" || event.key == "F")) updateLayer(selected, layer => { layer.flip = !layer.flip; });
    else if (event.key == "h" || event.key == "H") updateLayer(selected, layer => { layer.hidden = !layer.hidden; });
    else if (selected != "monitor" && selected != "stand" && (event.key == "Delete" || event.key == "Backspace")) { change(next => { next.layers = next.layers.filter(each => each.key != selected); }); setSelected(undefined); }
    else if (event.key == "]") moveLayer(selected, 1);
    else if (event.key == "[") moveLayer(selected, -1);
  };
  useEffect(() => {
    const handle = event => keysRef.current(event);
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // ---- what's drawn over the room ----
  const selectedLayer = layout.layers.find(each => each.key == selected);
  const selectedBox = !states ? undefined
    : selected == "monitor" ? getMonitorBox(layout.monitor, states.start.casing)
    : selected == "stand" ? getStandBox(layout.monitor)
    : selectedLayer && selectedLayer.type == "patch" ? getPatchBox(selectedLayer)
    : selectedLayer && getPartOf(layout, data.parts, selectedLayer) ? getLayerBox(getPartOf(layout, data.parts, selectedLayer), selectedLayer) : undefined;
  const toStage = box => ({ left: world.left + box.x * world.scale, top: world.top + box.y * world.scale, width: box.width * world.scale, height: box.height * world.scale });
  // each camera's view of the room, outlined (the casing as reshaped for the screen's shape)
  const cameraBoxes = !states ? [] : [["Monitor alone", "#5dbb5a", false], ["Side elements up", "#d98cff", true]].map(([label, color, isSide]) => {
    const rect = getRoomRect(layout.monitor, zoomBox(getCameraCasing(isSide)));
    return { label, color, camera: isSide ? "side" : "alone", k: rect.scale, x: -rect.left / rect.scale, y: -rect.top / rect.scale, width: win.width / rect.scale, height: win.height / rect.scale };
  });
  const allParts = [...data.partList, ...(layout.customParts || [])];
  const partName = layer => layer.type == "monitor" ? "MAIN MONITOR (items above it are in front)" : layer.type == "stand" ? "Monitor stand (moves with the monitor)" : layer.type == "patch" ? `Cover-up (wall from ${layer.source})` : (getPartOf(layout, data.parts, layer) || {}).label || layer.part;

  return (
    <div style={ui.page}>
      {/* ---- the parts and the base ---- */}
      <div style={{ ...ui.side, display: isPanelsHidden ? "none" : undefined }}>
        <div style={ui.h}>Parts (click to add)</div>
        <div style={ui.grid}>
          {allParts.map(part => (
            <div key={part.id} title={`${part.label} (from ${part.source})`} onClick={() => addLayer(part)}
              style={{ ...ui.thumb, backgroundImage: part.poly ? `url(${(data.sources.find(({ id }) => id == part.source) || {}).src})` : `url(${part.src})`, ...(part.poly ? { backgroundSize: `${(ROOM_W / part.box.width) * 100}% ${(ROOM_H / part.box.height) * 100}%`, backgroundPosition: `${(part.box.x / Math.max(1, ROOM_W - part.box.width)) * 100}% ${(part.box.y / Math.max(1, ROOM_H - part.box.height)) * 100}%` } : {}) }}>
              <span style={ui.thumbLabel}>{part.label}</span>
            </div>
          ))}
        </div>
        <div style={ui.row}>
          <Button onClick={() => setIsCutting("part")}>Cut a new part...</Button>
          <Button onClick={() => setIsCutting("cover")}>Cover up...</Button>
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>Cut a part with "Lift it out" to move something in the base picture (the bookcase, a poster): it's cut out and its old spot covered with wall. Cover up hides something (Alt+drag on a cover-up picks the wall that shows).</div>
        <div style={ui.h}>Base picture</div>
        <div style={ui.grid}>
          <div onClick={() => change(next => { next.base = null; })} style={{ ...ui.thumb, ...(!layout.base ? { outline: "2px solid #5dbb5a" } : {}) }}><span style={ui.thumbLabel}>None</span></div>
          {data.sources.map(source => (
            <div key={source.id} title={source.original} onClick={() => change(next => { next.base = source.id; })}
              style={{ ...ui.thumb, backgroundImage: `url(${source.src})`, backgroundSize: "cover", ...(layout.base == source.id ? { outline: "2px solid #5dbb5a" } : {}) }}>
              <span style={ui.thumbLabel}>{source.id == "00" ? "00 now" : source.id}</span>
            </div>
          ))}
        </div>
        <div style={ui.row}>Opacity <input type="range" min="0" max="1" step="0.05" value={layout.baseOpacity ?? 1} onChange={({ target }) => change(next => { next.baseOpacity = Number(target.value); }, false)} /></div>
      </div>

      {/* ---- the room ---- */}
      <div ref={stageRef} style={ui.stage} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}>
        <canvas ref={canvasRef} width={ROOM_W} height={ROOM_H}
          style={{ position: "absolute", left: world.left, top: world.top, width: ROOM_W * world.scale, height: ROOM_H * world.scale, imageRendering: "pixelated", filter: mode == "game" && isDimmed ? `brightness(${ROOM.brightness})` : undefined }} />
        {mode == "game" && states && (() => {
          const frameStyle = { position: "absolute", left: frame.left, top: frame.top, width: win.width * viewScale, height: win.height * viewScale, pointerEvents: "none" };
          const place = box => {
            const style = { position: "absolute", left: box.x * viewScale, top: box.y * viewScale, width: box.width * viewScale, height: box.height * viewScale };
            return box.id == "monitor" ? <MonitorPiece key={box.id} src={box.layer.src} extra={box.extra} style={style} /> : <img key={box.id} src={box.layer.src} alt="" style={style} />;
          };
          const monitorBox = elementBoxes.find(({ id }) => id == "monitor");
          return (
            <>
              <div style={frameStyle}>{monitorBox && place(monitorBox)}</div>
              {/* what's in front of the monitor in the list: over the game's monitor */}
              <canvas ref={frontRef} width={ROOM_W} height={ROOM_H}
                style={{ position: "absolute", left: world.left, top: world.top, width: ROOM_W * world.scale, height: ROOM_H * world.scale, imageRendering: "pixelated", pointerEvents: "none", display: isSplit ? "block" : "none", filter: isDimmed ? `brightness(${ROOM.brightness})` : undefined }} />
              <div style={{ ...frameStyle, outline: "1px solid rgba(255,255,255,0.5)", boxShadow: zoom < 1 ? "0 0 0 9999px rgba(10,10,14,0.55)" : undefined }}>
                {elementBoxes.filter(({ isSide }) => isSide).map(place)}
              </div>
            </>
          );
        })()}
        {cameraBoxes.map(box => (
          <div key={box.label} style={{ position: "absolute", ...toStage(box), border: `1px dashed ${box.color}`, pointerEvents: "none" }}>
            <span title="Drag to move this camera across" onPointerDown={event => startCameraDrag(event, box)}
              style={{ position: "absolute", left: 4, top: box.camera == "side" ? 16 : 2, color: box.color, fontSize: 11, textShadow: "0 0 3px #000", pointerEvents: "auto", cursor: "ew-resize", background: "rgba(0,0,0,0.45)", padding: "0 4px", borderRadius: 3 }}>&#8596; {box.label}</span>
          </div>
        ))}
        {selectedBox && <div style={{ position: "absolute", ...toStage(selectedBox), outline: "1px solid #ffef5a", boxShadow: "0 0 0 1px rgba(0,0,0,0.6)", pointerEvents: "none" }} />}
        {isPanelsHidden && <Button style={{ position: "absolute", right: 8, top: 8 }} onPointerDown={event => event.stopPropagation()} onClick={() => setIsPanelsHidden(false)}>Show panels (Tab)</Button>}
        <div style={{ position: "absolute", left: 8, bottom: 6, fontSize: 11, color: "#999", pointerEvents: "none" }}>
          Drag to move · wheel or +/- to scale · arrows nudge (Shift 10) · F flip · H hide · Del remove · [ ] order · Ctrl+Z undo · Ctrl+S save
        </div>
      </div>

      {/* ---- the view, the layers, saving ---- */}
      <div style={{ ...ui.right, display: isPanelsHidden ? "none" : undefined }}>
        <div style={ui.h}>View</div>
        <div style={ui.row}>
          <Button isOn={mode == "game"} onClick={() => setMode("game")}>Game view</Button>
          <Button isOn={mode == "scene"} onClick={() => setMode("scene")}>Whole scene</Button>
          <Button onClick={() => setIsPanelsHidden(true)}>Hide panels (Tab)</Button>
        </div>
        {mode == "game" && (
          <>
            {ELEMENTS.map(({ id, label }) => (
              <label key={id} style={{ ...ui.row, cursor: "pointer" }}>
                <input type="checkbox" checked={!!shown[id]} onChange={() => setShown(all => ({ ...all, [id]: !all[id] }))} /> {label}
              </label>
            ))}
            <div style={ui.row}>
              <Button onClick={() => setShown(all => ({ ...all, "side-monitor": true, console: true, dialogue: false, huds: false }))}>Picker</Button>
              <Button onClick={() => setShown(all => ({ ...all, "side-monitor": false, console: false, dialogue: true, huds: false }))}>Talk</Button>
              <Button onClick={() => setShown(all => ({ ...all, "side-monitor": false, console: false, dialogue: false, huds: true }))}>Fight</Button>
              <Button onClick={() => setShown(all => ({ ...all, "side-monitor": false, console: false, dialogue: false, huds: false }))}>None</Button>
            </div>
            <div style={ui.row}>Zoom out <input type="range" min="0.2" max="1" step="0.01" value={zoom} onChange={({ target }) => setZoom(Number(target.value))} /> {Math.round(zoom * 100)}%</div>
            <label style={{ ...ui.row, cursor: "pointer" }}><input type="checkbox" checked={isDimmed} onChange={() => setIsDimmed(on => !on)} /> Game's dimming ({ROOM.brightness})</label>
          </>
        )}

        <div style={ui.h}>Browser window</div>
        <div style={ui.row}>
          <select value={Object.keys(WINDOWS).find(name => WINDOWS[name].width == win.width && WINDOWS[name].height == win.height) || ""} style={{ ...ui.input, width: 150 }}
            onChange={({ target }) => WINDOWS[target.value] && change(next => { next.window = { ...WINDOWS[target.value] }; })}>
            <option value="">Other</option>
            {Object.keys(WINDOWS).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <Num value={win.width} onChange={value => change(next => { next.window = { ...win, width: value }; })} />
          <Num value={win.height} onChange={value => change(next => { next.window = { ...win, height: value }; })} />
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>In CSS px, as the browser lays the page out (devtools shows it). The game frame is 16:9 in its middle; the room shows round it.</div>
        <div style={ui.h}>Cameras (the monitor's place on the screen)</div>
        {[["alone", "Monitor alone", "#5dbb5a"], ["side", "Side elements up", "#d98cff"]].map(([camera, label, color]) => (
          <div key={camera}>
            <div style={{ ...ui.row, color }}>{label}</div>
            <div style={ui.row}>
              across
              <input type="range" min="-700" max="700" step="1" value={cameras[camera].dx || 0}
                onChange={({ target }) => change(next => { next.cameras = { ...cameras, [camera]: { ...cameras[camera], dx: Number(target.value) } }; }, false)} />
              <Num value={cameras[camera].dx || 0} onChange={value => change(next => { next.cameras = { ...cameras, [camera]: { ...cameras[camera], dx: value } }; })} />
            </div>
            <div style={ui.row}>
              up / down <Num value={cameras[camera].dy || 0} onChange={value => change(next => { next.cameras = { ...cameras, [camera]: { ...cameras[camera], dy: value } }; })} />
              <Button onClick={() => change(next => { next.cameras = { ...cameras, [camera]: { dx: 0, dy: 0 } }; })}>Now</Button>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#999" }}>In px of the game frame at 1920 wide (right and down are more). Or drag a camera's label in the whole scene. The room pans with the monitor; the side elements stay beside its right edge. In the game: "Side elements up" is playWindow.json's left (now {states ? ((states.picker.casing.x + TV_CASING_PX) / VIEW.width).toFixed(3) : ""}, would be {states ? ((states.picker.casing.x + TV_CASING_PX + (cameras.side.dx || 0)) / VIEW.width).toFixed(3) : ""}); "Monitor alone" is centered now, an offset would be new.</div>
        <div style={ui.h}>Screen zoom</div>
        <div style={ui.row}>
          <input type="range" min="0.5" max="1" step="0.01" value={screenZoom} onChange={({ target }) => change(next => { next.screenZoom = Number(target.value); }, false)} />
          {Math.round(screenZoom * 100)}%
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>The whole view zoomed out: the monitor and the side elements smaller on the player's screen (their words and the game in them too), more of the room round them. Try it in the game: <a href={`/?zoom=${screenZoom}${layout.monitor.aspect ? `&screen=${layout.monitor.aspect}` : ""}`} target="_blank" rel="noreferrer" style={{ color: "#8fd18a" }}>this zoom and shape</a></div>
        <div style={ui.h}>Main monitor</div>
        <div style={ui.row}>
          Room zoom
          <input type="range" min="0.5" max="1.5" step="0.01" value={ROOM.monitor.height / layout.monitor.height}
            onChange={({ target }) => change(next => { next.monitor.height = Math.round(ROOM.monitor.height / Number(target.value)); }, false)} />
          {Math.round((ROOM.monitor.height / layout.monitor.height) * 100)}%
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>Lower shows more of the room round the monitor (the monitor stays its size on the game's screen, so in the room it's bigger). It's the monitor's height below; in the game, ROOM.monitor.height.</div>
        <div style={ui.row}>
          <span>x</span><Num value={layout.monitor.centerX} onChange={value => change(next => { next.monitor.centerX = value; })} />
          <span>bottom</span><Num value={layout.monitor.bottom} onChange={value => change(next => { next.monitor.bottom = value; })} />
        </div>
        <div style={ui.row}>
          <span>height</span><Num value={layout.monitor.height} onChange={value => change(next => { next.monitor.height = value; })} />
          <select value={layout.monitor.look} onChange={({ target }) => change(next => { next.monitor.look = target.value; })} style={ui.input}>
            <option value="game">Game screen</option>
            <option value="dead">Off</option>
            <option value="none">Hidden</option>
          </select>
        </div>
        <div style={ui.row}>
          <span>screen shape (width / height)</span>
          <Num step={0.01} value={layout.monitor.aspect || (states ? states.start.casing.width / states.start.casing.height : 1)} onChange={value => change(next => { next.monitor.aspect = Math.max(0.3, value); })} />
          <Button onClick={() => change(next => { delete next.monitor.aspect; })}>Now</Button>
        </div>
        <div style={ui.row}>
          <Button onClick={() => window.open(`/?screen=${Math.round((layout.monitor.aspect || (states ? states.start.casing.width / states.start.casing.height : 1)) * 1000) / 1000}`, "_blank")}>Try this shape in the game</Button>
        </div>
        <div style={{ fontSize: 11, color: "#999" }}>As the game would make it: the border keeps its thickness and the things on it their shape; the picture on the screen keeps its size and shows more at the sides (mirrored edges stand in for that here). In the game it's playWindow.json (the dev panel's "adjust window").</div>
        <div style={{ fontSize: 11, color: "#999" }}>The game's ROOM.monitor: centerX {layout.monitor.centerX}, bottom {layout.monitor.bottom}, height {layout.monitor.height} (now 532, 548, 350)</div>

        <div style={ui.h}>Layers (top is drawn last)</div>
        <div>
          {[...layout.layers].reverse().map(layer => (
            <div key={layer.key} onClick={() => setSelected(layer.key)} style={{ ...ui.layer, background: selected == layer.key ? "#2f3a2f" : undefined }}>
              <input type="checkbox" checked={!layer.hidden} title="Shown" onClick={event => event.stopPropagation()} onChange={() => updateLayer(layer.key, each => { each.hidden = !each.hidden; })} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: layer.hidden ? 0.5 : 1 }}>{partName(layer)}</span>
              <Button style={{ padding: "0 5px" }} onClick={event => { event.stopPropagation(); moveLayer(layer.key, 1); }}>&#9650;</Button>
              <Button style={{ padding: "0 5px" }} onClick={event => { event.stopPropagation(); moveLayer(layer.key, -1); }}>&#9660;</Button>
            </div>
          ))}
        </div>
        {selectedLayer && selectedLayer.type == "patch" && (
          <>
            <div style={ui.h}>Cover-up</div>
            <div style={ui.row}>
              Wall from
              <select value={selectedLayer.source} onChange={({ target }) => updateLayer(selected, layer => { layer.source = target.value; })} style={ui.input}>
                {data.sources.map(source => <option key={source.id} value={source.id}>{source.id}</option>)}
              </select>
            </div>
            <div style={ui.row}>
              <span>from x</span><Num value={selectedLayer.dx} onChange={value => updateLayer(selected, layer => { layer.dx = value; })} />
              <span>y</span><Num value={selectedLayer.dy} onChange={value => updateLayer(selected, layer => { layer.dy = value; })} />
            </div>
            <div style={{ fontSize: 11, color: "#999" }}>Drag moves it; Alt+drag moves the wall that shows in it.</div>
            <div style={ui.row}><Button onClick={() => { change(next => { next.layers = next.layers.filter(each => each.key != selected); }); setSelected(undefined); }}>Remove</Button></div>
          </>
        )}
        {selectedLayer && !selectedLayer.type && selectedLayer.part && (
          <>
            <div style={ui.h}>{partName(selectedLayer)}</div>
            <div style={ui.row}>
              <span>x</span><Num value={selectedLayer.x} onChange={value => updateLayer(selected, layer => { layer.x = value; })} />
              <span>y</span><Num value={selectedLayer.y} onChange={value => updateLayer(selected, layer => { layer.y = value; })} />
            </div>
            <div style={ui.row}>
              <span>scale</span><Num step={0.01} value={selectedLayer.scale || 1} onChange={value => updateLayer(selected, layer => { layer.scale = Math.max(0.05, value); })} />
              <span>opacity</span><Num step={0.05} value={selectedLayer.opacity ?? 1} onChange={value => updateLayer(selected, layer => { layer.opacity = Math.min(1, Math.max(0, value)); })} />
            </div>
            <div style={ui.row}>
              <span>brightness</span><Num step={0.05} value={selectedLayer.brightness ?? 1} onChange={value => updateLayer(selected, layer => { layer.brightness = Math.max(0, value); })} />
            </div>
            <div style={ui.row}>
              <Button isOn={!!selectedLayer.flip} onClick={() => updateLayer(selected, layer => { layer.flip = !layer.flip; })}>Flip</Button>
              <Button onClick={() => { const key = `l${Date.now().toString(36)}`; change(next => { const index = next.layers.findIndex(each => each.key == selected); next.layers.splice(index + 1, 0, { ...copy(selectedLayer), key, x: selectedLayer.x + 12, y: selectedLayer.y + 12 }); }); setSelected(key); }}>Duplicate</Button>
              <Button onClick={() => { change(next => { next.layers = next.layers.filter(each => each.key != selected); }); setSelected(undefined); }}>Remove</Button>
            </div>
          </>
        )}

        <div style={ui.h}>Save and export</div>
        <div style={ui.row}>
          <Button onClick={save}>Save layout</Button>
          <Button onClick={undo} disabled={!history.length}>Undo ({history.length})</Button>
          <Button title="Back to the last saved layout (the browser's draft dropped)" onClick={() => { if (window.confirm("Drop the draft and go back to the last saved layout?")) { setHistory(list => [...list, copy(layout)]); setLayout(withMonitorLayer(copy(LAYOUT))); } }}>Last saved</Button>
        </div>
        <div style={ui.row}>
          <input value={exportName} onChange={({ target }) => setExportName(target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} style={{ ...ui.input, width: 150 }} />
          <select value={exportScale} onChange={({ target }) => setExportScale(Number(target.value))} style={ui.input}>
            <option value={1}>1x ({ROOM_W}x{ROOM_H})</option>
            <option value={2}>2x</option>
          </select>
        </div>
        <div style={ui.row}>
          <select value={exportWhat} onChange={({ target }) => setExportWhat(target.value)} style={{ ...ui.input, width: 240 }}>
            <option value="all">Everything (to regenerate the lighting)</option>
            <option value="nomonitor">Room without the monitor</option>
            <option value="front">Only what's in front of the monitor</option>
          </select>
        </div>
        <label style={{ ...ui.row, cursor: "pointer" }}>
          <input type="checkbox" checked={isDigitsExported} onChange={() => setIsDigitsExported(on => !on)} /> The clock's 12:00 (the game draws it)
        </label>
        <div style={ui.row}><Button onClick={exportPng}>Export PNG</Button></div>
        <div style={{ fontSize: 11, color: "#9c9", wordBreak: "break-all" }}>{status}</div>
      </div>

      {isCutting && (
        <Cutter sources={data.sources} sourceId={layout.base || "02"} mode={isCutting} onCancel={() => setIsCutting(false)}
          onDone={(part, isLift) => {
            const mode = isCutting;
            setIsCutting(false);
            if (mode == "cover") { setSelected(addCover(part)); return; }
            if (isLift) addCover(part, part.source);
            change(next => { next.customParts = [...(next.customParts || []), part]; });
            addLayer(part);
          }} />
      )}
    </div>
  );
};
