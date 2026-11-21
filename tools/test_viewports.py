# Viewport matrix: every major screen on small/tall phones, tablets, and landscape. Flags horizontal overflow,
# visible buttons that sit off-screen and can't be scrolled to, and overlapping HUD buttons; saves screenshots.
# usage: python3 tools/test_viewports.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/qa/'
VPS = [('se1', 320, 568), ('android-s', 360, 640), ('iphone13', 390, 844), ('tall', 412, 915), ('tab7', 600, 960),
       ('tab10', 800, 1280), ('ipad', 1024, 1366), ('land-phone', 844, 390), ('land-tab', 1280, 800)]
CHECK = r"""(() => {
  const vw = innerWidth, vh = innerHeight, issues = [];
  if (document.documentElement.scrollWidth > vw + 1) issues.push('page h-overflow ' + document.documentElement.scrollWidth + '>' + vw);
  const open = [...document.querySelectorAll('.overlay:not(.hidden)')];
  const top = open[open.length - 1];
  const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.closest('.hidden'));
  for (const b of btns) {
    const r = b.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const inTop = top ? top.contains(b) : true;
    if (!inTop && top && getComputedStyle(top).pointerEvents !== 'none') continue; // covered by an overlay, not interactive
    if (r.right > vw + 1 || r.left < -1) issues.push('btn x-offscreen #' + (b.id || b.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    // vertical: allowed if an ancestor scrolls
    if (r.bottom > vh + 1 || r.top < -1) {
      let p = b.parentElement, scroll = false;
      while (p) { const cs = getComputedStyle(p); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) { scroll = true; break; } p = p.parentElement; }
      if (!scroll) issues.push('btn y-offscreen #' + (b.id || b.className) + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom));
    }
    if (r.height < 28 && r.width < 28) issues.push('tiny tap target #' + (b.id || b.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  // text overflow inside buttons
  for (const b of btns) if (b.scrollWidth > b.clientWidth + 2 && getComputedStyle(b).overflow !== 'visible') issues.push('btn text clipped #' + (b.id || b.className));
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { issues, open: open.map(o => o.id), canvas: [Math.round(c.width), Math.round(c.height)] };
})()"""
allissues = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, w, h in VPS:
        c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 900 or h > w, has_touch=True)
        pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        ev = pg.evaluate
        pg.goto(URL, wait_until='networkidle'); ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(600)
        res = {}
        if name == 'land-phone':
            # touch phone sideways: the rotate-to-portrait screen must cover everything, and a running round must auto-pause
            hint = ev("getComputedStyle(document.getElementById('rotate-hint')).display")
            pg.screenshot(path=OUT + f'vp-{name}-rotate-{TAG}.png')
            c2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); p2 = c2.new_page()
            p2.goto(URL, wait_until='networkidle'); p2.evaluate("localStorage.clear(); document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); PH.newGame()"); p2.wait_for_timeout(300)
            p2.set_viewport_size({'width': 844, 'height': 390}); p2.wait_for_timeout(400)
            paused = p2.evaluate("PH.stateX.paused"); c2.close()
            allissues[name] = {} if (hint == 'flex' and paused) else {'rotate': ['hint=%s paused=%s' % (hint, paused)]}
            if errs: allissues[name]['console'] = errs
            print(name, json.dumps(allissues[name]), flush=True); c.close(); continue
        def snap(label):
            pg.wait_for_timeout(250)
            r = ev(CHECK); res[label] = r
            pg.screenshot(path=OUT + f'vp-{name}-{label}-{TAG}.png')
        snap('daily')
        pg.click('#btn-daily-claim'); pg.wait_for_timeout(300)
        ev("document.getElementById('toast').classList.add('hidden')")
        snap('title')
        ev("PH.Meta.setBank(50000); PH.Meta.persist(); PH.openShop('weapons')"); snap('shop')
        ev("document.getElementById('btn-next').click()"); pg.wait_for_timeout(200)
        ev("PH.Meta.markCleared('meadow'); PH.Meta.selectMap('lake'); PH.toTitle(); document.getElementById('ov-daily').classList.add('hidden')")
        ev("document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); PH.newGame(14)"); pg.wait_for_timeout(500)
        snap('header-new')
        ev("PH.skipIntro(); PH.ff(3, {bot: false})"); snap('play')
        pg.click('#btn-pause'); snap('pause')
        pg.click('#btn-resume'); pg.wait_for_timeout(200)
        ev("PH.setScore(123450); PH.forceDie()"); pg.wait_for_timeout(2200)
        if ev("!document.getElementById('ov-continue').classList.contains('hidden')"):
            snap('continue'); pg.click('#btn-norevive'); pg.wait_for_timeout(500)
        if ev("!document.getElementById('ov-ad').classList.contains('hidden')"):
            snap('ad'); pg.wait_for_function("!document.querySelector('#ov-ad .ad-close').disabled", timeout=9000); pg.click('#ov-ad .ad-close'); pg.wait_for_timeout(400)
        if ev("!document.getElementById('ov-name').classList.contains('hidden')"):
            snap('name'); pg.click('#btn-name-ok'); pg.wait_for_timeout(400)
        snap('gameover')
        ev("document.getElementById('btn-menu').click()"); pg.wait_for_timeout(300)
        ev("document.querySelectorAll('#ov-daily').forEach(o => o.classList.add('hidden')); PH.Meta.selectMap('meadow'); PH.toTitle()")
        pg.wait_for_timeout(200)
        pg.click('#btn-infinity'); snap('infinity')
        ev("PH.openBoard('meadow', 'title', false)"); snap('board')
        if errs: res['errors'] = errs
        allissues[name] = {k: v['issues'] for k, v in res.items() if isinstance(v, dict) and v.get('issues')}
        if errs: allissues[name]['console'] = errs
        print(name, json.dumps(allissues[name])[:1500], flush=True)
        c.close()
json.dump(allissues, open(f'/tmp/qa/viewports_{TAG}.json', 'w'), indent=1)
