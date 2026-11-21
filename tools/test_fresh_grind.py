# Fresh-save progression: an imperfect bot (reaction delay, aim jitter, random misses) plays Classic from a brand-new save,
# takes the free 2X when offered, buys the cheapest upgrades between runs, and keeps going until every map is cleared.
# Reports runs needed and where each run ended (balance spikes / walls).  usage: python3 tools/test_fresh_grind.py URL TAG [react] [jitter] [maxRuns]
import json, sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
REACT = float(sys.argv[3]) if len(sys.argv) > 3 else 0.35
JITTER = float(sys.argv[4]) if len(sys.argv) > 4 else 3
MAXRUNS = int(sys.argv[5]) if len(sys.argv) > 5 else 80
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    ev = pg.evaluate
    pg.goto(URL, wait_until='networkidle'); ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(500)
    ev("AD_CONFIG.interstitialSeconds = 1; AD_CONFIG.rewardedSeconds = 1")
    vis = lambda s: ev(f"(() => {{ const e = document.querySelector('{s}'); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; }})()")
    if vis('#ov-daily'): pg.locator('#ov-daily button').first.click(); pg.wait_for_timeout(300)
    ev("PH.botStats.esc = {}")
    runs = []; t0 = time.time(); revived = 0
    for n in range(MAXRUNS):
        ev("document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); document.getElementById('toast').classList.add('hidden')")
        start = ev("(() => { PH.newGame(); return { map: PH.Meta.save.equip.map, bank: PH.Meta.bank(), owned: PH.Meta.totalBought(), wpn: PH.weapon.id, turrets: PH.Meta.save.equip.turrets.slice() }; })()")
        info = None
        for _ in range(400):
            ev(f"PH.ff(30, {{ bot: true, react: {REACT}, jitter: {JITTER}, missRate: 0.06, until: () => !['play','intro','clear','bonus','mapshift'].includes(PH.state) }})")
            st = ev("PH.stateX")
            if st['state'] not in ('play', 'intro', 'clear', 'bonus', 'mapshift'): info = st; break
        # settle the end-of-run screens like a player
        for _ in range(60):
            if vis('#ov-continue'):
                if not revived and n % 4 == 1:  # watch the rewarded ad to continue now and then
                    pg.click('#btn-revive'); revived += 1
                else: pg.click('#btn-norevive')
                pg.wait_for_timeout(300); continue
            if vis('#ov-ad'):
                pg.wait_for_function("!document.querySelector('#ov-ad .ad-close') || !document.querySelector('#ov-ad .ad-close').disabled", timeout=8000)
                if vis('#ov-ad .ad-close'): pg.click('#ov-ad .ad-close')
                pg.wait_for_timeout(300); continue
            if vis('#ov-name'): pg.click('#btn-name-ok'); pg.wait_for_timeout(300); continue
            st = ev("PH.stateX")
            if st['state'] in ('play', 'intro'):  # revived: keep playing
                ev(f"PH.ff(600, {{ bot: true, react: {REACT}, jitter: {JITTER}, missRate: 0.06, until: () => !['play','intro','clear','bonus','mapshift'].includes(PH.state) }})"); continue
            if vis('#ov-over'): break
            pg.wait_for_timeout(300)
        over = ev("({ title: document.getElementById('go-title').innerText, earned: document.getElementById('go-earned').innerText, round: document.getElementById('go-round').innerText, note: document.getElementById('go-unranked').innerText })")
        if vis('#btn-double') and ev("!document.getElementById('btn-double').disabled"):
            pg.click('#btn-double'); pg.wait_for_timeout(400)
            if vis('#ov-ad'):
                pg.wait_for_function("!document.querySelector('#ov-ad .ad-close').disabled", timeout=8000); pg.click('#ov-ad .ad-close'); pg.wait_for_timeout(300)
        # shop: buy cheapest first (what most players do), equip the newest weapon automatically (buy() does that)
        bought = ev("""(() => { let k = 0; for (let i = 0; i < 400; i++) { const c = PH.Meta.cheapestNext(); if (!c.t || c.c > PH.Meta.bank()) break; if (!PH.Meta.buy(c.t.id)) break; k++; } PH.Meta.persist(); return k; })()""")
        cleared = ev("ECON.MAPS.map(m => PH.Meta.isCleared(m.id) ? 1 : 0).join('')")
        runs.append({'n': n + 1, 'start': start['map'], 'end': info and info['map'], 'round': info and info['round'], 'title': over['title'], 'earned': over['earned'], 'bought': bought, 'owned': start['owned'], 'wpn': start['wpn'], 'cleared': cleared})
        print(json.dumps(runs[-1]), flush=True)
        if cleared == '11111': break
        # next run: start on the furthest unlocked map (title would show it after auto-continue)
        ev("(() => { const last = [...ECON.MAPS].reverse().find(m => PH.Meta.hasMap(m.id)); PH.Meta.selectMap(last.id); PH.toTitle(); })()")
    print('ESCAPES', json.dumps(dict(sorted(ev('PH.botStats.esc').items(), key=lambda x: -x[1]))))
    print('RUNS', len(runs), 'WALL', round(time.time() - t0), 'ERRS', errs[:5])
    json.dump(runs, open(f'/tmp/qa/fresh_grind_{TAG}.json', 'w'), indent=1)
