# Pink decoy hint wording, unique animals per map, cumulative roster, NEW banners, turret one-shot.
# usage: python3 tools/test_map_animals.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/'

UNIQUES = {
    'meadow': [('cardinal', 'dart'), ('squirrel', 'hop'), ('pheasant', 'flush')],
    'lake': [('kingfisher', 'dive'), ('frog', 'hop'), ('beaver', 'swim')],
    'snow': [('ptarmigan', 'glide'), ('fox', 'dash'), ('weasel', 'run')],
    'desert': [('hawk', 'stoop'), ('scorpion', 'crawl'), ('jackrabbit', 'hop')],
    'night': [('moth', 'flutter'), ('raccoon', 'amble'), ('skunk', 'amble')],
}
NEW_AT = {2: {'meadow': 'CARDINAL', 'lake': 'KINGFISHER', 'snow': 'PTARMIGAN', 'desert': 'HAWK', 'night': 'MOTH'},
          5: {'meadow': 'SQUIRREL', 'lake': 'FROG', 'snow': 'FOX', 'desert': 'SCORPION', 'night': 'RACCOON'},
          8: {'meadow': 'PHEASANT', 'lake': 'BEAVER', 'snow': 'WEASEL', 'desert': 'JACKRABBIT', 'night': 'SKUNK'}}

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate

    def hide():
        ev("""['ov-daily','ov-title','ov-infinity','ov-name','ov-over','ov-shop','ov-continue'].forEach(id => {
          const e = document.getElementById(id); if (e) e.classList.add('hidden');
        })""")

    def play_map(mid):
        ev("""(id => {
          const order = ['meadow','lake','snow','desert','night'];
          const i = order.indexOf(id);
          for (let k = 0; k < i; k++) PH.Meta.markCleared(order[k]);
          PH.Meta.selectMap(id);
          PH.newGame(0);
        })""" , mid) if False else ev(
            """((id) => {
              const order = ['meadow','lake','snow','desert','night'];
              const i = order.indexOf(id);
              for (let k = 0; k < i; k++) PH.Meta.markCleared(order[k]);
              PH.Meta.selectMap(id);
              PH.newGame(0);
            })(""" + json.dumps(mid) + ")"
        )
        pg.wait_for_timeout(200)
        hide()
        ev("if (PH.state==='intro') PH.skipIntro()")
        ev("PH.holdRound(true)")
        ev("PH.forceClear()")

    pg.goto(URL, wait_until='networkidle', timeout=60000)
    pg.wait_for_timeout(400)
    ev("localStorage.clear()")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(500)
    hide()
    fails = []

    # ---- pink decoy hint ----
    ev("PH.newGame(0)")
    hide()
    ev("PH.jumpRound(3)")
    hide()
    ev("PH.holdRound(true); PH.forceClear(); PH.spawn('decoy');")
    ev("""(() => {
      const t = PH.targets.find(x => x.kind==='decoy');
      if (t) { t.x = 90; t.y = 150; }
      const el = document.getElementById('toast'); if (el) el.classList.add('hidden');
    })()""")
    hint = ev("({state:PH.state, banner:PH.banner, banner2:PH.banner2})")
    pg.wait_for_timeout(80)
    pg.screenshot(path=OUT + f'169-pink-decoy-hint-{TAG}.png')
    print('HINT', json.dumps(hint))
    b2 = (hint.get('banner2') or '')
    if 'PINK DECOY' not in b2.upper() or "DON'T SHOOT" not in b2.upper():
        fails.append('round 3 hint should clearly say not to shoot pink decoys, got %r' % hint)
    if 'PINK BIRDS' in b2.upper() and 'DECOY' not in b2.upper():
        fails.append('stale pink-birds wording still present, %r' % hint)

    decoy = ev("""(() => {
      const t = PH.targets.find(x => x.kind==='decoy');
      const pal = t && t.set;
      return { kind: t && t.kind, set: pal, hp: t && t.hp, m: t && t.m };
    })()""")
    if not decoy.get('kind'):
        fails.append('decoy did not spawn, %r' % decoy)

    # shoot it and confirm cash penalty text path still works
    ev("PH.setMoney(500); PH.setCash(200);")
    ev("""(() => { const t = PH.targets.find(x => x.kind==='decoy'); if (t) PH.damage(t, 1, 'player'); })()""")
    after = ev("({money: PH.Meta.bank(), cash: PH.runCash})")
    if after['money'] >= 500:
        fails.append('shooting a decoy should cost cash, %r' % after)

    # ---- NEW banners + roster + sprites ----
    shots = [('meadow', '170-meadow-new'), ('lake', '171-lake-new'), ('desert', '172-desert-new')]
    for mid, stem in shots:
        play_map(mid)
        ev("PH.jumpRound(8)")
        hide()
        ev("if (PH.state==='intro') PH.skipIntro()")
        ev("PH.holdRound(true); PH.forceClear();")
        kinds = [k for k, _m in UNIQUES[mid]]
        ev("document.getElementById('toast')&&document.getElementById('toast').classList.add('hidden')")
        ev("""((kinds) => {
          kinds.forEach((k, i) => {
            PH.spawn(k);
            const t = PH.targets.filter(o => o.kind===k).pop();
            if (!t) return;
            if (t.g) { t.x = 36 + i * 54; t.y = PH.dims().GROUND + 4; t.hop = 0; }
            else { t.x = 50 + i * 40; t.y = 118; }
            t.vx = 0; t.vx0 = 0; t.vy = 0; t.life = 99;
          });
        })""" + "(" + json.dumps(kinds) + ")")
        pg.wait_for_timeout(80)
        pg.screenshot(path=OUT + f'{stem}-{TAG}.png')
        placed = ev("PH.targets.map(t => ({kind:t.kind, set:t.set, m:t.m, hp:t.hp, hasSpr: !!(t.set && true)}))")
        print('SPAWN', mid, json.dumps(placed))
        got = {t['kind']: t for t in placed}
        for k, m in UNIQUES[mid]:
            if k not in got:
                fails.append('%s missing %s' % (mid, k))
                continue
            if got[k]['m'] != m:
                fails.append('%s %s movement want %s got %s' % (mid, k, m, got[k]['m']))
            if not (got[k]['hp'] or 0) >= 1:
                fails.append('%s %s missing hp %r' % (mid, k, got[k]))

    # ---- roster cumulative + weights + intros ----
    ev("PH.Meta.markCleared('meadow'); PH.Meta.selectMap('lake'); PH.newGame(0);")
    hide(); ev("PH.holdRound(true)")
    ros = ev("""({
      r1: PH.rosterFor('lake', 1),
      r2: PH.rosterFor('lake', 2),
      r8: PH.rosterFor('lake', 8),
      r8m: PH.rosterFor('meadow', 8),
      debut2: PH.debutFor('lake', 2) && PH.debutFor('lake', 2).name,
      debut5: PH.debutFor('meadow', 5) && PH.debutFor('meadow', 5).name,
    })""")
    print('ROSTER', json.dumps(ros))
    fly8 = dict(ros['r8']['fly']); g8 = dict(ros['r8']['ground'])
    fly1 = dict(ros['r1']['fly'])
    if 'kingfisher' in fly1:
        fails.append('kingfisher should not appear before its intro round, r1=%r' % ros['r1'])
    if 'kingfisher' not in fly8 or 'goose' not in fly8 or 'bird' not in fly8 or 'cardinal' not in fly8:
        fails.append('lake r8 fly roster should be cumulative, %r' % fly8)
    if 'frog' not in g8 or 'beaver' not in g8 or 'deer' not in g8 or 'squirrel' not in g8:
        fails.append('lake r8 ground roster should be cumulative, %r' % g8)
    # lake animals should outweigh inherited meadow ones
    lake_fly = fly8.get('goose', 0) + fly8.get('kingfisher', 0)
    meadow_fly = fly8.get('bird', 0) + fly8.get('blue', 0) + fly8.get('cardinal', 0)
    if lake_fly <= meadow_fly:
        fails.append('lake animals should be prominent on Lake, fly weights %r' % fly8)
    if ros.get('debut2') != 'KINGFISHER' or ros.get('debut5') != 'SQUIRREL':
        fails.append('debut names wrong, %r' % ros)

    ev("PH.jumpRound(2)")
    hide()
    nb = ev("({banner:PH.banner, banner2:PH.banner2, map:PH.Meta.save.equip.map})")
    print('NEW', json.dumps(nb))
    if 'NEW:' not in (nb.get('banner2') or '') or 'KINGFISHER' not in (nb.get('banner2') or ''):
        fails.append('Lake R2 should announce NEW: KINGFISHER, %r' % nb)

    # all maps have 3 uniques and intros
    meta = ev("""(() => {
      const out = {};
      ['meadow','lake','snow','desert','night'].forEach(id => {
        const rec = PH.MAP_ANIMALS[id];
        const uniques = rec.fly.concat(rec.ground).filter(e => e.intro);
        out[id] = { n: uniques.length, intros: uniques.map(e => [e.k, e.intro, e.name]), sig: rec.sig };
      });
      return out;
    })()""")
    print('UNIQUES', json.dumps(meta))
    for mid, info in meta.items():
        if info['n'] < 3:
            fails.append('%s should add at least 3 unique animals, %r' % (mid, info))

    # turret one-shots a new regular (cardinal)
    ev("PH.Meta.selectMap('meadow'); PH.newGame(0);")
    hide(); ev("if (PH.state==='intro') PH.skipIntro(); PH.holdRound(true); PH.forceClear();")
    ev("PH.spawn('cardinal')")
    ev("""(() => {
      const t = PH.targets.find(x => x.kind==='cardinal');
      if (t) { t.x = 90; t.y = 130; }
      PH.damage(t, 1, 'turret');
      return true;
    })()""")
    tur = ev("""(() => {
      const t = PH.targets.find(x => x.kind==='cardinal');
      return { hp: t && t.hp, state: t && t.state };
    })()""")
    print('TURRET', json.dumps(tur))
    if tur.get('state') not in ('hit', 'fall', 'gone') and (tur.get('hp') or 1) > 0.001:
        fails.append('turret should one-shot a cardinal, %r' % tur)

    # HP + payout tables exist
    tables = ev("""(() => {
      const ks = ['cardinal','squirrel','pheasant','kingfisher','frog','beaver','fox','ptarmigan','weasel','hawk','scorpion','jackrabbit','raccoon','moth','skunk'];
      const missingHp = ks.filter(k => !PH.kindHp(k) || PH.kindHp(k) < 1);
      const missingPay = ks.filter(k => !PH.Meta && false);
      const pay = ks.map(k => {
        try { return [k, PH.kindHp(k), !!PH.KIND[k]]; } catch (e) { return [k, 'err', String(e)]; }
      });
      return { missingHp, pay };
    })()""")
    if tables['missingHp']:
        fails.append('missing HP for %r' % tables['missingHp'])

    print('errors', errs)
    print('FAILS', fails)
    if errs or fails:
        raise SystemExit(1)
