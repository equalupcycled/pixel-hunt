# Generate Google Play screenshots from the STORE build (www/, data-store="1": no ads UI) by playing the real
# campaign with the QA aim bot and capturing chosen moments.
# usage: python3 tools/make_store_shots.py URL OUTDIR CSS_W CSS_H DSF PREFIX
#   phone 1080x1920: 360 640 3     7" tablet 1200x1920: 600 960 2     10" tablet 1600x2560: 800 1280 2
import json, os, sys, time
from playwright.sync_api import sync_playwright

URL, OUT = sys.argv[1], sys.argv[2]
CW, CH, DSF, PFX = int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
os.makedirs(OUT, exist_ok=True)

WATCH = r"""
window.SS = { want: %s, done: {}, shot: null };
SS.watch = function () {
  const s = PH.stateX, ts = PH.targets, fly = ts.filter(t => t.state !== 'dead' && t.y > 20 && t.y < 230).length;
  const take = (id, ok) => { if (ok && SS.want.includes(id) && !SS.done[id]) { SS.done[id] = 1; SS.shot = id; return true; } return false; };
  if (take('2-meadow-action', s.map === 'meadow' && s.round >= 3 && s.state === 'play' && fly >= 3)) return true;
  if (take('3-new-animal', s.map === 'lake' && s.round === 14 && s.state === 'intro' && PH.news)) return true;
  if (take('4-boss', s.map === 'snow' && s.round === 10 && s.state === 'play' && ts.some(t => t.kind === 'boss' && t.hp < t.hp0 * 0.8 && t.hp > 0 && t.y > 30))) return true;
  if (take('5-desert', s.map === 'desert' && s.round >= 8 && s.state === 'play' && fly >= 4)) return true;
  if (take('6-night', s.map === 'night' && s.round >= 8 && s.state === 'play' && fly >= 4)) return true;
  if (take('7-map-cleared', s.map === 'lake' && s.state === 'mapshift')) return true;
  if (s.state === 'dying' || s.state === 'ad' || s.state === 'over' || s.state === 'title') return true;
  return false;
};
"""
WANT = ['2-meadow-action', '3-new-animal', '4-boss', '5-desert', '6-night', '7-map-cleared']

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': CW, 'height': CH}, device_scale_factor=DSF, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate
    def snap(name):
        ev("document.getElementById('toast') && document.getElementById('toast').classList.add('hidden')")
        pg.wait_for_timeout(120)
        pg.screenshot(path=f'{OUT}/{PFX}-{name}.png')
    pg.goto(URL, wait_until='networkidle', timeout=60000); pg.wait_for_timeout(500)
    ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(600)
    ev("document.getElementById('ov-daily') && document.getElementById('ov-daily').classList.add('hidden')")
    ev("""(() => { PH.grantAll(); PH.equipPrimary('shotgun');
      ['pellet','tesla','missile'].forEach(id => { try { PH.Meta.mountTurret(id, true); } catch (e) {} }); PH.Meta.persist(); PH.toTitle(); })()""")
    pg.wait_for_timeout(400)
    ev("document.querySelectorAll('#ov-daily').forEach(e => e.classList.add('hidden'))")
    pg.locator('#btn-play').click(); pg.wait_for_timeout(500)
    ev(WATCH % json.dumps(WANT))
    t0 = time.time()
    while time.time() - t0 < 900:
        ev("PH.ff(30, { bot: true, until: SS.watch })")
        shot = ev("SS.shot")
        if shot: ev("SS.shot = null"); snap(shot)
        if ev("PH.stateX.state") in ('dying', 'ad', 'over', 'title'): break
    pg.wait_for_timeout(2500)
    for _ in range(20):
        v = ev("""(() => { const v = id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }; return { over: v('ov-over'), name: v('ov-name') }; })()""")
        if v['name']: pg.fill('#name-input', 'JOHN'); pg.click('#btn-name-ok'); pg.wait_for_timeout(600); continue
        if v['over']: break
        pg.wait_for_timeout(500)
    snap('8-all-maps-cleared')
    ev("PH.toTitle()"); pg.wait_for_timeout(800)
    ev("document.querySelectorAll('#ov-daily,#ov-name').forEach(e => e.classList.add('hidden'))")
    snap('1-title')
    btn = pg.locator('#btn-armory').first
    btn.click(); pg.wait_for_timeout(700); snap('9-upgrades')
    print(PFX, 'done', sorted(os.listdir(OUT)), 'errors', errs[:3])
