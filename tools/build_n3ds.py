# Builds Aquamarine-Portal/static/n3ds from rverse2's copy of Nintendo's 3DS Miiverse front-end:
#   - css/style.css with every green/cyan/blue accent turned into the Protarium red (#de3e3e)
#   - the images that CSS references, recoloured the same way pixel by pixel
#   - js/complete.js with Miiverse/rverse renamed to Protaverse in user-visible strings
# usage: python tools/build_n3ds.py <rverse2>/public <Aquamarine-Portal>/static/n3ds
import colorsys, os, re, shutil, sys
from PIL import Image, ImageSequence

SRC, OUT = sys.argv[1], sys.argv[2]
RED_HUE = 0.0          # #de3e3e
SAT_SCALE = 0.75       # Nintendo greens are fully saturated; Protarium red is ~0.71


def recolor(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.2 or not (60 / 360 <= h <= 250 / 360):
        return r, g, b
    r2, g2, b2 = colorsys.hls_to_rgb(RED_HUE, l, s * SAT_SCALE)
    return round(r2 * 255), round(g2 * 255), round(b2 * 255)


def recolor_css(css):
    def hex_sub(m):
        h = m.group(1)
        h = ''.join(c * 2 for c in h) if len(h) == 3 else h
        return '#%02x%02x%02x' % recolor(*(int(h[i:i + 2], 16) for i in (0, 2, 4)))

    def rgb_sub(m):
        r, g, b = recolor(*map(int, m.group(2, 3, 4)))
        return f'{m.group(1)}({r}, {g}, {b}{m.group(5)}'

    css = re.sub(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', hex_sub, css)
    return re.sub(r'(rgba?)\((\d+),\s*(\d+),\s*(\d+)(\s*,[^)]*\)|\))', rgb_sub, css)


# Regions kept in Nintendo's original colours: the platform tags row (Wii U stays blue).
KEEP = {'header-icons.png': [(0, 86, 385, 96)]}


def recolor_image(src, dst):
    img = Image.open(src)
    frames, durations = [], []
    for frame in ImageSequence.Iterator(img):
        original = frame.convert('RGBA')
        f = original.copy()
        f.putdata([recolor(r, g, b) + (a,) for r, g, b, a in f.getdata()])
        for box in KEEP.get(os.path.basename(src), []):
            f.paste(original.crop(box), box[:2])
        frames.append(f)
        durations.append(frame.info.get('duration', 100))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if src.lower().endswith('.gif'):
        frames[0].save(dst, save_all=True, append_images=frames[1:], duration=durations,
                       loop=img.info.get('loop', 0), disposal=2, transparency=0)
    elif src.lower().endswith(('.jpg', '.jpeg')):
        frames[0].convert('RGB').save(dst, quality=92)
    else:
        frames[0].save(dst, optimize=True)


css = open(f'{SRC}/css/n3ds/style.css', encoding='utf-8').read()
images = sorted(set(re.findall(r"url\(['\"]?(/img/[^'\")?]+)", css)))
images += ['/img/add-post-no-image.png', '/img/add-post-image-forbidden.png']
css = recolor_css(css).replace("url('/img/", "url('/n3ds/img/").replace('url("/img/', 'url("/n3ds/img/').replace('url(/img/', 'url(/n3ds/img/')
os.makedirs(f'{OUT}/css', exist_ok=True)
open(f'{OUT}/css/style.css', 'w', encoding='utf-8', newline='\n').write(css)

for rel in sorted(set(images)):
    src = SRC + rel
    if not os.path.isfile(src):
        print('missing', rel)
        continue
    recolor_image(src, OUT + '/img/' + rel[len('/img/'):])
print(len(set(images)), 'images')

js = open(f'{SRC}/js/n3ds/complete-en.js', encoding='utf-8').read()
# only touch the text inside locale "value" strings, never identifiers like data-is-of-miiverse
js = re.sub(r'("value":")((?:[^"\\]|\\.)*)"',
            lambda m: m.group(1) + re.sub(r'\b(rverse|Miiverse|Aquamarine)\b', 'Protaverse', m.group(2)) + '"', js)
os.makedirs(f'{OUT}/js', exist_ok=True)
open(f'{OUT}/js/complete.js', 'w', encoding='utf-8', newline='\n').write(js)
shutil.copy(f'{SRC}/js/src/cave-emulation.js', f'{OUT}/js/cave-emulation.js')
print('left in js:', sorted(set(re.findall(r'(?i)\b(?:rverse|miiverse|aquamarine)\b', js))))
