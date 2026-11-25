# A clean base for the apartment mock-up (Jamie, 2026-11-24): picture 06 with its wall shelves, its Kaiju City poster
# and its pin-up taken off the wall (the first two as parts of their own, from this same picture, to place by hand),
# and the wall filled in behind them. The wall's writing round them is left as it is: each item's own outline is
# found tightly (GrabCut), only that is filled.
# The fill: the wall's light and color from round the hole (the picture smoothed, the writing's thin lines melted out,
# then filled in at a low resolution so it's a smooth gradient), with a little grain so it isn't flat.
# Run: python scripts/apartmentCleanBase.py  ->  public/apartment-scene/sources/06c.png, parts/wall-shelves-06.png,
# parts/poster-kaiju-06.png, and their entries in sources.json and parts.json
import json, os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment-scene')
SOURCE = '06.jpg'
CLEAN_ID = '06c'
# id, label (None: taken off, not kept), box in the picture, how its hole is found: 'cut' (its outline, GrabCut) or
# 'box' (the posters: flat rectangles, their whole box), and how far the hole reaches past it (its outline and shadow)
ITEMS = [
    ('wall-shelves-06', 'Wall shelves (06, movable)', (746, 78, 1198, 474), 'cut', 9),
    # (traced by hand, Jamie 2026-11-24: the outline cut lost its right side and its bottom-right corner, which curls up
    # to show the poster's back: a flap from its right edge down to its bottom, beige)
    ('poster-kaiju-06', 'Kaiju City poster (06, movable)', (464, 248, 670, 526), 'box', 4,
     [(472, 255), (671, 255), (671, 468), (624, 515), (472, 515)]),
    ('pinup-06', None, (1220, 140, 1365, 462), 'box', 4),
]


def find_item(image, box):
    x0, y0, x1, y1 = box
    pad = 10
    H, W = image.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    region = np.ascontiguousarray(image[Y0:Y1, X0:X1][:, :, ::-1])
    mask = np.zeros(region.shape[:2], np.uint8)
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    # (a box at the picture's edge: no room for 'background' on that side, so the rect is pulled in a pixel there)
    rect = (x0 - X0, y0 - Y0, min(x1, W - 1) - x0, min(y1, H - 1) - y0)
    cv2.grabCut(region, mask, rect, bg, fg, 8, cv2.GC_INIT_WITH_RECT)
    item = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(item)
    if count > 1:
        biggest = stats[1:, cv2.CC_STAT_AREA].max()
        item = np.isin(labels, [k for k in range(1, count) if stats[k, cv2.CC_STAT_AREA] >= biggest * 0.04]).astype(np.uint8) * 255
    item = cv2.morphologyEx(item, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    # the holes inside filled (the gaps between the books)
    flood = item.copy()
    cv2.floodFill(flood, np.zeros((item.shape[0] + 2, item.shape[1] + 2), np.uint8), (0, 0), 255)
    item = item | cv2.bitwise_not(flood)
    full = np.zeros((H, W), np.uint8)
    full[Y0:Y1, X0:X1] = item
    return full


def fill_wall(image, hole):
    # the wall's light: the writing's thin lines melted (a median), then filled smoothly at an eighth of the size
    smooth = cv2.medianBlur(image, 11).copy()
    smooth[hole > 0] = 0
    small = cv2.resize(smooth, (image.shape[1] // 8, image.shape[0] // 8), interpolation=cv2.INTER_AREA)
    # (any small pixel touched by the hole is filled: none of the item's color is averaged into the wall)
    small_hole = (cv2.resize(hole, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_AREA) > 0).astype(np.uint8) * 255
    small_hole = cv2.dilate(small_hole, np.ones((3, 3), np.uint8))
    filled = cv2.inpaint(np.ascontiguousarray(small[:, :, ::-1]), small_hole, 5, cv2.INPAINT_TELEA)[:, :, ::-1]
    light = cv2.GaussianBlur(cv2.resize(filled, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_CUBIC), (0, 0), 6)
    # a little grain, in blocks the picture's pixel size, so the new wall isn't smoother than the old
    rng = np.random.default_rng(6)
    grain = rng.normal(0, 2.5, (image.shape[0] // 3 + 1, image.shape[1] // 3 + 1, 1))
    grain = np.repeat(np.repeat(grain, 3, axis=0), 3, axis=1)[:image.shape[0], :image.shape[1]]
    wall = np.clip(light.astype(np.float32) + grain, 0, 255)
    # blended in over a few px at the hole's edge
    soft = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 1.5)[..., None]
    soft = np.maximum(soft, (hole > 0)[..., None].astype(np.float32))
    return (image.astype(np.float32) * (1 - soft) + wall * soft).astype(np.uint8)


def main():
    image = np.asarray(Image.open(os.path.join(ROOT, 'sources', SOURCE)).convert('RGB'))
    hole = np.zeros(image.shape[:2], np.uint8)
    parts = []
    for pid, label, box, how, reach, *traced in ITEMS:
        poly = traced[0] if traced else None
        if poly:
            item = np.zeros(image.shape[:2], np.uint8)
            cv2.fillPoly(item, [np.array(poly, np.int32)], 255)
        else:
            item = find_item(image, box)
        if how == 'box':
            # (the part keeps its found outline, for its curled corners; the hole is the whole box)
            area = np.zeros_like(item)
            area[box[1]:box[3], box[0]:min(box[2], image.shape[1])] = 255
        else:
            area = item
        # the hole: the item and a few px round it (its dark outline, its shadow's edge)
        hole |= cv2.dilate(area, np.ones((reach * 2 + 1, reach * 2 + 1), np.uint8))
        if label:
            # (a traced part: cut to its outline's own box)
            x0, y0, x1, y1 = (min(x for x, _ in poly), min(y for _, y in poly), max(x for x, _ in poly) + 1, max(y for _, y in poly) + 1) if poly else box
            alpha = cv2.GaussianBlur(item, (3, 3), 0)[y0:y1, x0:x1]
            Image.fromarray(np.dstack([image[y0:y1, x0:x1], alpha])).save(os.path.join(ROOT, 'parts', f'{pid}.png'))
            parts.append({'id': pid, 'label': label, 'source': SOURCE, 'src': f'/apartment-scene/parts/{pid}.png', 'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0})
    Image.fromarray(fill_wall(image, hole)).save(os.path.join(ROOT, 'sources', f'{CLEAN_ID}.png'))
    Image.fromarray(hole).save(os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment-scene', 'clean-mask-06.png'))

    sources_path = os.path.join(ROOT, 'sources', 'sources.json')
    sources = [each for each in json.load(open(sources_path)) if each['id'] != CLEAN_ID]
    sources.append({'id': CLEAN_ID, 'src': f'/apartment-scene/sources/{CLEAN_ID}.png', 'original': '06 with its wall shelves, Kaiju poster and pin-up taken off'})
    json.dump(sources, open(sources_path, 'w'), indent=1)
    parts_path = os.path.join(ROOT, 'parts.json')
    listing = [each for each in json.load(open(parts_path)) if each['id'] not in [p['id'] for p in parts]]
    json.dump(listing + parts, open(parts_path, 'w'), indent=1)
    print('done', [p['id'] for p in parts])


if __name__ == '__main__':
    main()
