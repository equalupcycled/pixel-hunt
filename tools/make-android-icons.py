#!/usr/bin/env python3
"""Generate Pixel Hunt adaptive and legacy launcher icons from the existing PWA art."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'icons' / 'icon-maskable-512.png'
LEGACY_SRC = ROOT / 'icons' / 'icon-512.png'
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
BG = '#2B6FD6'  # theme blue, matches the maskable icon's sky

# density -> (legacy launcher px, adaptive 108dp layer px)
DENSITIES = {
    'mdpi': (48, 108),
    'hdpi': (72, 162),
    'xhdpi': (96, 216),
    'xxhdpi': (144, 324),
    'xxxhdpi': (192, 432),
}

def nearest(im, size):
    return im.resize((size, size), Image.Resampling.NEAREST)

def main():
    if not SRC.exists():
        raise SystemExit(f'missing {SRC}')
    fg_src = Image.open(SRC).convert('RGBA')
    legacy_src = Image.open(LEGACY_SRC).convert('RGBA') if LEGACY_SRC.exists() else fg_src
    for dens, (legacy, layer) in DENSITIES.items():
        mip = RES / f'mipmap-{dens}'
        mip.mkdir(parents=True, exist_ok=True)
        nearest(legacy_src, legacy).save(mip / 'ic_launcher.png')
        nearest(legacy_src, legacy).save(mip / 'ic_launcher_round.png')
        nearest(fg_src, layer).save(mip / 'ic_launcher_foreground.png')
    anyd = RES / 'mipmap-anydpi-v26'
    anyd.mkdir(parents=True, exist_ok=True)
    xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    (anyd / 'ic_launcher.xml').write_text(xml)
    (anyd / 'ic_launcher_round.xml').write_text(xml)
    (RES / 'values' / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources>\n'
        f'    <color name="ic_launcher_background">{BG}</color>\n'
        '</resources>\n'
    )
    print('Wrote adaptive and legacy launcher icons under', RES)

if __name__ == '__main__':
    main()
