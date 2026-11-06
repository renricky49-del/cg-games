"""Slice Higgsfield sprite sheets into individual trimmed, resized PNGs.
usage: python3 -I tools/slice.py <raw_dir> <out_dir> [sheet ...]"""
import sys, os
from PIL import Image, ImageFilter
raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

# sheet: (cols, rows, names, max_size(px), alpha_cut)
SHEETS = {
  'survivors': (3, 2, ['s0','s1','s2','s3','s4','s5'], 112, 40),
  'bosses':    (3, 2, ['boss_brute','boss_spitter','boss_charger','boss_howler','boss_tank','boss_abom'], 208, 40),
  'minions':   (2, 2, ['minion0','minion1','minion2','minion3'], 104, 40),
  'turrets':   (3, 3, ['nail1','nail2','nail3','bow1','bow2','bow3','tesla1','tesla2','tesla3'], 112, 110),
  'utils':     (3, 2, ['generator','freezer','bench','vending','spikes','radio'], 112, 110),
  'beds':      (3, 2, ['bed1','bed2','bed3','bed4','bed5','bed6'], 200, 40),
  'icons':     (4, 3, ['i_scrap','i_power','i_door','i_star','i_medal','i_repair','i_up','i_lock','i_clock','i_skull','i_ad','i_moon'], 96, 40),
  'doors':     (3, 3, ['door1','door2','door3','rug','plant','boxes','lamp','chair','rubble'], 128, 40),
  # --- polish pass ---
  'bf_brute':   (3, 1, ['boss_brute_0', 'boss_brute_1', 'boss_brute_2'], 208, 40),
  'bf_spitter': (3, 1, ['boss_spitter_0', 'boss_spitter_1', 'boss_spitter_2'], 208, 40),
  'bf_charger': (3, 1, ['boss_charger_0', 'boss_charger_1', 'boss_charger_2'], 208, 40),
  'bf_howler':  (3, 1, ['boss_howler_0', 'boss_howler_1', 'boss_howler_2'], 208, 40),
  'bf_tank':    (3, 1, ['boss_tank_0', 'boss_tank_1', 'boss_tank_2'], 208, 40),
  'bf_abom':    (3, 1, ['boss_abom_0', 'boss_abom_1', 'boss_abom_2'], 208, 40),
  'minion_frames': (4, 2, ['minion0_a', 'minion1_a', 'minion2_a', 'minion3_a', 'minion0_b', 'minion1_b', 'minion2_b', 'minion3_b'], 104, 110),
  'sleeping':  (3, 2, ['z0', 'z1', 'z2', 'z3', 'z4', 'z5'], 160, 40),
  'doordmg':   (3, 3, ['door1', 'door2', 'door3', 'door1_d1', 'door2_d1', 'door3_d1', 'door1_d2', 'door2_d2', 'door3_d2'], 128, 40),
  'skins2':    (3, 2, ['s6', 's7', 's8', 's9', 's10', 's11'], 112, 40),
  'furniture': (4, 3, ['f_fridge', 'f_shelf', 'f_desk', 'f_couch', 'f_wardrobe', 'f_kitchen', 'f_tv', 'f_armchair', 'f_table', 'f_lamp', 'f_pizza', 'f_laundry'], 128, 40),
  'weapons2':  (3, 2, ['flame1', 'flame2', 'flame3', 'mortar1', 'mortar2', 'mortar3'], 112, 110),
}
ONLY = set(sys.argv[3:])
def runs(profile, gap=6):
    best=None; start=None; last=None
    for i,v in enumerate(profile+[0]*(gap+1)):
        if v:
            if start is None: start=i
            last=i
        elif start is not None and i-last>gap:
            seg=(start,last+1, sum(profile[start:last+1]))
            if best is None or seg[2]>best[2]: best=seg
            start=None
    return best

def main_run_bbox(mask):
    w,h=mask.size; px=mask.load()
    rows=[sum(1 for x in range(0,w,2) if px[x,y]) for y in range(h)]
    r=runs(rows)
    if not r: return None
    cols=[sum(1 for y in range(r[0],r[1],2) if px[x,y]) for x in range(w)]
    c=runs(cols)
    if not c: return None
    return (c[0], r[0], c[1], r[1])

for sheet, (cols, rows, names, maxs, cut) in SHEETS.items():
    p = os.path.join(raw, sheet + '.png')
    if (ONLY and sheet not in ONLY) or not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA')
    W, H = im.size
    cw, ch = W / cols, H / rows
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        cell = im.crop((int(c*cw), int(r*ch), int((c+1)*cw), int((r+1)*ch)))
        rch, gch, bch, a = cell.split()
        # kill faint background haze, snap near-opaque to opaque
        a = a.point(lambda v: 0 if v < cut else (255 if v > 235 else v))
        cell = Image.merge('RGBA', (rch, gch, bch, a))
        # bbox of solid content
        solid = a.point(lambda v: 255 if v > 128 else 0)
        bb = main_run_bbox(solid)
        if not bb:
            print('EMPTY', sheet, name); continue
        pad = 3
        bb = (max(0, bb[0]-pad), max(0, bb[1]-pad), min(cell.width, bb[2]+pad), min(cell.height, bb[3]+pad))
        cell = cell.crop(bb)
        s = maxs / max(cell.size)
        if s < 1:
            cell = cell.resize((max(1, round(cell.width*s)), max(1, round(cell.height*s))), Image.LANCZOS)
        cell.save(os.path.join(out, name + '.png'), optimize=True)
        print(name, cell.size)
