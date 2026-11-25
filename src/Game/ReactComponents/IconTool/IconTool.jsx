import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import kaijuSea from "Components/data/kaijuSea.json";
import { SEA_KAIJU } from "Components/LandingKaiju";
import SAVED from "./iconTool.json";

/*
  The tab icon tool (Jamie, 2026-11-25; dev only, at /icon): the landing's roaring Kaiju (the right one, facing left),
  black with its purple outline, mid-spew, with its purple lo-fi fire, framed in a circle for the browser tab's icon.
  - A scene (SCENE units square) holds the Kaiju (its frame's top left, its scale, which frame, facing left or right,
    its outline's width in its frame's px) and its fire (moved off the mouth, in the Kaiju's frame px; its own scale,
    as a share of the size it has on the landing; its angle from upright toward the face; which frame; its glow).
  - The framing circle (its middle and radius) and the inner circle (a share of its radius, the same middle): inside
    the inner one the icon is whole; from there out to the outer one it fades, gone by the outer one.
  - Drag on the scene to move what's picked (Kaiju, fire or circle); the mouse wheel scales it.
  - Previews at the tab's sizes (16, 32, 48), the home-screen size (180), on a dark tab, a light tab and clear.
  - Save writes the settings over iconTool.json; Export writes the framed square at EXPORT_PX to
    public/icon-source/kaiju-icon.png (and downloads it), for scripts/makeIcons.py to make the icon set from.
  The Kaiju and fire are drawn as the landing draws them (LandingKaiju's SeaKaiju), on a canvas.
*/
const SCENE = 1200;
const EXPORT_PX = 1024;
const KAIJU_FRAME = { width: kaijuSea.frame[0], height: kaijuSea.frame[1], count: kaijuSea.frames.length };
const FIRE_FRAME = { width: kaijuSea.fire.frame[0], height: kaijuSea.fire.frame[1], count: kaijuSea.fire.count };
// the fire's height on the landing, in the Kaiju's frame px (its height out of the water there times
// SEA_KAIJU.fire.length, over the frame's scale there: waterRow 298 of the right one's tune)
const FIRE_BASE_HEIGHT = 298 * SEA_KAIJU.fire.length;

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

// one frame of the Kaiju, and the same in its outline's color (for the outline drawn round it)
const getKaijuFrames = (sheet, frame) => {
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = KAIJU_FRAME.width;
    canvas.height = KAIJU_FRAME.height;
    return canvas;
  };
  const plain = make();
  plain.getContext("2d").drawImage(sheet, frame * KAIJU_FRAME.width, 0, KAIJU_FRAME.width, KAIJU_FRAME.height, 0, 0, KAIJU_FRAME.width, KAIJU_FRAME.height);
  const tinted = make();
  const ctx = tinted.getContext("2d");
  ctx.drawImage(plain, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = SEA_KAIJU.outline;
  ctx.fillRect(0, 0, tinted.width, tinted.height);
  return { plain, tinted };
};

/*
  The frame's shape (Jamie, 2026-11-25: try a square too): 'circle', or 'square' with its corners rounded by 'corner'
  (a share of its half size: 0 square, 1 a circle). Its fade, as the circle's: whole inside the inner shape (the same
  shape, 'inner' of the size, the same middle), gone by the outer one; for the square, drawn pixel by pixel from the
  distance to each (a rounded square's distance field), so its corners fade evenly too.
*/
const getFrame = circle => ({ shape: circle.shape || "circle", corner: circle.corner == undefined ? 0.25 : circle.corner });
// a rounded square's signed distance (inside negative): 'half' its half size, 'radius' its corners'
const roundedSquareDistance = (dx, dy, half, radius) => {
  const qx = Math.abs(dx) - (half - radius);
  const qy = Math.abs(dy) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
};
const makeSquareFade = (size, cx, cy, half, inner, corner) => {
  const mask = document.createElement("canvas");
  mask.width = mask.height = size;
  const ctx = mask.getContext("2d");
  const image = ctx.createImageData(size, size);
  const radius = half * Math.min(1, Math.max(0, corner));
  const innerHalf = half * Math.min(0.999, Math.max(0, inner));
  const innerRadius = radius * (innerHalf / half);
  const [x0, x1] = [Math.max(0, Math.floor(cx - half)), Math.min(size, Math.ceil(cx + half))];
  const [y0, y1] = [Math.max(0, Math.floor(cy - half)), Math.min(size, Math.ceil(cy + half))];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const outside = roundedSquareDistance(dx, dy, half, radius); // (<= 0 inside the outer)
      if (outside >= 0) continue;
      const pastInner = roundedSquareDistance(dx, dy, innerHalf, innerRadius);
      const alpha = pastInner <= 0 ? 1 : -outside / (pastInner - outside);
      image.data[(y * size + x) * 4 + 3] = Math.round(255 * alpha);
    }
  }
  ctx.putImageData(image, 0, 0);
  return mask;
};

// the whole icon scene, at 'size' px for its SCENE units; 'isFeathered': the frame's fade applied
const drawScene = (ctx, size, settings, images, isFeathered) => {
  const { kaiju, fire, circle } = settings;
  const k = size / SCENE;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(kaiju.x, kaiju.y);
  ctx.scale(kaiju.scale, kaiju.scale);
  if (kaiju.isMirrored) {
    ctx.translate(KAIJU_FRAME.width, 0);
    ctx.scale(-1, 1);
  }
  // the Kaiju: its outline (its shape in purple, all round it), then it
  const { plain, tinted } = images.kaiju;
  const steps = 12;
  for (let n = 0; n < steps; n++) {
    const angle = (n / steps) * Math.PI * 2;
    ctx.drawImage(tinted, Math.cos(angle) * kaiju.outline, Math.sin(angle) * kaiju.outline);
  }
  ctx.drawImage(plain, 0, 0);
  // the fire: from its mouth, turned toward its face and up, glowing purple, added on (as on the landing)
  const [mouthX, mouthY] = kaijuSea.frames[kaiju.frame].mouth;
  const fireHeight = FIRE_BASE_HEIGHT * fire.scale;
  const fireWidth = (FIRE_FRAME.width * fireHeight) / FIRE_FRAME.height;
  ctx.save();
  ctx.translate(mouthX + fire.dx, mouthY + fire.dy);
  ctx.rotate((fire.angle * Math.PI) / 180);
  ctx.globalCompositeOperation = "lighter";
  if (fire.glow > 0) {
    ctx.shadowColor = SEA_KAIJU.fireGlow;
    ctx.shadowBlur = 8 * fire.glow * kaiju.scale * k;
  }
  ctx.drawImage(images.fire, fire.frame * FIRE_FRAME.width, 0, FIRE_FRAME.width, FIRE_FRAME.height, -fireWidth / 2, -fireHeight, fireWidth, fireHeight);
  ctx.restore();
  ctx.restore();
  // the fade: whole inside the inner circle, gone by the outer one
  if (isFeathered && getFrame(circle).shape == "square") {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(makeSquareFade(size, circle.x * k, circle.y * k, circle.r * k, circle.inner, getFrame(circle).corner), 0, 0);
    ctx.restore();
  } else if (isFeathered) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    const inner = circle.r * Math.min(0.999, Math.max(0, circle.inner));
    const gradient = ctx.createRadialGradient(circle.x * k, circle.y * k, inner * k, circle.x * k, circle.y * k, circle.r * k);
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }
};

// the framed square (the outer circle's box) at 'px' px
const drawIcon = (settings, images, px) => {
  const scene = document.createElement("canvas");
  const sceneSize = Math.round((SCENE * px) / (2 * settings.circle.r));
  scene.width = scene.height = sceneSize;
  drawScene(scene.getContext("2d"), sceneSize, settings, images, true);
  const out = document.createElement("canvas");
  out.width = out.height = px;
  const k = sceneSize / SCENE;
  const { x, y, r } = settings.circle;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scene, (x - r) * k, (y - r) * k, 2 * r * k, 2 * r * k, 0, 0, px, px);
  return out;
};

const Page = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #15161a;
  color: #e6e2da;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  overflow: auto;
`;
const Stage = styled.div`
  position: relative;
  flex: none;
  background:
    repeating-conic-gradient(#2a2b31 0% 25%, #202126 0% 50%) 0 0 / 24px 24px;
  border: 1px solid #333;
  cursor: grab;
  &:active { cursor: grabbing; }
  & canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
`;
const Panel = styled.div`
  flex: 1;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const Group = styled.fieldset`
  border: 1px solid #3a3b42;
  border-radius: 6px;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 90px 1fr 64px;
  gap: 4px 8px;
  align-items: center;
  & legend { padding: 0 4px; color: #c99bff; }
  & input[type=number] { width: 60px; background: #0e0f12; color: inherit; border: 1px solid #444; }
`;
const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  & button { padding: 6px 10px; background: #2c2d34; color: inherit; border: 1px solid #4a4b55; border-radius: 4px; cursor: pointer; }
  & button[aria-pressed=true] { background: #5b3a86; border-color: #a74cff; }
`;
const Previews = styled.div`
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 10px;
  justify-content: start;
  align-items: end;
`;
const Swatch = styled.div`
  display: flex;
  gap: 10px;
  align-items: end;
  padding: 8px;
  border-radius: 6px;
  & canvas { image-rendering: auto; }
  & .zoom { image-rendering: pixelated; }
`;

// a slider with a number box beside it
const Control = ({ label, value, min, max, step, onChange }) => (
  <>
    <label>{label}</label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    <input type="number" min={min} max={max} step={step} value={Number(value.toFixed(3))} onChange={event => onChange(Number(event.target.value))} />
  </>
);

// one preview: the icon at 'px', and beside it the same blown up (to see its pixels)
const Preview = ({ icon, px, zoom = 0 }) => {
  const ref = useRef(null);
  const zoomRef = useRef(null);
  useEffect(() => {
    if (!icon) return;
    [ref.current, zoomRef.current].forEach(canvas => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(icon, 0, 0, px, px);
    });
  }, [icon, px]);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
      <canvas ref={ref} width={px} height={px} style={{ width: px, height: px }} title={`${px} px`} />
      {zoom > 0 && <canvas ref={zoomRef} className="zoom" width={px} height={px} style={{ width: px * zoom, height: px * zoom }} title={`${px} px, x${zoom}`} />}
    </div>
  );
};

export const IconTool = () => {
  const [settings, setSettings] = useState(SAVED);
  const [images, setImages] = useState(undefined);
  const [picked, setPicked] = useState("kaiju");
  const [status, setStatus] = useState("");
  const [icon, setIcon] = useState(undefined);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const overlayRef = useRef(null);
  const dragRef = useRef(undefined);
  const stagePx = 720;

  // the sprite sheets, and the picked frames of them
  const [sheets, setSheets] = useState(undefined);
  useEffect(() => {
    Promise.all([loadImage(SEA_KAIJU.sheet), loadImage(SEA_KAIJU.fireSheet)]).then(([kaiju, fire]) => setSheets({ kaiju, fire }));
  }, []);
  useEffect(() => {
    if (!sheets) return;
    setImages({ kaiju: getKaijuFrames(sheets.kaiju, settings.kaiju.frame), fire: sheets.fire });
  }, [sheets, settings.kaiju.frame]);

  const set = (part, key, value) => setSettings(now => ({ ...now, [part]: { ...now[part], [key]: value } }));

  // draw: the scene (faint where the fade takes it, the faded icon over it), the circles over that, and the previews
  useEffect(() => {
    if (!images) return;
    const scene = sceneRef.current;
    const ctx = scene.getContext("2d");
    const whole = document.createElement("canvas");
    whole.width = whole.height = stagePx;
    drawScene(whole.getContext("2d"), stagePx, settings, images, false);
    ctx.clearRect(0, 0, stagePx, stagePx);
    ctx.globalAlpha = 0.22;
    ctx.drawImage(whole, 0, 0);
    ctx.globalAlpha = 1;
    const faded = document.createElement("canvas");
    faded.width = faded.height = stagePx;
    drawScene(faded.getContext("2d"), stagePx, settings, images, true);
    ctx.drawImage(faded, 0, 0);
    // the circles
    const overlay = overlayRef.current.getContext("2d");
    const k = stagePx / SCENE;
    const { x, y, r, inner } = settings.circle;
    overlay.clearRect(0, 0, stagePx, stagePx);
    overlay.lineWidth = 1.5;
    overlay.setLineDash([]);
    const { shape, corner } = getFrame(settings.circle);
    const outline = half => {
      overlay.beginPath();
      if (shape == "square") overlay.roundRect(x * k - half, y * k - half, half * 2, half * 2, half * Math.min(1, corner));
      else overlay.arc(x * k, y * k, half, 0, Math.PI * 2);
      overlay.stroke();
    };
    overlay.strokeStyle = picked == "circle" ? "#ffd84a" : "rgba(255, 216, 74, 0.6)";
    outline(r * k);
    overlay.setLineDash([6, 5]);
    overlay.strokeStyle = "rgba(109, 255, 160, 0.75)";
    outline(r * inner * k);
    overlay.setLineDash([]);
    overlay.fillStyle = "#ffd84a";
    overlay.fillRect(x * k - 2, y * k - 2, 4, 4);
    setIcon(drawIcon(settings, images, 512));
  }, [images, settings, picked]);

  // dragging what's picked; the wheel scales it
  const toScene = event => {
    const box = stageRef.current.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * SCENE, y: ((event.clientY - box.top) / box.height) * SCENE };
  };
  const onPointerDown = event => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { from: toScene(event), start: settings };
  };
  const onPointerMove = event => {
    const drag = dragRef.current;
    if (!drag) return;
    const at = toScene(event);
    const dx = at.x - drag.from.x;
    const dy = at.y - drag.from.y;
    const { start } = drag;
    if (picked == "kaiju") setSettings({ ...start, kaiju: { ...start.kaiju, x: start.kaiju.x + dx, y: start.kaiju.y + dy } });
    if (picked == "circle") setSettings({ ...start, circle: { ...start.circle, x: start.circle.x + dx, y: start.circle.y + dy } });
    if (picked == "fire") {
      // (in the Kaiju's frame px, and turned round with it when it faces left)
      const side = start.kaiju.isMirrored ? -1 : 1;
      setSettings({ ...start, fire: { ...start.fire, dx: start.fire.dx + (side * dx) / start.kaiju.scale, dy: start.fire.dy + dy / start.kaiju.scale } });
    }
  };
  const onPointerUp = () => { dragRef.current = undefined; };
  useEffect(() => {
    const stage = stageRef.current;
    const onWheel = event => {
      event.preventDefault();
      const by = event.deltaY < 0 ? 1.04 : 1 / 1.04;
      setSettings(now => {
        if (picked == "kaiju") return { ...now, kaiju: { ...now.kaiju, scale: now.kaiju.scale * by } };
        if (picked == "fire") return { ...now, fire: { ...now.fire, scale: now.fire.scale * by } };
        return { ...now, circle: { ...now.circle, r: Math.max(20, now.circle.r * by) } };
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [picked]);

  const post = async (url, body) => {
    const response = await fetch(url, { method: "POST", body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw new Error(text);
    return text;
  };
  const save = async () => {
    try {
      await post("/__icon-tool/save", settings);
      setStatus("Saved to iconTool.json");
    } catch (error) {
      setStatus(`Not saved: ${error.message}`);
    }
  };
  const exportIcon = async () => {
    if (!images) return;
    const dataUrl = drawIcon(settings, images, EXPORT_PX).toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "kaiju-icon.png";
    link.click();
    try {
      const file = await post("/__icon-tool/export", { dataUrl });
      setStatus(`Exported (${EXPORT_PX} px): ${file}`);
    } catch (error) {
      setStatus(`Downloaded; not written to the repo: ${error.message}`);
    }
  };
  const isChanged = useMemo(() => JSON.stringify(settings) != JSON.stringify(SAVED), [settings]);

  return (
    <Page>
      <Stage ref={stageRef} style={{ width: stagePx, height: stagePx }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <canvas ref={sceneRef} width={stagePx} height={stagePx} />
        <canvas ref={overlayRef} width={stagePx} height={stagePx} />
      </Stage>
      <Panel>
        <h2 style={{ margin: 0 }}>Tab icon</h2>
        <Row>
          Drag moves, wheel scales:
          {["kaiju", "fire", "circle"].map(part => (
            <button key={part} aria-pressed={picked == part} onClick={() => setPicked(part)}>{part == "kaiju" ? "Kaiju" : part == "fire" ? "Fire" : "Frame"}</button>
          ))}
        </Row>
        <Group>
          <legend>Kaiju</legend>
          <Control label="Scale" value={settings.kaiju.scale} min={0.3} max={5} step={0.01} onChange={value => set("kaiju", "scale", value)} />
          <Control label="X" value={settings.kaiju.x} min={-1200} max={1200} step={1} onChange={value => set("kaiju", "x", value)} />
          <Control label="Y" value={settings.kaiju.y} min={-1200} max={1200} step={1} onChange={value => set("kaiju", "y", value)} />
          <Control label="Frame" value={settings.kaiju.frame} min={0} max={KAIJU_FRAME.count - 1} step={1} onChange={value => set("kaiju", "frame", value)} />
          <Control label="Outline" value={settings.kaiju.outline} min={0} max={8} step={0.1} onChange={value => set("kaiju", "outline", value)} />
          <label>Faces left</label>
          <input type="checkbox" checked={settings.kaiju.isMirrored} onChange={event => set("kaiju", "isMirrored", event.target.checked)} />
          <span />
        </Group>
        <Group>
          <legend>Fire</legend>
          <Control label="Scale" value={settings.fire.scale} min={0.1} max={3} step={0.01} onChange={value => set("fire", "scale", value)} />
          <Control label="Angle" value={settings.fire.angle} min={-180} max={180} step={1} onChange={value => set("fire", "angle", value)} />
          <Control label="Off mouth X" value={settings.fire.dx} min={-300} max={300} step={0.5} onChange={value => set("fire", "dx", value)} />
          <Control label="Off mouth Y" value={settings.fire.dy} min={-300} max={300} step={0.5} onChange={value => set("fire", "dy", value)} />
          <Control label="Frame" value={settings.fire.frame} min={0} max={FIRE_FRAME.count - 1} step={1} onChange={value => set("fire", "frame", value)} />
          <Control label="Glow" value={settings.fire.glow} min={0} max={4} step={0.05} onChange={value => set("fire", "glow", value)} />
        </Group>
        <Group>
          <legend>Frame</legend>
          <label>Shape</label>
          <Row>
            {["circle", "square"].map(shape => (
              <button key={shape} aria-pressed={getFrame(settings.circle).shape == shape} onClick={() => set("circle", "shape", shape)}>{shape == "circle" ? "Circle" : "Square"}</button>
            ))}
          </Row>
          <span />
          {getFrame(settings.circle).shape == "square" && <Control label="Corners" value={getFrame(settings.circle).corner} min={0} max={1} step={0.01} onChange={value => set("circle", "corner", value)} />}
          <Control label="X" value={settings.circle.x} min={0} max={SCENE} step={1} onChange={value => set("circle", "x", value)} />
          <Control label="Y" value={settings.circle.y} min={0} max={SCENE} step={1} onChange={value => set("circle", "y", value)} />
          <Control label={getFrame(settings.circle).shape == "square" ? "Half size" : "Radius"} value={settings.circle.r} min={20} max={SCENE} step={1} onChange={value => set("circle", "r", value)} />
          <Control label="Fade starts" value={settings.circle.inner} min={0} max={1} step={0.01} onChange={value => set("circle", "inner", value)} />
        </Group>
        <Row>
          <button onClick={save}>Save{isChanged ? " *" : ""}</button>
          <button onClick={() => setSettings(SAVED)}>Back to saved</button>
          <button onClick={exportIcon}>Export {EXPORT_PX} px</button>
          <span>{status}</span>
        </Row>
        <div>Previews (each beside it blown up, to see its pixels):</div>
        <Previews>
          {[["Dark tab", "#202124"], ["Light tab", "#f1f3f4"], ["Clear", "repeating-conic-gradient(#555 0% 25%, #888 0% 50%) 0 0 / 8px 8px"]].map(([name, background]) => (
            <Swatch key={name} style={{ background }} title={name}>
              <Preview icon={icon} px={16} zoom={4} />
              <Preview icon={icon} px={32} zoom={2} />
              <Preview icon={icon} px={48} />
            </Swatch>
          ))}
        </Previews>
        <Row>
          <Swatch style={{ background: "#000" }} title="Home screen (iOS fills clear with black)"><Preview icon={icon} px={180} /></Swatch>
          <span style={{ maxWidth: 260 }}>Home screen, 180 px (iOS fills the clear parts with black).<br />Outer line: the icon's edge. Dashed: where the fade starts.</span>
        </Row>
      </Panel>
    </Page>
  );
};
