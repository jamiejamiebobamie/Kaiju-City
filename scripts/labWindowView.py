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
    # (round 4: the top chunk up and wider, so the skyline stands on it all along: its widest row, CHUNK_Y, at the
    # skyline's ground, the narrower top edge above it, toward the horizon; centred under the skyline, CENTRE_ROWS
    # warped sideways so each row's land is centred, easing off to none by the waist)
    TIP_Y, TIP_DROP = 110, 5
    CHUNK_Y, CHUNK_DROP = 217, 34.5 - HORIZON_DOWN
    MID_Y, MID_DROP = 441, 30
    BASE_Y, BASE_DROP, DEPTH_RATIO = 780, 293 - HORIZON_DOWN, 5.0
    CHUNK_ROWS, CHUNK_WIDTH = (110, 300), 370
    WAIST_ROWS, WAIST_WIDTH = (340, 540), 130
    BASE_WIDTH = 717
    CENTRE_ROWS = (560, 720)
    COAST_ABOVE = 360  # (map rows above it: the top chunk, its coast a thin outline rather than the map's surf)
    COAST_FADE, COAST_LOW = (300, 480), 0.35  # (the outline full to the first row, easing to this share by the second)
    SYM_ROWS = (640, 720)  # (to the waist and on down: easing off before "[Press any key]")
    # (round 4: below "[Press any key]" (row PRESS_ROW here) the coasts carry straight on, widening as they do above
    # it, BASE_SPREAD times: the drawn perspective's own bent in near the bottom)
    PRESS_ROW, BASE_SPREAD = 550, 1.25
    BASE_FLARE = 0.6  # (round 5: flaring out more toward the screen's bottom corners: the widening grows by this much
                      # per 120 px down)
    # the mountains on the left in front: peaks along Jamie's strokes (map px, from his screenshot), sharp, not bulbous
    # (round 4: re-read from his screenshot with the zoom spot where it really was: they'd landed ~50 map px right)
    RIDGE_HEIGHT = 13  # (map px, at the crests; 34 made one massif up to the logo)
    RIDGES = [[(107, 766), (105, 747), (125, 731), (141, 718), (150, 696), (157, 671), (148, 646)],
              [(144, 686), (129, 657), (136, 651)],
              [(197, 762), (204, 747), (215, 733), (213, 715)]]
    # painted behind the horizon, as Jamie drew them (px here: across from the skyline's middle, up from the horizon):
    # the North Bay's mountains on the left, behind the skyline's left edge; Treasure Island on the right
    NORTH_BAY = [(-340, 0), (-310, -2), (-285, -4), (-262, -8), (-245, -14), (-220, -24), (-203, -27), (-187, -45), (-162, -57), (-145, -58), (-128, -53),
                 (-120, -45), (-108, -47), (-87, -38), (-78, -17), (-75, 0)]
    NORTH_BAY = [(x, y * 0.6) for x, y in NORTH_BAY]  # (lower, round 5: it stood over the Kaiju and the logo)
    # Treasure Island (round 4): small and low, trees along its top, placed where the Bay Bridge's line crosses it
    # (TI_AT: px here along the line from the map's edge; back over the map's own bridge, where Jamie drew it: the
    # bridge already reaches near his window's right edge there), the bridge on its near part, behind its far part
    TI_AT, TI_SIZE = -25, (64, 7)
    # the bridges past the map, on Jamie's green lines (from where the map's own end, at its edge)
    GOLDEN_GATE = [(-150, -4)]  # (flatter: Jamie, round 4)
    TOWER_TALL = 7  # the bridges' towers, map px high (drawn by their distance)
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
    row_at = fitted([(d_base, BASE_DROP), (d_of_row(MID_Y), MID_DROP), (d_of_row(CHUNK_Y), CHUNK_DROP), (d_of_row(TIP_Y), TIP_DROP)], None)
    chunk_scale = CHUNK_WIDTH / chunk_w
    curved_width = fitted([(d_base, BASE_WIDTH / base_w), (d_of_row(waist_y), WAIST_WIDTH / waist_w),
                           (d_of_row(chunk_y), chunk_scale), (d_of_row(TIP_Y), chunk_scale)], 1.0)
    # below "[Press any key]": the width carried on straight with the row (straight coasts), from its own slope there
    probe = np.geomspace(d_base / 4, d_base * 6, 4000)
    d_press = float(probe[np.argmin(np.abs(row_at(probe) - (PRESS_ROW - HZ)))])
    r_press, w_press = float(row_at(d_press)), float(curved_width(d_press))
    slope = (curved_width(d_press * 0.98) - curved_width(d_press * 1.02)) / (row_at(d_press * 0.98) - row_at(d_press * 1.02))
    def width_at(d):
        r = row_at(d)
        below = np.maximum(r - r_press, 0)
        return np.where(r > r_press, w_press + slope * BASE_SPREAD * below * (1 + BASE_FLARE * below / 120), curved_width(d))
    # centred (Jamie): each map row's land, from the north city down to the waist, warped sideways to sit on the line
    # up the middle; easing off between CENTRE_ROWS
    cols_ = np.arange(MW)
    centre_off = np.zeros(MH)
    for y in range(MH):
        xs_ = cols_[body[y]]
        if len(xs_):
            axis_x = base_mid[0] + (tip_mid[0] - base_mid[0]) * (BASE_Y - y) / (BASE_Y - TIP_Y)
            centre_off[y] = (xs_.min() + xs_.max()) / 2 - axis_x
    centre_off = cv2.GaussianBlur(centre_off.reshape(-1, 1).astype(np.float32), (1, 0), 12).ravel()
    ease = np.clip((CENTRE_ROWS[1] - np.arange(MH)) / (CENTRE_ROWS[1] - CENTRE_ROWS[0]), 0, 1)
    centre_off *= ease * ease * (3 - 2 * ease)
    def shift_at(d):
        y = BASE_Y - (np.asarray(d) - d_base) * (BASE_Y - TIP_Y) / LENGTH
        return np.interp(y, np.arange(MH), centre_off, left=centre_off[0], right=0.0)
    # (round 8, Jamie: the base's coasts leave the window alike: near the bottom the land reaches further left of the
    # line up the middle than right, so there the right side is widened to mirror the left, easing in over SYM_ROWS)
    mirror = np.ones(MH)
    for y in range(MH):
        xs_ = np.nonzero(land[y])[0]
        if len(xs_):
            axis_x = base_mid[0] + (tip_mid[0] - base_mid[0]) * (BASE_Y - y) / (BASE_Y - TIP_Y)
            mirror[y] = np.clip((axis_x - xs_.min()) / max(xs_.max() - axis_x, 1), 1, 1.6)
    mirror = cv2.GaussianBlur(mirror.reshape(-1, 1).astype(np.float32), (1, 0), 8).ravel()
    ease_in = np.clip((np.arange(MH) - SYM_ROWS[0]) / (SYM_ROWS[1] - SYM_ROWS[0]), 0, 1)
    mirror = 1 + (mirror - 1) * ease_in * ease_in * (3 - 2 * ease_in)
    def mirror_at(d):
        y = BASE_Y - (np.asarray(d) - d_base) * (BASE_Y - TIP_Y) / LENGTH
        return np.interp(y, np.arange(MH), mirror, left=1.0, right=float(mirror[-1]))
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
if LANDING:
    # the map's surf (its lavender-to-light-blue speckle along the coasts) dimmed to a trace: the landing animates it
    # (Jamie, round 7: the still breaking waves broke the spell; LandingScene's Surf, from 'surf' in the traffic file)
    coast_band = cv2.dilate((mp.sum(axis=2) < 60).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    SURF = coast_band & (mp.sum(axis=2) > 90) & (mp[..., 2] >= 130) & (mp[..., 2] - mp[..., 0] >= 40)
    SURF &= cv2.dilate(land.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)  # (the coasts only: the map's own
    # moon reflection out at sea is these colours too)
    clean[SURF] = clean[SURF] * 0.3 + np.array([10, 22, 44], np.float32) * 0.7
# the green hills raised (Jamie, playtest 36): parkland rises with its distance in from its edges, highest near the base
green = ((mp[..., 1] > mp[..., 0] + 6) & (mp[..., 1] > 40) & land).astype(np.uint8)
green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
dist = cv2.distanceTransform(green, cv2.DIST_L2, 5)
toward_base = np.clip((np.arange(MH)[:, None] - 350) / 450, 0, 1) ** 1.5
height = cv2.GaussianBlur(np.minimum(dist, 26) * 0.7 * toward_base, (0, 0), 7)  # (gentle: the eye is only CAM_H up)
# flat right in front of the window, rising over the next stretch (steep close up, it streaked)
if LANDING:
    # the landing's mountains (Jamie, round 5): one ridge along each of his strokes, its crest the stroke itself, the
    # land falling away from it on both sides down to the parkland's edges, like a raised-relief map: its height
    # by how far from the crest it is against how far from the parkland's edge; gullies cut down its sides
    relief_rng = np.random.default_rng(11)
    crest = np.zeros((MH, MW), np.uint8)
    for ridge in RIDGES:
        cv2.polylines(crest, [np.array(ridge, np.int32).reshape(-1, 1, 2)], False, 1, 1)
    from_crest = cv2.distanceTransform(1 - crest, cv2.DIST_L2, 5)
    park = cv2.dilate(green, np.ones((3, 3), np.uint8))
    from_edge = cv2.distanceTransform(park, cv2.DIST_L2, 5)
    down = from_crest / np.maximum(from_crest + from_edge, 1e-3)  # 0 on the crest, 1 at the parkland's edge
    def field(sigma):
        f = cv2.GaussianBlur(relief_rng.random((MH, MW)).astype(np.float32), (0, 0), sigma)
        return (f - f.min()) / max(f.max() - f.min(), 1e-6)
    crest_height = RIDGE_HEIGHT * (0.75 + 0.5 * field(10))   # higher and lower along the crest
    gullies = 0.8 + 0.4 * field(2.5)                           # cut down the sides
    height = crest_height * np.clip(1 - down, 0, 1) ** 2.2 * (1 - (1 - gullies) * np.clip(down * 2, 0, 1))
    height *= park > 0
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
        side = np.where(side > 0, side * mirror_at(d) ** -1, side) + shift_at(d)
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

def project(mx, my, h=0.0):
    dx, dy = mx - CAM['x'], my - CAM['y']
    d = dx * AHEAD[0] + dy * AHEAD[1]
    if d <= NEAR * 0.95:
        return None
    if LANDING:
        side = dx * RIGHT[0] + dy * RIGHT[1] - shift_at(d)
        return (VPX + side * width_at(d) * (mirror_at(d) if side > 0 else 1), HZ + row_at(d) - h * height_at(d), d)
    return (VPX + (dx * RIGHT[0] + dy * RIGHT[1]) * F / d, HZ + (K - h * F) / d, d)

# the sky, above it all: deep night, lighter at the horizon, with stars
ys = np.arange(H, dtype=np.float32)[:, None]
t = np.clip(ys / HZ, 0, 1)
SKY_TOP = np.array([11, 12, 14]) if LANDING else np.array([4, 6, 16])  # (the landing's: its page's own black, #0b0c0e)
sky = SKY_TOP * (1 - t ** (2.2 if LANDING else 1))[..., None] + np.array([26, 40, 72]) * (t ** (2.2 if LANDING else 1))[..., None]
sky = np.broadcast_to(sky, (H, W, 3)).copy()
stars = (rng.random((H, W)) < 0.0009) & (ys < HZ * 0.9)
if not LANDING:  # (the landing's twinkle: drawn live by LandingScene's Stars, from 'stars' in the traffic file)
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
    # the Bay Bridge's line: straight on from the map's own bridge, as it leaves the Peninsula
    bay_start, bay_back = np.array(project(499, 125)[:2]), np.array(project(470, 135)[:2])
    bay_way = (bay_start - bay_back) / np.linalg.norm(bay_start - bay_back)
    ti_mid = bay_start + bay_way * TI_AT
    ti_rel = ti_mid[0] - VPX
    ti_w, ti_h = TI_SIZE
    ti_rng = np.random.default_rng(8)
    # (it stands on the water at the bridge's distance, below the horizon: its foot ti_h * 0.45 under the bridge)
    ti_base = ti_mid[1] + ti_h * 0.45
    island = [(-ti_w / 2, 0), (-ti_w / 2 + 6, -ti_h * 0.6), (-ti_w / 2 + 14, -ti_h * 0.85)]
    for x in np.arange(-ti_w / 2 + 16, ti_w / 2 - 10, 2.0):  # tree tops along it, bumpy
        island.append((x, -ti_h - ti_rng.uniform(0.5, 3.2)))
    island += [(ti_w / 2 - 6, -ti_h * 0.55), (ti_w / 2, 0)]
    ix_, iy_ = zip(*island)
    ti_top = ti_base + np.interp(cols - ti_rel, ix_, iy_, left=1, right=1)
    ti_shape = (ys >= ti_top[None, :]) & (ys <= ti_base) & (ti_top[None, :] < ti_base - 0.5)
    out = np.where(ti_shape[..., None], np.array([11, 15, 28]), out)
    out = np.where((ti_shape & (ys < ti_top[None, :] + 1))[..., None], np.array([30, 40, 62]), out)
    far_shapes |= ti_shape
    # small far hills along the horizon (round 6, as the early versions had), only right of the North Bay's mountains
    # (left of them is the Pacific): low, uneven, hazy
    far_rise = 2.2 + 1.8 * np.sin(cols / 23.0) + 1.3 * np.sin(cols / 9.7 + 1.0) + 0.8 * np.sin(cols / 4.1 + 2.3)
    far_rise *= np.clip((cols - NORTH_BAY[-1][0] + 10) / 30, 0, 1)
    far_tops = HZ - np.maximum(far_rise, 0)
    far_hills = (ys >= far_tops[None, :]) & (ys <= HZ + 1) & is_sky & (far_rise[None, :] > 0.8)
    out = np.where(far_hills[..., None], np.array([17, 23, 42]), out)
    out = np.where((far_hills & (ys < far_tops[None, :] + 1))[..., None], np.array([30, 38, 64]), out)
    far_shapes |= far_hills
    for points, color, jag in ((NORTH_BAY, np.array([13, 18, 33]), 1.4),):
        tops = silhouette(points, jag)
        shape = (ys >= tops[None, :]) & (ys <= HZ + 1) & is_sky & (tops[None, :] < HZ - 0.5)
        far_shapes |= shape
        out = np.where(shape[..., None], color, out)
        rim = shape & (ys < tops[None, :] + 1)
        out = np.where(rim[..., None], color + np.array([20, 24, 40]), out)
    # the stars that show: in the open sky, not behind the far lands (Jamie, 2026-11-19: gently twinkling)
    STAR_LIST = [[int(x), int(y), round(float(rng.uniform(0.45, 1.0)), 2)] for y, x in np.argwhere(stars & is_sky & ~far_shapes)]
    # the ground darkens toward the bottom of the screen, into the page's black: the eye goes up the Peninsula
    below = np.clip((ys - HZ) / (H - HZ), 0, 1)
    shade = 1 - 0.7 * np.clip((below - 0.45) / 0.55, 0, 1) ** 1.3
    out = np.where(is_sky[..., None], out, out * shade[..., None] + np.array([11, 12, 14]) * (1 - shade[..., None]))
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert('RGBA')

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
    bridge_color = tuple(int(c) for c in ROAD * 0.8) + (255,)
    q = project(88, 0)
    golden = [(q[0], q[1])] + [(VPX + x, HZ + y) for x, y in GOLDEN_GATE]
    BRIDGE_LINES.append(golden)
    pen.line(golden, fill=bridge_color, width=1)
    # the Bay Bridge: straight on to the right edge; on Treasure Island's near half, behind its far half (a pixel at
    # a time: drawn unless the island stands there past its middle)
    # (Jamie, round 5: the bridge cut at the island's left edge; out again over its right end; no cars over it)
    TI_HIDE = (VPX + ti_rel - ti_w / 2, VPX + ti_rel + ti_w / 2 - 5.5)  # (round 7: the outbound from behind the island,
    # coming out on its low right end where Jamie marked it)
    TI_HIDE_FROM = TI_HIDE[0]
    TI_BOX = (TI_HIDE[0] - 1, TI_HIDE[1], ti_base - ti_h - 6, ti_base + 3)
    # (round 6: the map's own stretch of it traced, from the city, so it has no gaps; then straight on to the edge.
    # Round 8: hidden exactly where the island stands, a pixel at a time, so it meets the island with no gap either side)
    bay_map = [project(310 + (499 - 310) * k / 120, 187 + (125 - 187) * k / 120) for k in range(121)]
    bay_line = [np.array(q[:2]) for q in bay_map if q is not None]
    bay_end = bay_start + bay_way * ((W - bay_start[0]) / max(bay_way[0], 1e-3))
    bay_line.append(bay_end)
    steps_ = []
    for a_, b_ in zip(bay_line, bay_line[1:]):
        n = max(1, int(np.hypot(*(b_ - a_)) * 2))
        steps_ += [a_ + (b_ - a_) * k / n for k in range(n)]
    bay_pts, run = [], []
    for x, y in steps_:
        cx_, cy_ = int(round(x)), int(round(y))
        hidden = 0 <= cy_ < H and 0 <= cx_ < W and ti_shape[cy_, cx_]
        if hidden:
            if len(run) > 1:
                bay_pts.append(run)
            run = []
        else:
            run.append((float(x), float(y)))
    if len(run) > 1:
        bay_pts.append(run)
    for run in bay_pts:
        pen.line(run, fill=bridge_color, width=1)
        BRIDGE_LINES.append(run)
    # ---- the suspensions (Jamie, 2026-11-19): towers up from the deck, their height by how far off they are, the main
    # cable from the deck up to the first tower's top, sagging nearly to the deck between towers, and back down ----
    def suspension(deck, towers, color, cable_color, ends=(True, True)):
        # deck: [(x, y, px per map px there)], towers: shares along it, each tower TOWER_TALL map px high
        def at(share):
            k = share * (len(deck) - 1)
            i = min(int(k), len(deck) - 2)
            f = k - i
            return tuple(deck[i][c] + (deck[i + 1][c] - deck[i][c]) * f for c in range(3))
        tops = []
        for share in towers:
            x, y, scale = at(share)
            tall = max(2.0, TOWER_TALL * scale)
            pen.line([(x, y), (x, y - tall)], fill=color, width=1)
            tops.append((share, tall))
        spans = list(zip(tops, tops[1:]))
        if ends is True or ends is False:
            ends = (ends, ends)
        if ends[0]:
            spans = [((0.0, 0.0), tops[0])] + spans
        if ends[1]:
            spans = spans + [(tops[-1], (1.0, 0.0))]
        for (s0, h0), (s1, h1) in spans:
            cable = []
            for k in range(41):
                t = k / 40
                x, y, _ = at(s0 + (s1 - s0) * t)
                sag = (h0 + h1) / 2 * 0.8 * 4 * t * (1 - t) if h0 and h1 else 0
                cable.append((x, y - ((1 - t) * h0 + t * h1 - sag)))
            pen.line(cable, fill=cable_color, width=1)
    # the Golden Gate: its two towers, international orange, smaller as it goes off toward the North Bay
    g_scale = height_at(project(88, 0)[2])
    golden_deck = [(x, y, g_scale * (1 - 0.45 * k / max(1, len(golden) - 1))) for k, (x, y) in enumerate(golden)]
    golden_deck = [tuple(golden_deck[0][c] + (golden_deck[-1][c] - golden_deck[0][c]) * k / 30 for c in range(3)) for k in range(31)]
    suspension(golden_deck, (0.3, 0.72), (170, 66, 48), (150, 60, 46))
    # the Bay Bridge's west span, the city to Treasure Island: four silver towers (its east span, past the island, a truss)
    west = [q for q in bay_map if q is not None and not (0 <= int(round(q[1])) < H and 0 <= int(round(q[0])) < W and ti_shape[int(round(q[1])), int(round(q[0]))]) and q[0] < VPX + ti_rel]
    if len(west) > 4:
        # (Jamie, 2026-11-19: all the way to Treasure Island, its cable down to the deck at the island's edge)
        suspension([(q[0], q[1], height_at(q[2])) for q in west], (0.1, 0.3, 0.5, 0.7, 0.88), (168, 176, 190), (140, 150, 168), ends=(False, True))
    # and on past the island to the window's edge (Jamie): up from the deck at the island's far end, smaller as it goes
    after = [run for run in bay_pts if run[0][0] > VPX + ti_rel]
    if after and len(after[0]) > 4:
        far_scale = height_at(project(499, 125)[2]) * 0.9
        run = after[0]
        suspension([(x, y, far_scale * (1 - 0.4 * k / (len(run) - 1))) for k, (x, y) in enumerate(run)], (0.12, 0.34, 0.56, 0.78, 0.97), (168, 176, 190), (140, 150, 168), ends=(True, False))

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
# (the landing's moon is its own layer, placed and sized live: LandingScene's Moon, Jamie's ?tune panel)
if not LANDING:
    arr[..., :3] += (halo ** 2)[..., None] * np.array([38, 44, 70])
# (the landing's pale yellow: Jamie; the dithered board-map disc tried, and taken back)
if not LANDING:
    arr[crescent, :3] = arr[crescent, :3] * 0.15 + np.array([236, 232, 205]) * 0.85
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
if False:  # (the joiner under the city is drawn over the skyline now: scripts/landingJoiner.py, Jamie, round 4)
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
    if LANDING:
        # no cars over Treasure Island: the roads' paths cut there (each piece made a there-and-back of its own)
        island_zone = cv2.dilate(ti_shape.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        on_island = lambda x, y: 0 <= int(round(y)) < H and 0 <= int(round(x)) < W and island_zone[int(round(y)), int(round(x))]
        cut = []
        for path in paths:
            piece = []
            for point in path:
                if on_island(point[0], point[1]):
                    if len(piece) >= 2:
                        cut.append(piece + piece[::-1])
                    piece = []
                else:
                    piece.append(point)
            if len(piece) >= 2:
                cut.append(piece if len(piece) == len(path) else piece + piece[::-1])
        paths = cut
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
    extra = {}
    if LANDING:
        # the surf's points (every other one), where they're seen; and Treasure Island's, along its foot
        surf = []
        for my, mx in np.argwhere(SURF)[::2]:
            if my < COAST_ABOVE:
                continue  # (the top chunk's coast is the thin outline below instead: squeezed into few rows, it was a blob)
            q = project(float(mx), float(my))
            if q and 0 <= q[0] < W and HZ < q[1] < H and is_seen(*q):
                surf.append([round(float(q[0]), 1), round(float(q[1]), 1), round(float(q[2]), 1)])
        # (Jamie: the island's waves only in front of it, below its foot, where it meets the water; none on it)
        foot_row = int(np.floor(ti_base))
        foot = np.nonzero(ti_shape[foot_row])[0] if 0 <= foot_row < H else np.array([])
        island = []
        if len(foot):
            for x in np.arange(foot.min() - 1, foot.max() + 2, 1.0):
                for dy in (1.4, 2.4, 3.3):
                    if dy > 3 and rng.random() < 0.5:
                        continue
                    island.append([round(float(x + rng.uniform(-0.4, 0.4)), 1), round(float(foot_row + dy), 1), 1600])
        # (round 8: the top chunk's coasts outlined, Jamie: its ends were lost in the sea)
        coast = []
        # (2026-11-19, Jamie: pixel thin, following the land's shape: traced along the true shore (the land mask, its
        # coast margin taken off), one point to a pixel of the picture)
        shore = cv2.erode(land.astype(np.uint8), np.ones((5, 5), np.uint8))
        outline = cv2.findContours(shore, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
        # (Jamie, 2026-11-19: the whole coast, so the outline never starts out of nowhere: full at the top chunk, easing
        # to a fainter line by COAST_FADE's end; kept to a third of a pixel of the picture, so it draws thin)
        taken = set()
        for contour in outline:
            for (mx, my) in contour[:, 0, :]:
                q = project(float(mx), float(my))
                if q and 0 <= q[0] < W and HZ < q[1] < H and is_seen(*q):
                    spot = (round(q[0] * 3), round(q[1] * 3))
                    if spot not in taken:
                        taken.add(spot)
                        weight = 1 - (1 - COAST_LOW) * np.clip((my - COAST_FADE[0]) / (COAST_FADE[1] - COAST_FADE[0]), 0, 1)
                        coast.append([round(spot[0] / 3, 2), round(spot[1] / 3, 2), round(float(q[2]), 1), round(float(weight), 2)])
        # none drawn over Treasure Island: the coasts behind it are hidden by it
        def off_island(points):
            return [p for p in points if not (0 <= int(round(p[1])) < H and 0 <= int(round(p[0])) < W and ti_shape[int(round(p[1])), int(round(p[0]))])]
        surf, island, coast = off_island(surf), off_island(island), off_island(coast)
        extra = {'surf': surf, 'islandSurf': island, 'coast': coast, 'stars': STAR_LIST}
        print('coast', len(coast))
        print('surf', len(surf), 'island surf', len(island))
    json.dump({'paths': paths, 'glints': glints, 'near': NEAR, 'horizon': HZ, **extra}, open(traffic_path, 'w'))
    print('traffic runs', len(paths), 'glints', len(glints))
