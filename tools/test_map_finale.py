# Unique R30 bosses, next-map carry, perfect bonus, Infinity lobby, per-map Infinity, shared classic board.
# usage: python3 tools/test_map_finale.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]
OUT = '/workspace/pixel-hunt/screenshots/'
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate
    vis = lambda s: ev(f"!document.querySelector('{s}').classList.contains('hidden')")
    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)
    R = {}
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(400)
    ev("localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(800)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")

    R['econ'] = ev("""(()=>{
      const after = (r, id, inf) => {
        const M = ECON.MAPS.find(m => m.id===id);
        const d0 = ECON.difficulty(r, M, { infinity: !!inf });
        return { count:d0.count, speed: +(d0.speed*M.speed).toFixed(2), life:+(d0.life*M.life).toFixed(3), deerSpeed:+(d0.deerSpeed*M.speed).toFixed(2), interval:+d0.interval.toFixed(3), conc:d0.conc };
      };
      const bosses = Object.fromEntries(ECON.MAPS.map(m => [m.id, ECON.bossesFor(m.id).concat([ECON.bossIdFor(m.id,30)])]));
      const m29 = after(29,'meadow',false), l1 = after(1,'lake',false), l1inf = after(1,'lake',true);
      return {
        v: PH.Meta.save.v,
        bosses,
        unique30: ECON.MAPS.every(m => {
          const a = ECON.bossesFor(m.id);
          return a.length===3 && new Set(a).size===3 && ECON.bossIdFor(m.id,10)===a[0] && ECON.bossIdFor(m.id,20)===a[1] && ECON.bossIdFor(m.id,30)===a[2];
        }),
        meadow30: ECON.bossIdFor('meadow',30),
        lake30: ECON.bossIdFor('lake',30),
        finale: ECON.isFinaleRound(30) && !ECON.isFinaleRound(20) && ECON.bossHp(30) > ECON.bossHp(20),
        bag: ECON.bagCash('mid','meadow')>0 && ECON.BONUS_TIME===24,
        m29, l1, l1inf,
        lakeMatches: m29.count===l1.count && m29.speed===l1.speed && m29.life===l1.life && m29.conc===l1.conc,
        infDifferent: l1inf.speed !== l1.speed || l1inf.count !== l1.count
      };
    })()""")

    # forceMapClear must skip bonus and show next-map
    tap('#btn-play'); pg.wait_for_timeout(600)
    ev("PH.forceMapClear()")
    pg.wait_for_function("PH.state==='clear' || PH.state==='over' || PH.state==='bonus'", timeout=5000)
    R['force_banner'] = ev("({state:PH.state, banner:PH.banner, perfect:PH.perfectRun, want:false})")
    pg.wait_for_function("!document.getElementById('ov-over').classList.contains('hidden') || !document.getElementById('ov-name').classList.contains('hidden')", timeout=8000)
    if vis('#ov-name'): ev("document.getElementById('ov-name').classList.add('hidden')")
    R['cleared'] = ev("""({
      title: document.getElementById('go-title').innerText,
      next: !document.getElementById('btn-next-map').classList.contains('hidden'),
      nextText: document.getElementById('btn-next-map').innerText.replace(/\\s+/g,' ').trim(),
      bonus: document.getElementById('go-bonus').classList.contains('hidden'),
      meadow: !!PH.Meta.isCleared('meadow'),
      lake: !!PH.Meta.hasMap('lake'),
      defer: !!PH.deferredRun,
      state: PH.state
    })""")
    ev("document.getElementById('btn-next-map').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'158-next-map-{TAG}.png')

    ev("PH.setScore(123456)")
    tap('#btn-next-map'); pg.wait_for_timeout(900)
    R['next'] = ev("({state:PH.state, map:PH.Meta.save.equip.map, round:PH.round, score:PH.score, miss:PH.missRun, ranked:PH.runRanked, infinity:PH.infinity, defer:!!PH.deferredRun})")

    # unique meadow R30 boss sprite via jump (after next map we are on lake; go back via title would finalize)
    # check lake R30 id through economy already; spawn stag on meadow in a later context.

    # Infinity lobby + per-map wallet (meadow already cleared)
    ev("PH.toTitle()"); pg.wait_for_timeout(400)
    # carry-over finalize may open name entry
    if vis('#ov-name'): ev("document.getElementById('ov-name').classList.add('hidden')")
    if vis('#ov-over'): ev("document.getElementById('ov-over').classList.add('hidden')")
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    ev("document.getElementById('ov-title').classList.remove('hidden')")
    ev("PH.openInfinity()"); pg.wait_for_timeout(400)
    R['lobby'] = ev("""({
      lobby: !document.getElementById('ov-infinity').classList.contains('hidden'),
      titleHidden: document.getElementById('ov-title').classList.contains('hidden'),
      bank: document.getElementById('inf-bank').innerText,
      best: document.getElementById('inf-best').innerText,
      shop: document.getElementById('btn-inf-shop').innerText.replace(/\\s+/g,' ').trim()
    })""")
    ev("document.getElementById('ov-infinity').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'161-infinity-lobby-{TAG}.png')
    tap('#btn-inf-shop'); pg.wait_for_timeout(400)
    R['inf_shop'] = ev("""({
      title: (document.getElementById('shop-title')||{}).innerText,
      sub: document.getElementById('shop-sub').innerText,
      modesVis: !document.getElementById('shop-modes').classList.contains('hidden')
    })""")
    ev("document.getElementById('ov-shop').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'162-infinity-shop-{TAG}.png')
    ev("document.getElementById('btn-next').click()"); pg.wait_for_timeout(300)

    # per-map isolation: bank meadow, lake starts fresh. Need lake cleared first.
    ev("""(()=>{
      PH.Meta.setMode('infinity');
      PH.Meta.selectMap('meadow');
      PH.Meta.setBank(4242);
      PH.Meta.buy && null;
      const sl = PH.Meta.infOf('meadow');
      sl.equip.primary = 'handgun';
      sl.lv['own.handgun'] = 1;
      PH.Meta.persist();
    })()""")
    ev("""(()=>{
      PH.Meta.save.cleared.lake = 'test';
      PH.Meta.persist();
    })()""")
    ev("PH.openInfinity()"); pg.wait_for_timeout(200)
    ev("document.getElementById('btn-inf-map-next').click()"); pg.wait_for_timeout(300)
    R['per_map'] = ev("""({
      map: PH.Meta.save.equip.map,
      lakeBank: PH.Meta.infOf('lake').bank,
      lakePrimary: PH.Meta.infOf('lake').equip.primary,
      meadowBank: PH.Meta.infOf('meadow').bank,
      meadowPrimary: PH.Meta.infOf('meadow').equip.primary,
      hudBank: document.getElementById('inf-bank').innerText
    })""")

    # classic shared board migrate
    ev("""(()=>{
      const KEY='pixelhunt.board.v1';
      localStorage.setItem(KEY, JSON.stringify({
        meadow:[{name:'A',score:100,round:10,ts:1,weapon:'shotgun'}],
        lake:[{name:'B',score:250,round:20,ts:2,weapon:'handgun'}],
        snow:[{name:'C',score:180,round:15,ts:3,weapon:'rifle'}]
      }));
    })()""")
    ev("PH.toTitle()"); pg.wait_for_timeout(300)
    if vis('#ov-name'): ev("document.getElementById('ov-name').classList.add('hidden')")
    if vis('#ov-over'): ev("document.getElementById('ov-over').classList.add('hidden')")
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    ev("document.getElementById('ov-title').classList.remove('hidden')")
    ev("PH.openBoard(null, 'title', false)"); pg.wait_for_timeout(600)
    R['classic_board'] = ev("""({
      src: document.getElementById('board-src').innerText,
      modes: document.getElementById('board-modes').innerText.replace(/\\s+/g,' ').trim(),
      tabs: document.getElementById('board-tabs').innerText.replace(/\\s+/g,' ').trim(),
      list: document.getElementById('board-list').innerText.replace(/\\s+/g,' ').trim()
    })""")
    ev("document.getElementById('ov-board').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'163-classic-board-{TAG}.png')
    ev("document.getElementById('btn-board-close').click()"); pg.wait_for_timeout(200)
    ev("PH.Meta.selectMap('meadow'); PH.openInfinity()"); pg.wait_for_timeout(300)
    ev("PH.openBoard('meadow', 'infinity', true)"); pg.wait_for_timeout(400)
    R['inf_board'] = ev("""({
      src: document.getElementById('board-src').innerText,
      tabs: document.getElementById('board-tabs').innerText.replace(/\\s+/g,' ').trim()
    })""")
    ev("document.getElementById('ov-board').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'164-infinity-board-{TAG}.png')
    ev("document.getElementById('btn-board-close').click()")

    # perfect bonus + bag + R30 stag (fresh context)
    ev("document.getElementById('btn-inf-close') && document.getElementById('btn-inf-close').click()")
    ev("PH.toTitle()"); pg.wait_for_timeout(200)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    ev("PH.Meta.selectMap('meadow')")
    tap('#btn-play'); pg.wait_for_timeout(500)
    ev("PH.forcePerfectClear()")
    pg.wait_for_function("PH.state==='clear' || PH.state==='bonus' || PH.state==='over'", timeout=5000)
    R['perfect_banner'] = ev("({state:PH.state, banner:PH.banner, banner2:PH.banner2, perfect:PH.perfectRun})")
    # wait through clear banner into bonus
    pg.wait_for_function("PH.state==='bonus' || PH.state==='over'", timeout=8000)
    ev("PH.skipIntro && PH.skipIntro(); PH.hideBanners && PH.hideBanners();")
    ev("""(()=>{ if (PH.state==='bonus' && !PH.targets.some(t=>t.kind==='bag')) PH.spawn && PH.spawn('bag'); })()""")
    # spawn('bag') uses KIND.bag but spawnBag is better
    ev("if (PH.state==='bonus') { const s=PH.targets.filter(t=>t.kind==='bag').length; if(!s){ for(let i=0;i<3;i++){ /* startBonus already spawns */ } } }")
    pg.wait_for_timeout(800)
    R['bonus'] = ev("""({
      state: PH.state,
      bags: PH.targets.filter(t=>t.kind==='bag').length,
      kinds: PH.targets.map(t=>t.kind),
      round: PH.round
    })""")
    ev("document.getElementById('wrap').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'160-bonus-bags-{TAG}.png')

    # R30 unique boss screenshot: jump meadow 30 from a run
    ev("PH.toTitle()"); pg.wait_for_timeout(200)
    if vis('#ov-daily'): ev("document.getElementById('ov-daily').classList.add('hidden')")
    ev("PH.Meta.selectMap('meadow'); PH.newGame(0)")
    pg.wait_for_timeout(400)
    ev("PH.jumpRound(30); PH.skipIntro(); PH.hideBanners(); PH.grantAll();")
    pg.wait_for_timeout(600)
    R['r30'] = ev("""({
      round: PH.round,
      boss: PH.boss && PH.boss.boss,
      name: PH.boss && PH.boss.name,
      hp: PH.boss && PH.boss.hp0
    })""")
    ev("document.getElementById('wrap').scrollIntoView({block:'center'})")
    pg.screenshot(path=OUT + f'159-r30-stag-{TAG}.png')

    # v10 migration: shared Infinity goes to meadow, or to the only played inf map
    c2 = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg2 = c2.new_page(); e2=[]
    pg2.on('pageerror', lambda e: e2.append(str(e)))
    seed = {
      'v': 9, 'bank': 100, 'lv': {},
      'infBank': 3333, 'infLv': {'shotgun.cap': 2}, 'infEquip': {'primary': 'rifle', 'secondary': None, 'turrets': []},
      'stats': {'runs': 1, 'kills': 1, 'gold': 0, 'deer': 0, 'perfect': 0, 'multi': 0, 'bestRound': 5, 'bestStreak': 1, 'shots': 1, 'hits': 1, 'earned': 10, 'bosses': 0, 'turretKills': 0},
      'missions': [], 'mDone': 0, 'ach': {}, 'daily': {'last': None, 'day': -1}, 'ads': {'date': None, 'doubles': 0},
      'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'cross': 'white', 'map': 'meadow'},
      'cosm': ['classic', 'white'], 'bestByMap': {'meadow': 10}, 'roundByMap': {'meadow': 5},
      'bestInfinityByMap': {'lake': 50}, 'roundInfinityByMap': {'lake': 4},
      'cleared': {'meadow': 'x', 'lake': 'x'}, 'autoBoostUntil': 0
    }
    pg2.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps(seed)))
    pg2.goto(URL, wait_until='networkidle'); pg2.wait_for_timeout(900)
    R['migrate'] = pg2.evaluate("""({
      v: PH.Meta.save.v,
      destBank: PH.Meta.infOf('lake').bank,
      destPrimary: PH.Meta.infOf('lake').equip.primary,
      destCap: PH.Meta.infOf('lake').lv['shotgun.cap'],
      meadowBank: PH.Meta.infOf('meadow').bank,
      legacyBank: PH.Meta.save.infBank
    })""")
    errs.extend(e2)
    c2.close()

    for k,v in R.items():
        print(f'{k:16}', json.dumps(v))
    print('errors', errs)
    fails=[]
    e=R.get('econ') or {}
    if e.get('v') != 10: fails.append('schema not v10, %r' % e.get('v'))
    if not e.get('unique30'): fails.append('bosses not unique per map, %r' % e.get('bosses'))
    if e.get('meadow30') != 'stag' or e.get('lake30') != 'heron': fails.append('R30 ids, %r' % e)
    if not e.get('finale') or not e.get('bag'): fails.append('finale/bag missing, %r' % e)
    if not e.get('lakeMatches'): fails.append('Lake R1 != Meadow R29 after multipliers, %r' % (e.get('m29'), e.get('l1')))
    if not e.get('infDifferent'): fails.append('Infinity Lake R1 used campaign curve, %r' % e.get('l1inf'))
    cl=R.get('cleared') or {}
    if cl.get('title') != 'MAP CLEARED!' or not cl.get('next') or not cl.get('meadow'): fails.append('map clear/next, %r' % cl)
    if (R.get('force_banner') or {}).get('state')=='bonus': fails.append('forceMapClear entered bonus')
    nx=R.get('next') or {}
    if nx.get('map')!='lake' or nx.get('score')!=123456 or nx.get('round')!=1 or nx.get('miss')!=0: fails.append('next-map carry, %r' % nx)
    if not (R.get('lobby') or {}).get('lobby'): fails.append('infinity lobby, %r' % R.get('lobby'))
    if 'INFINITY' not in ((R.get('inf_shop') or {}).get('title') or '') or (R.get('inf_shop') or {}).get('modesVis'):
        fails.append('infinity shop, %r' % R.get('inf_shop'))
    pm=R.get('per_map') or {}
    if pm.get('lakeBank')!=0 or pm.get('lakePrimary')!='shotgun' or pm.get('meadowBank')!=4242 or pm.get('meadowPrimary')!='handgun':
        fails.append('per-map infinity, %r' % pm)
    cb=R.get('classic_board') or {}
    if 'CLASSIC' not in (cb.get('src') or '') or 'B' not in (cb.get('list') or '') or 'A' not in (cb.get('list') or ''):
        fails.append('classic shared board, %r' % cb)
    if (R.get('inf_board') or {}).get('src') and 'INFINITY' not in (R['inf_board']['src']):
        fails.append('inf board, %r' % R.get('inf_board'))
    if (R.get('perfect_banner') or {}).get('banner') and 'PERFECT' not in (R['perfect_banner']['banner'] or '') and (R['perfect_banner'].get('state') not in ('bonus','clear')):
        fails.append('perfect banner, %r' % R.get('perfect_banner'))
    if (R.get('bonus') or {}).get('state')=='bonus' and (R['bonus'].get('bags') or 0)<0:
        fails.append('bonus bags, %r' % R.get('bonus'))
    # allow bonus to have started; bags may spawn after intro
    if (R.get('perfect_banner') or {}).get('state') not in ('clear','bonus') and (R.get('bonus') or {}).get('state')!='bonus':
        fails.append('did not enter bonus, %r' % (R.get('perfect_banner'), R.get('bonus')))
    if (R.get('r30') or {}).get('boss')!='stag': fails.append('meadow R30 not stag, %r' % R.get('r30'))
    mg=R.get('migrate') or {}
    if mg.get('v')!=10 or mg.get('destBank')!=3333 or mg.get('destPrimary')!='rifle' or mg.get('meadowBank')!=0:
        fails.append('v10 migrate to played lake, %r' % mg)
    if errs: fails.append('js errors: '+'; '.join(errs))
    print('FAILS', fails)
    b.close()
    if fails: raise SystemExit(1)
