# Renders the CJK glyphs used on tile faces into a white-on-transparent atlas (assets/img/glyphs.png)
from PIL import Image, ImageDraw, ImageFont
G = "一二三四五六七八九萬東南西北中發"
S = 128
font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 112)
im = Image.new("RGBA", (S*len(G), S), (0,0,0,0))
d = ImageDraw.Draw(im)
for i,ch in enumerate(G):
    bb = d.textbbox((0,0), ch, font=font)
    w,h = bb[2]-bb[0], bb[3]-bb[1]
    # bold-ish: stroke
    d.text((i*S + (S-w)/2 - bb[0], (S-h)/2 - bb[1]), ch, font=font, fill=(255,255,255,255), stroke_width=3, stroke_fill=(255,255,255,255))
im.save("assets/img/glyphs.png", optimize=True)
print(im.size)
