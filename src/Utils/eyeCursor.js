/*
  The eye cursor (Jamie, 2026-11-25): over the apartment itself (not the monitor's screen, not the side things beside it)
  the pointer is an eye, U+1F441 in its plain, old-school text form (Jamie: not the color emoji): the character with the
  text-presentation selector (U+FE0E), in a symbol font, drawn in pale ink with a dark outline so it reads on the dark
  room. Drawn once onto a small canvas, and that picture is the cursor, its hot spot in the eye's middle. If the system
  draws it as a color emoji anyway (no text form in its fonts), a plain drawn eye in the same ink is used instead.
  Set as the CSS variable --eye-cursor on the page (the game area uses it; the monitor and the side things set their own).
  (24 px, with a copy twice as big for sharp screens: Chromium browsers fall back to the usual pointer near the page's
  edges when a cursor's picture is too big to fit there, which the 32 px one at 125% display scaling was. Jamie)
*/
const EYE = {
  char: "\u{1F441}︎",
  size: 24,
  fontPx: 18,
  fonts: '"Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Symbols", "DejaVu Sans", "Symbola", sans-serif',
  ink: "#efe9df",
  outline: "rgba(0, 0, 0, 0.85)"
};

// did the glyph come out in color (an emoji font), rather than in the ink?
const getIsColored = (ctx, px) => {
  const { data } = ctx.getImageData(0, 0, px, px);
  for (let k = 0; k < data.length; k += 4) {
    if (data[k + 3] < 200) continue;
    const [r, g, b] = [data[k], data[k + 1], data[k + 2]];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) return true;
  }
  return false;
};

// the eye as plain line art (on a 32 px grid, scaled): an almond outline and a round iris, in the ink with a dark
// outline under it
const drawPlainEye = (ctx, scale) => {
  ctx.save();
  ctx.scale((scale * EYE.size) / 32, (scale * EYE.size) / 32);
  const c = 16;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(c - 13, c);
    ctx.quadraticCurveTo(c, c - 12, c + 13, c);
    ctx.quadraticCurveTo(c, c + 12, c - 13, c);
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  ctx.strokeStyle = EYE.outline;
  ctx.lineWidth = 4.5;
  shape();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = EYE.ink;
  ctx.lineWidth = 2;
  shape();
  ctx.stroke();
  ctx.fillStyle = EYE.ink;
  ctx.beginPath();
  ctx.arc(c, c, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = EYE.outline;
  ctx.beginPath();
  ctx.arc(c, c, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// the eye at 'scale' times its size, as a picture's data URL
const drawEye = scale => {
  const px = EYE.size * scale;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${EYE.fontPx * scale}px ${EYE.fonts}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5 * scale;
  ctx.strokeStyle = EYE.outline;
  ctx.strokeText(EYE.char, px / 2, px / 2 + scale);
  ctx.fillStyle = EYE.ink;
  ctx.fillText(EYE.char, px / 2, px / 2 + scale);
  if (getIsColored(ctx, px)) {
    ctx.clearRect(0, 0, px, px);
    drawPlainEye(ctx, scale);
  }
  return canvas.toDataURL("image/png");
};

export const installEyeCursor = () => {
  if (typeof document == "undefined") return;
  try {
    const one = drawEye(1);
    if (!one) return;
    const two = drawEye(2);
    const half = EYE.size / 2;
    const plain = `url(${one}) ${half} ${half}, default`;
    // (the sharp one for screens that scale up, where the browser takes image-set in a cursor)
    const sharp = two ? `-webkit-image-set(url(${one}) 1x, url(${two}) 2x) ${half} ${half}, default` : undefined;
    const isSharp = !!sharp && typeof CSS != "undefined" && CSS.supports("cursor", sharp);
    document.documentElement.style.setProperty("--eye-cursor", isSharp ? sharp : plain);
  } catch {
    // (no canvas: the usual cursor)
  }
};
