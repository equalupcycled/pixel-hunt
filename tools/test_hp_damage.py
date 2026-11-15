# HP and per-weapon damage. usage: python3 tools/test_hp_damage.py URL TAG
import sys, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/index.html'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate

    def hide_daily():
        ev("document.getElementById('ov-daily')&&document.getElementById('ov-daily').classList.add('hidden')")

    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(800)
    hide_daily()
    fails = []

    tables = ev("""({
      v: PH.Meta.save.v,
      duck: PH.kindHp('bird'), blue: PH.kindHp('blue'), gold: PH.kindHp('gold'), decoy: PH.kindHp('decoy'),
      goose: PH.kindHp('goose'), owl: PH.kindHp('owl'), bat: PH.kindHp('bat'), vulture: PH.kindHp('vulture'),
      deer: PH.kindHp('deer'), swimgoose: PH.kindHp('swimgoose'), rabbit: PH.kindHp('rabbit'),
      wolf: PH.kindHp('wolf'), roadrunner: PH.kindHp('roadrunner'), coyote: PH.kindHp('coyote'),
      eyes: PH.kindHp('eyes'), egg: PH.kindHp('egg'), fawn: PH.kindHp('fawn'),
      boss10: PH.bossHp(10),
      sg: [0,1,2,3,4,5,6].map(l => PH.dmgOf('shotgun', l)),
      hg: [0,1,2,3,4,5].map(l => PH.dmgOf('handgun', l)),
      rf: [0,1,2,3,4,5,6].map(l => PH.dmgOf('rifle', l)),
      bow: [0,1,2,3,4,5,6].map(l => PH.dmgOf('bow', l)),
      mg: [0,1,2,3,4].map(l => PH.dmgOf('mg', l)),
      lz: [0,1,2,3,4,5].map(l => PH.dmgOf('laser', l)),
      pellet: [0,1,2,3,4].map(l => PH.dmgOf('pellet', l)),
      tesla: [0,1,2,3,4].map(l => PH.dmgOf('tesla', l)),
      missile: [0,1,2,3,4].map(l => PH.dmgOf('missile', l)),
      flak1: PH.flakDmg(1),
      infPast: PH.dmgOf('shotgun', 7),
      hitsDuckSg: PH.hitsNeeded(2, 2),
      hitsDuckHg: PH.hitsNeeded(2, 1),
      hitsGooseRf: PH.hitsNeeded(4, 4),
    })""")
    print('TABLES', json.dumps(tables, indent=2))
    if tables.get('v') != 9: fails.append('fresh schema not v9, %r' % tables.get('v'))
    expect_hp = dict(duck=2, blue=2, gold=2, decoy=1, goose=4, owl=3, bat=2, vulture=4,
                     deer=4, swimgoose=4, rabbit=3, wolf=5, roadrunner=3, coyote=5, eyes=3, egg=2, fawn=2, boss10=20)
    for k, want in expect_hp.items():
        if tables.get(k) != want: fails.append('hp %s want %s got %r' % (k, want, tables.get(k)))
    if tables.get('sg') != [2,3,4,5,6,7,8]: fails.append('shotgun dmg %r' % tables.get('sg'))
    if tables.get('hg') != [1,2,3,4,5,6]: fails.append('handgun dmg %r' % tables.get('hg'))
    if tables.get('rf') != [4,5,6,7,9,11,13]: fails.append('rifle dmg %r' % tables.get('rf'))
    if tables.get('bow') != [3,4,5,6,7,9,11]: fails.append('bow dmg %r' % tables.get('bow'))
    if tables.get('mg') != [1,2,3,4,5]: fails.append('mg dmg %r' % tables.get('mg'))
    if tables.get('lz') != [2,3,4,5,6,7]: fails.append('laser dmg %r' % tables.get('lz'))
    if tables.get('pellet') != [2,3,4,5,6]: fails.append('pellet dmg %r' % tables.get('pellet'))
    if tables.get('tesla') != [3,4,5,6,8]: fails.append('tesla dmg %r' % tables.get('tesla'))
    if tables.get('missile') != [3,4,5,6,8]: fails.append('missile dmg %r' % tables.get('missile'))
    if tables.get('flak1') != 4: fails.append('flak L1 %r' % tables.get('flak1'))
    if not (tables.get('infPast') or 0) > 8: fails.append('infinity dmg should rise past cap, got %r' % tables.get('infPast'))
    # strictly increasing tracks
    for name in ('sg','hg','rf','bow','mg','lz','pellet','tesla','missile'):
        arr = tables.get(name) or []
        if any(arr[i] >= arr[i+1] for i in range(len(arr)-1)):
            fails.append('%s not strictly increasing: %r' % (name, arr))
    if tables.get('hitsDuckSg') != 1 or tables.get('hitsDuckHg') != 2 or tables.get('hitsGooseRf') != 1:
        fails.append('hitsNeeded %r' % {k: tables.get(k) for k in ('hitsDuckSg','hitsDuckHg','hitsGooseRf')})

    combat = ev("""(() => {
      PH.newGame();
      PH.forceClear();
      const out = {};
      PH.spawn('bird');
      let t = PH.targets.find(x => x.kind === 'bird');
      out.birdHp0 = t && t.hp;
      PH.damage(t, PH.dmgOf('shotgun', 0), 'player');
      out.birdAfterSg = t.hp;
      out.birdDead = !PH.targets.includes(t) || t.hp <= 0 || t.state === 'fall' || t.state === 'dead';

      PH.forceClear();
      PH.spawn('bird');
      t = PH.targets.find(x => x.kind === 'bird');
      PH.damage(t, PH.dmgOf('handgun', 0), 'player');
      out.hgLeft = t.hp;
      out.hgStillUp = t.hp > 0 && (t.state === 'fly' || t.state === 'run' || t.state === 'glide' || t.state === 'skim' || t.state === 'hop' || !t.state || t.state === 'fly');
      PH.damage(t, PH.dmgOf('handgun', 0), 'player');
      out.hgAfter2 = t.hp;
      out.hgDead = t.hp <= 0 || !PH.targets.includes(t) || t.state === 'fall' || t.state === 'dead';

      PH.forceClear();
      PH.spawn('goose');
      t = PH.targets.find(x => x.kind === 'goose');
      out.gooseHp0 = t && t.hp;
      PH.damage(t, PH.dmgOf('rifle', 0), 'player');
      out.gooseAfterRf = t.hp;
      out.gooseDead = t.hp <= 0 || !PH.targets.includes(t) || t.state === 'fall' || t.state === 'dead';

      PH.forceClear();
      PH.spawn('deer');
      t = PH.targets.find(x => x.kind === 'deer');
      out.deerHp0 = t && t.hp;
      PH.damage(t, PH.dmgOf('shotgun', 0), 'player');
      out.deerAfter1 = t.hp;
      PH.damage(t, PH.dmgOf('shotgun', 0), 'player');
      out.deerAfter2 = t.hp;
      PH.damage(t, PH.dmgOf('shotgun', 0), 'player');
      out.deerAfter3 = t.hp;
      out.deerDead = t.hp <= 0 || !PH.targets.includes(t) || t.state === 'fall' || t.state === 'dead';

      const w0 = PH.makeWeapon('shotgun');
      const w1 = (() => { const lv = PH.Meta.save.lv['shotgun.dmg']; PH.Meta.save.lv['shotgun.dmg'] = 1; const w = PH.makeWeapon('shotgun'); PH.Meta.save.lv['shotgun.dmg'] = lv || 0; return w; })();
      out.sgW0 = w0 && w0.dmg;
      out.sgW1 = w1 && w1.dmg;
      out.shotDmg0 = PH.shotDmg(w0);
      out.critHg = PH.shotDmg({ id: 'handgun', dmg: 1 }, { crit: true });
      out.bowFull = PH.shotDmg({ id: 'bow', dmg: 3 }, { charge: 1 });
      out.bowHalf = PH.shotDmg({ id: 'bow', dmg: 3 }, { charge: 0.5 });
      return out;
    })()""")
    print('COMBAT', json.dumps(combat, indent=2))
    if combat.get('birdHp0') != 2 or not combat.get('birdDead') or combat.get('birdAfterSg', 99) > 0:
        fails.append('shotgun should one-shot a 2 HP duck, %r' % combat)
    if combat.get('hgLeft') != 1 or combat.get('hgAfter2', 99) > 0 or not combat.get('hgDead'):
        fails.append('handgun should take two shots on a duck, %r' % combat)
    if combat.get('gooseHp0') != 4 or not combat.get('gooseDead'):
        fails.append('rifle should one-shot a 4 HP goose, %r' % combat)
    if combat.get('deerHp0') != 4 or combat.get('deerAfter1') != 2 or combat.get('deerAfter2', 99) > 0 or not combat.get('deerDead'):
        fails.append('deer should take 3 shotgun hits, %r' % combat)
    if combat.get('sgW0') != 2 or combat.get('sgW1') != 3:
        fails.append('weapon upgrade should raise dmg, %r' % {k: combat.get(k) for k in ('sgW0','sgW1','shotDmg0')})
    if combat.get('critHg') != 2: fails.append('handgun crit should be 2x, %r' % combat.get('critHg'))
    if combat.get('bowFull') != 3: fails.append('bow full draw %r' % combat.get('bowFull'))
    if not (combat.get('bowHalf') or 0) < combat.get('bowFull', 0):
        fails.append('bow partial should deal less than full, %r' % combat)

    ev("PH.toTitle()")
    pg.wait_for_timeout(300)
    hide_daily()
    ev("PH.openShop('weapons')")
    pg.wait_for_timeout(400)
    shop = ev("""(() => {
      const lines = [...document.querySelectorAll('.item .dmg-line, .card .dmg-line')].map(e => e.textContent.trim());
      const shot = lines.find(s => s.includes('DMG') && (s.includes('2') || s.includes('→')));
      const detail = document.getElementById('shop-detail');
      return { lines, shot, detailOpen: detail && !detail.classList.contains('hidden') };
    })()""")
    print('SHOP', shop)
    if not shop.get('shot') or 'DMG 2' not in shop.get('shot') or '\u2192' not in shop.get('shot') or '3' not in shop.get('shot'):
        fails.append('shop card missing DMG 2 → 3, got %r' % shop)
    ev("document.getElementById('shop-detail')&&document.getElementById('shop-detail').classList.add('hidden')")
    ev("document.getElementById('ov-shop')&&document.getElementById('ov-shop').classList.add('hidden')")

    # v6 -> v7 migration fills *.dmg at 0
    seed = {'v': 6, 'bank': 100, 'lv': {'shotgun.cap': 1}, 'stats': {}, 'missions': [], 'mDone': 0, 'ach': {},
            'daily': {'last': None, 'day': -1}, 'ads': {'date': None, 'doubles': 0},
            'equip': {'primary': 'shotgun', 'secondary': None, 'turrets': [], 'skin': 'classic', 'map': 'meadow'},
            'autoBoostUntil': 0}
    pg2 = c.new_page()
    pg2.add_init_script("localStorage.setItem('pixelhunt.save.v1', %s);" % json.dumps(json.dumps(seed)))
    pg2.goto(URL, wait_until='networkidle'); pg2.wait_for_timeout(800)
    mig = pg2.evaluate("""({
      v: PH.Meta.save.v,
      dmg: PH.Meta.save.lv['shotgun.dmg'],
      infDmg: (PH.Meta.save.infLv||{})['shotgun.dmg'],
      cap: PH.Meta.save.lv['shotgun.cap'],
      bank: PH.Meta.save.bank,
      autoBoostUntil: PH.Meta.save.autoBoostUntil,
    })""")
    print('MIGRATE', mig)
    if mig.get('v') != 9: fails.append('migration schema not v9, %r' % mig)
    if mig.get('dmg') not in (0, None) or mig.get('infDmg') not in (0, None):
        fails.append('migration should start dmg tracks at 0, %r' % mig)
    if mig.get('cap') != 1 or mig.get('bank') != 100:
        fails.append('migration overwrote classic progress, %r' % mig)

    print('ERRS', errs)
    print('FAILS', fails)
    if fails or errs:
        raise SystemExit(1)
    print('OK', TAG)
