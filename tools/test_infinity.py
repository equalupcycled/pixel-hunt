# Prices, ad-continue (same round + score), map clear, infinity mode.
# usage: python3 tools/test_infinity.py URL TAG
import sys, json
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]
OUT = '/workspace/pixel-hunt/screenshots/'
def end_after_shift(pg, ev, vis, tap):
    # Since 1.0.5 a cleared map auto-continues into the next map; end the run there to reach the game-over screen.
    pg.wait_for_function("PH.state==='intro' || PH.state==='play' || PH.state==='over' || !document.getElementById('ov-over').classList.contains('hidden')", timeout=12000)
    if ev("PH.state==='intro' || PH.state==='play'"):
        ev("PH.forceDie()")
        pg.wait_for_function("!document.getElementById('ov-continue').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden') || !document.getElementById('ov-name').classList.contains('hidden')", timeout=10000)
        if vis('#ov-continue'): tap('#btn-norevive')
    pg.wait_for_timeout(1500)
    if vis('#ov-ad'):  # placeholder interstitial: wait out the countdown, then close it like a player
        pg.wait_for_function("!document.querySelector('#ov-ad .ad-close').disabled", timeout=12000); pg.click('#ov-ad .ad-close')
    print('AFTER_SHIFT', ev("({state: PH.state, map: PH.Meta.save.equip.map, ov: [...document.querySelectorAll('.overlay:not(.hidden)')].map(e => e.id)})"))

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
      // costs as a fresh save (0 upgrades) and at the unlock thresholds
      const at = (t, total) => ECON.cost(t, 0, total);
      return {
        handgun_at_req: at(hg, hg.req),
        laser_at_req: at(ls, ls.req),
        mapTracks: ECON.TRACKS.filter(t=>t.group==='map'||(t.id||'').startsWith('map.')).length,
        totalLevels: ECON.TOTAL_LEVELS,
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
    pg.wait_for_function("PH.state==='clear' || PH.state==='over' || PH.state==='mapshift'", timeout=5000)
    pg.wait_for_timeout(400)
    R['clear_banner'] = ev("({state:PH.state})")
    # wait for victory overlay (clearT 3.2s + maybe name entry)
    end_after_shift(pg, ev, vis, tap)
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
    if 'MEADOW' not in ev("document.getElementById('title-map').innerText"): tap('#btn-map-prev'); pg.wait_for_timeout(300)  # run auto-continued to Lake
    R['title_unlocked'] = ev("""({
      map: document.getElementById('title-map').innerText,
      clear: document.getElementById('title-clear').innerText.replace(/\\s+/g,' ').trim(),
      infBtn: !document.getElementById('btn-infinity').classList.contains('hidden'),
      mapbest: document.getElementById('title-mapbest').innerText
    })""")
    pg.screenshot(path=OUT + f'100-map-select-infinity-unlocked-{TAG}.png')
    ev("document.getElementById('btn-armory').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'104-title-upgrades-{TAG}.png')
    R['title_upgrades_label'] = ev("document.getElementById('btn-armory').innerText.trim()")

    # 6b) Classic vs Infinity Upgrades shop from title (map already cleared)
    tap('#btn-armory'); pg.wait_for_timeout(500)
    R['shop_classic'] = ev("""({
      title: (document.querySelector('#ov-shop h2')||{}).innerText,
      sub: document.getElementById('shop-sub').innerText,
      money: document.getElementById('shop-money').innerText,
      modes: document.getElementById('shop-modes').innerText.replace(/\\s+/g,' ').trim(),
      modesVis: !document.getElementById('shop-modes').classList.contains('hidden'),
      mapsVis: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
      btn: document.getElementById('btn-armory') ? document.getElementById('btn-armory').innerText : ''
    })""")
    pg.screenshot(path=OUT + f'105-upgrades-classic-{TAG}.png')
    ev("document.getElementById('btn-next').click()"); pg.wait_for_timeout(300)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    tap('#btn-infinity'); pg.wait_for_timeout(400)
    R['infinity_lobby'] = ev("""({
      lobby: !document.getElementById('ov-infinity').classList.contains('hidden'),
      titleHidden: document.getElementById('ov-title').classList.contains('hidden'),
      bank: document.getElementById('inf-bank').innerText,
      best: document.getElementById('inf-best').innerText,
      play: !!document.getElementById('btn-inf-play')
    })""")
    tap('#btn-inf-shop'); pg.wait_for_timeout(400)
    R['shop_infinity_from_title'] = ev("""({
      sub: document.getElementById('shop-sub').innerText,
      title: (document.getElementById('shop-title')||{}).innerText||'',
      money: document.getElementById('shop-money').innerText,
      mapsVis: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
      styleVis: !document.querySelector('#shop-tabs button[data-tab="style"]').classList.contains('hidden'),
      modesVis: !document.getElementById('shop-modes').classList.contains('hidden'),
      note: (document.querySelector('#shop-list .note')||{}).textContent||'',
      anyMax: [...document.querySelectorAll('#shop-list .pbtn')].some(b=>b.textContent.trim()==='MAX'),
      lvSample: (document.querySelector('#shop-list .lvl')||{}).textContent||''
    })""")
    ev("document.getElementById('ov-shop').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'106-upgrades-infinity-{TAG}.png')
    ev("document.getElementById('btn-next').click()"); pg.wait_for_timeout(300)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")

    # 7) play infinity from its own lobby, HUD, separate high score
    if vis('#ov-title') and not vis('#ov-infinity'):
        if not vis('#btn-infinity'): tap('#btn-map-prev'); pg.wait_for_timeout(300)  # the run auto-continued to Lake; Meadow holds the Infinity mode
        tap('#btn-infinity'); pg.wait_for_timeout(300)
    tap('#btn-inf-play'); pg.wait_for_timeout(1000)
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
      best: PH.Meta.save.bestByMap.meadow,
      infBank: PH.Meta.save.infBank,
      infPrimary: (PH.Meta.save.infEquip||{}).primary,
      infLvCap: PH.Meta.save.infLv && PH.Meta.save.infLv['shotgun.cap'] || 0,
      infBought: Object.values(PH.Meta.save.infLv||{}).reduce((a,b)=>a+b,0),
      autoBoostUntil: PH.Meta.save.autoBoostUntil
    })""")
    errs.extend(merr)
    c2.close()

    # 10) Infinity progression is isolated from Classic; uncapped levels; safe v9 defaults (perks start at 0, autoBoostUntil 0, dmg tracks at 0)
    c3 = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg3 = c3.new_page(); e3 = []
    pg3.on('pageerror', lambda e: e3.append(str(e)))
    pg3.goto(URL, wait_until='networkidle'); pg3.wait_for_timeout(800)
    ev3 = pg3.evaluate
    def vis3(s):
        return ev3(f"!document.querySelector('{s}').classList.contains('hidden')")
    if vis3('#ov-daily'): ev3("document.getElementById('ov-daily').classList.add('hidden')")
    ev3("""(()=>{
      PH.grantAll();
      PH.Meta.save.bank = 77777;
      PH.Meta.save.equip.primary = 'laser';
      PH.Meta.save.cleared.meadow = 'test';
      PH.Meta.save.lv['shotgun.cap'] = PH.Meta.save.lv['shotgun.cap'] || 3;
      PH.Meta.persist();
    })()""")
    ev3("PH.toTitle()"); pg3.wait_for_timeout(400)
    if vis3('#ov-daily'): ev3("document.getElementById('ov-daily').classList.add('hidden')")
    snap = ev3("""({
      bank: PH.Meta.save.bank,
      cap: PH.Meta.save.lv['shotgun.cap'],
      primary: PH.Meta.save.equip.primary,
      infBank: PH.Meta.save.infBank,
      infPrimary: PH.Meta.save.infEquip.primary
    })""")
    ev3("document.getElementById('btn-infinity').click()"); pg3.wait_for_timeout(400)
    ev3("document.getElementById('btn-inf-play').click()"); pg3.wait_for_timeout(900)
    R['inf_start_gear'] = ev3("""({
      infinity: PH.infinity,
      mode: PH.Meta.mode,
      bank: PH.Meta.bank(),
      infBank: PH.Meta.save.infBank,
      campaignBank: PH.Meta.save.bank,
      campaignCap: PH.Meta.save.lv['shotgun.cap'],
      campaignPrimary: PH.Meta.save.equip.primary,
      infPrimary: PH.Meta.activeEquip().primary,
      infSecondary: PH.Meta.activeEquip().secondary,
      infTurrets: (PH.Meta.activeEquip().turrets||[]).length,
      infCap: PH.Meta.levelOf('shotgun.cap'),
      moneyHud: PH.money
    })""")
    ev3("AD_CONFIG.interstitialSeconds=1; AD_CONFIG.rewardedSeconds=1; PH.forceDie()")
    pg3.wait_for_function("!document.getElementById('ov-continue').classList.contains('hidden') || !document.getElementById('ov-ad').classList.contains('hidden') || !document.getElementById('ov-name').classList.contains('hidden') || !document.getElementById('ov-over').classList.contains('hidden')", timeout=8000)
    if vis3('#ov-continue'): ev3("document.getElementById('btn-norevive').click()"); pg3.wait_for_timeout(400)
    if vis3('#ov-ad'):
        pg3.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()", timeout=8000)
        r = ev3("(()=>{const e=document.querySelector('.ad-close');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
        pg3.touchscreen.tap(*r); pg3.wait_for_timeout(600)
    if vis3('#ov-name'): ev3("document.getElementById('btn-name-skip') && document.getElementById('btn-name-skip').click() || document.getElementById('ov-name').classList.add('hidden')")
    ev3("document.getElementById('btn-go-shop').click()"); pg3.wait_for_timeout(500)
    cap_id = ev3("ECON.TRACKS.find(t=>t.id==='shotgun.cap').val.length-1")
    ev3("""(()=>{
      PH.Meta.setMode('infinity');
      PH.Meta.setBank(5000000);
      PH.Meta.persist();
      let n=0;
      while (PH.Meta.levelOf('shotgun.cap') <= ECON.TRACKS.find(t=>t.id==='shotgun.cap').val.length-1 && n<40) {
        if (!PH.Meta.buy('shotgun.cap')) break;
        n++;
      }
    })()""")
    ev3("document.getElementById('btn-next').click()"); pg3.wait_for_timeout(200)
    ev3("document.getElementById('btn-go-shop').click()"); pg3.wait_for_timeout(400)
    R['inf_uncapped'] = ev3("""(()=>{
      const capTrack = ECON.TRACKS.find(t=>t.id==='shotgun.cap');
      const item = [...document.querySelectorAll('#shop-list .item')].find(el => /BARREL/.test(el.innerText));
      const lv = item ? (item.querySelector('.lvl')||{}).textContent : '';
      const btns = item ? [...item.querySelectorAll('.pbtn')].map(b=>b.textContent.trim()) : [];
      return {
        sub: document.getElementById('shop-sub').innerText,
        goShop: document.getElementById('btn-go-shop').innerText.trim(),
        mapsVis: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
        level: PH.Meta.levelOf('shotgun.cap'),
        cap: capTrack.val.length-1,
        maxed: PH.Meta.maxed(capTrack),
        lvText: lv,
        btns,
        anyMax: [...document.querySelectorAll('#shop-list .pbtn')].some(b=>b.textContent.trim()==='MAX'),
        campaignCap: PH.Meta.save.lv['shotgun.cap'],
        campaignBank: PH.Meta.save.bank,
        infBank: PH.Meta.save.infBank,
        classicOnToggle: null
      };
    })()""")
    R['toggle_classic'] = ev3("""({
      sub: document.getElementById('shop-sub').innerText,
      money: document.getElementById('shop-money').innerText.replace(/[^0-9]/g,''),
      mode: PH.Meta.mode,
      bank: PH.Meta.bank(),
      campaignBank: PH.Meta.save.bank,
      mapsVis: !!document.querySelector('#shop-tabs button[data-tab="maps"]'),
      modesVis: !document.getElementById('shop-modes').classList.contains('hidden')
    })""")
    R['toggle_inf'] = ev3("""({
      sub: document.getElementById('shop-sub').innerText,
      mode: PH.Meta.mode,
      bank: PH.Meta.bank(),
      campaignBank: PH.Meta.save.bank,
      modesVis: !document.getElementById('shop-modes').classList.contains('hidden')
    })""")
    ev3("document.querySelector('#ov-shop').scrollIntoView({block:'center'})")
    pg3.screenshot(path=OUT + f'106-upgrades-infinity-uncapped-{TAG}.png')
    R['inf_start_gear']['before'] = snap
    errs.extend(e3)
    c3.close()

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
    if not R['cleared']['clearedFlag'] or R['cleared']['title'] not in ('MAP CLEARED!', 'GAME OVER'): fails.append('map clear')
    if not R['title_unlocked']['infBtn']: fails.append('infinity button hidden after clear')
    if not R['infinity_start']['infinity'] or R['infinity_start']['round'] != 1: fails.append('infinity start')
    if not R['infinity_over'].get('boardHasInf') and (R['infinity_over'].get('infBest') or 0) <= 0: fails.append('infinity high score not saved')
    if not R['migration']['meadowCleared']: fails.append('migration did not grant meadow clear')
    if R['migration'].get('lakeCleared'): fails.append('migration granted lake clear without round 30')
    if R['migration'].get('ckptClamped') != 30: fails.append('ckpt not clamped to 30, got %r' % R['migration'].get('ckptClamped'))
    if R['migration'].get('best') != 88000: fails.append('migration overwrote classic best, got %r' % R['migration'].get('best'))
    if R['migration'].get('v') != 10: fails.append('migration schema not v10, got %r' % R['migration'].get('v'))
    if R['migration'].get('autoBoostUntil') not in (0, None): fails.append('migration should start autoBoostUntil at 0, got %r' % R['migration'].get('autoBoostUntil'))
    if R['migration'].get('infBank') not in (0, None): fails.append('migration should start Infinity wallet at 0, got %r' % R['migration'].get('infBank'))
    if R['migration'].get('infPrimary') not in ('shotgun', None) or R['migration'].get('infBought') not in (0, None):
        fails.append('migration should start Infinity at free shotgun, got %r' % {k: R['migration'].get(k) for k in ('infPrimary','infBought','infLvCap')})
    if R.get('title_upgrades_label') != 'UPGRADES': fails.append('title button is not UPGRADES, got %r' % R.get('title_upgrades_label'))
    if R.get('shop_classic') and 'CLASSIC' not in (R['shop_classic'].get('sub') or ''): fails.append('classic shop not labeled, %r' % R.get('shop_classic'))
    if R.get('shop_classic') and R['shop_classic'].get('mapsVis'): fails.append('classic shop still has a MAPS tab, %r' % R.get('shop_classic'))
    if R.get('prices', {}).get('mapTracks'): fails.append('map tracks still purchasable, %r' % R.get('prices'))
    if R.get('prices', {}).get('totalLevels') not in (329, None): fails.append('TOTAL_LEVELS expected 329, %r' % R.get('prices'))
    if R.get('shop_infinity_from_title'):
        s = R['shop_infinity_from_title']
        if 'INFINITY' not in (s.get('sub') or ''): fails.append('infinity shop not labeled, %r' % s)
        if s.get('mapsVis') or s.get('styleVis'): fails.append('infinity shop showed maps/style tabs, %r' % s)
        if '/' in (s.get('lvSample') or '') and 'MAX' in (s.get('lvSample') or ''): fails.append('infinity lv label looks capped, %r' % s.get('lvSample'))
    g = R.get('inf_start_gear') or {}
    if not g.get('infinity'): fails.append('did not enter infinity for isolation test')
    if g.get('infPrimary') != 'shotgun' or g.get('infSecondary') or g.get('infTurrets') or g.get('infCap') not in (0, None):
        fails.append('infinity did not start on free shotgun, %r' % g)
    if g.get('campaignPrimary') != 'laser' or g.get('campaignCap') != (g.get('before') or {}).get('cap'):
        fails.append('entering infinity mutated campaign loadout, %r' % g)
    if (g.get('campaignBank') or 0) < 77777:
        fails.append('entering infinity spent campaign money, %r' % g)
    if g.get('bank') not in (0,):
        fails.append('infinity wallet should start at 0, %r' % g)
    u = R.get('inf_uncapped') or {}
    if not u or u.get('level', 0) <= u.get('cap', 99) or u.get('maxed'):
        fails.append('could not buy past classic cap, %r' % u)
    if not (u.get('lvText') or '').startswith('LV ') or '/' in (u.get('lvText') or '') or 'MAX' in (u.get('lvText') or ''):
        fails.append('infinity UI should show uncapped LV N, %r' % u)
    if 'MAX' in (u.get('btns') or []):
        fails.append('infinity buy button says MAX past cap, %r' % u)
    if u.get('campaignCap') != g.get('campaignCap') or u.get('campaignBank') != g.get('campaignBank'):
        fails.append('infinity buy mutated campaign, %r' % (u, g.get('campaignBank'), g.get('campaignCap')))
    tc = R.get('toggle_classic') or {}
    if tc.get('mapsVis'): fails.append('classic shop still has a MAPS tab, %r' % tc)
    if tc.get('modesVis') or (R.get('toggle_inf') or {}).get('modesVis'):
        fails.append('shop mode toggle should be hidden on dedicated shops, %r' % tc)
    ti = R.get('toggle_inf') or {}
    if ti.get('mode') != 'infinity' or ti.get('campaignBank') != g.get('campaignBank'):
        fails.append('infinity shop mixed wallets, %r' % ti)
    if R.get('infinity_lobby') and not R['infinity_lobby'].get('lobby'):
        fails.append('infinity button did not open lobby, %r' % R.get('infinity_lobby'))
    s = R.get('shop_infinity_from_title') or {}
    if s.get('modesVis'): fails.append('infinity shop showed classic/infinity toggle, %r' % s)
    if errs: fails.append('js errors: ' + '; '.join(errs))
    print('FAILS', fails)
    b.close()
    if fails: raise SystemExit(1)
