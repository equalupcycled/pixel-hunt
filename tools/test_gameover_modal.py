# Game over is a modal over the title screen. usage: python3 tools/test_gameover_modal.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright

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

    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)

    def wait_death_ui():
        pg.wait_for_function(
            "!document.getElementById('ov-continue').classList.contains('hidden')"
            "||!document.getElementById('ov-ad').classList.contains('hidden')"
            "||!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000,
        )
        pg.wait_for_timeout(300)

    def dismiss_ad():
        if not visible('ov-ad'):
            return
        pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()", timeout=8000)
        r = ev("(()=>{const e=document.querySelector('.ad-close');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(500)

    def finish_to_over():
        wait_death_ui()
        if visible('ov-continue'):
            ev("document.getElementById('btn-norevive').click()")
            pg.wait_for_timeout(400)
        dismiss_ad()
        pg.wait_for_function(
            "!document.getElementById('ov-over').classList.contains('hidden')"
            "||!document.getElementById('ov-name').classList.contains('hidden')",
            timeout=8000,
        )
        if visible('ov-name'):
            ev("document.getElementById('btn-name-ok')&&document.getElementById('btn-name-ok').click()")
            pg.wait_for_timeout(400)
            dismiss_ad()
            pg.wait_for_function("!document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)

    def reach_over():
        ev("PH.newGame()")
        pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
        ev("PH.setCash(200); PH.forceDie()")
        finish_to_over()

    R = {}
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(400)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()

    reach_over()
    hide_daily()
    R['open'] = ev("""({
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      title: !document.getElementById('ov-title').classList.contains('hidden'),
      hasX: !!document.getElementById('btn-over-close'),
      xClass: (document.getElementById('btn-over-close')||{}).className || '',
      overHasX: (document.getElementById('ov-over')||{}).classList.contains('has-x'),
      again: !!(document.getElementById('btn-again') && !document.getElementById('btn-again').classList.contains('hidden')),
      menu: !!(document.getElementById('btn-menu') && !document.getElementById('btn-menu').classList.contains('hidden')),
      shop: !!(document.getElementById('btn-go-shop') && !document.getElementById('btn-go-shop').classList.contains('hidden')),
      share: !!(document.getElementById('btn-share') && !document.getElementById('btn-share').classList.contains('hidden')),
      board: !!(document.getElementById('btn-go-board') && !document.getElementById('btn-go-board').classList.contains('hidden')),
      adfree: !!(document.getElementById('btn-adfree-o') && !document.getElementById('btn-adfree-o').classList.contains('hidden')),
      earned: (document.getElementById('go-earned')||{}).innerText || '',
      goTitle: (document.getElementById('go-title')||{}).innerText || '',
      titleMap: (document.getElementById('title-map')||{}).innerText || '',
      state: PH.state,
    })""")
    ev("document.getElementById('ov-over').scrollIntoView({block:'start'})")
    pg.screenshot(path=OUT + f'155-gameover-modal-{TAG}.png')

    ev("Sfx && Sfx.init()")
    tap('#btn-over-close')
    hide_daily()
    R['after_x'] = ev("""({
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      title: !document.getElementById('ov-title').classList.contains('hidden'),
      state: PH.state,
    })""")

    # Play again still starts a run and hides the modal + title
    reach_over()
    hide_daily()
    tap('#btn-again')
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    R['again'] = ev("""({
      state: PH.state,
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      title: !document.getElementById('ov-title').classList.contains('hidden'),
    })""")

    # TITLE button also closes to the title screen
    ev("PH.forceDie()")
    finish_to_over()
    hide_daily()
    tap('#btn-menu')
    hide_daily()
    R['after_menu'] = ev("""({
      over: !document.getElementById('ov-over').classList.contains('hidden'),
      title: !document.getElementById('ov-title').classList.contains('hidden'),
      state: PH.state,
    })""")

    R['errors'] = errs
    print(json.dumps(R, indent=2))

    fails = []
    o = R['open']
    if not o.get('over'): fails.append('game over not shown, %r' % o)
    if not o.get('title'): fails.append('title not visible behind game over, %r' % o)
    if not o.get('hasX') or 'x-close' not in (o.get('xClass') or ''): fails.append('missing X close, %r' % o)
    if not o.get('overHasX'): fails.append('ov-over missing has-x')
    for k in ('again', 'menu', 'shop', 'share', 'board', 'adfree'):
        if not o.get(k): fails.append('missing %s button, %r' % (k, o))
    if '200' not in (o.get('earned') or ''): fails.append('earnings missing, %r' % o.get('earned'))
    if 'GAME OVER' not in (o.get('goTitle') or ''): fails.append('title text, %r' % o.get('goTitle'))

    x = R['after_x']
    if x.get('over'): fails.append('X did not close game over, %r' % x)
    if not x.get('title'): fails.append('title not left after X, %r' % x)
    if x.get('state') != 'title': fails.append('state not title after X, %r' % x)

    a = R['again']
    if a.get('state') not in ('intro', 'play'): fails.append('play again did not start, %r' % a)
    if a.get('over') or a.get('title'): fails.append('overlays still up after play again, %r' % a)

    m = R['after_menu']
    if m.get('over'): fails.append('TITLE did not close game over, %r' % m)
    if not m.get('title'): fails.append('title not left after TITLE, %r' % m)
    if m.get('state') != 'title': fails.append('state not title after TITLE, %r' % m)

    if errs: fails.append('page errors: ' + ' | '.join(errs))
    if fails:
        print('FAIL: ' + ' | '.join(fails))
        sys.exit(1)
    print('OK gameover-modal ' + TAG)
