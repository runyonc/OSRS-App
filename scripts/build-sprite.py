"""Download each equippable's inventory icon from the OSRS Wiki and pack them into one sprite sheet.

Writes public/equipment-sprite.png (32x32 cells) and src/data/equipmentSprite.json ({ name: index }).
Icons are cached in .cache/icons so re-runs only fetch new items.
"""
import json, os, sys, time, urllib.request, urllib.parse, concurrent.futures
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache', 'icons')
os.makedirs(CACHE, exist_ok=True)
UA = 'IronFunyonPlanner/0.1 (single-user ironman planner; https://github.com/runyonc/OSRS-App)'
CELL = 32
COLS = 64

names = [e['n'] for e in json.load(open(os.path.join(ROOT, 'src/data/equipment.json')))]

def fetch(name):
    path = os.path.join(CACHE, name.replace('/', '_') + '.png')
    if os.path.exists(path):
        return name, path
    # Stackable ammo icons carry a stack-size suffix on the wiki ("Rune arrow 5.png").
    candidates = [name, name + ' 5', name + ' 1', name + ' 4', name + ' 3', name + ' 2']
    for cand in candidates:
        url = 'https://oldschool.runescape.wiki/images/' + urllib.parse.quote(cand.replace(' ', '_')) + '.png'
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
                open(path, 'wb').write(data)
                return name, path
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    break
                time.sleep(1.5 * (attempt + 1))
            except Exception:
                time.sleep(1.5 * (attempt + 1))
    return name, None

results = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
    for i, (name, path) in enumerate(ex.map(fetch, names)):
        results[name] = path
        if i % 200 == 0:
            print(f'  icons {i}/{len(names)}', flush=True)

found = [n for n in names if results[n]]
missing = [n for n in names if not results[n]]
rows = (len(found) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
index = {}
for i, name in enumerate(found):
    try:
        im = Image.open(results[name]).convert('RGBA')
    except Exception:
        continue
    im.thumbnail((CELL, CELL))
    x = (i % COLS) * CELL + (CELL - im.width) // 2
    y = (i // COLS) * CELL + (CELL - im.height) // 2
    sheet.paste(im, (x, y), im)
    index[name] = i
sheet = sheet.quantize(colors=255, method=Image.Quantize.FASTOCTREE)
sheet.save(os.path.join(ROOT, 'public/equipment-sprite.png'), optimize=True)
json.dump({'cell': CELL, 'cols': COLS, 'index': index}, open(os.path.join(ROOT, 'src/data/equipmentSprite.json'), 'w'))
print(f'sprite: {len(index)} icons, {len(missing)} missing, sheet {sheet.width}x{sheet.height}, {os.path.getsize(os.path.join(ROOT, "public/equipment-sprite.png"))//1024} KB')
if missing:
    print('missing sample:', missing[:15])
