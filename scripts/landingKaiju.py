# The landing's Kaiju in the water and their fire (Jamie, 2026-11-19), from his sheets:
#   the Kaiju: 10 poses on white (Kaiju-home-screen/ORIGINALS/image_8a5c71e6.png); the 7th and 8th overlap (one's tail
#     through the other) and are left out; the rest cut out as black silhouettes (the logo's walking Kaiju's look: the
#     page outlines them in purple), soft-edged, their holes filled, set in frames of one size, feet on one line and
#     legs on one middle, so they don't jump; for each frame its mouth (where the fire comes from) and its body's spans
#     across each row (for the wake where the water cuts it);
#   the fire: 7 panels on black (image_c40baadf.png); the first is empty; the rest cut out, their black made clear
#     (the flame's light as its alpha), upright (the page turns them to the mouth).
#   python -I scripts/landingKaiju.py <kaiju sheet> <fire sheet> public/zoom-scene/kaiju-sea.png public/zoom-scene/kaiju-fire.png src/Components/data/kaijuSea.json
import sys, json
import numpy as np
import cv2
from PIL import Image

kaiju_path, fire_path, kaiju_out, fire_out, json_out = sys.argv[1:6]
FRAME = (480, 400)              # each Kaiju frame's size, px (wide: the tail had been cut, the next frame showing)
FEET_AT = 380                   # the feet's line in a frame
LEGS_X = 270                    # the legs' middle across a frame
MARGIN = 12                     # empty all round each pose, at least (checked)
SKIP = {6}                      # (0-based, among the figures found: the 7th and 8th poses overlap, found as one)
ROAR = [2, 3, 4, 5]             # the kept frames that roar (mouth open: fire), by their place among the kept

# ---- the Kaiju ----
sheet = np.asarray(Image.open(kaiju_path).convert('RGB')).astype(np.float32)
light = sheet.sum(axis=2)
solid = (light < 600).astype(np.uint8)
count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
figures = sorted([k for k in range(1, count) if stats[k][4] > 2000], key=lambda k: stats[k][0])
kept = [k for i, k in enumerate(figures) if i not in SKIP]
frames, meta = [], []
for k in kept:
    x, y, w, h, _ = stats[k]
    body = (labels[y:y + h, x:x + w] == k).astype(np.uint8)
    # holes filled (pale highlights inside it: teeth, spines' light), then a soft edge from the sheet's own shading
    flood = np.pad(body, 1)
    cv2.floodFill(flood, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 1)
    body = body | (1 - flood[1:-1, 1:-1])
    edge = np.clip((700 - light[y:y + h, x:x + w]) / 140, 0, 1)
    near = cv2.dilate(body, np.ones((3, 3), np.uint8)).astype(bool)
    alpha = np.where(body.astype(bool), 1.0, np.where(near, edge, 0.0))
    rows = np.nonzero(body.any(axis=1))[0]
    bottom = rows.max()
    legs = body[int(h * 0.78):, :]
    legs_x = np.nonzero(legs.any(axis=0))[0]
    middle = (legs_x.min() + legs_x.max()) / 2 if len(legs_x) else w / 2
    ox, oy = int(round(LEGS_X - middle)), int(round(FEET_AT - bottom))
    frame = np.zeros((FRAME[1], FRAME[0]), np.float32)
    sx0, sy0 = max(0, -ox), max(0, -oy)
    dx0, dy0 = max(0, ox), max(0, oy)
    ww, hh = min(w - sx0, FRAME[0] - dx0), min(h - sy0, FRAME[1] - dy0)
    frame[dy0:dy0 + hh, dx0:dx0 + ww] = alpha[sy0:sy0 + hh, sx0:sx0 + ww]
    filled = np.nonzero(frame > 0.02)
    assert filled[1].min() >= MARGIN and filled[1].max() < FRAME[0] - MARGIN and filled[0].min() >= MARGIN, ('a pose runs off its frame', k, filled[1].min(), filled[1].max(), filled[0].min())
    frames.append(frame)
    # its mouth: the frontmost (rightmost) point of the head (the top third of it), a little down from the snout's tip
    solid_frame = frame > 0.5
    top = np.nonzero(solid_frame.any(axis=1))[0].min()
    head = solid_frame[top:top + int((FEET_AT - top) * 0.33)]
    cols = np.nonzero(head.any(axis=0))[0]
    tip_x = int(cols.max())
    tip_rows = np.nonzero(head[:, tip_x])[0]
    mouth = [tip_x - 4, int(top + tip_rows.mean()) + 4]
    # the body's spans across each row (pairs of [from, to]), for the wake where the water cuts it
    spans = []
    for r in range(FRAME[1]):
        row = np.concatenate([[0], solid_frame[r].astype(int), [0]])
        edges_ = np.nonzero(np.diff(row))[0]
        spans.append([[int(a), int(b)] for a, b in zip(edges_[::2], edges_[1::2]) if b - a >= 2])
    meta.append({'mouth': mouth, 'spans': spans})
sheet_out = np.zeros((FRAME[1], FRAME[0] * len(frames), 4), np.uint8)
for i, frame in enumerate(frames):
    sheet_out[:, i * FRAME[0]:(i + 1) * FRAME[0], :3] = [11, 12, 14]  # (the page's black)
    sheet_out[:, i * FRAME[0]:(i + 1) * FRAME[0], 3] = (frame * 255).astype(np.uint8)
Image.fromarray(sheet_out, 'RGBA').save(kaiju_out)

# ---- the fire ----
fire = np.asarray(Image.open(fire_path).convert('RGB')).astype(np.float32)
dark = (fire.sum(axis=2) < 14).astype(np.uint8)
count, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
panels = sorted([stats[k] for k in range(1, count) if stats[k][2] > 100 and stats[k][3] > 300], key=lambda s: s[0])
panels = panels[1:]  # (the first is empty)
pw = min(s[2] for s in panels) - 8
ph = min(s[3] for s in panels) - 8
flames = []
for x, y, w, h, _ in panels:
    cx = x + w // 2
    crop = fire[y + 4:y + 4 + ph, cx - pw // 2:cx - pw // 2 + pw]
    light_ = crop.max(axis=2)
    a = np.clip((light_ - 10) / 200, 0, 1)
    # (Jamie: more purple, glowing, less of its busy detail but some kept): its light smoothed a little, then coloured
    # from deep violet through bright violet to a pale lavender core
    smooth = cv2.GaussianBlur(light_, (0, 0), 1.3) * 0.6 + light_ * 0.4
    level = np.clip((smooth - 20) / 250, 0, 1) ** 1.25  # (the palest only at the hottest)
    stops = np.array([[60, 8, 110], [128, 32, 210], [176, 80, 250], [214, 150, 255], [236, 200, 255]], np.float32)
    at = level * (len(stops) - 1)
    i = np.clip(at.astype(int), 0, len(stops) - 2)
    f = (at - i)[..., None]
    color = stops[i] * (1 - f) + stops[i + 1] * f
    a = np.clip(cv2.GaussianBlur(a, (0, 0), 0.8), 0, 1)
    flames.append(np.dstack([color, a * 255]).astype(np.uint8))
Image.fromarray(np.concatenate(flames, axis=1), 'RGBA').save(fire_out)

json.dump({'frame': FRAME, 'feetAt': FEET_AT, 'legsX': LEGS_X, 'roar': ROAR, 'frames': meta, 'fire': {'frame': [int(pw), int(ph)], 'count': len(flames)}}, open(json_out, 'w'))
print('kaiju frames', len(frames), 'mouths', [m['mouth'] for m in meta], 'fire frames', len(flames), (pw, ph))
