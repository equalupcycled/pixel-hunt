# Infinity (and Classic) game-over overlay must stay on top of its backdrop,
# hide or stack correctly when leaving via every button, and never trap other screens.
# usage: python3 tools/test_infinity_over.py URL [TAG]
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/tmp/qa/'

OVERLAYS = ['ov-title', 'ov-infinity', 'ov-over', 'ov-shop', 'ov-board', 'ov-how',
            'ov-about', 'ov-missions', 'ov-daily', 'ov-pause', 'ov-continue',
            'ov-name', 'ov-adfree', 'ov-ad']

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    ev = pg.evaluate
    fails = []

    def vis(id_):
        return ev(f"(()=>{{const e=document.getElementById('{id_}');return !!e && !e.classList.contains('hidden');}})()")

    def shown():
        return ev(f"""(() => {OVERLAYS}.filter(id => {{ const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }}))()""")

    def hit(sel):
        ev(f"document.querySelector({json.dumps(sel)}) && document.querySelector({json.dumps(sel)}).scrollIntoView({{block:'center', inline:'center'}})")
        pg.wait_for_timeout(80)
        return ev(f"""(() => {{
          const e = document.querySelector({json.dumps(sel)});
          if (!e) return {{miss: 'no-el'}};
          e.scrollIntoView({{block:'center', inline:'center'}});
          const r = e.getBoundingClientRect();
          const x = r.x + Math.max(2, r.width/2), y = r.y + Math.max(2, r.height/2);
          if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth)
            return {{miss: 'offscreen', x, y, w: innerWidth, h: innerHeight}};
          const top = document.elementFromPoint(x, y);
          const overlay = (function p(n){{ while (n && n !== document.body) {{ if (n.classList && n.classList.contains('overlay')) return n.id; n = n.parentElement; }} return null; }})(top);
          return {{ x, y, topId: top && (top.id || top.className || top.tagName), overlay }};
        }})()""")

    def hit_is(sel, overlay_id, label):
        h = hit(sel)
        if h.get('overlay') != overlay_id:
            fails.append('%s: click on %s hits %r (expected overlay %s) overlays=%s' % (label, sel, h, overlay_id, shown()))
        return h

    def tap(sel):
        ev(f"document.querySelector({json.dumps(sel)}).scrollIntoView({{block:'center'}})")
        h = hit(sel)
        # Prefer a real tap at the button's center so we catch stacking bugs Playwright's .click() can miss
        if h.get('x') is not None:
            pg.touchscreen.tap(h['x'], h['y'])
        else:
            pg.locator(sel).click()
        pg.wait_for_timeout(350)

    def dismiss_ad(earned=False):
        if not vis('ov-ad'):
            # rewarded/interstitial can take a beat to mount
            for _ in range(8):
                if vis('ov-ad'):
                    break
                pg.wait_for_timeout(100)
            if not vis('ov-ad'):
                return
        if earned:
            pg.wait_for_function("(()=>{const b=document.querySelector('#ov-ad .ad-close');return b&&/CLAIM|CLOSE/.test(b.textContent||'')})()", timeout=10000)
        else:
            pg.wait_for_function("(()=>{const b=document.querySelector('#ov-ad .ad-close');return b&&!b.disabled})()", timeout=10000)
        ev("document.querySelector('#ov-ad .ad-close').click()")
        pg.wait_for_timeout(400)

    def finish_to_over():
        pg.wait_for_function(
            "!document.getElementById('ov-continue').classList.contains('hidden')"
            "||!document.getElementById('ov-ad').classList.contains('hidden')"
            "||!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000)
        pg.wait_for_timeout(250)
        if vis('ov-continue'):
            ev("document.getElementById('btn-norevive').click()"); pg.wait_for_timeout(350)
        dismiss_ad()
        pg.wait_for_function(
            "!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000)
        if vis('ov-name'):
            ev("document.getElementById('name-input').value='QA'"); ev("document.getElementById('btn-name-ok').click()")
            pg.wait_for_timeout(400); dismiss_ad()
            pg.wait_for_function("!document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)

    def die_in_infinity():
        ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
        ev("PH.startInfinity()")
        pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
        ev("PH.setCash(250); PH.forceDie()")
        finish_to_over()

    def die_in_classic():
        ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
        ev("PH.newGame()")
        pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
        ev("PH.setCash(250); PH.forceDie()")
        finish_to_over()

    def expect_only(label, *ids, allow=()):
        got = set(shown()); want = set(ids)
        # title / infinity lobby are intentional backdrops behind the game-over modal (and may remain under shop)
        ok = set(allow) | (set() if 'ov-title' in want or 'ov-infinity' in want else {'ov-title', 'ov-infinity'})
        extra = got - want - ok
        missing = want - got
        if extra or missing:
            fails.append('%s overlays got %s want %s extra=%s missing=%s' % (label, sorted(got), sorted(want), sorted(extra), sorted(missing)))

    def click_id(id_):
        ev(f"document.getElementById({json.dumps(id_)}) && document.getElementById({json.dumps(id_)}).click()")
        pg.wait_for_timeout(300)

    def hide_overlay(id_):
        ev(f"document.getElementById({json.dumps(id_)}) && document.getElementById({json.dumps(id_)}).classList.add('hidden')")

    def close_shop_to_over():
        res = ev("""(() => {
          const shop = document.getElementById('ov-shop');
          const b = document.getElementById('btn-next');
          if (!b) return {err:'no-btn', before: shop && shop.className};
          const before = shop.className;
          b.click();
          return {before, after: shop.className, hidden: shop.classList.contains('hidden')};
        })()""")
        pg.wait_for_timeout(250)
        if vis('ov-shop'):
            fails.append('shop did not close via #btn-next %r' % res)
            hide_overlay('ov-shop')
            ev("document.getElementById('ov-over') && document.getElementById('ov-over').classList.remove('hidden')")
            ev("document.getElementById('ov-infinity') && document.getElementById('ov-infinity').classList.remove('hidden')")
            pg.wait_for_timeout(150)

    ads_off = False

    pg.goto(URL, wait_until='networkidle', timeout=60000); pg.wait_for_timeout(400)
    ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(600)
    ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    ev("PH.grantAll(); PH.Meta.persist(); PH.toTitle()")
    ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    ads_off = ev("!!window.ADS_OFF")

    # ---------- Infinity: loss screen is above the lobby, buttons are the hit target ----------
    die_in_infinity()
    expect_only('inf-over', 'ov-over', 'ov-infinity')
    z = ev("""({over: getComputedStyle(document.getElementById('ov-over')).zIndex,
                inf: getComputedStyle(document.getElementById('ov-infinity')).zIndex})""")
    try:
        if int(z['over']) <= int(z['inf']):
            fails.append('Infinity lobby z-index %s >= game-over %s' % (z['inf'], z['over']))
    except Exception:
        fails.append('z-index not numeric %r' % z)
    hit_is('#btn-again', 'ov-over', 'inf-again')
    hit_is('#btn-go-shop', 'ov-over', 'inf-shop-btn')
    hit_is('#btn-menu', 'ov-over', 'inf-menu')
    hit_is('#btn-over-close', 'ov-over', 'inf-x')
    hit_is('#btn-double', 'ov-over', 'inf-2x')
    hit_is('#btn-go-board', 'ov-over', 'inf-board-btn')
    # Lobby controls must NOT be the top hit target
    for sel, name in [('#btn-inf-play', 'play'), ('#btn-inf-shop', 'upgrades'), ('#btn-inf-board', 'lobby-board'), ('#btn-inf-close', 'lobby-x')]:
        h = hit(sel)
        if h.get('overlay') == 'ov-infinity':
            fails.append('Infinity lobby %s is clickable through game-over: %r' % (name, h))
    pg.screenshot(path=OUT + f'inf-over-fixed-{TAG}.png')

    # Play Again -> new Infinity run, no leftover over
    tap('#btn-again')
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    if ev("!PH.infinity"): fails.append('Play Again did not start Infinity')
    if vis('ov-over') or vis('ov-infinity') or vis('ov-title'):
        fails.append('overlays leftover after Play Again: %s' % shown())
    ev("PH.setCash(250); PH.forceDie()"); finish_to_over()

    # Upgrades / shop from the loss screen, then back
    click_id('btn-go-shop')
    expect_only('inf-shop', 'ov-shop', allow=('ov-over',))  # over may sit under the shop
    hit_is('#shop-title, #ov-shop h2, #btn-next', 'ov-shop', 'inf-shop-open')
    if vis('ov-over'):
        h = hit('#btn-again')
        if h.get('overlay') == 'ov-over':
            fails.append('GAME OVER still intercepts taps while shop is open: %r' % h)
    pg.screenshot(path=OUT + f'inf-shop-from-over-{TAG}.png')
    close_shop_to_over()
    expect_only('inf-over-after-shop', 'ov-over', 'ov-infinity')
    hit_is('#btn-again', 'ov-over', 'inf-again-after-shop')

    # Leaderboard from the loss screen, then back
    click_id('btn-go-board')
    expect_only('inf-board', 'ov-board', allow=('ov-over', 'ov-infinity'))
    hit_is('#btn-board-close', 'ov-board', 'inf-board-open')
    if vis('ov-over'):
        h = hit('#btn-again')
        if h.get('overlay') == 'ov-over':
            fails.append('GAME OVER still intercepts taps while board is open: %r' % h)
    click_id('btn-board-close')
    expect_only('inf-over-after-board', 'ov-over', 'ov-infinity')
    hit_is('#btn-again', 'ov-over', 'inf-again-after-board')

    # 2X payout (web placeholder ad OR store-build ADS_OFF free grant)
    before = ev("document.getElementById('go-earned').innerText")
    if vis('btn-double') and ev("!document.getElementById('btn-double').classList.contains('hidden')"):
        ev("window.AD_CONFIG && (AD_CONFIG.rewardedSeconds=1, AD_CONFIG.interstitialSeconds=1)")
        tap('#btn-double'); pg.wait_for_timeout(400)
        dismiss_ad(earned=True)
        pg.wait_for_timeout(400)
        after = ev("document.getElementById('go-earned').innerText")
        if '2X' not in after and after == before:
            fails.append('2X did not apply (ADS_OFF=%s) earned %r -> %r' % (ads_off, before, after))
        expect_only('inf-over-after-2x', 'ov-over', 'ov-infinity')
        hit_is('#btn-again', 'ov-over', 'inf-again-after-2x')
    else:
        fails.append('2X button hidden on Infinity game-over')

    # TITLE button -> Infinity lobby, game-over gone, lobby clickable
    click_id('btn-menu')
    expect_only('inf-lobby-via-title-btn', 'ov-infinity')
    hit_is('#btn-inf-play', 'ov-infinity', 'lobby-play')
    hit_is('#btn-inf-shop', 'ov-infinity', 'lobby-shop')
    pg.screenshot(path=OUT + f'inf-lobby-after-loss-{TAG}.png')

    # From lobby: shop, close, still no game-over
    click_id('btn-inf-shop')
    expect_only('lobby-shop', 'ov-shop', allow=('ov-infinity',))
    if vis('ov-over'): fails.append('game-over returned on lobby shop: %s' % shown())
    close_shop_to_over()
    # after lobby shop, we should be back on the lobby (shopFrom=infinity)
    if vis('ov-over') and vis('ov-infinity'):
        ev("document.getElementById('ov-over').classList.add('hidden')")
    expect_only('lobby-after-shop', 'ov-infinity')

    # From lobby: leaderboard, close
    click_id('btn-inf-board')
    expect_only('lobby-board', 'ov-board', allow=('ov-infinity',))
    if vis('ov-over'): fails.append('game-over returned on lobby board: %s' % shown())
    click_id('btn-board-close')
    expect_only('lobby-after-board', 'ov-infinity')

    # Map select in the lobby still works
    ev("document.getElementById('btn-inf-map-next') && document.getElementById('btn-inf-map-next').click()")
    pg.wait_for_timeout(200)
    expect_only('lobby-after-map', 'ov-infinity')
    if vis('ov-over'): fails.append('game-over returned on map change: %s' % shown())

    # Lobby X / Home -> Classic title, no leftover over
    click_id('btn-inf-close')
    expect_only('classic-title', 'ov-title', allow=('ov-daily',))
    ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    hit_is('#btn-play', 'ov-title', 'classic-play')

    # ---------- Continue (revive) in Infinity, then quit mid-run ----------
    ev("PH.startInfinity()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    ev("window.AD_CONFIG && (AD_CONFIG.rewardedSeconds=1, AD_CONFIG.interstitialSeconds=1)")
    ev("PH.setCash(100); PH.forceDie()")
    pg.wait_for_function("!document.getElementById('ov-continue').classList.contains('hidden')", timeout=8000)
    expect_only('inf-continue', 'ov-continue', allow=('ov-ad',))
    hit_is('#btn-revive', 'ov-continue', 'continue-revive')
    ev("document.getElementById('btn-revive').click()")
    for _ in range(25):
        if ev("PH.state==='intro'||PH.state==='play'") or vis('ov-ad'):
            break
        pg.wait_for_timeout(150)
    dismiss_ad(earned=True)
    try:
        pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=8000)
    except Exception:
        print('REVIVE_FAIL', ev("({state:PH.state, shown: [...document.querySelectorAll('.overlay:not(.hidden)')].map(e=>e.id), ad: !document.getElementById('ov-ad').classList.contains('hidden')})"))
        raise
    if vis('ov-over') or vis('ov-continue'):
        fails.append('continue left a modal up: %s' % shown())
    # Quit mid-run via pause -> should reach game-over (continue already used)
    ev("PH.togglePause()"); pg.wait_for_timeout(200)
    expect_only('inf-pause', 'ov-pause')
    click_id('btn-quit'); pg.wait_for_timeout(400)
    dismiss_ad()
    pg.wait_for_function(
        "!document.getElementById('ov-over').classList.contains('hidden')"
        "||!document.getElementById('ov-name').classList.contains('hidden')", timeout=8000)
    if vis('ov-name'):
        ev("document.getElementById('btn-name-ok').click()"); pg.wait_for_timeout(400)
    expect_only('inf-over-after-quit', 'ov-over', 'ov-infinity')
    hit_is('#btn-again', 'ov-over', 'quit-again')

    # Android BACK (PH_handleBack) closes game-over to the lobby
    ev("PH_handleBack()"); pg.wait_for_timeout(300)
    expect_only('back-to-lobby', 'ov-infinity')
    hit_is('#btn-inf-play', 'ov-infinity', 'back-lobby-play')
    # BACK again leaves the lobby for Classic title
    ev("PH_handleBack()"); pg.wait_for_timeout(300)
    ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    expect_only('back-to-title', 'ov-title')
    hit_is('#btn-play', 'ov-title', 'back-title-play')

    # Start a new Infinity run from the lobby after a loss
    ev("PH.openInfinity()"); pg.wait_for_timeout(200)
    click_id('btn-inf-play')
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    if ev("!PH.infinity"): fails.append('lobby PLAY did not start Infinity')
    if vis('ov-over') or vis('ov-infinity'):
        fails.append('overlays leftover after lobby PLAY: %s' % shown())

    # ---------- Classic game-over: backdrop is title, same stacking rules, no regression ----------
    ev("PH.toTitle()"); ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    die_in_classic()
    expect_only('classic-over', 'ov-over', 'ov-title')
    zc = ev("""({over: getComputedStyle(document.getElementById('ov-over')).zIndex,
                 title: getComputedStyle(document.getElementById('ov-title')).zIndex})""")
    try:
        if int(zc['over']) <= int(zc['title']):
            fails.append('Classic title z-index %s >= game-over %s' % (zc['title'], zc['over']))
    except Exception:
        fails.append('classic z-index not numeric %r' % zc)
    hit_is('#btn-again', 'ov-over', 'classic-again')
    hit_is('#btn-go-shop', 'ov-over', 'classic-shop-btn')
    if ev("!document.getElementById('btn-infinity').classList.contains('hidden')"):
        h = hit('#btn-infinity')
        if h.get('overlay') == 'ov-title':
            fails.append('Classic title INFINITY is clickable through game-over: %r' % h)
    click_id('btn-go-shop')
    expect_only('classic-shop', 'ov-shop', allow=('ov-over',))
    hit_is('#btn-next', 'ov-shop', 'classic-shop-open')
    close_shop_to_over()
    expect_only('classic-over-after-shop', 'ov-over', 'ov-title')
    click_id('btn-go-board')
    expect_only('classic-board', 'ov-board', allow=('ov-over', 'ov-title'))
    hit_is('#btn-board-close', 'ov-board', 'classic-board-open')
    click_id('btn-board-close')
    expect_only('classic-over-after-board', 'ov-over', 'ov-title')
    click_id('btn-over-close')
    ev("document.querySelectorAll('#ov-daily').forEach(e=>e.classList.add('hidden'))")
    expect_only('classic-title-after-x', 'ov-title')
    hit_is('#btn-play', 'ov-title', 'classic-title-after-x')

    if errs:
        fails.append('console errors %r' % errs[:6])
    print('ADS_OFF', ads_off)
    print('FAILS', fails)
    if fails:
        raise SystemExit(1)
    print('OK', TAG)
