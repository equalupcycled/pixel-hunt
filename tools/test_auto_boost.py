# Auto Reload 15-minute rewarded boost. usage: python3 tools/test_auto_boost.py URL TAG
import sys, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/index.html'
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

    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(350)

    def claim_rewarded():
        pg.wait_for_function("!document.getElementById('ov-ad').classList.contains('hidden')", timeout=5000)
        pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&/CLAIM|CLOSE/.test(b.textContent||'')})()", timeout=8000)
        r = ev("(()=>{const e=document.querySelector('.ad-close');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)

    def finish_death():
        pg.wait_for_function("PH.state==='dying'||!document.getElementById('ov-continue').classList.contains('hidden')||!document.getElementById('ov-ad').classList.contains('hidden')||!document.getElementById('ov-over').classList.contains('hidden')||!document.getElementById('ov-name').classList.contains('hidden')", timeout=12000)
        pg.wait_for_timeout(1800)
        if visible('ov-continue'):
            ev("document.getElementById('btn-norevive').click()"); pg.wait_for_timeout(400)
        if visible('ov-ad'):
            pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()", timeout=8000)
            r = ev("(()=>{const e=document.querySelector('.ad-close');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
            pg.touchscreen.tap(*r); pg.wait_for_timeout(500)
        if visible('ov-name'):
            ev("document.getElementById('btn-name-skip')&&document.getElementById('btn-name-skip').click()||document.getElementById('ov-name').classList.add('hidden')")
            pg.wait_for_timeout(400)
        pg.wait_for_timeout(300)

    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(500)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()

    R = {}
    R['fresh'] = ev("""({
      v: PH.Meta.save.v,
      until: PH.Meta.save.autoBoostUntil,
      active: PH.Meta.autoBoostActive(),
      titleBtn: (document.getElementById('btn-auto-boost-t')||{}).innerText || '',
      disabled: !!(document.getElementById('btn-auto-boost-t')||{}).disabled
    })""")

    ev("""(()=>{
      PH.setAutoBoostMs(15*60*1000);
      let t = 1e12;
      PH.setNow(() => t);
      window.__boostT = (ms) => { t = 1e12 + ms; PH.setNow(() => t); };
    })()""")
    ev("AD_CONFIG.rewardedSeconds=0.2")
    tap('#btn-auto-boost-t')
    claim_rewarded()
    R['after_ad'] = ev("""({
      active: PH.Meta.autoBoostActive(),
      left: PH.Meta.autoBoostLeft(),
      until: PH.Meta.autoBoostUntil(),
      delay: PH.autoReloadDelay(),
      label: (document.getElementById('btn-auto-boost-t')||{}).innerText || '',
      disabled: !!(document.getElementById('btn-auto-boost-t')||{}).disabled
    })""")

    ev("PH.newGame()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    pg.wait_for_timeout(200)
    ev("PH.togglePause()")
    pg.wait_for_timeout(150)
    ev("window.__boostT(14*60*1000)")
    pg.wait_for_timeout(150)
    R['paused_14m'] = ev("""({
      paused: PH.paused,
      pauseVis: !document.getElementById('ov-pause').classList.contains('hidden'),
      active: PH.Meta.autoBoostActive(),
      left: PH.Meta.autoBoostLeft(),
      delay: PH.autoReloadDelay(),
      label: (document.getElementById('btn-auto-boost-p')||{}).innerText || ''
    })""")

    ev("window.__boostT(15*60*1000 + 500)")
    pg.wait_for_timeout(250)
    R['paused_expired'] = ev("""({
      paused: PH.paused,
      active: PH.Meta.autoBoostActive(),
      left: PH.Meta.autoBoostLeft(),
      delay: PH.autoReloadDelay(),
      perkAuto: PH.perkAuto,
      toast: (document.getElementById('toast')||{}).innerText || '',
      toastHidden: document.getElementById('toast').classList.contains('hidden')
    })""")

    ev("""(()=>{
      if (PH.paused) PH.togglePause();
      PH.setNow(null);
      PH.setAutoBoostMs(3000);
      PH.Meta.clearAutoBoost();
      PH.toTitle();
    })()""")
    pg.wait_for_timeout(300)
    hide_daily()
    ev("AD_CONFIG.rewardedSeconds=0.2")
    tap('#btn-auto-boost-t')
    claim_rewarded()
    R['short_grant'] = ev("""({
      active: PH.Meta.autoBoostActive(),
      left: PH.Meta.autoBoostLeft(),
      delay: PH.autoReloadDelay()
    })""")
    ev("PH.newGame()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    pg.wait_for_timeout(200)
    R['in_run'] = ev("""(()=>{
      const w = PH.weapon;
      if (!w) return { noWeapon: true, state: PH.state };
      w.ammo = 0; w.overheated = false; w.reloading = false; w.autoT = 0;
      return { state: PH.state, ammo: w.ammo, delay: PH.autoReloadDelay(), perkAuto: PH.perkAuto, paused: PH.paused };
    })()""")
    pg.wait_for_timeout(800)
    R['did_auto'] = ev("""(()=>{
      const w = PH.weapon;
      return { reloading: !!(w && w.reloading), ammo: w && w.ammo, autoT: w && w.autoT, perkAuto: PH.perkAuto, state: PH.state };
    })()""")

    ev("PH.toTitle()")
    pg.wait_for_timeout(200)
    ev("""(()=>{
      PH.Meta.clearAutoBoost();
      PH.setNow(null);
      PH.Meta.setMode('campaign');
      PH.Meta.save.lv['perk.auto'] = 1;
      PH.Meta.persist();
      PH.toTitle();
    })()""")
    pg.wait_for_timeout(250)
    hide_daily()
    R['owned_classic'] = ev("""({
      label: (document.getElementById('btn-auto-boost-t')||{}).innerText || '',
      disabled: !!(document.getElementById('btn-auto-boost-t')||{}).disabled,
      owned: PH.Meta.ownsAutoReload(),
      delay: PH.autoReloadDelay()
    })""")

    ev("""(()=>{
      PH.Meta.save.lv['perk.auto'] = 0;
      PH.Meta.save.infLv['perk.auto'] = 0;
      PH.Meta.save.cleared = PH.Meta.save.cleared || {};
      PH.Meta.save.cleared.meadow = 'test';
      PH.Meta.persist();
    })()""")
    ev("AD_CONFIG.interstitialSeconds=0.2; AD_CONFIG.rewardedSeconds=0.2")
    ev("PH.startInfinity()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    ev("PH.forceDie()")
    finish_death()
    R['inf_over'] = ev("""({
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      infinity: PH.infinity,
      label: (document.getElementById('btn-auto-boost-o')||{}).innerText || '',
      disabled: !!(document.getElementById('btn-auto-boost-o')||{}).disabled,
      ownedInf: PH.Meta.withMode('infinity', () => PH.Meta.ownsAutoReload()),
      ownedClassic: PH.Meta.withMode('campaign', () => PH.Meta.ownsAutoReload())
    })""")

    for k, v in R.items():
        print(f'{k:16}', json.dumps(v))
    print('errors', errs)
    fails = []
    if R.get('fresh', {}).get('v') != 7: fails.append('fresh schema not v7, %r' % R.get('fresh'))
    if R.get('fresh', {}).get('until') not in (0, None): fails.append('fresh until not 0')
    if 'AD' not in (R.get('fresh', {}).get('titleBtn') or '') or R.get('fresh', {}).get('disabled'):
        fails.append('title button not offered, %r' % R.get('fresh'))
    a = R.get('after_ad') or {}
    if not a.get('active') or a.get('left', 0) < 14 * 60 * 1000 or a.get('delay', -1) < 0:
        fails.append('ad did not grant 15min boost, %r' % a)
    if 'AUTO RELOAD' not in (a.get('label') or '') or not a.get('disabled'):
        fails.append('button did not switch to countdown, %r' % a)
    p14 = R.get('paused_14m') or {}
    if not p14.get('paused'): fails.append('did not pause, %r' % p14)
    if not p14.get('active') or p14.get('left', 0) < 30 * 1000 or p14.get('delay', -1) < 0:
        fails.append('pause froze or dropped the boost at 14m, %r' % p14)
    if '1:00' not in (p14.get('label') or '') and '0:59' not in (p14.get('label') or '') and 'AUTO RELOAD' not in (p14.get('label') or ''):
        fails.append('pause button did not show remaining time, %r' % p14)
    ex = R.get('paused_expired') or {}
    if ex.get('active') or ex.get('delay', 0) >= 0 or (ex.get('perkAuto') or 0) >= 0:
        fails.append('boost did not expire on the wall clock while paused, %r' % ex)
    if ex.get('paused') and 'ended' not in (ex.get('toast') or '').lower() and 'ENDED' not in (ex.get('toast') or '').upper():
        fails.append('missing Auto Reload ended toast while paused, %r' % ex)
    sg = R.get('short_grant') or {}
    if not sg.get('active') or sg.get('delay', -1) < 0: fails.append('short grant failed, %r' % sg)
    da = R.get('did_auto') or {}
    if not da.get('reloading') and (da.get('ammo') in (0, None)):
        fails.append('did not auto-reload when empty, %r' % {'did_auto': da, 'in_run': R.get('in_run')})
    oc = R.get('owned_classic') or {}
    if not oc.get('disabled') or 'own' not in (oc.get('label') or '').lower():
        fails.append('owning perk did not disable button, %r' % oc)
    io = R.get('inf_over') or {}
    if not io.get('over'): fails.append('did not reach infinity game over, %r' % io)
    elif io.get('disabled') and 'own' in (io.get('label') or '').lower():
        fails.append('infinity game-over hid boost because of classic perk, %r' % io)
    elif 'AD' not in (io.get('label') or '') and 'AUTO RELOAD' not in (io.get('label') or ''):
        fails.append('infinity game-over missing boost button, %r' % io)
    print('FAILS', fails)
    if fails or errs:
        raise SystemExit(1)
