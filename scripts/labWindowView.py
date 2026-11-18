# Makes the Lab's window views (Jamie, 2026-11-18): the Peninsula's map (Map.gif) as land seen in perspective from
# just south of its base, looking north up the whole of it, at night: its green hills raised as terrain, the sea
# cleaned of the map's moon reflection and ships, far land masses where the bridges lead, the landing page's skyline at
# the tip, an oversized crescent moon. With TRAFFIC_OUT set, it writes the roads (for the cars' lights) and spots on
# the water (for its glints) as JSON, each [x, y, distance], hidden where the land stands in front of them.
#   the Lab fight and trap:
#     TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/lab-window.png
#   the walking Lab:
#     TRAFFIC_OUT=src/Game/DataClasses/Levels/data/labIntroWindowTraffic.json python -I scripts/labWindowView.py public/Map.gif public/levels/labIntro-window.png HZ=262 NEAR=33 F=260
#   the landing page (Jamie, 2026-11-18): straight up the Peninsula's middle, the logo's own skyline standing at its tip
#   (so no city drawn), the vanishing point on the logo's zoom spot (MainMenu's LANDING_VIEW places it there):
#     TRAFFIC_OUT=src/Components/data/landingTraffic.json python -I scripts/labWindowView.py public/Map.gif public/zoom-scene/0-peninsula.png LANDING=1
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
VPX = None                        # the vanishing point's column (None: the middle)
CITY = 1                          # the skyline drawn at the tip
LANDING = 0                       # the landing page's view (its own size, camera, sky and moon: below)
MOON_X = MOON_Y = MOON_R = None   # the moon's middle and size, if not by the city
for arg in sys.argv[3:]:
    if arg.split('=')[0] == 'LANDING':
        LANDING = int(arg.split('=')[1])
if LANDING:
    # Jamie's mock-up (Home_page_peninsula, 2025-10-31): seen from high up, the whole Peninsula from the screen's bottom
    # to the logo, its north city under the logo's skyline, the bridges spreading out either side of it.
    # Drawn at half the screen's px (shown twice the size, pixelated). Matched to the logo (600 x 300 px): its zoom spot
    # at (VPX, SPOT_ROW) here, straight below the vanishing point (the Peninsula's lines run up at it), the horizon
    # HORIZON_UP above (just over the skyline: at the spot itself, the near end came 11 times the tip's size); the
    # skyline's ground 69 px below the spot (34.5 here) standing on the north city (map row TIP_Y); the Peninsula's
    # base (map row BASE_Y) at a 1080 px screen's bottom (388 here below the spot), centred on that screen (the spot is
    # 115 px right of its middle: 57.5 here). The camera looks along the Peninsula's own line, base to north city, so
    # it runs straight up the middle at the spot; TIP_SCALE: px here per map px at the north city
    # Jamie, after a look (2026-11-18): the tip as wide as the skyline (525 px: TIP_WIDTH 262 here, centred TIP_LEFT
    # 61.5 here left of the spot), the horizon lower (HORIZON_UP 35 here: just behind the skyline), the hills on the
    # left in front taller (HILLS: three times was a cliff wall; spread wider too), shaded (lit from the moon's side). The base then runs off both sides.
    # Then (Jamie's mock-up, a yellow line): the horizon just above the skyline's ground, 46 px below the spot (23
    # here). No true camera gives that with the tip this wide and the whole Peninsula in view (the base came 30 times
    # the tip's size), so the landing's perspective is drawn, like the mock-up: rows run as distance^-ROW_POWER and
    # widths as distance^-WIDTH_POWER (a camera has both 1), set so the tip is TIP_WIDTH wide TIP_DROP below the horizon
    # and the base BASE_SCALE px here per map px at a 1080 px screen's bottom (BASE_DROP), the camera DEPTH_RATIO times
    # as far from the tip as from the base. Lines along the Peninsula still all run to the one vanishing point.
    W, H, VPX, SPOT_ROW, HORIZON_DOWN = 1700, 1000, 850, 380, 23
    HZ = SPOT_ROW + HORIZON_DOWN
    # (and the skyline on the land's top edge, the north city spread out below it as in the mock-up: the rows fitted
    # through a third point, the Peninsula's middle MID_Y, MID_DROP below the horizon)
    TIP_Y, TIP_DROP, TIP_WIDTH, TIP_LEFT = 110, 34.5 - HORIZON_DOWN, 262, 61.5
    MID_Y, MID_DROP = 330, 70
    BASE_Y, BASE_DROP, BASE_SCALE, DEPTH_RATIO = 780, 388 - HORIZON_DOWN, 1.8, 5.0
    HILLS = 4.5
    CITY = 0
    MOON_X, MOON_Y, MOON_R = 1060, HZ - 78, 26  # (in from the corner: a 1366 x 768 screen cut it off)
for arg in sys.argv[3:]:
    key, value = arg.split('=')
    if key in ('X', 'Y'):
        CAM[key.lower()] = int(value)
    else:
        globals()[key] = int(value)
if VPX is None:
    VPX = W / 2
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
AHEAD, RIGHT = np.array([0.0, -1.0]), np.array([1.0, 0.0])  # the way the camera looks, and its right, on the map
if LANDING:
    # the Peninsula's line: the middle of its land (bridges left out: they're thin) at the base and at the north city
    body = cv2.morphologyEx(land.astype(np.uint8), cv2.MORPH_OPEN, np.ones((17, 17), np.uint8)).astype(bool)
    def middle(y):
        row = np.concatenate([[0], body[y].astype(int), [0]])
        edges = np.nonzero(np.diff(row))[0]
        starts, ends = edges[::2], edges[1::2]
        k = int(np.argmax(ends - starts))
        return np.array([(starts[k] + ends[k] - 1) / 2, y], float)
    base_mid, tip_mid = middle(BASE_Y), middle(TIP_Y)
    AHEAD = (tip_mid - base_mid) / np.linalg.norm(tip_mid - base_mid)
    RIGHT = np.array([-AHEAD[1], AHEAD[0]])
    d_base = np.linalg.norm(tip_mid - base_mid) / (DEPTH_RATIO - 1)
    d_tip = d_base * DEPTH_RATIO
    row = np.concatenate([[0], body[TIP_Y].astype(int), [0]])
    edges = np.nonzero(np.diff(row))[0]
    TIP_SCALE = TIP_WIDTH / int(np.max(edges[1::2] - edges[::2]))  # px here per map px at the tip
    WIDTH_POWER = np.log(BASE_SCALE / TIP_SCALE) / np.log(DEPTH_RATIO)
    # rows: straight lines in log distance / log px through the base, the middle and the tip, carried on past both
    d_mid = d_base + np.linalg.norm(tip_mid - base_mid) * (BASE_Y - MID_Y) / (BASE_Y - TIP_Y)
    LOG_D = np.log([d_base, d_mid, d_tip])
    LOG_R = np.log([BASE_DROP, MID_DROP, TIP_DROP])
    def row_at(d):
        x = np.log(d)
        k = np.where(x < LOG_D[1], 0, 1)
        slope = (LOG_R[k + 1] - LOG_R[k]) / (LOG_D[k + 1] - LOG_D[k])
        return np.exp(LOG_R[k] + slope * (x - LOG_D[k]))
    ROW_POWER = -(LOG_R[0] - LOG_R[1]) / (LOG_D[0] - LOG_D[1])  # (the near stretch's, for the bottom row's distance)
    width_at = lambda d: TIP_SCALE * (d_tip / d) ** WIDTH_POWER  # px per map px (sideways, and up for the hills)
    NEAR = d_base * (BASE_DROP / (H - HZ)) ** (1 / ROW_POWER)   # the distance at the picture's bottom row
    side = -TIP_LEFT / TIP_SCALE              # the line's offset from the camera, sideways (map px)
    eye = base_mid - AHEAD * d_base - RIGHT * side
    CAM['x'], CAM['y'] = float(eye[0]), float(eye[1])
    F, K_LANDING = 1.0, 1.0                   # (unused on the landing)
    print('powers', np.round(-np.diff(LOG_R) / np.diff(LOG_D), 2), round(WIDTH_POWER, 2), 'tip scale', round(TIP_SCALE, 2))
    print('base', base_mid, 'north city', tip_mid, 'camera', CAM, 'F', round(F), 'NEAR', NEAR)
K = K_LANDING if LANDING else NEAR * (H - HZ)  # the camera's height, times F
CAM_H = K / F
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
height = cv2.GaussianBlur(np.minimum(dist, 26) * 0.7 * toward_base, (0, 0), 16 if LANDING else 7)  # (the landing's wider: rolling, not a cliff)  # (gentle: the eye is only CAM_H up)
# flat right in front of the window, rising over the next stretch (steep close up, it streaked)
if LANDING:
    height *= HILLS
    # shaded, lit from the north-east (the moon's side) and above, so the hills read as hills
    gy, gx = np.gradient(height)
    light = np.array([0.55, -0.45, 0.7])
    lit = (-gx * light[0] - gy * light[1] + light[2]) / np.sqrt(gx ** 2 + gy ** 2 + 1) / light[2]
    hill_shade = np.where(land, np.clip(lit, 0.35, 1.5), 1.0)
    clean *= hill_shade[..., None]
else:
    height *= np.clip((CAM['y'] - np.arange(MH)[:, None] - 70) / 120, 0, 1)

# ---- past the map: the sea, and the far lands where the bridges go ----
FAR_LAND = np.array([16, 22, 40], np.float32)   # dark blue, made out faintly against the sky and sea
def far_land(mx, my):
    # hills to the north-west, where the top bridge leads; a long low shore to the east, where the right one does
    north_west = (my < -70 + 0.25 * (mx - 60)) & (mx < 260) & (my > -2600)
    east = (mx > 640 + 0.15 * (my - 120)) & (my < 170) & (my > -2600)
    hills = np.where(north_west, 55 + 26 * np.sin(mx / 70.0) * np.cos(my / 110.0) + 12 * np.sin(mx / 23.0 + my / 51.0), 0)
    shore = np.where(east, 40 + 8 * np.sin(my / 140.0) + 6 * np.sin(mx / 90.0), 0)  # (above the eye, CAM_H, or it hides in the horizon's glow)
    # (lower on the landing: behind the logo's skyline, they rose over its smaller buildings)
    if LANDING:  # (none on the landing: from high up they were flat slabs; Jamie's mock-up has none)
        return np.zeros_like(mx, bool), np.zeros_like(mx, float)
    return north_west | east, np.maximum(hills, 0) + shore

# ---- the march: each column outward from the window, nearest first ----
steps = np.geomspace(NEAR * 0.9, 4000, 1800 if LANDING else 900)
xs = np.arange(W, dtype=np.float32)
out = np.zeros((H, W, 3), np.float32)
ybuf = np.full(W, H, np.float32)              # each column: the highest row drawn so far
cover = np.zeros((len(steps), W), np.float32)  # that row, after each step (for hiding the cars and glints behind land)
for s, d in enumerate(steps):
    if LANDING:
        side = (xs - VPX) / width_at(d)
        mx = (CAM['x'] + AHEAD[0] * d + RIGHT[0] * side).astype(np.float32)
        my = (CAM['y'] + AHEAD[1] * d + RIGHT[1] * side).astype(np.float32)
        # past the map's bottom edge (the camera stands south of it): the map mirrored, so no straight cut shows
        my = np.where(my > MH - 1.001, 2 * (MH - 1.001) - my, my).astype(np.float32)
    else:
        mx = CAM['x'] + (xs - VPX) * d / F
        my = np.full(W, CAM['y'] - d, np.float32)
    inside = (mx >= 0) & (mx < MW - 1) & (my >= 0) & (my < MH - 1)
    ix = np.clip(mx.astype(int), 0, MW - 1)
    iy = np.clip(my.astype(int), 0, MH - 1)
    if LANDING:
        # close up the map's pixels grow huge here: blended between them instead (a soft foreground, not blocks)
        fx_, fy_ = np.clip(mx, 0, MW - 1.001), np.clip(my, 0, MH - 1.001)
        x0, y0 = fx_.astype(int), fy_.astype(int)
        ax, ay = (fx_ - x0)[:, None], (fy_ - y0)[:, None]
        blended = (clean[y0, x0] * (1 - ax) + clean[y0, x0 + 1] * ax) * (1 - ay) + (clean[y0 + 1, x0] * (1 - ax) + clean[y0 + 1, x0 + 1] * ax) * ay
        col = np.where(inside[:, None], blended if d < 160 else clean[iy, ix], SEA)
    else:
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
    y_top = HZ + row_at(d) - h * width_at(d) if LANDING else HZ + (K - h * F) / d
    top = np.maximum(np.ceil(y_top), 0)
    for x in np.nonzero(top < ybuf)[0]:
        out[int(top[x]):int(ybuf[x]), x] = col[x]
    ybuf = np.minimum(ybuf, top)
    cover[s] = ybuf

# the sky, above it all: deep night, lighter at the horizon, with stars
ys = np.arange(H, dtype=np.float32)[:, None]
t = np.clip(ys / HZ, 0, 1)
SKY_TOP = np.array([11, 12, 14]) if LANDING else np.array([4, 6, 16])  # (the landing's: its page's own black, #0b0c0e)
sky = SKY_TOP * (1 - t ** (2.2 if LANDING else 1))[..., None] + np.array([26, 40, 72]) * (t ** (2.2 if LANDING else 1))[..., None]
sky = np.broadcast_to(sky, (H, W, 3)).copy()
stars = (rng.random((H, W)) < 0.0009) & (ys < HZ * 0.9)
sky[stars] = [200, 210, 255]
rows = np.arange(H)[:, None]
is_sky = rows < ybuf[None, :]
out = np.where(is_sky[..., None], sky, out)
glow = np.exp(-((ys - HZ) / 6) ** 2)[..., None]
out = out + glow * np.array([18, 26, 48])
if LANDING:
    # the ground darkens toward the bottom of the screen, into the page's black: the eye goes up the Peninsula
    below = np.clip((ys - HZ) / (H - HZ), 0, 1)
    shade = 1 - 0.7 * np.clip((below - 0.45) / 0.55, 0, 1) ** 1.3
    out = np.where(is_sky[..., None], out, out * shade[..., None] + np.array([11, 12, 14]) * (1 - shade[..., None]))
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')

def project(mx, my, h=0.0):
    dx, dy = mx - CAM['x'], my - CAM['y']
    d = dx * AHEAD[0] + dy * AHEAD[1]
    if d <= NEAR * 0.95:
        return None
    if LANDING:
        return (VPX + (dx * RIGHT[0] + dy * RIGHT[1]) * width_at(d), HZ + row_at(d) - h * width_at(d), d)
    return (VPX + (dx * RIGHT[0] + dy * RIGHT[1]) * F / d, HZ + (K - h * F) / d, d)

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
if CITY and base and os.path.exists(SKYLINE):
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
if MOON_X is not None:
    cx, cy, moon_r = MOON_X, MOON_Y, MOON_R
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
    if not LANDING:
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
        my = rng.uniform(-1500, min(CAM['y'] - NEAR * 2, MH - 1) if LANDING else CAM['y'] - NEAR * 2)  # (the landing: not on the mirrored map)
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
