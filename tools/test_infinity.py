# Prices, ad-continue (same round + score), map clear, infinity mode.
# usage: python3 tools/test_infinity.py URL TAG
import sys, json
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]
OUT = '/workspace/pixel-hunt/screenshots/'
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(800)
    ev = pg.evaluate; vis = lambda s: ev(f"!document.querySelector('{s}').classList.contains('hidden')")
    def close_ad(earned=False):
        pg.wait_for_function("!document.getElementById('ov-ad').classList.contains('hidden')", timeout=8000)
        if earned:
            pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&/CLAIM|CLOSE/.test(b.textContent||'')})()", timeout=8000)
        else:
            pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()", timeout=8000)
        r = ev("(()=>{const e=document.querySelector('.ad-close');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(600)
    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(500)
    R = {}
    ev("localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(900)
    if vis('#ov-daily'): tap('#btn-daily-claim')

    # 1) higher prices restored (Handgun unlock should be around $9,000, not $5,000)
    R['prices'] = ev("""(()=>{
      const bought = PH.Meta.totalBought();
      const hg = ECON.TRACKS.find(t=>t.id==='own.handgun');
      const ls = ECON.TRACKS.find(t=>t.id==='own.laser');
      const night = ECON.TRACKS.find(t=>t.id==='map.night');
      // costs as a fresh save (0 upgrades) and at the unlock thresholds
      const at = (t, total) => ECON.cost(t, 0, total);
      return {
        handgun_at_req: at(hg, hg.req),
        laser_at_req: at(ls, ls.req),
        night_at_req: at(night, night.req),
        curve0: ECON.curve(0)
      };
    })()""")

    # 2) map select: infinity locked, clear progress visible
    R['title_locked'] = ev("""({
      map: document.getElementById('title-map').innerText,
      clear: document.getElementById('title-clear').innerText.replace(/\\s+/g,' ').trim(),
      infBtn: !document.getElementById('btn-infinity').classList.contains('hidden'),
      sw: navigator.serviceWorker && 'ok'
    })""")
    ev("document.getElementById('title-clear').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'99-map-select-infinity-locked-{TAG}.png')

    # 3) watch-ad-to-continue: same round, score kept, X's cleared, still ranked
    tap('#btn-play'); pg.wait_for_timeout(800)
    ev("PH.jumpRound(7)"); pg.wait_for_timeout(400)
    ev("PH.forceClear()")
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'||PH.state==='clear'", timeout=8000)
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=8000)
    R['no_shop_between_rounds'] = ev("({shop: !document.getElementById('ov-shop').classList.contains('hidden'), state: PH.state, round: PH.round})")
    ev("PH.jumpRound(7)"); pg.wait_for_timeout(400)
    ev("PH.setScore(12400); PH.setCash(350); AD_CONFIG.rewardedSeconds=1; AD_CONFIG.interstitialSeconds=1")
    start = ev("({round:PH.round, score:PH.score, miss:PH.missRun, fromCkpt:PH.fromCkpt, cash:PH.Meta ? 350 : 350})")
    ev("PH.setMiss(PH.maxMiss-1)")
    # bump score if still 0 by waiting, that's ok — we'll also try to set by shooting nothing; use hook if score is 0
    # There's no setScore; after jumpRound the score may be 0. Give a known score by... we can only observe keep-0.
    # Force a die and revive, then check round and fromCkpt and miss.
    ev("PH.forceDie()")
    pg.wait_for_function("!document.getElementById('ov-continue').classList.contains('hidden')", timeout=8000)
    R['continue_copy'] = ev("({detail:document.getElementById('cont-detail').innerText, note:document.getElementById('cont-note').innerText, btn:document.getElementById('btn-revive').innerText.replace(/\\n/g,' | ')})")
    ev("document.getElementById('ov-continue').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'98-continue-ad-choice-{TAG}.png')
    tap('#btn-revive')
    close_ad(earned=True)
    pg.wait_for_function("PH.state==='intro'||PH.state==='play'", timeout=5000)
    R['after_revive'] = ev("({state:PH.state, round:PH.round, score:PH.score, miss:PH.missRun, fromCkpt:PH.fromCkpt, infinity:PH.infinity, reviveUsed:PH.reviveUsed})")
    R['revive_keeps_round'] = ev(f"PH.round==={start['round']} && PH.missRun===0 && PH.fromCkpt===0 && PH.reviveUsed===true && PH.score==={start['score']}")

    # 4) second death (no more continue) still ranked (name entry)
    ev("PH.forceDie()")
    pg.wait_for_function("PH.state==='dying'||PH.state==='ad'||!document.getElementById('ov-ad').classList.contains('hidden')||!document.getElementById('ov-name').classList.contains('hidden')||!document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    pg.wait_for_timeout(2000)
    if vis('#ov-ad'):
        close_ad(earned=False)
    R['revived_run_ranked'] = ev("({name: !document.getElementById('ov-name').classList.contains('hidden'), unranked: document.getElementById('go-unranked').innerText, over: !document.getElementById('ov-over').classList.contains('hidden')})")
    if vis('#ov-name'):
        tap('#btn-name-ok'); pg.wait_for_timeout(400)
    # game over choices should include checkpoint (round 5 at least? we jumped to 7 so ckpt 5) and start from 1
    R['go_choices'] = ev("({ckpt: document.getElementById('btn-ckpt').innerText.replace(/\\n/g,' | '), again: document.getElementById('btn-again').innerText.replace(/\\n/g,' | '), ckptVis: !document.getElementById('btn-ckpt').classList.contains('hidden'), infVis: !document.getElementById('btn-go-infinity').classList.contains('hidden')})")

    # 5) map clear (beat round 30 boss) unlocks infinity; migration of already-reached 30
    ev("document.getElementById('btn-menu') && document.getElementById('btn-menu').click()")
    pg.wait_for_timeout(400)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    # start a fresh ranked run then force the clear
    if vis('#ov-over'): tap('#btn-again') if ev("!document.getElementById('btn-again').classList.contains('hidden')") else None
    # go to title if needed
    if vis('#ov-over'): ev("document.getElementById('btn-menu').click()"); pg.wait_for_timeout(300)
    if vis('#ov-title'):
        tap('#btn-play'); pg.wait_for_timeout(700)
    ev("PH.forceMapClear()")
    pg.wait_for_function("PH.state==='clear' || PH.state==='over'", timeout=5000)
    pg.wait_for_timeout(400)
    R['clear_banner'] = ev("({state:PH.state})")
    # wait for victory overlay (clearT 3.2s + maybe name entry)
    pg.wait_for_timeout(3600)
    pg.wait_for_function("!document.getElementById('ov-name').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    if vis('#ov-name'):
        tap('#btn-name-ok'); pg.wait_for_timeout(400)
    R['cleared'] = ev("""({
      title: document.getElementById('go-title').innerText,
      note: document.getElementById('go-unranked').innerText,
      clearedFlag: !!PH.Meta.isCleared('meadow'),
      infBtn: !document.getElementById('btn-go-infinity').classList.contains('hidden'),
      saved: !!PH.Meta.save.cleared.meadow
    })""")
    ev("document.getElementById('go-title').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'103-map-cleared-{TAG}.png')

    # 6) title shows unlocked infinity
    tap('#btn-menu'); pg.wait_for_timeout(500)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    R['title_unlocked'] = ev("""({
      map: document.getElementById('title-map').innerText,
      clear: document.getElementById('title-clear').innerText.replace(/\\s+/g,' ').trim(),
      infBtn: !document.getElementById('btn-infinity').classList.contains('hidden'),
      mapbest: document.getElementById('title-mapbest').innerText
    })""")
    pg.screenshot(path=OUT + f'100-map-select-infinity-unlocked-{TAG}.png')

    # 7) play infinity, HUD, separate high score
    tap('#btn-infinity'); pg.wait_for_timeout(1000)
    R['infinity_start'] = ev("({state:PH.state, round:PH.round, infinity:PH.infinity, fromCkpt:PH.fromCkpt, score:PH.score})")
    ev("PH.jumpRound(12)"); pg.wait_for_timeout(800)
    R['infinity_hud'] = ev("({round:PH.round, infinity:PH.infinity})")
    pg.screenshot(path=OUT + f'101-infinity-play-{TAG}.png')
    ev("PH.setScore(88800); AD_CONFIG.interstitialSeconds=1; AD_CONFIG.rewardedSeconds=1")
    ev("PH.forceDie()")
    pg.wait_for_function("!document.getElementById('ov-continue').classList.contains('hidden') || !document.getElementById('ov-ad').classList.contains('hidden') || !document.getElementById('ov-name').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    if vis('#ov-continue'):
        tap('#btn-norevive'); pg.wait_for_timeout(400)
    if vis('#ov-ad'):
        close_ad(earned=False)
    if vis('#ov-name'):
        ev("document.getElementById('name-input').value='InfHunter'")
        tap('#btn-name-ok'); pg.wait_for_timeout(500)
    R['infinity_over'] = ev("""({
      note: document.getElementById('go-unranked').innerText,
      bestLabel: document.getElementById('go-bestl').innerText,
      infBest: PH.Meta.save.bestInfinityByMap.meadow||0,
      classicBest: PH.Meta.save.bestByMap.meadow||0,
      boardHasInf: !!(JSON.parse(localStorage.getItem('pixelhunt.board.v1')||'{}')['meadow:inf']),
      fromCkpt: (window.lastRun?null:null)
    })""")

    # 8) leaderboard infinity tab
    tap('#btn-go-board'); pg.wait_for_timeout(600)
    R['board'] = ev("""({
      src: document.getElementById('board-src').innerText,
      modes: document.getElementById('board-modes').innerText.replace(/\\n/g,' | ')
    })""")
    pg.screenshot(path=OUT + f'102-infinity-leaderboard-{TAG}.png')
    ev("document.getElementById('btn-board-close').click()"); pg.wait_for_timeout(300)

    # 9) v3 migration: a v2 save that already reached round 30 is granted the clear.
    # Fresh context + init script so the in-memory game cannot persist over the seeded save.
    c2 = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg2 = c2.new_page(); merr = []
    pg2.on('pageerror', lambda e: merr.append(str(e)))
    seed = {
        'v': 2, 'bank': 5000, 'lv': {},
        'stats': {'runs': 3, 'kills': 40, 'gold': 0, 'deer': 0, 'perfect': 0, 'multi': 0, 'bestRound': 32, 'bestStreak': 4, 'shots': 80, 'hits': 40, 'earned': 2000, 'bosses': 3, 'turretKills': 0},
        'missions': [], 'mDone': 0, 'ach': {}, 'daily': {'last': None, 'day': -1}, 'ads': {'date': None, 'doubles': 0},
        'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'cross': 'white', 'map': 'meadow'},
        'cosm': ['classic', 'white'], 'bestByMap': {'meadow': 88000}, 'roundByMap': {'meadow': 32, 'lake': 8}, 'ckpt': {'meadow': 35},
    }
    pg2.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps(seed)))
    pg2.goto(URL, wait_until='networkidle'); pg2.wait_for_timeout(900)
    if not pg2.evaluate("document.getElementById('ov-daily').classList.contains('hidden')"):
        pg2.evaluate("document.getElementById('ov-daily').classList.add('hidden')")
    R['migration'] = pg2.evaluate("""({
      v: PH.Meta.save.v,
      meadowCleared: !!PH.Meta.save.cleared.meadow,
      lakeCleared: !!PH.Meta.save.cleared.lake,
      ckptClamped: PH.Meta.save.ckpt.meadow,
      hasInfBest: PH.Meta.save.bestInfinityByMap && typeof PH.Meta.save.bestInfinityByMap==='object',
      infBtn: !document.getElementById('btn-infinity').classList.contains('hidden'),
      bank: PH.Meta.save.bank,
      best: PH.Meta.save.bestByMap.meadow
    })""")
    errs.extend(merr)
    c2.close()

    for k,v in R.items():
        print(f'{k:22}', json.dumps(v))
    print('errors', errs)
    fails = []
    if R['prices']['handgun_at_req'] != 9000: fails.append('handgun price')
    if R['prices']['laser_at_req'] != 96000: fails.append('laser price')
    if R['title_locked']['infBtn']: fails.append('infinity unlocked too early')
    if R['no_shop_between_rounds']['shop']: fails.append('shop opened between rounds')
    if not R['revive_keeps_round']: fails.append('revive did not keep round/score/clear X')
    if not (R['revived_run_ranked'].get('name') or 'NOT RANKED' not in (R['revived_run_ranked'].get('unranked') or '')):
        # name entry should appear for a ranked revived run with score 12400
        if not R['revived_run_ranked'].get('name'): fails.append('revived run not offered name/rank')
    if not R['cleared']['clearedFlag'] or R['cleared']['title'] != 'MAP CLEARED!': fails.append('map clear')
    if not R['title_unlocked']['infBtn']: fails.append('infinity button hidden after clear')
    if not R['infinity_start']['infinity'] or R['infinity_start']['round'] != 1: fails.append('infinity start')
    if not R['infinity_over'].get('boardHasInf') and (R['infinity_over'].get('infBest') or 0) <= 0: fails.append('infinity high score not saved')
    if not R['migration']['meadowCleared']: fails.append('migration did not grant meadow clear')
    if R['migration'].get('lakeCleared'): fails.append('migration granted lake clear without round 30')
    if R['migration'].get('ckptClamped') != 30: fails.append('ckpt not clamped to 30, got %r' % R['migration'].get('ckptClamped'))
    if R['migration'].get('best') != 88000: fails.append('migration overwrote classic best, got %r' % R['migration'].get('best'))
    if errs: fails.append('js errors: ' + '; '.join(errs))
    print('FAILS', fails)
    b.close()
    if fails: raise SystemExit(1)
