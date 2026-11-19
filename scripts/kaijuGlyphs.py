# The title word's letters as SVG paths (Jamie, 2026-11-19: the live border on "Kaiju" follows each letter's own
# outline, offset outward, with a gap that travels round it; paths, so its length can be measured), from the title's
# font (src/fonts/green_fuz.otf), in font units (y up; the page flips and scales them).
#   python -I scripts/kaijuGlyphs.py src/fonts/green_fuz.otf src/Components/data/kaijuGlyphs.json
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

font = TTFont(sys.argv[1])
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
letters = []
for ch in "Kaiju":
    name = cmap[ord(ch)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)
    letters.append({"ch": ch, "path": pen.getCommands(), "advance": glyphs[name].width})
data = {"upm": font["head"].unitsPerEm, "ascender": font["hhea"].ascent, "descender": font["hhea"].descent, "letters": letters}
json.dump(data, open(sys.argv[2], "w"))
print("ok", [(l["ch"], l["advance"], len(l["path"])) for l in letters])
