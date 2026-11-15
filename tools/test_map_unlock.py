# Sequential map unlock (clear previous R30) and v8/v9 migration.
# usage: python3 tools/test_map_unlock.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]
OUT = '/workspace/pixel-hunt/screenshots/'
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    ev = pg.evaluate
    vis = lambda s: ev(f"!document.querySelector('{s}').classList.contains('hidden')")
    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)
    R = {}
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(400)
    ev("localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(800)
    if vis('#ov-daily'): tap('#btn-daily-claim')

    R['fresh'] = ev("""({
      v: PH.Meta.save.v,
      total: ECON.TOTAL_LEVELS,
      mapTracks: ECON.TRACKS.filter(t => t.group === 'map' || (t.id||'').startsWith('map.')).length,
      maps: Object.fromEntries(ECON.MAPS.map(m => [m.id, !!PH.Meta.hasMap(m.id)])),
      mapsTab: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
      flashlightNeeds: (ECON.TRACKS.find(t => t.id === 'flashlight') || {}).needsMap,
      flashlightNeedsOld: (ECON.TRACKS.find(t => t.id === 'flashlight') || {}).needs || null,
      equip: PH.Meta.save.equip.map
    })""")

    # Cycle to Lake: locked requirement on the map select screen, PLAY disabled.
    ev("Sfx && Sfx.init()")
    tap('#btn-map-next')
    pg.wait_for_timeout(300)
    R['lake_locked'] = ev("""({
      map: document.getElementById('title-map').innerText.replace(/\\s+/g,' ').trim(),
      clear: document.getElementById('title-clear').innerText.replace(/\\s+/g,' ').trim(),
      best: document.getElementById('title-mapbest').innerText.replace(/\\s+/g,' ').trim(),
      playDisabled: !!document.getElementById('btn-play').disabled,
      browse: PH.browseMap,
      equip: PH.Meta.save.equip.map,
      state: PH.state
    })""")
    ev("document.getElementById('title-clear').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'147-map-select-locked-{TAG}.png')

    # PLAY must not start a locked map (handler + disabled).
    ev("document.getElementById('btn-play').click()")
    pg.wait_for_timeout(400)
    R['play_blocked'] = ev("({state: PH.state, equip: PH.Meta.save.equip.map, browse: PH.browseMap})")

    # Back to Meadow, clear R30, expect celebratory unlock of Lake.
    ev("document.getElementById('btn-map-prev').click()")
    pg.wait_for_timeout(200)
    tap('#btn-play'); pg.wait_for_timeout(700)
    ev("PH.forceMapClear()")
    pg.wait_for_function("PH.state==='clear' || PH.state==='over'", timeout=5000)
    pg.wait_for_timeout(200)
    R['banner'] = ev("({state: PH.state, banner: PH.banner, banner2: PH.banner2})")
    pg.wait_for_timeout(3600)
    pg.wait_for_function("!document.getElementById('ov-name').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    if vis('#ov-name'):
        ev("document.getElementById('name-input').value='Hunter'")
        tap('#btn-name-ok'); pg.wait_for_timeout(400)
    R['cleared'] = ev("""({
      title: document.getElementById('go-title').innerText,
      note: document.getElementById('go-unranked').innerText.replace(/\\s+/g,' ').trim(),
      meadow: !!PH.Meta.isCleared('meadow'),
      maps: Object.fromEntries(ECON.MAPS.map(m => [m.id, !!PH.Meta.hasMap(m.id)])),
    })""")
    ev("document.getElementById('go-unranked').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'148-new-map-unlocked-{TAG}.png')

    tap('#btn-menu'); pg.wait_for_timeout(500)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    ev("Sfx && Sfx.init()")
    tap('#btn-map-next')
    pg.wait_for_timeout(300)
    R['lake_open'] = ev("""({
      map: document.getElementById('title-map').innerText.replace(/\\s+/g,' ').trim(),
      clear: document.getElementById('title-clear').innerText.replace(/\\s+/g,' ').trim(),
      playDisabled: !!document.getElementById('btn-play').disabled,
      hasLake: !!PH.Meta.hasMap('lake'),
      hasSnow: !!PH.Meta.hasMap('snow'),
      equip: PH.Meta.save.equip.map
    })""")

    # Shop has no MAPS tab and no "Unlock map" / map-owned requirement copy.
    ev("document.getElementById('btn-armory').click()")
    pg.wait_for_timeout(400)
    R['shop'] = ev("""({
      mapsTab: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
      body: document.getElementById('ov-shop').innerText
    })""")
    ev("document.getElementById('btn-next').click()")
    pg.wait_for_timeout(200)

    # --- migrations (new page so load() runs) ---
    def load_seed(seed):
        pg2 = c.new_page()
        pg2.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps(seed)))
        pg2.goto(URL, wait_until='networkidle')
        pg2.wait_for_timeout(700)
        data = pg2.evaluate("""({
          v: PH.Meta.save.v,
          bank: PH.Meta.save.bank,
          maps: Object.fromEntries(ECON.MAPS.map(m => [m.id, !!PH.Meta.hasMap(m.id)])),
          lvMaps: Object.fromEntries(Object.keys(PH.Meta.save.lv).filter(k => k.startsWith('map.')).map(k => [k, PH.Meta.save.lv[k]])),
          equip: PH.Meta.save.equip.map,
          cleared: PH.Meta.save.cleared
        })""")
        pg2.close()
        return data

    # Bought Desert without clearing earlier maps — keep it, no refund, don't grant Night.
    R['mig_bought'] = load_seed({
        'v': 7, 'bank': 99999, 'lv': {'map.desert': 1, 'shotgun.cap': 2},
        'stats': {}, 'missions': [], 'mDone': 0, 'ach': {},
        'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'cross': 'white', 'map': 'desert'},
        'cosm': ['classic', 'white'], 'bestByMap': {}, 'roundByMap': {}, 'ckpt': {}, 'cleared': {}
    })
    # Cleared Meadow, never bought Lake — Lake unlocks, Snow stays locked.
    R['mig_cleared'] = load_seed({
        'v': 7, 'bank': 1200, 'lv': {'shotgun.cap': 1},
        'stats': {}, 'missions': [], 'mDone': 0, 'ach': {},
        'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'cross': 'white', 'map': 'meadow'},
        'cosm': ['classic', 'white'], 'bestByMap': {'meadow': 8000}, 'roundByMap': {'meadow': 30},
        'ckpt': {'meadow': 30}, 'cleared': {'meadow': 'migrated'}
    })
    # Already played Snow (no purchase, previous maps not cleared) — keep Snow, don't take it away.
    R['mig_played'] = load_seed({
        'v': 7, 'bank': 4400, 'lv': {},
        'stats': {}, 'missions': [], 'mDone': 0, 'ach': {},
        'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'cross': 'white', 'map': 'snow'},
        'cosm': ['classic', 'white'], 'bestByMap': {'snow': 2100}, 'roundByMap': {'snow': 8},
        'ckpt': {'snow': 5}, 'cleared': {}
    })

    fails = []
    f = R['fresh']
    if f.get('v') != 10: fails.append('fresh schema not v10, %r' % f)
    if f.get('total') != 329: fails.append('TOTAL_LEVELS not 329, %r' % f)
    if f.get('mapTracks'): fails.append('map tracks still exist, %r' % f)
    if f.get('mapsTab'): fails.append('MAPS tab still in the shop')
    if f.get('flashlightNeeds') != 'night' or f.get('flashlightNeedsOld'): fails.append('flashlight still uses map purchase needs, %r' % f)
    if not f.get('maps', {}).get('meadow') or any(f.get('maps', {}).get(m) for m in ('lake', 'snow', 'desert', 'night')):
        fails.append('fresh maps unlocks wrong, %r' % f.get('maps'))

    lk = R['lake_locked']
    if 'LAKE' not in (lk.get('map') or ''): fails.append('map select did not show Lake, %r' % lk)
    if 'LOCKED' not in (lk.get('map') or ''): fails.append('Lake title missing LOCKED, %r' % lk)
    clear = (lk.get('clear') or '')
    if 'Clear Meadow to unlock' not in clear and 'CLEAR MEADOW TO UNLOCK' not in clear.upper():
        fails.append('locked requirement copy missing, %r' % lk)
    if not lk.get('playDisabled'): fails.append('PLAY was enabled on a locked map, %r' % lk)
    if lk.get('equip') != 'meadow': fails.append('browsing Lake wrote locked id into equip, %r' % lk)

    pb = R['play_blocked']
    if pb.get('state') != 'title': fails.append('PLAY started a locked map, %r' % pb)
    if pb.get('equip') != 'meadow': fails.append('PLAY selected locked Lake, %r' % pb)

    bn = R['banner']
    b2 = (bn.get('banner2') or '')
    if 'NEW MAP UNLOCKED' not in b2 or 'LAKE' not in b2:
        fails.append('clear banner missing new-map message, %r' % bn)
    cl = R['cleared']
    if cl.get('title') != 'MAP CLEARED!': fails.append('over title, %r' % cl)
    if 'NEW MAP UNLOCKED: LAKE!' not in (cl.get('note') or ''):
        fails.append('over note missing new-map message, %r' % cl)
    if not cl.get('meadow') or not cl.get('maps', {}).get('lake') or cl.get('maps', {}).get('snow'):
        fails.append('clear should unlock only the next map, %r' % cl)

    lo = R['lake_open']
    if 'LAKE' not in (lo.get('map') or '') or lo.get('playDisabled'):
        fails.append('Lake should be playable after Meadow clear, %r' % lo)
    if lo.get('hasSnow'): fails.append('Snow unlocked too early, %r' % lo)

    sh = R['shop']
    if sh.get('mapsTab'): fails.append('MAPS tab present after clear')
    body = sh.get('body') or ''
    if 'Unlock map' in body or 'OWN 18' in body.upper() or 'Own 18 upgrades' in body or 'Own 80 upgrades' in body:
        fails.append('shop still shows map purchase copy, %r' % body[:400])

    mb = R['mig_bought']
    if mb.get('v') != 10: fails.append('bought migration not v9, %r' % mb)
    if mb.get('bank') != 99999: fails.append('bought migration refunded money, %r' % mb)
    if not mb.get('maps', {}).get('desert'): fails.append('bought Desert was taken away, %r' % mb)
    if mb.get('maps', {}).get('night'): fails.append('Night granted without Desert clear, %r' % mb)
    if mb.get('equip') != 'desert': fails.append('legacy Desert selection dropped, %r' % mb)

    mc = R['mig_cleared']
    if not mc.get('maps', {}).get('lake') or mc.get('maps', {}).get('snow'):
        fails.append('cleared-Meadow migration should unlock only Lake, %r' % mc)
    if mc.get('bank') != 1200: fails.append('cleared migration changed bank, %r' % mc)

    mp = R['mig_played']
    if not mp.get('maps', {}).get('snow'): fails.append('played Snow was taken away, %r' % mp)
    if mp.get('maps', {}).get('desert'): fails.append('Desert granted from playing Snow, %r' % mp)
    if mp.get('bank') != 4400: fails.append('played migration changed bank, %r' % mp)
    if mp.get('equip') != 'snow': fails.append('played Snow selection dropped, %r' % mp)

    if errs: fails.append('js errors: ' + '; '.join(errs))
    print('RESULTS', json.dumps({k: R[k] for k in R}, default=str)[:3000])
    print('FAILS', fails)
    b.close()
    if fails: raise SystemExit(1)
