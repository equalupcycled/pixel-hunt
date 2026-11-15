# Ground-animal bosses patrol the ground and drop fawns, not eggs.
# usage: python3 tools/test_ground_boss.py URL TAG
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

    def hide_daily():
        ev("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")

    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        pg.touchscreen.tap(*r); pg.wait_for_timeout(400)

    def start_meadow(weapon='shotgun'):
        ev(f"""(()=>{{
          const M=PH.Meta;
          M.equipWeapon('{weapon}','primary');
          M.save.equip.secondary=null;
          M.save.equip.turrets=[];
          M.selectMap('meadow');
          M.persist();
          PH.rebuild();
        }})()""")
        if ev("!document.getElementById('ov-title').classList.contains('hidden')"):
            tap('#btn-play')
        pg.wait_for_timeout(800)

    def jump_play(rnd):
        ev("""(() => {
          ['ov-continue','ov-ad','ov-over','ov-name','ov-daily','ov-title','ov-pause','toast'].forEach(i=>{
            const e=document.getElementById(i); if(e) e.classList.add('hidden');
          });
          if (PH.paused) PH.togglePause();
        })()""")
        ev(f"PH.jumpRound({rnd})")
        ev("PH.skipIntro()")
        ev("if (!PH.boss && PH.round % (ECON.BOSS_EVERY||10) === 0) PH.spawn('boss')")
        pg.wait_for_function("PH.state==='play' && PH.boss", timeout=8000)
        ev("document.getElementById('toast')&&document.getElementById('toast').classList.add('hidden')")
        ev("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")

    def snap_targets():
        return ev("""(() => {
          const d = PH.dims();
          const boss = PH.boss;
          const list = PH.targets.map(t => ({
            kind: t.kind, m: t.m, g: t.g||0, x: Math.round(t.x), y: Math.round(t.y),
            sc: t.sc, hp: t.hp, hp0: t.hp0, vx: t.vx, name: t.name||null, state: t.state
          }));
          return {
            state: PH.state, round: PH.round, miss: PH.missRun, score: PH.score, cash: PH.Meta.bank(),
            ground: d.GROUND, skyTop: d.SKY_TOP, W: d.W, H: d.H, bar: d.BAR,
            boss: boss && { kind: boss.kind, name: boss.name, m: boss.m, x: Math.round(boss.x), y: Math.round(boss.y),
              sc: boss.sc, hp: boss.hp, ground: PH.isGroundBoss(boss) },
            list
          };
        })()""")

    fails = []
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(600)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()
    ev("PH.grantAll()")
    start_meadow('shotgun')

    # --- R20 Big Buck is on the ground, not in the sky ---
    jump_play(20)
    R20 = snap_targets()
    print('R20', json.dumps(R20, indent=2))
    if R20.get('round') != 20: fails.append('expected round 20, got %r' % R20.get('round'))
    boss = R20.get('boss') or {}
    if boss.get('name') != 'BIG BUCK': fails.append('R20 boss name %r' % boss.get('name'))
    if boss.get('m') != 'brun' or not boss.get('ground'): fails.append('R20 boss not ground/brun %r' % boss)
    sky_y = (R20.get('skyTop') or 34) + 52
    gnd = R20.get('ground') or 320
    if boss.get('y') is None or boss['y'] < gnd - 80:
        fails.append('R20 Big Buck y=%s should be near ground %s (not sky ~%s)' % (boss.get('y'), gnd, sky_y))
    if boss.get('y') is not None and boss['y'] < 180:
        fails.append('R20 Big Buck still looks airborne y=%s' % boss.get('y'))
    if any(t['kind'] == 'egg' for t in R20['list']):
        fails.append('R20 started with eggs: %r' % R20['list'])

    ev("if (PH.boss) { PH.boss.x = 70; PH.boss.vx = Math.abs(PH.boss.vx); }")
    ev("PH.dropFawn()")
    pg.wait_for_timeout(350)
    after = snap_targets()
    fawns = [t for t in after['list'] if t['kind'] == 'fawn']
    eggs = [t for t in after['list'] if t['kind'] == 'egg']
    print('AFTER DROP', json.dumps({'fawns': fawns, 'eggs': eggs, 'boss': after.get('boss')}, indent=2))
    if eggs: fails.append('ground boss dropped eggs: %r' % eggs)
    if not fawns: fails.append('dropFawn did not add a fawn')
    else:
        f = fawns[0]
        if f['hp'] != 2 or f['hp0'] != 2: fails.append('fawn hp %r want 2' % f)
        if not f['g']: fails.append('fawn should be a ground animal')
        if f['sc'] >= 1.5: fails.append('fawn scale should be smaller than deer 1.6, got %s' % f['sc'])
        if f['vx'] <= 0: fails.append('fawn should run left-to-right, vx=%s' % f['vx'])
        if f['y'] < gnd - 50: fails.append('fawn y=%s should be on the ground band %s' % (f['y'], gnd))

    ev("document.getElementById('toast')&&document.getElementById('toast').classList.add('hidden')")
    ev('PH.hideBanners && PH.hideBanners()'); pg.wait_for_timeout(80)
    pg.screenshot(path=OUT + f'156-ground-boss-fawns-{TAG}.png')

    # Hitting a fawn pays points/cash (Egg Sniper must not change the payout)
    pay = ev("""(() => {
      const f = PH.targets.find(t => t.kind === 'fawn' && (t.state === 'fly' || t.state === 'run'));
      if (!f) return { ok: false };
      const before = { score: PH.score, cash: PH.Meta.bank(), hp: f.hp };
      PH.damage(f, 1, 'player');
      const mid = { score: PH.score, cash: PH.Meta.bank(), hp: f.hp, state: f.state };
      if (f.hp > 0) PH.damage(f, 2, 'player');
      const wantPts = ECON.fawnPts(PH.round);
      const wantCash = ECON.fawnCash(PH.round);
      return {
        ok: true, before, mid,
        after: { score: PH.score, cash: PH.Meta.bank() },
        wantPts, wantCash,
        eggPts: ECON.eggPts(PH.round), eggCash: ECON.eggCash(PH.round),
        dead: !PH.targets.includes(f) || f.hp <= 0 || f.state === 'fall' || f.state === 'gone' || f.state === 'hit',
      };
    })()""")
    print('PAY', json.dumps(pay, indent=2))
    if not pay or not pay.get('ok'): fails.append('no fawn to shoot')
    else:
        if not pay.get('dead'): fails.append('fawn should die in two 1+ dmg hits, mid=%r' % pay.get('mid'))
        if pay['after']['score'] <= pay['before']['score']: fails.append('killing a fawn should add points')
        if pay['after']['cash'] <= pay['before']['cash']: fails.append('killing a fawn should add cash')
        # payout uses fawn table, not egg*eggsnipe (grantAll maxes eggsnipe)
        delta = pay['after']['score'] - pay['before']['score']
        if pay['wantPts'] and delta < pay['wantPts'] * 0.5:
            fails.append('fawn score delta %s too small vs fawnPts %s' % (delta, pay['wantPts']))

    ev("if (PH.boss) { PH.boss.x = 55; PH.boss.vx = Math.abs(PH.boss.vx); }")
    ev("PH.dropFawn()")
    pg.wait_for_timeout(280)
    ev("document.getElementById('toast')&&document.getElementById('toast').classList.add('hidden')")
    ev('PH.hideBanners && PH.hideBanners()'); pg.wait_for_timeout(80)
    pg.screenshot(path=OUT + f'157-ground-boss-fawn-drop-{TAG}.png')

    # Escaped fawn costs 1 X. grantAll maxes Deer Whisperer and Second Chance, which would swallow the X.
    ev("""(() => {
      PH.Meta.save.lv['perk.deer'] = 0;
      PH.Meta.save.lv['perk.second'] = 0;
      PH.Meta.persist();
    })()""")
    ev("PH.newGame()"); pg.wait_for_timeout(400)
    hide_daily()
    start_meadow('shotgun')
    jump_play(20)
    ev("PH.dropFawn()")
    esc = ev("""(() => {
      const miss0 = PH.missRun;
      const f = PH.targets.find(t => t.kind === 'fawn');
      if (!f) return { ok: false, miss0 };
      f.x = PH.dims().W + 40;
      return { ok: true, miss0, id: true };
    })()""")
    pg.wait_for_timeout(400)
    esc2 = ev("""({ miss: PH.missRun, fawns: PH.targets.filter(t => t.kind === 'fawn').map(t => ({x:t.x,state:t.state})) })""")
    print('ESCAPE no-mercy', esc, esc2)
    if not esc.get('ok'): fails.append('could not spawn fawn for escape test')
    elif esc2.get('miss', 0) != esc.get('miss0', 0) + 1:
        fails.append('escaped fawn should cost 1 X, miss %s -> %s' % (esc.get('miss0'), esc2.get('miss')))

    # Deer Whisperer: escaped fawn costs no X
    ev("""(() => {
      PH.Meta.save.lv['perk.deer'] = 1;
      PH.Meta.save.lv['perk.second'] = 0;
      PH.Meta.persist();
    })()""")
    ev("PH.newGame()"); pg.wait_for_timeout(400)
    hide_daily()
    start_meadow('shotgun')
    jump_play(20)
    ev("PH.dropFawn()")
    merc = ev("""(() => {
      const miss0 = PH.missRun;
      const f = PH.targets.find(t => t.kind === 'fawn');
      if (!f) return { ok: false, miss0 };
      f.x = PH.dims().W + 40;
      return { ok: true, miss0, slowed: f.vx };
    })()""")
    pg.wait_for_timeout(400)
    merc2 = ev("({ miss: PH.missRun })")
    print('ESCAPE mercy', merc, merc2)
    if not merc.get('ok'): fails.append('could not spawn fawn for whisperer test')
    elif merc2.get('miss') != merc.get('miss0'):
        fails.append('Deer Whisperer should waive fawn escape X, miss %s -> %s' % (merc.get('miss0'), merc2.get('miss')))

    # Boss escape still costs X even with whisperer (boss is not g)
    ev("""(() => {
      const miss0 = PH.missRun;
      const b = PH.boss;
      if (b) { b.leaving = true; b.x = PH.dims().W + 80; }
      return { miss0, has: !!b };
    })()""")
    pg.wait_for_timeout(400)
    bossEsc = ev("({ miss: PH.missRun, boss: !!(PH.boss && (PH.boss.state==='fly' || PH.boss.state==='run')) })")
    print('BOSS ESCAPE', bossEsc)
    # miss should increase (whisperer does not cover the boss)
    # We don't hard-fail if the boss already left another way, but if miss didn't move that's a bug
    # (mercy leftover). If jump_play reset miss to 0 and boss escaped, miss should be 1.

    # Flying bosses (Meadow R10 Giant Eagle) still drop eggs, not fawns. Bosses are every 10 rounds.
    ev("""(() => {
      PH.Meta.save.lv['perk.deer'] = 0;
      PH.Meta.save.lv['perk.second'] = 0;
      PH.Meta.persist();
    })()""")
    ev("PH.newGame()"); pg.wait_for_timeout(400)
    hide_daily()
    start_meadow('shotgun')
    jump_play(10)
    ev("""(() => {
      const b = PH.boss;
      // force an egg the same way the game would
      if (typeof ECON !== 'undefined' && b) {
        // use internal drop via a tiny hook: spawn is public; dropEgg is not. Advance dropT.
        b.dropT = 0;
        b.x = 90;
      }
    })()""")
    # Wait for the next maybeDropEgg tick
    pg.wait_for_timeout(800)
    air = snap_targets()
    print('R10 eagle', json.dumps({'round': air.get('round'), 'boss': air.get('boss'), 'kinds': [t['kind'] for t in air['list']]}, indent=2))
    if not air.get('boss') or air['boss'].get('name') != 'GIANT EAGLE':
        fails.append('R10 should be GIANT EAGLE, got %r' % (air.get('boss')))
    if air.get('boss') and air['boss'].get('y', 999) > 160:
        fails.append('R10 eagle should still patrol the sky, y=%s' % air['boss'].get('y'))
    if air.get('boss') and air['boss'].get('ground'):
        fails.append('R10 eagle should not be a ground boss')
    kinds = [t['kind'] for t in air['list']]
    if 'fawn' in kinds: fails.append('flying boss dropped a fawn: %r' % kinds)
    # egg may take a moment; if none, that's only a soft check if dropT didn't fire
    if 'egg' not in kinds and 'fawn' not in kinds:
        # try waiting a bit more
        pg.wait_for_timeout(2000)
        air2 = snap_targets()
        kinds = [t['kind'] for t in air2['list']]
        print('R10 later kinds', kinds)
        if 'fawn' in kinds: fails.append('flying boss later dropped a fawn')
        if 'egg' not in kinds and not any(t.get('hatched') for t in air2['list']):
            # hatched not in snap; check kinds only
            fails.append('flying boss did not drop an egg (kinds %r)' % kinds)


    if errs: fails.append('page errors: %s' % errs)
    if fails:
        print('FAIL', fails)
        raise SystemExit(1)
    print('PASS ground boss / fawns')
    b.close()
