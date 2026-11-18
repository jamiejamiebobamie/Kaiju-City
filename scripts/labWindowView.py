# Makes the Lab's window views (Jamie, 2026-11-18): the Peninsula's map (Map.gif) as land seen in perspective from
# just south of its base, looking north up the whole of it, at night: its green hills raised as terrain, the sea
# cleaned of the map's moon reflection and ships, far land masses where the bridges lead, the landing page's skyline at
# the tip, an oversized crescent moon. With TRAFFIC_OUT set, it writes the roads (for the cars' lights) and spots on
# the water (for its glints) as JSON, each [x, y, distance], hidden where the land stands in front of them.
#   the Lab fight and trap:
#     TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/lab-window.png
#   the walking Lab:
#     TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labIntroWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/labIntro-window.png HZ=262 NEAR=33 F=260
import sys, os, json
import numpy as np
import cv2
from PIL import Image

src_path, out_path = sys.argv[1], sys.argv[2]
W, H = 1408, 768                  # the Lab's own size: the picture is drawn over the whole scene
HZ = 236                          # the horizon's row (the fight's window shows through from about row 182 to 340: lab.png)
CAM = {'x': 250, 'y': 860}        # where the view is from, in map pixels: just south of the Peninsula's base
NEAR = 11                         # map pixels from the camera at the bottom row
F = 200                           # screen px per map px at distance 1
for arg in sys.argv[3:]:
    key, value = arg.split('=')
    if key in ('X', 'Y'):
        CAM[key.lower()] = int(value)
    else:
        globals()[key] = int(value)
K = NEAR * (H - HZ)               # the camera's height, times F
CAM_H = K / F
rng = np.random.default_rng(3)
here = os.path.dirname(os.path.abspath(__file__))

# ---- the map: colors, land, heights ----
mp = np.asarray(Image.open(src_path).convert('RGB')).astype(np.float32)
MH, MW = mp.shape[:2]
SEA = np.array([3, 8, 16], np.float32)
SPECK = np.array([8, 23, 42], np.float32)
# land: the lit part, joined up, holes filled, a little coast kept round it
bright = (mp.sum(axis=2) > 90).astype(np.uint8)
bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
count, labels, stats, _ = cv2.connectedComponentsWithStats(bright, 8)
biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
land = (labels == biggest).astype(np.uint8)
# (holes filled from all round the map's edge: the Peninsula splits the sea in two, and from one corner alone the
# other half of the sea counted as a hole, so as land, its moon reflection and all)
flood = np.pad(land, 1)
cv2.floodFill(flood, np.zeros((MH + 4, MW + 4), np.uint8), (0, 0), 1)
land = land | (1 - flood[1:-1, 1:-1])
land = cv2.dilate(land, np.ones((7, 7), np.uint8)).astype(bool)
# the sea cleaned: the map's moon reflection, its ships, gone (Jamie, playtest 36): dark, with faint specks
clean = mp.copy()
sea_px = ~land
clean[sea_px] = SEA
specks = sea_px & (rng.random((MH, MW)) < 0.05)
clean[specks] = SPECK
# the green hills raised (Jamie, playtest 36): parkland rises with its distance in from its edges, highest near the base
green = ((mp[..., 1] > mp[..., 0] + 6) & (mp[..., 1] > 40) & land).astype(np.uint8)
green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
dist = cv2.distanceTransform(green, cv2.DIST_L2, 5)
toward_base = np.clip((np.arange(MH)[:, None] - 350) / 450, 0, 1) ** 1.5
height = cv2.GaussianBlur(np.minimum(dist, 26) * 0.7 * toward_base, (0, 0), 7)  # (gentle: the eye is only CAM_H up)
# flat right in front of the window, rising over the next stretch (steep close up, it streaked)
height *= np.clip((CAM['y'] - np.arange(MH)[:, None] - 70) / 120, 0, 1)

# ---- past the map: the sea, and the far lands where the bridges go ----
FAR_LAND = np.array([16, 22, 40], np.float32)   # dark blue, made out faintly against the sky and sea
def far_land(mx, my):
    # hills to the north-west, where the top bridge leads; a long low shore to the east, where the right one does
    north_west = (my < -70 + 0.25 * (mx - 60)) & (mx < 260) & (my > -2600)
    east = (mx > 640 + 0.15 * (my - 120)) & (my < 170) & (my > -2600)
    hills = np.where(north_west, 55 + 26 * np.sin(mx / 70.0) * np.cos(my / 110.0) + 12 * np.sin(mx / 23.0 + my / 51.0), 0)
    shore = np.where(east, 40 + 8 * np.sin(my / 140.0) + 6 * np.sin(mx / 90.0), 0)  # (above the eye, CAM_H, or it hides in the horizon's glow)
    return north_west | east, np.maximum(hills, 0) + shore

# ---- the march: each column outward from the window, nearest first ----
steps = np.geomspace(NEAR * 0.9, 4000, 900)
xs = np.arange(W, dtype=np.float32)
out = np.zeros((H, W, 3), np.float32)
ybuf = np.full(W, H, np.float32)              # each column: the highest row drawn so far
cover = np.zeros((len(steps), W), np.float32)  # that row, after each step (for hiding the cars and glints behind land)
for s, d in enumerate(steps):
    mx = CAM['x'] + (xs - W / 2) * d / F
    my = np.full(W, CAM['y'] - d, np.float32)
    inside = (mx >= 0) & (mx < MW - 1) & (my >= 0) & (my < MH - 1)
    ix = np.clip(mx.astype(int), 0, MW - 1)
    iy = np.clip(my.astype(int), 0, MH - 1)
    col = np.where(inside[:, None], clean[iy, ix], SEA)
    h = np.where(inside, height[iy, ix], 0.0)
    is_far, far_h = far_land(mx, my)
    is_far &= ~inside
    col = np.where(is_far[:, None], FAR_LAND, col)
    h = np.where(is_far, far_h, h)
    # a little speckle on the sea past the map, as on the map's own
    sea_out = ~inside & ~is_far
    speck = sea_out & (rng.random(W) < 0.05)
    col[speck] = SPECK
    # hills shaded by their height, darker low down
    col = col * (0.75 + 0.25 * np.clip(h / 30, 0, 1))[:, None]
    haze = (1 - np.exp(-d / 1100))
    # (the far lands only a little hazed: hazed fully they matched the sky, and vanished)
    haze = np.where(is_far, haze * 0.25, haze)[:, None]
    col = col * 0.66 * (1 - haze) + np.array([24, 36, 64]) * haze
    y_top = HZ + (K - h * F) / d
    top = np.maximum(np.ceil(y_top), 0)
    for x in np.nonzero(top < ybuf)[0]:
        out[int(top[x]):int(ybuf[x]), x] = col[x]
    ybuf = np.minimum(ybuf, top)
    cover[s] = ybuf

# the sky, above it all: deep night, lighter at the horizon, with stars
ys = np.arange(H, dtype=np.float32)[:, None]
t = np.clip(ys / HZ, 0, 1)
sky = np.array([4, 6, 16]) * (1 - t)[..., None] + np.array([26, 40, 72]) * t[..., None]
sky = np.broadcast_to(sky, (H, W, 3)).copy()
stars = (rng.random((H, W)) < 0.0009) & (ys < HZ * 0.9)
sky[stars] = [200, 210, 255]
rows = np.arange(H)[:, None]
is_sky = rows < ybuf[None, :]
out = np.where(is_sky[..., None], sky, out)
glow = np.exp(-((ys - HZ) / 6) ** 2)[..., None]
out = out + glow * np.array([18, 26, 48])
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')

def project(mx, my, h=0.0):
    d = CAM['y'] - my
    if d <= NEAR * 0.95:
        return None
    return (W / 2 + (mx - CAM['x']) * F / d, HZ + (K - h * F) / d, d)

def is_seen(x, y, d):
    # a point is seen unless land nearer than it rises over it in its column
    c = int(round(x))
    if c < 0 or c >= W:
        return False
    s = int(np.searchsorted(steps, d * 0.97)) - 1
    return s < 0 or y < cover[s, c]

# ---- the city at the tip: the landing page's skyline (from SVG_logo.svg), taller, dimmed for the night ----
SKYLINE = os.path.join(here, 'assets', 'landing-skyline.png')
TIP = {'x': 205, 'y': 120, 'width': 230, 'tall': 2.4}
base = project(TIP['x'], TIP['y'])
city_right = W / 2
if base and os.path.exists(SKYLINE):
    sky_img = Image.open(SKYLINE).convert('RGBA')
    width = max(4, int(TIP['width'] * F / base[2]))
    height_px = max(2, int(sky_img.height * width / sky_img.width * TIP['tall']))
    sky_img = sky_img.resize((width, height_px), Image.LANCZOS)
    arr = np.asarray(sky_img).astype(np.float32)
    arr[..., :3] *= 0.8
    img.alpha_composite(Image.fromarray(arr.astype(np.uint8), 'RGBA'), (int(base[0] - width / 2), int(base[1] - height_px)))
    city_right = base[0] + width / 2

# ---- the moon: a crescent, oversized, to the right of the city, just over the horizon (Jamie, playtest 36) ----
MOON = {'right_of_city': 150, 'radius': max(9, int((HZ - 182) * 0.42)), 'above': 0.55}
moon_r = MOON['radius']
cx, cy = city_right + MOON['right_of_city'], HZ - moon_r * (1 + MOON['above'])
yy, xx = np.mgrid[0:H, 0:W]
disc = np.hypot(xx - cx, yy - cy) <= moon_r
bite = np.hypot(xx - (cx - moon_r * 0.45), yy - (cy - moon_r * 0.15)) <= moon_r * 0.95
crescent = disc & ~bite & is_sky
halo = np.clip(1 - (np.hypot(xx - cx, yy - cy) - moon_r) / (moon_r * 1.6), 0, 1) * is_sky
arr = np.asarray(img).astype(np.float32)
arr[..., :3] += (halo ** 2)[..., None] * np.array([38, 44, 70])
arr[crescent, :3] = arr[crescent, :3] * 0.15 + np.array([236, 232, 205]) * 0.85
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
img.convert('RGB').save(out_path)
print('ok', img.size)

# ---- the roads and the water, for the lights ----
traffic_path = os.environ.get('TRAFFIC_OUT')
if traffic_path:
    raw = mp.astype(int)
    r, g, b = raw[..., 0], raw[..., 1], raw[..., 2]
    road = ((r > 190) & (g > 150) & (b > 110) & (r > b + 25) & land).astype(np.uint8)
    road = cv2.morphologyEx(road, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(road, 8)
    keep = np.zeros_like(road)
    for k in range(1, count):
        x, y, w_, h_, area = stats[k]
        if max(w_, h_) >= 40 and area < 0.25 * w_ * h_:
            keep[labels == k] = 1
    # each road's outline: up one side and back down the other, two lanes going opposite ways
    contours, _ = cv2.findContours(keep, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    runs = [[(float(pt[0][0]), float(pt[0][1])) for pt in contour][::4] for contour in contours if len(contour) >= 60]
    # the bridges' roads carried on over the far lands (Jamie, playtest 36): out from the top bridge into the hills,
    # and from the right bridge along the far shore; each there and back, two lanes
    def line(points, step=6):
        pts = []
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            n = max(1, int(np.hypot(x2 - x1, y2 - y1) / step))
            pts += [(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n) for k in range(n)]
        pts.append(points[-1])
        return pts + pts[::-1]
    runs.append(line([(88, 0), (40, -120), (-60, -260), (-260, -380), (-600, -520)]))
    runs.append(line([(499, 125), (660, 70), (900, 40), (1400, 20), (2400, 0)]))
    paths = []
    for run in runs:
        pts = []
        for x, y in run:
            q = project(x, y)
            if q and -20 <= q[0] <= W + 20 and HZ <= q[1] <= H and is_seen(*q):
                pts.append([round(float(q[0]), 1), round(float(q[1]), 1), round(float(q[2]), 1)])
            else:
                if len(pts) >= 4:
                    paths.append(pts)
                pts = []
        if len(pts) >= 4:
            paths.append(pts)
    # spots on the water that glint now and then (Jamie, playtest 36: the water moving a little)
    glints = []
    for _ in range(20000):
        mx = rng.uniform(-900, 1600)
        my = rng.uniform(-1500, CAM['y'] - NEAR * 2)
        inside = 0 <= mx < MW and 0 <= my < MH
        if inside and land[int(my), int(mx)]:
            continue
        if not inside and far_land(np.array([mx]), np.array([my]))[0][0]:
            continue
        q = project(mx, my)
        if q and 0 <= q[0] < W and HZ < q[1] < H and is_seen(*q):
            glints.append([round(float(q[0]), 1), round(float(q[1]), 1), round(float(q[2]), 1)])
        if len(glints) >= 700:
            break
    json.dump({'paths': paths, 'glints': glints, 'near': NEAR, 'horizon': HZ}, open(traffic_path, 'w'))
    print('traffic runs', len(paths), 'glints', len(glints))
