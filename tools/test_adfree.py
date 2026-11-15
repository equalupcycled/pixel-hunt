# Remove Ads ($2.99 one-time, per-device). usage: python3 tools/test_adfree.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse, parse_qs

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/'

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate

    def visible(id_):
        return ev(f"(()=>{{const e=document.getElementById('{id_}');return !!e && !e.classList.contains('hidden');}})()")

    def hide_daily():
        ev("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")

    def wait_death_ui():
        pg.wait_for_function(
            "!document.getElementById('ov-continue').classList.contains('hidden')"
            "||!document.getElementById('ov-ad').classList.contains('hidden')"
            "||!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000,
        )
        pg.wait_for_timeout(300)

    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)

    def txt(id_):
        return ev(f"(document.getElementById('{id_}')||{{}}).innerText||''")

    def cls(sel):
        return ev(f"(document.querySelector('{sel}')||{{}}).className||''")

    R = {}
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(400)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()

    R['fresh'] = ev("""({
      v: PH.Meta.save.v,
      adFree: PH.Meta.isAdFree(),
      session: PH.Meta.save.adFreeSession,
      btn: (document.getElementById('btn-adfree-t')||{}).innerText || '',
      btnHidden: !!(document.getElementById('btn-adfree-t')||{}).classList.contains('hidden'),
      noteHidden: !!(document.querySelector('#ov-title .adfree-note')||{}).classList.contains('hidden'),
      ownedHidden: !!(document.querySelector('#ov-title .adfree-owned')||{}).classList.contains('hidden'),
      link: (window.ADFREE_CONFIG||{}).paymentLink || '',
      price: (window.ADFREE_CONFIG||{}).priceLabel || '',
    })""")

    ev("window.__opened=[]; window.PH_openUrl=function(u){window.__opened.push(u);return true;}")
    ev("Sfx && Sfx.init()")
    tap('#btn-adfree-t')
    R['opened'] = ev("window.__opened.slice()")

    ev("document.getElementById('btn-adfree-t').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'150-adfree-button-{TAG}.png')

    # Invalid query must not grant, and must strip the param.
    base = URL if URL.endswith('/') or URL.endswith('.html') else URL + '/'
    # Prefer the game page path so query lands on index.
    origin = ev("location.origin + location.pathname")
    pg.goto(origin + '?adfree=not-a-session', wait_until='networkidle')
    pg.wait_for_timeout(600)
    hide_daily()
    R['invalid'] = ev("""({
      adFree: PH.Meta.isAdFree(),
      search: location.search,
      href: location.href,
    })""")

    pg.goto(origin + '?adfree=cs_short', wait_until='networkidle')
    pg.wait_for_timeout(600)
    hide_daily()
    R['short'] = ev("({ adFree: PH.Meta.isAdFree(), search: location.search })")

    # Valid return: mark ad-free, toast, strip query, hide buy button.
    sid = 'cs_live_testdevicesession99'
    pg.goto(origin + '?adfree=' + sid, wait_until='networkidle')
    pg.wait_for_timeout(800)
    hide_daily()
    R['granted'] = ev("""({
      adFree: PH.Meta.isAdFree(),
      session: PH.Meta.save.adFreeSession,
      v: PH.Meta.save.v,
      search: location.search,
      toast: (document.getElementById('toast')||{}).innerText || '',
      toastHidden: !!(document.getElementById('toast')||{}).classList.contains('hidden'),
      btnHidden: !!(document.getElementById('btn-adfree-t')||{}).classList.contains('hidden'),
      noteHidden: !!(document.querySelector('#ov-title .adfree-note')||{}).classList.contains('hidden'),
      ownedHidden: !!(document.querySelector('#ov-title .adfree-owned')||{}).classList.contains('hidden'),
      owned: (document.querySelector('#ov-title .adfree-owned')||{}).innerText || '',
    })""")
    ev("document.getElementById('ov-title').scrollIntoView({block:'start'})")
    pg.screenshot(path=OUT + f'151-adfree-thanks-{TAG}.png')

    # Persist across reload (no query).
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()
    R['persist'] = ev("""({
      adFree: PH.Meta.isAdFree(),
      session: PH.Meta.save.adFreeSession,
      btnHidden: !!(document.getElementById('btn-adfree-t')||{}).classList.contains('hidden'),
      ownedHidden: !!(document.querySelector('#ov-title .adfree-owned')||{}).classList.contains('hidden'),
    })""")

    # Rewarded Auto Reload is granted instantly (no ad overlay).
    ev("AD_CONFIG.rewardedSeconds=8")
    tap('#btn-auto-boost-t')
    pg.wait_for_timeout(500)
    R['boost'] = ev("""({
      adVisible: !document.getElementById('ov-ad').classList.contains('hidden'),
      active: PH.Meta.autoBoostActive(),
      left: PH.Meta.autoBoostLeft(),
      label: (document.getElementById('btn-auto-boost-t')||{}).innerText || '',
    })""")

    # Death: continue without an ad; interstitial skipped after decline / second death.
    ev("PH.newGame()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    pg.wait_for_timeout(200)
    ev("PH.forceDie()")
    wait_death_ui()
    R['continue'] = ev("""({
      adVisible: !document.getElementById('ov-ad').classList.contains('hidden'),
      contVisible: !document.getElementById('ov-continue').classList.contains('hidden'),
      reviveLabel: (document.getElementById('btn-revive')||{}).innerText || '',
      reviveUsed: PH.reviveUsed,
    })""")
    if visible('ov-continue'):
        tap('#btn-revive')
        pg.wait_for_timeout(600)
    R['revived'] = ev("""({
      adVisible: !document.getElementById('ov-ad').classList.contains('hidden'),
      contVisible: !document.getElementById('ov-continue').classList.contains('hidden'),
      state: PH.state,
      reviveUsed: PH.reviveUsed,
    })""")

    ev("PH.forceDie()")
    wait_death_ui()
    if visible('ov-name'):
        ev("document.getElementById('btn-name-skip')&&document.getElementById('btn-name-skip').click()||document.getElementById('ov-name').classList.add('hidden')")
        pg.wait_for_timeout(400)
        if not visible('ov-over'):
            wait_death_ui()
    R['second_death'] = ev("""({
      adVisible: !document.getElementById('ov-ad').classList.contains('hidden'),
      contVisible: !document.getElementById('ov-continue').classList.contains('hidden'),
      overVisible: !document.getElementById('ov-over').classList.contains('hidden'),
      buyHidden: !!(document.getElementById('btn-adfree-o')||{}).classList.contains('hidden'),
      doubleLabel: (document.getElementById('btn-double')||{}).innerText || '',
    })""")

    # Dedicated 2X run on a fresh ad-free page so leftover overlays cannot leak.
    pg3 = c.new_page()
    pg3.on('pageerror', lambda e: errs.append(str(e)))
    pg3.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps({
        'v': 9, 'adFree': True, 'adFreeSession': 'cs_live_testdevicesession99', 'bank': 0, 'autoBoostUntil': 0,
    })))
    pg3.goto(URL, wait_until='networkidle'); pg3.wait_for_timeout(800)
    ev3 = pg3.evaluate
    ev3("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")
    ev3("PH.newGame()")
    pg3.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    ev3("PH.setCash(200); PH.forceDie()")
    pg3.wait_for_function(
        "!document.getElementById('ov-continue').classList.contains('hidden')"
        "||!document.getElementById('ov-over').classList.contains('hidden')"
        "||!document.getElementById('ov-name').classList.contains('hidden')",
        timeout=8000,
    )
    pg3.wait_for_timeout(300)
    if ev3("!document.getElementById('ov-continue').classList.contains('hidden')"):
        ev3("document.getElementById('btn-norevive').click()")
        pg3.wait_for_timeout(400)
        pg3.wait_for_function(
            "!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000,
        )
    if ev3("!document.getElementById('ov-name').classList.contains('hidden')"):
        ev3("document.getElementById('btn-name-skip')&&document.getElementById('btn-name-skip').click()")
        pg3.wait_for_timeout(400)
        pg3.wait_for_function("!document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    R['over_before_2x'] = ev3("""({
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      dblHidden: !!(document.getElementById('btn-double')||{}).classList.contains('hidden'),
      dblDisabled: !!(document.getElementById('btn-double')||{}).disabled,
      label: (document.getElementById('btn-double')||{}).innerText || '',
      earned: (document.getElementById('go-earned')||{}).innerText || '',
      adFree: PH.Meta.isAdFree(),
      cash: PH.Meta && 0,
    })""")
    ev3("window.__adWas = false; const mo=new MutationObserver(()=>{if(!document.getElementById('ov-ad').classList.contains('hidden')) window.__adWas=true;}); mo.observe(document.getElementById('ov-ad'),{attributes:true,attributeFilter:['class']})")
    if ev3("!document.getElementById('ov-over').classList.contains('hidden')") and ev3("!document.getElementById('btn-double').classList.contains('hidden')") and ev3("!document.getElementById('btn-double').disabled"):
        r = ev3("(()=>{const e=document.getElementById('btn-double');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        pg3.touchscreen.tap(*r); pg3.wait_for_timeout(700)
    R['double'] = ev3("""({
      adVisible: !document.getElementById('ov-ad').classList.contains('hidden'),
      adWas: !!window.__adWas,
      earned: (document.getElementById('go-earned')||{}).innerText || '',
      hiddenAfter: !!(document.getElementById('btn-double')||{}).classList.contains('hidden'),
      label: (document.getElementById('btn-double')||{}).innerText || '',
    })""")
    pg3.close()

    # Pause menu buy button is hidden when ad-free.
    ev("PH.toTitle()")
    hide_daily()
    ev("PH.newGame()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    ev("PH.togglePause()")
    pg.wait_for_timeout(400)
    R['pause'] = ev("""({
      pauseVisible: !document.getElementById('ov-pause').classList.contains('hidden'),
      buyHidden: !!(document.getElementById('btn-adfree-p')||{}).classList.contains('hidden'),
      ownedHidden: !!(document.querySelector('#ov-pause .adfree-owned')||{}).classList.contains('hidden'),
    })""")

    # v8 save migrates to v9 with adFree false (fresh page so persist cannot race).
    seed = {
      'v': 8, 'bank': 12, 'lv': {},
      'equip': {'map': 'meadow', 'primary': 'shotgun', 'secondary': None},
      'autoBoostUntil': 0,
    }
    pg2 = c.new_page()
    pg2.on('pageerror', lambda e: errs.append(str(e)))
    pg2.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps(seed)))
    pg2.goto(URL, wait_until='networkidle'); pg2.wait_for_timeout(800)
    pg2.evaluate("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")
    R['migrate_clean'] = pg2.evaluate("""({
      v: PH.Meta.save.v,
      adFree: PH.Meta.isAdFree(),
      session: PH.Meta.save.adFreeSession,
      bank: PH.Meta.bank(),
      map: PH.Meta.save.equip.map,
      btnHidden: !!(document.getElementById('btn-adfree-t')||{}).classList.contains('hidden'),
    })""")
    pg2.close()

    R['errors'] = errs
    print(json.dumps(R, indent=2))

    fails = []
    f = R['fresh']
    if f.get('v') != 9: fails.append('fresh schema not v9, %r' % f)
    if f.get('adFree'): fails.append('fresh already ad-free, %r' % f)
    if 'REMOVE ADS $2.99' not in (f.get('btn') or ''): fails.append('title button copy, %r' % f.get('btn'))
    if f.get('btnHidden'): fails.append('title buy button hidden on fresh')
    if f.get('noteHidden'): fails.append('restore note hidden on fresh')
    if not f.get('ownedHidden'): fails.append('owned label shown on fresh')
    if 'buy.stripe.com' not in (f.get('link') or ''): fails.append('missing payment link, %r' % f.get('link'))
    if f.get('price') != '$2.99': fails.append('price label %r' % f.get('price'))

    opened = R.get('opened') or []
    if not any(isinstance(u, str) and 'buy.stripe.com' in u for u in opened):
        fails.append('button did not open payment link, %r' % opened)

    if R['invalid'].get('adFree'): fails.append('invalid sid granted, %r' % R['invalid'])
    if 'adfree=' in (R['invalid'].get('search') or ''): fails.append('invalid query not stripped, %r' % R['invalid'])
    if R['short'].get('adFree'): fails.append('short sid granted, %r' % R['short'])

    g = R['granted']
    if not g.get('adFree'): fails.append('valid return did not grant, %r' % g)
    if g.get('session') != sid: fails.append('session not saved, %r' % g)
    if 'adfree=' in (g.get('search') or ''): fails.append('success query not stripped, %r' % g)
    if 'THANKS' not in (g.get('toast') or '').upper() and g.get('toastHidden'):
        fails.append('missing thanks toast, %r' % g)
    if not g.get('btnHidden'): fails.append('buy button still visible after grant')
    if not g.get('noteHidden'): fails.append('restore note still visible after grant')
    if g.get('ownedHidden'): fails.append('owned label hidden after grant')
    if 'ADS REMOVED' not in (g.get('owned') or '').upper(): fails.append('owned label copy, %r' % g.get('owned'))

    per = R['persist']
    if not per.get('adFree') or not per.get('btnHidden'):
        fails.append('ad-free did not persist, %r' % per)

    bo = R['boost']
    if bo.get('adVisible'): fails.append('auto-reload showed an ad while ad-free, %r' % bo)
    if not bo.get('active') or bo.get('left', 0) <= 0:
        fails.append('auto-reload not granted instantly, %r' % bo)

    co = R['continue']
    if co.get('adVisible'): fails.append('continue offer showed an ad, %r' % co)
    if not co.get('contVisible'): fails.append('continue offer missing, %r' % co)
    lab = (co.get('reviveLabel') or '').upper()
    if 'WATCH AD' in lab: fails.append('continue still says WATCH AD, %r' % co.get('reviveLabel'))
    if 'CONTINUE' not in lab: fails.append('continue label, %r' % co.get('reviveLabel'))

    rv = R['revived']
    if rv.get('adVisible'): fails.append('revive showed an ad, %r' % rv)
    if not rv.get('reviveUsed'): fails.append('revive not marked used, %r' % rv)
    if rv.get('state') not in ('play', 'intro', 'clear'):
        fails.append('did not resume after instant continue, %r' % rv)

    sd = R['second_death']
    if sd.get('adVisible'): fails.append('second death showed interstitial, %r' % sd)
    if sd.get('contVisible'): fails.append('continue offered twice, %r' % sd)
    if not sd.get('overVisible'): fails.append('game over not shown after second death, %r' % sd)
    if not sd.get('buyHidden'): fails.append('game over buy button visible while ad-free')
    if 'WATCH AD' in (sd.get('doubleLabel') or '').upper():
        fails.append('2X still says WATCH AD, %r' % sd.get('doubleLabel'))

    d = R.get('double') or {}
    pre = R.get('over_before_2x') or {}
    if pre.get('dblHidden') or pre.get('dblDisabled') or not pre.get('over'):
        fails.append('2X button was not tappable, %r' % pre)
    if d.get('adVisible') or d.get('adWas'):
        fails.append('2X showed an ad, %r' % d)
    if '2X' not in (d.get('earned') or '').upper():
        fails.append('2X did not apply, %r' % d)

    pa = R['pause']
    if not pa.get('pauseVisible'): fails.append('pause menu not shown, %r' % pa)
    if not pa.get('buyHidden'): fails.append('pause buy button visible while ad-free')

    mig = R['migrate_clean']
    if mig.get('v') != 9: fails.append('v8 migration not v9, %r' % mig)
    if mig.get('adFree'): fails.append('v8 migration granted ad-free, %r' % mig)
    if mig.get('bank') != 12: fails.append('v8 migration lost bank, %r' % mig)
    if mig.get('btnHidden'): fails.append('buy button hidden after clean v8 migration')

    if errs: fails.append('page errors: ' + ' | '.join(errs))
    if fails:
        print('FAIL: ' + ' | '.join(fails))
        sys.exit(1)
    print('OK adfree ' + TAG)
