"""Composite store covers: key art (cover-cropped) + title logo with a soft shadow.
usage: python3 -I tools/covers.py <raw_dir> <logo_png> <out_dir>"""
import sys
from PIL import Image, ImageFilter
raw, logo_p, out = sys.argv[1:4]
logo = Image.open(raw + '/logo.png').convert('RGBA')
a = logo.split()[3].point(lambda v: 0 if v < 30 else v); logo.putalpha(a); logo = logo.crop(a.getbbox())

def cover(src, W, H, logo_w, logo_y, name):
    im = Image.open(src).convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l = (im.width - W) // 2; t = (im.height - H) // 2
    im = im.crop((l, t, l + W, t + H)).convert('RGBA')
    lw = int(W * logo_w); lg = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    x = (W - lg.width) // 2; y = int(H * logo_y)
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    blk = Image.new('RGBA', lg.size, (10, 5, 25, 200)); blk.putalpha(lg.split()[3].point(lambda v: v * 0.75))
    sh.paste(blk, (x + 6, y + 10), blk); sh = sh.filter(ImageFilter.GaussianBlur(W / 120))
    im = Image.alpha_composite(im, sh); im.alpha_composite(lg, (x, y))
    im.convert('RGB').save(f'{out}/{name}', quality=90, optimize=True)
    print(name, im.size)

cover(raw + '/keyart.png', 1920, 1080, 0.42, 0.03, 'cover_1920x1080.jpg')
cover(raw + '/cover_p.png', 800, 1200, 0.86, 0.04, 'cover_800x1200.jpg')
cover(raw + '/cover_s.png', 800, 800, 0.72, 0.03, 'cover_800x800.jpg')
