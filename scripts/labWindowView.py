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
    # The landing page (Jamie, 2026-11-18, after his mock-up, Home_page_peninsula): the whole Peninsula from high up,
    # from the screen's bottom to the logo, its top chunk round the logo's skyline, the bridges going out to far lands
    # (the Golden Gate to the North Bay's hills, the Bay Bridge to the East Bay's shore), circuit roots under the city.
    # Drawn at half the screen's px (shown twice the size, pixelated), placed by the logo (600 x 300 px): its zoom spot
    # at (SPOT_X, SPOT_ROW) here; the skyline (logo x 30-555) centred 61.5 here left of it, its ground 34.5 below it.
    # The perspective is drawn, not a camera's (no camera gives a low horizon, a wide top and the whole Peninsula):
    # each distance has its own row and width, fitted through anchors along the Peninsula (map rows), and lines along
    # it run up the middle to the vanishing point (VPX, HZ), under the skyline's middle, just above its ground.
    # Jamie's round 3 drawing (on his mock-up): the coasts run near straight from the base up to the waist just under
    # the logo, then the top chunk flares out round the skyline, wider than it.
    # Its px are the logo's at its own size (600 x 300); the landing scales both together (MainMenu: 1.2 times at
    # Jamie's window, 1908 x 915, and with the window), so Jamie's drawing's px are divided by 2.4 here.
    #   rows (px here below the horizon): the top edge at the skyline's ground, the waist (map row MID_Y) MID_DROP, the
    #   base at the bottom of Jamie's window (293 below the spot);
    #   widths (px here across the land): the top chunk CHUNK_WIDTH (the skyline is 262 wide), the waist WAIST_WIDTH,
    #   the base BASE_WIDTH (his window's width)
    W, H, SPOT_X, SPOT_ROW, HORIZON_DOWN = 1700, 1000, 850, 380, 23
    VPX, HZ = SPOT_X - 61.5, SPOT_ROW + HORIZON_DOWN
    TIP_Y, TIP_DROP = 110, 34.5 - HORIZON_DOWN
    MID_Y, MID_DROP = 441, 32
    BASE_Y, BASE_DROP, DEPTH_RATIO = 780, 293 - HORIZON_DOWN, 5.0
    CHUNK_ROWS, CHUNK_WIDTH = (110, 300), 300
    WAIST_ROWS, WAIST_WIDTH = (340, 540), 130
    BASE_WIDTH = 717
    # the mountains on the left in front: peaks along Jamie's strokes (map px, from his screenshot), sharp, not bulbous
    RIDGES = [[(166, 762), (172, 742), (199, 726), (221, 713), (240, 690), (260, 664), (264, 638)],
              [(239, 680), (240, 650), (250, 644)],
              [(254, 758), (268, 743), (285, 728), (292, 710)]]
    # painted behind the horizon, as Jamie drew them (px here: across from the skyline's middle, up from the horizon):
    # the North Bay's mountains on the left, behind the skyline's left edge; Treasure Island on the right
    NORTH_BAY = [(-240, -5), (-220, -24), (-203, -27), (-187, -45), (-162, -57), (-145, -58), (-128, -53),
                 (-120, -45), (-108, -47), (-87, -38), (-78, -17), (-75, 0)]
    TREASURE_ISLAND = [(255, 0), (265, -12), (272, -18), (280, -30), (313, -32), (347, -28), (359, -13), (367, 0)]
    # the bridges past the map, on Jamie's green lines (from where the map's own end, at its edge)
    GOLDEN_GATE = [(-138, -16)]
    BAY_BRIDGE = [(201, -1), (272, -10), (313, -16), (355, -12), (401, -17), (467, -20)]
    CITY = 0
    MOON_X, MOON_Y, MOON_R = 1000, HZ - 55, 35  # (as big as round 2 looked, the logo now 1.2 times; clear of the horizon)
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
    LENGTH = np.linalg.norm(tip_mid - base_mid)
    d_base = LENGTH / (DEPTH_RATIO - 1)
    d_tip = d_base * DEPTH_RATIO
    d_of_row = lambda y: d_base + LENGTH * (BASE_Y - y) / (BASE_Y - TIP_Y)  # (the map's rows run near enough along it)
    def width_of(y0, y1, pick):
        ys = np.arange(y0, y1)
        widths = [np.max(np.diff(np.nonzero(np.diff(np.concatenate([[0], body[y].astype(int), [0]])))[0])[::2]) for y in ys]
        k = pick(widths)
        return ys[k], widths[k]
    chunk_y, chunk_w = width_of(*CHUNK_ROWS, np.argmax)
    waist_y, waist_w = width_of(*WAIST_ROWS, np.argmin)
    base_w = width_of(BASE_Y, BASE_Y + 1, np.argmax)[1]
    # straight lines in log distance / log px through the anchors, carried on past both ends
    def fitted(anchors, far_power):
        log_d = np.log([d for d, _ in anchors])
        log_v = np.log([v for _, v in anchors])
        def at(d):
            x = np.log(d)
            v = np.interp(x, log_d, log_v)
            near = log_v[0] + (log_v[1] - log_v[0]) / (log_d[1] - log_d[0]) * (x - log_d[0])
            far = log_v[-1] - far_power * (x - log_d[-1]) if far_power is not None else log_v[-1] + (log_v[-1] - log_v[-2]) / (log_d[-1] - log_d[-2]) * (x - log_d[-1])
            return np.exp(np.where(x < log_d[0], near, np.where(x > log_d[-1], far, v)))
        return at
    row_at = fitted([(d_base, BASE_DROP), (d_of_row(MID_Y), MID_DROP), (d_of_row(TIP_Y), TIP_DROP)], None)
    chunk_scale = CHUNK_WIDTH / chunk_w
    width_at = fitted([(d_base, BASE_WIDTH / base_w), (d_of_row(waist_y), WAIST_WIDTH / waist_w),
                       (d_of_row(chunk_y), chunk_scale), (d_of_row(TIP_Y), chunk_scale)], 1.0)
    # the hills' heights: by the width, and past the tip falling off slowly (the far lands stand up behind the city)
    height_at = lambda d: np.where(d > d_tip, chunk_scale * (d_tip / np.maximum(d, 1)) ** 0.25, width_at(d))
    NEAR = float(np.exp(np.interp(np.log(H - HZ), np.log([row_at(d) for d in np.geomspace(d_base * 3, d_base / 4, 400)]),
                                  np.log(np.geomspace(d_base * 3, d_base / 4, 400)))))  # the bottom row's distance
    eye = base_mid - AHEAD * d_base           # on the Peninsula's line: it runs up the middle (Jamie: centred)
    CAM['x'], CAM['y'] = float(eye[0]), float(eye[1])
    F, K_LANDING = 1.0, 1.0                   # (unused on the landing)
    print('chunk', chunk_y, chunk_w, 'waist', waist_y, waist_w, 'base', base_w, 'camera', CAM, 'NEAR', round(NEAR, 1))
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
height = cv2.GaussianBlur(np.minimum(dist, 26) * 0.7 * toward_base, (0, 0), 7)  # (gentle: the eye is only CAM_H up)
# flat right in front of the window, rising over the next stretch (steep close up, it streaked)
if LANDING:
    # the landing's: a few peaked mountains on the parkland at the left in front (Jamie: peaked, not bulbous, smaller),
    # each a sharp cone roughened by a ridge noise, the low rolling hills elsewhere kept
    peak_rng = np.random.default_rng(11)
    yy_, xx_ = np.mgrid[0:MH, 0:MW].astype(np.float32)
    spots = []
    for ridge in RIDGES:  # a peak every ~9 map px along each ridge, a little off it now and then
        for (x1, y1), (x2, y2) in zip(ridge, ridge[1:]):
            n = max(1, int(np.hypot(x2 - x1, y2 - y1) / 9))
            spots += [(x1 + (x2 - x1) * k / n + peak_rng.uniform(-3, 3), y1 + (y2 - y1) * k / n + peak_rng.uniform(-3, 3)) for k in range(n)]
        spots.append(ridge[-1])
    peaks = np.zeros((MH, MW), np.float32)
    for px, py in spots:
        tall, reach = peak_rng.uniform(14, 24), peak_rng.uniform(14, 22)  # (narrower stood up as spikes)
        cone = np.clip(1 - np.hypot(xx_ - px, yy_ - py) / reach, 0, 1) ** 1.2
        peaks = np.maximum(peaks, tall * cone)
    ridges = 0.8 + 0.2 * np.abs(np.sin(xx_ / 4.3 + np.sin(yy_ / 7.1) * 2) * np.cos(yy_ / 5.7 - xx_ / 9.0))
    parkland = cv2.GaussianBlur(cv2.dilate(green, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 3)
    peaks *= parkland  # (on the parkland only: on the city they came out as dark blobs)
    height = np.maximum(height * 0.6, peaks * ridges) * np.clip(cv2.distanceTransform(land.astype(np.uint8), cv2.DIST_L2, 5) / 4, 0, 1)
    # shaded, lit from the south-east and above, so the hills read as hills
    gy, gx = np.gradient(height)
    light = np.array([0.55, 0.45, 0.7])  # (from the front right: lit from behind, only their dark sides showed)
    lit = (-gx * light[0] - gy * light[1] + light[2]) / np.sqrt(gx ** 2 + gy ** 2 + 1) / light[2]
    hill_shade = np.where(land, np.clip(lit, 0.3, 1.6), 1.0)
    clean *= hill_shade[..., None]
    # the moonlit faces caught in a cool light, so the peaks read against the dark parkland
    clean += (np.clip(hill_shade - 1, 0, 1) * 1.6)[..., None] * np.array([34, 46, 70], np.float32)
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
    if LANDING:  # (none on the map past it: the landing's are painted behind the horizon, where Jamie drew them)
        return np.zeros_like(mx, bool), np.zeros_like(mx, float)
    return north_west | east, np.maximum(hills, 0) + shore

# the bridges' roads past the map, on to the far lands (the Lab's cars' paths)
FAR_ROADS = [[(88, 0), (40, -120), (-60, -260), (-260, -380), (-600, -520)],
             [(499, 125), (660, 70), (900, 40), (1400, 20), (2400, 0)]]
ROAD = np.array([200, 168, 140], np.float32)

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
    y_top = HZ + row_at(d) - h * height_at(d) if LANDING else HZ + (K - h * F) / d
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
    # ---- painted behind the horizon, where Jamie drew them: the North Bay's mountains on the left (a jagged ridge, its
    # top caught by the moon) and Treasure Island, low, on the right; over the sky only ----
    cols = np.arange(W) - VPX
    def silhouette(points, jag):
        px_, py_ = zip(*points)
        top = np.interp(cols, px_, py_, left=0, right=0)
        top = np.where(top < -2, top + jag * (np.sin(cols / 3.1) + 0.6 * np.sin(cols / 1.7 + 1.3)), top)
        return HZ + np.minimum(top, 0)
    far_shapes = np.zeros((H, W), bool)  # (the moon goes behind them)
    for points, color, jag in ((NORTH_BAY, np.array([13, 18, 33]), 1.4), (TREASURE_ISLAND, np.array([11, 15, 28]), 0.5)):
        tops = silhouette(points, jag)
        shape = (ys >= tops[None, :]) & (ys <= HZ + 1) & is_sky & (tops[None, :] < HZ - 0.5)
        far_shapes |= shape
        out = np.where(shape[..., None], color, out)
        rim = shape & (ys < tops[None, :] + 1)
        out = np.where(rim[..., None], color + np.array([20, 24, 40]), out)
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
        return (VPX + (dx * RIGHT[0] + dy * RIGHT[1]) * width_at(d), HZ + row_at(d) - h * height_at(d), d)
    return (VPX + (dx * RIGHT[0] + dy * RIGHT[1]) * F / d, HZ + (K - h * F) / d, d)

def is_seen(x, y, d):
    # a point is seen unless land nearer than it rises over it in its column
    c = int(round(x))
    if c < 0 or c >= W:
        return False
    s = int(np.searchsorted(steps, d * 0.97)) - 1
    return s < 0 or y < cover[s, c]

if LANDING:
    # ---- the bridges past the map, on Jamie's green lines: the Golden Gate from behind the skyline's left up into the
    # North Bay's mountains (its two towers), the Bay Bridge from the city out right over Treasure Island and on ----
    from PIL import ImageDraw
    pen = ImageDraw.Draw(img)
    BRIDGE_LINES = []
    for start, points, way in (((88, 0), GOLDEN_GATE, -1), ((499, 125), BAY_BRIDGE, 1)):
        q = project(*start)
        # (on from the map's own end: Jamie's line's points short of it left out, or it doubled back)
        line_ = [(q[0], q[1])] + [(VPX + x, HZ + y) for x, y in points if (VPX + x - q[0]) * way > 4]
        BRIDGE_LINES.append(line_)
        pen.line(line_, fill=tuple(int(c) for c in ROAD * 0.8), width=1)
    (gx1, gy1), (gx2, gy2) = BRIDGE_LINES[0][0], BRIDGE_LINES[0][-1]
    for share, tall in ((0.45, 5), (0.75, 4)):
        tx, ty = gx1 + (gx2 - gx1) * share, gy1 + (gy2 - gy1) * share
        pen.line([(tx, ty), (tx, ty - tall)], fill=(150, 58, 44), width=1)

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
in_sky = is_sky & ~far_shapes if LANDING else is_sky
crescent = disc & ~bite & in_sky
halo = np.clip(1 - (np.hypot(xx - cx, yy - cy) - moon_r) / (moon_r * 1.6), 0, 1) * in_sky
arr = np.asarray(img).astype(np.float32)
arr[..., :3] += (halo ** 2)[..., None] * np.array([38, 44, 70])
arr[crescent, :3] = arr[crescent, :3] * 0.15 + np.array([236, 232, 205]) * 0.85
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
if LANDING:
    # ---- under the city (Jamie): a darkened patch of ground with small jagged roots, like a tree trunk's in the ground
    # seen from far off, grounding the logo's skyline in the Peninsula (behind the skyline, on the land; a small detail)
    root_rng = np.random.default_rng(5)
    ground = SPOT_ROW + 34.5
    left, right = SPOT_X + (30 - 415) / 2, SPOT_X + (555 - 415) / 2
    middle_, half = (left + right) / 2, (right - left) / 2
    arr = np.asarray(img).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    patch = np.clip(1 - ((xx - middle_) / (half * 1.05)) ** 2 - ((yy - ground) / 16) ** 2, 0, 1) * (yy >= ground - 2)
    arr[..., :3] *= (1 - 0.6 * patch ** 0.7)[..., None]
    img = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pen = ImageDraw.Draw(layer)
    def root(x, y, length):
        points = [(x, y)]
        for _ in range(int(length)):
            x += root_rng.choice([-1, 0, 0, 1]) * (1 if root_rng.random() < 0.8 else 2)
            y += 1
            points.append((x, y))
            if root_rng.random() < 0.08 and length > 5:
                root(x, y, length * 0.45)
        pen.line(points, fill=(2, 2, 5, 255), width=1)
    for x0 in np.linspace(left + 6, right - 6, 18):
        root(x0 + root_rng.uniform(-4, 4), ground - 1, root_rng.uniform(6, 15))
    fade = np.clip(1 - (np.arange(H) - ground) / 18, 0, 1)[:, None]
    roots = np.asarray(layer).astype(np.float32)
    roots[..., 3] *= fade
    img = Image.alpha_composite(img, Image.fromarray(roots.astype(np.uint8), 'RGBA'))
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
        runs.append(line(FAR_ROADS[0]))
        runs.append(line(FAR_ROADS[1]))
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
    if LANDING:
        # the bridges' cars, along their drawn lines (far off: small)
        for line_ in BRIDGE_LINES:
            pts = []
            for (x1, y1), (x2, y2) in zip(line_, line_[1:]):
                n = max(1, int(np.hypot(x2 - x1, y2 - y1) / 1.5))
                pts += [[round(x1 + (x2 - x1) * k / n, 1), round(y1 + (y2 - y1) * k / n, 1), 1600] for k in range(n)]
            paths.append(pts + pts[::-1])
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
