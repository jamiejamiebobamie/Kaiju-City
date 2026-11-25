# The apartment room, put together from Jamie's relit versions of the mock-up (Jamie, 2026-11-25), each for what it
# does best (they line up pixel for pixel):
#   #3 (image_f5993796): the base: its colors and balance
#   #2 (image_bc9df5fd): the monitor, its stand and its hard shadow on the desk; its rim light (a thick, bright green
#       line along the casing's top and left) thinned to a pixel and dimmed
#   #1 (image_8ecedecf): the desk things, easier to see: its contrast kept, its brightness brought down to #3's
# and the Gemini star taken out. Writes public/apartment-scene/final/room-composite.png (and a few preview crops).
# Run: python scripts/apartmentComposite.py
import os
import numpy as np, cv2
from PIL import Image

SOURCE_DIR = r'C:\Users\jamie\OneDrive\Documents\AffinityFiles\KaijuCity\Apartment-Scene\re-do_after-mock-up'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'apartment-scene', 'final')
BASE, MONITOR, DESK = 'image_f5993796.jpg', 'image_bc9df5fd.jpg', 'image_8ecedecf.jpg'

# the monitor in the pictures: its casing (a rounded box) and, under it, its stand and its shadow on the desk
CASING = (303, 211, 787, 600, 16)  # x0, y0, x1, y1, corner radius
UNDER = [(318, 596), (772, 596), (800, 652), (290, 652)]
# the desk and what's on it (the band along the bottom, and the things standing up above it)
DESK_AREAS = [(0, 588, 1365, 768), (0, 512, 132, 600), (298, 538, 374, 600), (856, 556, 1152, 600)]
FEATHER = 9  # px: every seam fades over this


def load(name):
    return np.asarray(Image.open(os.path.join(SOURCE_DIR, name)).convert('RGB')).astype(np.float32)


def rounded_box(shape, box):
    x0, y0, x1, y1, r = box
    mask = np.zeros(shape, np.uint8)
    cv2.rectangle(mask, (x0 + r, y0), (x1 - r, y1), 255, -1)
    cv2.rectangle(mask, (x0, y0 + r), (x1, y1 - r), 255, -1)
    for cx, cy in [(x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)]:
        cv2.circle(mask, (cx, cy), r, 255, -1)
    return mask


def soft(mask):
    return cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), FEATHER / 2)[..., None]


def tame_rim(image, casing):
    # the rim: the casing's bright green edge pixels
    r, g, b = image[..., 0], image[..., 1], image[..., 2]
    green = (g > 120) & (g > r + 35) & (g > b + 35)
    near_edge = cv2.dilate(casing, np.ones((3, 3), np.uint8)) & cv2.bitwise_not(cv2.erode(casing, np.ones((13, 13), np.uint8)))
    rim = (green & (near_edge > 0)).astype(np.uint8) * 255
    # the outermost pixel of the casing, wherever the rim was, becomes one even dim line; the rest of the rim becomes the
    # casing again (filled from just inside)
    ring = casing & cv2.bitwise_not(cv2.erode(casing, np.ones((3, 3), np.uint8)))
    outer = ring & cv2.dilate(rim, np.ones((9, 9), np.uint8))
    inner = rim & cv2.bitwise_not(outer)
    rim_color = image[rim > 0].mean(axis=0) if rim.any() else np.array([110, 200, 110], np.float32)
    filled = cv2.inpaint(np.ascontiguousarray(image[..., ::-1].astype(np.uint8)), cv2.dilate(inner, np.ones((3, 3), np.uint8)), 4, cv2.INPAINT_TELEA)[..., ::-1].astype(np.float32)
    result = np.where((inner > 0)[..., None], filled, image)
    casing_color = np.median(image[(cv2.erode(casing, np.ones((25, 25), np.uint8)) > 0)], axis=0)
    result = np.where((outer > 0)[..., None], rim_color * 0.35 + casing_color * 0.65, result)
    # (then any bright green left in the band along the edge, a few px in from the traced outline, dimmed the same way)
    band = cv2.dilate(casing, np.ones((5, 5), np.uint8)) & cv2.bitwise_not(cv2.erode(casing, np.ones((17, 17), np.uint8)))
    r, g, b = result[..., 0], result[..., 1], result[..., 2]
    left = ((g > casing_color[1] + 30) & (g > r + 20) & (g > b + 20) & (band > 0))
    result = np.where(left[..., None], result * 0.3 + casing_color * 0.7, result)
    return result


def match_brightness(image, reference, mask):
    # the reference's light, area by area (its broad brightness and color), with this picture's detail and contrast
    broad = lambda picture: cv2.GaussianBlur(picture, (0, 0), 22) + 1
    gain = np.clip(broad(reference) / broad(image), 0.4, 1.6)
    return np.clip(image * gain, 0, 255)


def remove_star(image):
    h, w = image.shape[:2]
    cx, cy, size = w - 56, h - 56, 64
    yy, xx = np.mgrid[0:size, 0:size]
    r = size / 2
    diamond = ((np.abs((xx + 0.5 - r) / r) ** 0.75 + np.abs((yy + 0.5 - r) / r) ** 0.75) <= 1.0).astype(np.uint8)
    mask = np.zeros((h, w), np.uint8)
    mask[cy - 32:cy + 32, cx - 32:cx + 32] = diamond
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8)) * 255
    return cv2.inpaint(np.ascontiguousarray(image[..., ::-1].astype(np.uint8)), mask, 6, cv2.INPAINT_TELEA)[..., ::-1]


def main():
    base, monitor_pic, desk_pic = load(BASE), load(MONITOR), load(DESK)
    shape = base.shape[:2]
    casing = rounded_box(shape, CASING)
    monitor_area = casing.copy()
    cv2.fillPoly(monitor_area, [np.array(UNDER, np.int32)], 255)
    desk_area = np.zeros(shape, np.uint8)
    for x0, y0, x1, y1 in DESK_AREAS:
        desk_area[y0:y1, x0:x1] = 255
    desk_area &= cv2.bitwise_not(cv2.dilate(monitor_area, np.ones((FEATHER, FEATHER), np.uint8)))

    result = base
    desk = match_brightness(desk_pic, base, desk_area)
    result = result * (1 - soft(desk_area)) + desk * soft(desk_area)
    monitor = tame_rim(monitor_pic, casing)
    result = result * (1 - soft(monitor_area)) + monitor * soft(monitor_area)
    result = remove_star(np.clip(result, 0, 255).astype(np.uint8))

    os.makedirs(OUT_DIR, exist_ok=True)
    Image.fromarray(result).save(os.path.join(OUT_DIR, 'room-composite.png'))
    print('written', os.path.join(OUT_DIR, 'room-composite.png'))


if __name__ == '__main__':
    main()
