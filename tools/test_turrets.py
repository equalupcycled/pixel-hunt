# Turret hit rate and kills. usage: python3 tools/test_turrets.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/'

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate

    def hide_overlays():
        ev("""['ov-daily','ov-title','ov-infinity','ov-name','ov-over','ov-shop'].forEach(id => {
          const e = document.getElementById(id); if (e) e.classList.add('hidden');
        })""")

    def arm(ids, ammo=8):
        ev("""((ids) => {
          const lv = PH.Meta.save.lv;
          lv['turret.slots'] = ids.length;
          ids.forEach(id => { lv['own.' + id] = 1; });
          PH.Meta.activeEquip().turrets = ids.slice();
          PH.Meta.persist();
          PH.newGame(0);
        })(""" + json.dumps(ids) + ")")
        pg.wait_for_timeout(300)
        hide_overlays()
        ev("if (PH.state === 'intro') PH.skipIntro()")
        ev("PH.holdRound(true)")
        ev("PH.forceClear()")
        ev("""((ammo) => {
          PH.turrets.forEach(t => {
            t.ammo = ammo; t.ammo0 = Math.max(t.ammo0, ammo);
            t.cool = 99; t.rate = 0.12; if (t.range) t.range = 260; t.lock = null;
          });
          PH.resetTurretStats();
        })(%d)""" % ammo)
        ev("if (PH.state !== 'play') PH.skipIntro()")
        hide_overlays()

    def freeze_turrets():
        ev("PH.holdRound(true); PH.turrets.forEach(t => { t.cool = 99; t.lock = null; });")

    def ready_turrets(ammo=8):
        ev("""((ammo) => {
          PH.holdRound(true);
          PH.turrets.forEach(t => {
            t.ammo = ammo; t.ammo0 = Math.max(t.ammo0, ammo);
            t.cool = 0; t.rate = 0.12; if (t.range) t.range = 260; t.lock = null;
          });
          PH.resetTurretStats();
        })(%d)""" % ammo)

    def place(kind, x, y):
        ev("""((kind, x, y) => {
          PH.spawn(kind);
          const t = PH.targets[PH.targets.length - 1];
          t.x = x; t.y = y; t.vx = 0; t.vx0 = 0; t.vy = 0; t.life = 99; t.hop = 0; t.erratic = false; t.test = true;
          if (t.kind === 'eyes') { t.vis = true; t.pt = 8; t.peeks = 3; }
        })(%s, %s, %s)""" % (json.dumps(kind), x, y))

    def place_egg(x, y):
        ev("""((x, y) => {
          PH.dropEgg({ x: x, y: y });
          const e = PH.targets[PH.targets.length - 1];
          e.x = x; e.y = y; e.vy = 0; e.vx = 0; e.hatchY = 400; e.life = 99; e.test = true;
        })(%s, %s)""" % (x, y))

    pg.goto(URL, wait_until='networkidle', timeout=60000)
    pg.wait_for_timeout(600)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(800)
    hide_overlays()
    fails = []

    # ---- pellet hitscan: mixed regulars including ground, fawn, egg, bat ----
    arm(['pellet'], 10)
    ev("PH.forceClear()")
    freeze_turrets()
    place('bird', 100, 110)
    place('goose', 140, 100)
    place('deer', 90, 200)
    place('fawn', 150, 200)
    place('wolf', 130, 200)
    place_egg(120, 90)
    place('bat', 80, 75)
    kinds0 = ev("PH.targets.filter(t => t.test && t.state==='fly').map(t => t.kind).sort()")
    ready_turrets(10)
    pg.wait_for_timeout(1600)
    st = ev("PH.turretStats()")
    living = ev("PH.targets.filter(t => t.test && (t.state==='fly'||t.state==='flee') && (t.hp||0)>0.001).map(t => t.kind)")
    dead_ok = ev("PH.targets.filter(t => t.test).every(t => t.state==='gone' || t.state==='hit' || t.state==='fall' || (t.hp||0)<=0)")
    rate = (st['hits'] / st['shots']) if st['shots'] else 0
    if len(kinds0) < 7: fails.append(f"pellet did not place all targets: {kinds0}")
    if st['shots'] < 7: fails.append(f"pellet shots too few: {st} kinds={kinds0}")
    if st['kills'] < 7: fails.append(f"pellet kills too few: {st}")
    if rate < 0.99: fails.append(f"pellet hit rate {rate:.2f} stats={st}")
    if st['misses'] != 0: fails.append(f"pellet misses {st['misses']}")
    if not dead_ok or living:
        fails.append(f"pellet left living {living} kinds0={kinds0} dead_ok={dead_ok} stats={st}")
    R_pellet = {'stats': st, 'living': living, 'kinds0': kinds0, 'rate': rate}

    # screenshot while we re-fire at a fresh flock so tracers are visible
    ev("PH.forceClear()")
    freeze_turrets()
    for i, k in enumerate(['bird', 'goose', 'gold', 'bat', 'owl']):
        place(k, 70 + i * 22, 80 + (i % 3) * 18)
    ready_turrets(6)
    pg.wait_for_timeout(90)
    pg.screenshot(path=OUT + f'166-turrets-{TAG}.png')

    # ---- decoys are ignored ----
    ev("PH.forceClear()")
    freeze_turrets()
    place('decoy', 110, 100)
    ready_turrets(4)
    pg.wait_for_timeout(800)
    decoy = ev("""({
      stats: PH.turretStats(),
      decoy: PH.targets.filter(t => t.kind==='decoy').map(t => ({ state: t.state, hp: t.hp }))
    })""")
    if decoy['stats']['shots'] != 0: fails.append(f"turret shot a decoy: {decoy}")
    if not decoy['decoy'] or decoy['decoy'][0]['state'] != 'fly': fails.append(f"decoy not left alone: {decoy}")

    # ---- leaving target is not fired at ----
    ev("PH.forceClear()")
    freeze_turrets()
    ev("""(() => {
      PH.spawn('bird');
      const t = PH.targets[PH.targets.length-1];
      const W = PH.dims().W;
      t.x = W + 8; t.y = 90; t.vx = 90; t.vx0 = 90; t.vy = 0; t.life = 0.05; t.test = true;
    })()""")
    ready_turrets(4)
    pg.wait_for_timeout(400)
    leaving = ev("PH.turretStats()")
    if leaving['shots'] != 0: fails.append(f"fired at a leaving bird: {leaving}")

    # ---- boss is not one-shot ----
    ev("PH.forceClear()")
    ev("PH.jumpRound(10)")
    ev("if (PH.state==='intro') PH.skipIntro()")
    ev("PH.holdRound(true)")
    hide_overlays()
    ev("PH.forceClear()")
    ev("PH.spawn('boss')")
    ev("PH.holdRound(true); PH.turrets.forEach(t => { t.ammo = 1; t.cool = 0; t.lock = null; }); PH.resetTurretStats();")
    hp0 = ev("PH.boss ? PH.boss.hp : 0")
    dmg = ev("PH.turrets[0] ? PH.turrets[0].dmg : 2")
    pg.wait_for_timeout(700)
    boss = ev("""({
      stats: PH.turretStats(),
      alive: !!(PH.boss && (PH.boss.state==='fly' || PH.boss.state==='flee') && PH.boss.hp > 0),
      hp: PH.boss ? PH.boss.hp : 0,
      hp0: PH.boss ? PH.boss.hp0 : 0,
      kind: PH.boss && PH.boss.boss
    })""")
    if not boss['alive']: fails.append(f"boss was one-shot or gone: {boss} hp0_before={hp0} dmg={dmg}")
    if boss['alive'] and boss['hp'] >= hp0 and hp0 > 0 and boss['stats']['shots'] > 0:
        fails.append(f"boss took no damage: {boss} start={hp0} dmg={dmg}")
    if boss['alive'] and hp0 - boss['hp'] > dmg * 2 + 1:
        fails.append(f"boss lost more HP than turret dmg suggests: {boss} start={hp0} dmg={dmg}")
    R_boss = {'start': hp0, 'dmg': dmg, **boss}

    # ---- tesla + missile also connect and kill regulars ----
    arm(['tesla', 'missile'], 8)
    ev("PH.forceClear()")
    freeze_turrets()
    place('bird', 90, 150)
    place('goose', 110, 140)
    place('fawn', 80, 200)
    place('rabbit', 100, 200)
    place_egg(85, 110)
    ready_turrets(8)
    pg.wait_for_timeout(1800)
    ev("PH.turrets.forEach(t => { t.ammo = 0; })")
    pg.wait_for_timeout(2500)
    st2 = ev("PH.turretStats()")
    living2 = ev("PH.targets.filter(t => t.test && (t.state==='fly'||t.state==='flee') && (t.hp||0)>0.001).map(t => t.kind)")
    rate2 = (st2['hits'] / st2['shots']) if st2['shots'] else 0
    if st2['shots'] < 5: fails.append(f"tesla/missile shots too few: {st2}")
    if rate2 < 0.99: fails.append(f"tesla/missile hit rate {rate2:.2f} stats={st2}")
    if st2['misses'] != 0: fails.append(f"tesla/missile misses {st2['misses']}")
    if living2: fails.append(f"tesla/missile left living {living2} stats={st2}")
    R_mix = {'stats': st2, 'living': living2, 'rate': rate2}

    print('PELL', json.dumps(R_pellet))
    print('DECOY', json.dumps(decoy))
    print('LEAVE', json.dumps(leaving))
    print('BOSS', json.dumps(R_boss))
    print('MIX', json.dumps(R_mix))
    print('errors', errs)
    print('FAILS', fails)
    if errs or fails:
        raise SystemExit(1)
