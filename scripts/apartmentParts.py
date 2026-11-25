# The apartment scene's parts (Jamie, 2026-11-24): each item cut out of one of Jamie's apartment pictures
# (public/apartment-scene/sources), for the mock-up tool (/apartment) to place by hand.
# Each part: a box in its source picture (the picture's own px); GrabCut finds the item in it (the pixel art's dark
# outlines make that easy), its edge softened a pixel. 'rect': kept as the box, no cut (the current room's clock).
# Run: python scripts/apartmentParts.py  ->  public/apartment-scene/parts/*.png and parts.json
import json, os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment-scene')
SOURCES = os.path.join(ROOT, 'sources')
OUT = os.path.join(ROOT, 'parts')

PARTS = [
    # id, label, source, (x0, y0, x1, y1), options
    ('figurines', 'Kaiju figurines on the shelf', '02.jpg', (38, 30, 684, 248), {}),
    ('figurines-lit', 'Kaiju figurines, purple lit', '05.jpg', (38, 30, 684, 248), {}),
    ('neon', 'Purple neon tube', '05.jpg', (216, 2, 644, 46), {}),
    # (traced by hand: its light cone is the wall's, not the lamp's)
    ('lamp', 'Desk lamp', '02.jpg', (68, 236, 350, 602), {'poly': [(186, 246), (234, 240), (256, 260), (328, 276), (346, 300), (244, 406), (220, 402), (206, 400), (206, 505), (214, 552), (258, 566), (258, 600), (70, 600), (76, 556), (146, 540), (126, 505), (96, 462), (78, 425), (78, 388), (108, 350), (158, 318), (196, 332)], 'fill': False}),
    ('poster-kaiju', 'Kaiju City poster', '02.jpg', (466, 250, 668, 524), {}),
    ('bookcase', 'Tall bookcase', '02.jpg', (742, 40, 1188, 592), {}),
    ('wall-shelves', 'Wall shelves with books', '05.jpg', (742, 82, 1198, 478), {}),
    ('pinup', 'Pin-up poster', '02.jpg', (1216, 150, 1365, 464), {}),
    ('cactus', 'Cactus', '02.jpg', (1222, 452, 1338, 624), {}),
    ('can-red', 'Red soda can', '02.jpg', (3, 506, 80, 632), {}),
    ('takeout-closed', 'Takeout box, closed', '02.jpg', (2, 618, 192, 734), {}),
    ('can-lying', 'Kaiju Kola can, lying', '02.jpg', (168, 656, 302, 732), {}),
    ('can-tall', 'Kaiju Kola can, standing', '02.jpg', (268, 544, 332, 678), {'inner': 0.18}),
    ('takeout-open', 'Takeout box, open', '02.jpg', (328, 562, 550, 714), {}),
    # (thin dim lines: no cut finds them, so a patch of the desk with them on it, its edges faded)
    ('cables', 'Tangled cables (desk patch)', '02.jpg', (462, 564, 742, 768), {'rect': True, 'feather': 14}),
    ('papers', 'Papers', '02.jpg', (648, 636, 998, 764), {}),
    ('chips', 'Chip bag and tissue', '02.jpg', (782, 556, 972, 644), {}),
    ('mug-new', 'Coffee mug (new art)', '02.jpg', (990, 596, 1102, 714), {}),
    ('wrapper', 'Burger wrapper', '02.jpg', (1092, 574, 1230, 664), {}),
    ('ashtray', 'Ashtray', '02.jpg', (1116, 668, 1268, 752), {}),
    ('paper-right', 'Paper, right', '02.jpg', (1252, 634, 1365, 732), {}),
    ('cigarette', 'Cigarette butt', '02.jpg', (1270, 726, 1324, 758), {}),
    # the current room's, placed as they are now (Jamie): the coffee and the clock (its 12:00 digits are the game's own)
    ('mug', 'Coffee mug (now)', '00-current.png', (706, 530, 770, 592), {}),
    ('clock', 'Clock (now)', '00-current.png', (254, 536, 358, 592), {'rect': True}),
]


def fill_holes(mask):
    # what the outside can't reach is inside: the gaps between a bookcase's books
    flood = mask.copy()
    h, w = mask.shape
    edge = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, edge, (0, 0), 255)
    return mask | cv2.bitwise_not(flood)


def cut(image, box, rect=False, inner=None, bright=None, poly=None, fill=True, feather=0):
    x0, y0, x1, y1 = box
    crop = image[y0:y1, x0:x1]
    if rect:
        alpha = np.full(crop.shape[:2], 255, np.uint8)
        if feather:
            h, w = alpha.shape
            ramp = lambda n: np.clip(np.minimum(np.arange(n), np.arange(n)[::-1]) / feather, 0, 1)
            alpha = (np.outer(ramp(h), ramp(w)) * 255).astype(np.uint8)
    elif bright:
        # colored or light lines (and their dark outline round them) over a dark ground
        hsv = cv2.cvtColor(np.ascontiguousarray(crop[:, :, ::-1]), cv2.COLOR_BGR2HSV)
        lines = ((hsv[:, :, 1].astype(int) * hsv[:, :, 2].astype(int) / 255 > bright) & (hsv[:, :, 2] < 230)).astype(np.uint8) * 255
        lines = cv2.morphologyEx(lines, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        alpha = cv2.GaussianBlur(cv2.dilate(lines, np.ones((3, 3), np.uint8)), (3, 3), 0)
    else:
        # GrabCut in a margin round the box, so the box's edge is sure background
        pad = 8
        H, W = image.shape[:2]
        X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
        region = np.ascontiguousarray(image[Y0:Y1, X0:X1][:, :, ::-1])
        mask = np.zeros(region.shape[:2], np.uint8)
        model_b, model_f = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        if poly:
            # inside the traced outline probably the item, outside sure not
            mask[:] = cv2.GC_BGD
            cv2.fillPoly(mask, [np.array([(x - X0, y - Y0) for x, y in poly], np.int32)], cv2.GC_PR_FGD)
            cv2.grabCut(region, mask, None, model_b, model_f, 6, cv2.GC_INIT_WITH_MASK)
        elif inner:
            # most of the box is the item: its middle sure, the rest probably
            mask[:] = cv2.GC_BGD
            mask[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = cv2.GC_PR_FGD
            iw, ih = int((x1 - x0) * inner), int((y1 - y0) * inner)
            mask[y0 - Y0 + ih:y1 - Y0 - ih, x0 - X0 + iw:x1 - X0 - iw] = cv2.GC_FGD
            cv2.grabCut(region, mask, None, model_b, model_f, 6, cv2.GC_INIT_WITH_MASK)
        else:
            cv2.grabCut(region, mask, (x0 - X0, y0 - Y0, x1 - x0, y1 - y0), model_b, model_f, 6, cv2.GC_INIT_WITH_RECT)
        sure = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        # the biggest pieces only (no specks of wall), then the holes filled and the edge softened
        count, labels, stats, _ = cv2.connectedComponentsWithStats(sure)
        if count > 1:
            biggest = stats[1:, cv2.CC_STAT_AREA].max()
            keep = [k for k in range(1, count) if stats[k, cv2.CC_STAT_AREA] >= biggest * 0.04]
            sure = np.isin(labels, keep).astype(np.uint8) * 255
        sure = cv2.morphologyEx(sure, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        if fill: sure = fill_holes(sure)
        alpha = cv2.GaussianBlur(sure, (3, 3), 0)[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0]
    return np.dstack([crop, alpha])


def main():
    os.makedirs(OUT, exist_ok=True)
    listing = []
    images = {}
    for pid, label, source, box, options in PARTS:
        if source not in images:
            images[source] = np.asarray(Image.open(os.path.join(SOURCES, source)).convert('RGB'))
        rgba = cut(images[source], box, options.get('rect', False), options.get('inner'), options.get('bright'), options.get('poly'), options.get('fill', True), options.get('feather', 0))
        Image.fromarray(rgba).save(os.path.join(OUT, f'{pid}.png'))
        x0, y0, x1, y1 = box
        listing.append({'id': pid, 'label': label, 'source': source, 'src': f'/apartment-scene/parts/{pid}.png',
                        'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0})
        print(pid, rgba.shape[1], 'x', rgba.shape[0])
    with open(os.path.join(ROOT, 'parts.json'), 'w') as f:
        json.dump(listing, f, indent=1)


if __name__ == '__main__':
    main()
