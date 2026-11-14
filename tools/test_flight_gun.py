# Gun pose contact sheet + flight-direction audit (390x844 touch).  usage: python3 tools/test_flight_gun.py URL TAG [gun|flight|all]
import sys, json
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]; WHAT = sys.argv[3] if len(sys.argv) > 3 else 'all'
OUT = '/workspace/pixel-hunt/screenshots/'
CTX = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
def boot(p):
    b = p.chromium.launch(); c = b.new_context(**CTX); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(800)
    pg.evaluate("document.getElementById('ov-daily').classList.add('hidden'); PH.grantAll()")
    return b, pg, errs
def tap(pg, sel):
    r = pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()"); pg.touchscreen.tap(*r); pg.wait_for_timeout(400)
def start(pg, weapon, mp='meadow', rnd=None):
    pg.evaluate(f"(()=>{{const M=PH.Meta; M.equipWeapon('{weapon}','primary'); M.save.equip.secondary=null; M.save.equip.turrets=[]; M.selectMap('{mp}'); M.persist(); PH.rebuild();}})()")
    if pg.evaluate("!document.getElementById('ov-title').classList.contains('hidden')"): tap(pg, '#btn-play')
    pg.wait_for_timeout(1600)
    if rnd: pg.evaluate(f"PH.jumpRound({rnd})"); pg.wait_for_timeout(1600)
with sync_playwright() as p:
    if WHAT in ('gun', 'all'):
        b, pg, errs = boot(p); shots = []
        for w in ['shotgun', 'handgun', 'rifle', 'bow', 'mg', 'laser']:
            start(pg, w); pg.evaluate("PH.forceClear()")
            d = pg.evaluate("PH.dims()"); cv = pg.evaluate("(()=>{const r=document.getElementById('game').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
            u = cv[2] / d['W']; hx = cv[0] + 90 * u; hy = cv[1] + (d['H'] - d['BAR'] - 14) * u
            for name, (ax, ay) in {'left': (20, d['H'] - 150), 'up': (92, 40), 'right': (165, d['H'] - 150)}.items():
                pg.evaluate(f"PH.setAim({ax},{ay}); document.getElementById('toast').classList.add('hidden')"); pg.wait_for_timeout(120)
                f = f'/tmp/gun/{TAG}-{w}-{name}.png'
                pg.screenshot(path=f, clip={'x': hx - 35, 'y': hy - 52, 'width': 70, 'height': 60}); shots.append(f)
            pg.evaluate("PH.forceDie()"); pg.wait_for_timeout(200)
            pg.evaluate("['ov-continue','ov-ad','ov-over','ov-name'].forEach(i=>document.getElementById(i).classList.add('hidden'))")
            pg.evaluate("document.getElementById('btn-play') && null"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(700)
            pg.evaluate("document.getElementById('ov-daily').classList.add('hidden')")
        print('gun errors', errs); b.close()
        from PIL import Image, ImageDraw
        cols, rows = 3, 6; im = Image.new('RGB', (140 * 3 + 60, 120 * rows + 20), '#222')
        dr = ImageDraw.Draw(im)
        for i, f in enumerate(shots):
            t = Image.open(f).resize((140, 120), Image.NEAREST); r, c = divmod(i, 3); im.paste(t, (60 + c * 140, 20 + r * 120))
            if c == 0: dr.text((4, 20 + r * 120 + 55), shots[i].split('-')[1], fill='#fff')
        for c, n in enumerate(['aim left', 'aim up', 'aim right']): dr.text((60 + c * 140 + 40, 4), n, fill='#ffe066')
        im.save(OUT + f'90-gun-pose-{TAG}.png'); print('sheet', OUT + f'90-gun-pose-{TAG}.png')
    if WHAT in ('flight', 'all'):
        b, pg, errs = boot(p)
        res = {}
        for mp, rnd in [('meadow', 3), ('meadow', 12), ('lake', 6), ('snow', 6), ('desert', 6), ('night', 6), ('meadow', 10), ('desert', 20)]:
            start(pg, 'shotgun', mp); pg.evaluate(f"PH.jumpRound({rnd})")
            stat = pg.evaluate("""() => new Promise(res => {
              const seen = new Map(); let back = 0, badExit = 0, rightExit = 0, mr0 = PH.missRun, missAdds = 0, last = PH.missRun, firstX = [], kinds = new Set(), bossSeen = 0;
              const t0 = performance.now();
              (function step() {
                for (const t of PH.targets) {
                  kinds.add(t.kind); if (t.kind === 'boss') bossSeen = 1;
                  const s = seen.get(t);
                  if (!s) { seen.set(t, { x: t.x, st: t.state }); if (t.kind !== 'eyes') firstX.push(Math.round(t.x)); continue; }
                  if (t.state === 'fly' && s.st === 'fly' && t.kind !== 'eyes' && t.kind !== 'boss' && t.kind !== 'egg' && t.x < s.x - 0.01) back++;
                  if (s.st === 'fly' && t.state === 'gone' && t.kind !== 'eyes' && t.kind !== 'boss' && t.kind !== 'egg') { if (t.x > PH.dims().W) rightExit++; else badExit++; }
                  s.x = t.x; s.st = t.state;
                }
                const cur = new Set(PH.targets);
                for (const [t, s] of seen) if (!cur.has(t) && !s.done) { s.done = 1; if (s.st === 'fly' && t.kind !== 'eyes' && t.kind !== 'boss' && t.kind !== 'egg') { if (s.x > PH.dims().W) rightExit++; else badExit++; } }
                if (PH.missRun > last) missAdds += PH.missRun - last; last = PH.missRun;
                if (PH.state === 'dying' || PH.state === 'over' || performance.now() - t0 > 14000) {
                  res({ back, badExit, rightExit, missAdds, firstX: [...new Set(firstX)].slice(0, 6), kinds: [...kinds], bossSeen, state: PH.state, flee: PH.targets.filter(t => t.state === 'flee').length }); return; }
                requestAnimationFrame(step);
              })();
            })""")
            res[f'{mp} r{rnd}'] = stat
            pg.reload(wait_until='networkidle'); pg.wait_for_timeout(600); pg.evaluate("document.getElementById('ov-daily').classList.add('hidden'); PH.grantAll()")
        for k, v in res.items(): print(f'{k:11}', json.dumps(v))
        print('flight errors', errs); b.close()
