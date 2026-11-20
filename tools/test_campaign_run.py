# Classic campaign auto-continues into the next map; score and money accumulate until loss; 2X applies to the whole run.
# usage: python3 tools/test_campaign_run.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/'

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate
    vis = lambda s: ev(f"!!document.querySelector('{s}') && !document.querySelector('{s}').classList.contains('hidden')")

    def hide_overlays():
        ev("""['ov-daily','ov-title','ov-infinity','ov-name','ov-over','ov-shop','ov-continue'].forEach(id => {
          const e = document.getElementById(id); if (e) e.classList.add('hidden');
        })""")

    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)

    pg.goto(URL, wait_until='networkidle', timeout=60000)
    pg.wait_for_timeout(500)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(700)
    hide_overlays()
    fails = []

    ev("PH.grantAdFree && PH.grantAdFree('test')")
    ev("document.getElementById('ov-title') && document.getElementById('ov-title').classList.remove('hidden')")
    if vis('#btn-play'):
        tap('#btn-play')
    else:
        ev("PH.newGame(0)")
    pg.wait_for_timeout(500)
    ev("if (PH.state==='intro') PH.skipIntro()")
    hide_overlays()
    ev("PH.setScore(50000)")
    ev("PH.forceMapClear()")
    pg.wait_for_function("PH.state==='clear' || PH.state==='mapshift'", timeout=6000)
    ev("PH.setCash(7777)")
    ev("PH.setScore(50000)")
    banner = ev("({state:PH.state, banner:PH.banner, banner2:PH.banner2, meadow:!!PH.Meta.isCleared('meadow'), lake:!!PH.Meta.hasMap('lake'), over: !document.getElementById('ov-over').classList.contains('hidden'), next: !document.getElementById('btn-next-map').classList.contains('hidden'), cash:PH.runCash, score:PH.score})")
    pg.wait_for_timeout(80)
    pg.screenshot(path=OUT + f'167-mapshift-{TAG}.png')

    ev("PH.advanceMapFlow()")
    pg.wait_for_function("PH.Meta.save.equip.map==='lake' && (PH.round===1 || PH.state==='intro' || PH.state==='play')", timeout=8000)
    ev("if (PH.state==='intro') PH.skipIntro()")
    hide_overlays()
    after = ev("""({
      state: PH.state, map: PH.Meta.save.equip.map, round: PH.round,
      score: PH.score, cash: PH.runCash, miss: PH.missRun, ranked: PH.runRanked,
      perfect: !!PH.perfectRun, infinity: !!PH.infinity,
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      maps: PH.runMaps
    })""")

    ev("PH.forceDie()")
    pg.wait_for_function("PH.state==='dying' || PH.state==='over' || PH.state==='ad' || !document.getElementById('ov-continue').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden')", timeout=6000)
    pg.wait_for_timeout(200)
    if vis('#ov-continue'):
        tap('#btn-norevive')
    pg.wait_for_function("!document.getElementById('ov-over').classList.contains('hidden') || !document.getElementById('ov-name').classList.contains('hidden')", timeout=10000)
    if vis('#ov-name'): ev("document.getElementById('ov-name').classList.add('hidden'); if (PH.showOver) PH.showOver(null);")
    # If name entry hid over, show it.
    if ev("document.getElementById('ov-over').classList.contains('hidden')"):
        ev("PH.showOver(null)")
        pg.wait_for_timeout(200)

    over = ev("""({
      title: document.getElementById('go-title').innerText.trim(),
      score: document.getElementById('go-score').innerText.trim(),
      earned: document.getElementById('go-earned').innerText.trim(),
      round: document.getElementById('go-round').innerText.trim(),
      note: document.getElementById('go-unranked').innerText.trim(),
      next: !document.getElementById('btn-next-map').classList.contains('hidden'),
      dbl: !document.getElementById('btn-double').classList.contains('hidden'),
      dblText: document.getElementById('btn-double').innerText.replace(/\\s+/g,' ').trim(),
      bank: PH.Meta.bank()
    })""")
    ev("document.getElementById('ov-over').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'168-gameover-cumulative-{TAG}.png')

    bank0 = over['bank']
    if vis('#btn-double') and ev("!document.getElementById('btn-double').disabled"):
        tap('#btn-double')
        pg.wait_for_timeout(500)
    doubled = ev("""({
      earned: document.getElementById('go-earned').innerText.trim(),
      bank: PH.Meta.bank(),
      dblHidden: document.getElementById('btn-double').classList.contains('hidden')
    })""")

    print('BANNER', json.dumps(banner))
    print('AFTER', json.dumps(after))
    print('OVER', json.dumps(over))
    print('DOUBLE', json.dumps(doubled))
    print('errors', errs)

    if banner.get('over') or banner.get('next'):
        fails.append('map clear showed a next-map popup, %r' % banner)
    btxt = (banner.get('banner') or '') + ' ' + (banner.get('banner2') or '')
    if 'MEADOW' not in btxt.upper() or 'LAKE' not in btxt.upper():
        fails.append('transition banner should say Meadow cleared to Lake, %r' % banner)
    if after.get('map') != 'lake' or after.get('round') != 1:
        fails.append('did not auto-start Lake R1, %r' % after)
    if after.get('score') != 50000:
        fails.append('score did not carry into Lake, %r' % after)
    if after.get('cash') != 7777:
        fails.append('run money did not carry into Lake, %r' % after)
    if after.get('miss') != 0:
        fails.append('misses should reset on the new map, %r' % after)
    if after.get('over'):
        fails.append('game-over appeared at map transition, %r' % after)
    if after.get('perfect') is not True:
        fails.append('perfect-run should reset at the new map, %r' % after)
    if over.get('title') != 'GAME OVER':
        fails.append('expected GAME OVER after Lake loss, %r' % over)
    if '50,000' not in (over.get('score') or '') and '50000' not in (over.get('score') or ''):
        fails.append('game-over score missing Meadow total, %r' % over)
    if '7,777' not in (over.get('earned') or '') and '7777' not in (over.get('earned') or ''):
        fails.append('game-over earnings missing Meadow money, %r' % over)
    if over.get('next'):
        fails.append('GO TO NEXT MAP still shown on game over, %r' % over)
    if 'LAKE' not in (over.get('note') or '').upper() or 'MEADOW' not in (over.get('note') or '').upper():
        fails.append('game-over should mention the full run maps, %r' % over)
    if '15,554' not in (doubled.get('earned') or '') and '2X' not in (doubled.get('earned') or ''):
        fails.append('2X should double the full run earnings, %r' % doubled)
    if doubled.get('bank') != bank0 + 7777:
        fails.append('2X should add the full run money to the bank (was %s now %s)' % (bank0, doubled.get('bank')))

    print('FAILS', fails)
    if errs or fails:
        raise SystemExit(1)
