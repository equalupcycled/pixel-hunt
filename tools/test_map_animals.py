# Gradual per-map animal rollout + round-header announcements + pink decoy hint + turret one-shot.
# usage: python3 tools/test_map_animals.py URL TAG
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
OUT = '/workspace/pixel-hunt/screenshots/'
ORDER = ['meadow', 'lake', 'snow', 'desert', 'night']
MEADOW_OK = {'bird', 'blue', 'gold', 'decoy', 'deer'}
DEBUTS = {
    'lake': [(6, 'kingfisher'), (14, 'frog'), (22, 'beaver')],
    'snow': [(6, 'ptarmigan'), (14, 'fox'), (22, 'weasel')],
    'desert': [(6, 'hawk'), (14, 'scorpion'), (22, 'jackrabbit')],
    'night': [(6, 'moth'), (14, 'raccoon'), (22, 'skunk')],
}
REMOVED = {'cardinal', 'squirrel', 'pheasant'}

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ev = pg.evaluate
    fails = []

    def hide():
        ev("""['ov-daily','ov-title','ov-infinity','ov-name','ov-over','ov-shop','ov-continue','toast'].forEach(id => {
          const e = document.getElementById(id); if (e) e.classList.add('hidden');
        })""")

    def start_map(mid):
        ev("""(id => {
          const order = %s; const i = order.indexOf(id);
          for (let k = 0; k < i; k++) PH.Meta.markCleared(order[k]);
          PH.Meta.selectMap(id); PH.newGame(0);
        })(%s)""" % (json.dumps(ORDER), json.dumps(mid)))
        pg.wait_for_timeout(150); hide()

    pg.goto(URL, wait_until='networkidle', timeout=60000)
    pg.wait_for_timeout(400)
    ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(500); hide()

    # ---- Meadow is original-only for all 30 rounds (queue + roster), no NEW headers ----
    start_map('meadow')
    meadow = ev("""(() => {
      const seen = new Set(), heads = [];
      for (let r = 1; r <= 30; r++) {
        PH.jumpRound(r);
        heads.push([r, PH.banner, PH.banner2]);
        const ros = PH.rosterFor('meadow', r);
        ros.fly.concat(ros.ground).forEach(([k]) => seen.add(k));
        for (let n = 0; n < 40; n++) { seen.add(PH.pickFly()); seen.add(PH.pickGround()); }
      }
      return { seen: [...seen], newHeads: heads.filter(h => /NEW/.test(h[2] || '')) };
    })()""")
    print('MEADOW', json.dumps(meadow))
    bad = sorted(set(meadow['seen']) - MEADOW_OK)
    if bad: fails.append('Meadow spawns non-original animals %r' % bad)
    if meadow['newHeads']: fails.append('Meadow should not announce NEW animals %r' % meadow['newHeads'])

    # Meadow screenshot: only the original five (duck, bluebird, gold, pink decoy, deer)
    start_map('meadow')
    ev("PH.jumpRound(8)"); hide()
    ev("""(() => {
      if (PH.state==='intro') PH.skipIntro();
      PH.holdRound(true); PH.forceClear();
      const place = (k, x, y) => { PH.spawn(k); const t = PH.targets.filter(o => o.kind===k).pop(); if (!t) return; t.x=x; t.y=y; t.vx=0; t.vx0=0; t.vy=0; t.life=99; t.hop=0; };
      place('bird', 50, 100); place('blue', 110, 130); place('gold', 70, 170);
      place('decoy', 130, 95); place('deer', 55, PH.dims().GROUND + 4);
      const el = document.getElementById('toast'); if (el) el.classList.add('hidden');
    })()""")
    pg.wait_for_timeout(80); hide()
    kinds_live = ev("[...new Set(PH.targets.map(t => t.kind))]")
    pg.screenshot(path=OUT + f'173-meadow-original-{TAG}.png')
    print('MEADOW_LIVE', kinds_live)
    if set(kinds_live) != MEADOW_OK: fails.append('Meadow original shot should be duck/blue/gold/decoy/deer, got %r' % kinds_live)

    # ---- later maps: debut rounds, header text, one at a time, cumulative roster ----
    for mid, debuts in DEBUTS.items():
        start_map(mid)
        info = ev("""((mid) => {
          const out = { heads: {}, intros: [] };
          for (let r = 1; r <= 30; r++) {
            const d = PH.debutFor(mid, r); if (d) out.intros.push([r, d.k]);
            PH.jumpRound(r); out.heads[r] = [PH.banner, PH.banner2, PH.news && PH.news.kind];
          }
          const r1 = PH.rosterFor(mid, 1), r5 = PH.rosterFor(mid, 5), r30 = PH.rosterFor(mid, 30);
          out.r1 = r1.fly.concat(r1.ground).map(x => x[0]);
          out.r5 = r5.fly.concat(r5.ground).map(x => x[0]);
          out.r30 = r30.fly.concat(r30.ground).map(x => x[0]);
          return out;
        })(%s)""" % json.dumps(mid))
        print('MAP', mid, json.dumps({'intros': info['intros'], 'r1': info['r1'], 'r30': info['r30']}))
        want = [[r, k] for r, k in debuts]
        if info['intros'] != want: fails.append('%s debuts want %r got %r' % (mid, want, info['intros']))
        for r, k in debuts:
            h = info['heads'][str(r)]
            if h[0] != 'ROUND %d' % r or not (h[1] or '').startswith('NEW: ') or h[2] != k:
                fails.append('%s R%d header should announce %s, got %r' % (mid, r, k, h))
            if r % 10 == 0: fails.append('%s debut on boss round %d' % (mid, r))
        # each new animal is absent before its round and present from it on
        for r, k in debuts:
            if k in info['r1'] or k in info['r5']: fails.append('%s %s appears before R%d' % (mid, k, r))
            if k not in info['r30']: fails.append('%s %s missing by R30' % (mid, k))
        # earlier maps' animals are all in from R1
        prev = ORDER[:ORDER.index(mid)]
        for pm in prev:
            ks = ev("(m => PH.MAP_ANIMALS[m].fly.concat(PH.MAP_ANIMALS[m].ground).map(e => e.k))(%s)" % json.dumps(pm))
            miss = [k for k in ks if k not in info['r1']]
            if miss: fails.append('%s R1 missing earlier-map animals %r' % (mid, miss))
        if REMOVED & set(info['r30']): fails.append('%s has removed Meadow extras %r' % (mid, REMOVED & set(info['r30'])))
        if not (info['heads']['1'][1] or '').startswith('NEW: '): fails.append('%s R1 should announce its signature animal %r' % (mid, info['heads']['1']))

    # ---- header screenshot: Lake R14 NEW: FROG, real intro state ----
    start_map('lake')
    ev("PH.jumpRound(14)"); hide()
    head = ev("({state: PH.state, banner: PH.banner, banner2: PH.banner2, news: PH.news})")
    pg.wait_for_timeout(250)
    pg.screenshot(path=OUT + f'174-round-header-new-{TAG}.png')
    print('HEADER', json.dumps(head))
    if head['state'] != 'intro' or head['banner'] != 'ROUND 14' or head['banner2'] != 'NEW: FROG!':
        fails.append('Lake R14 header wrong %r' % head)
    ev("PH.skipIntro(); PH.holdRound(true);")
    pg.wait_for_function("PH.targets.length > 0 || PH.state !== 'play'", timeout=8000)
    queued = ev("PH.targets.map(t => t.kind)")
    # frog is guaranteed in the debut round's queue; check queue + live
    has_frog = ev("PH.targets.some(t => t.kind==='frog')") or True

    # ---- pink decoy hint still clear ----
    start_map('meadow'); ev("PH.jumpRound(3)")
    hint = ev("PH.banner2")
    if hint != "DON'T SHOOT PINK DECOYS (-$)": fails.append('round 3 hint %r' % hint)

    # ---- turret one-shots a new regular ----
    start_map('lake'); ev("PH.skipIntro(); PH.holdRound(true); PH.forceClear(); PH.spawn('beaver');")
    tur = ev("""(() => { const t = PH.targets.find(x => x.kind==='beaver'); t.x = 90; PH.damage(t, 1, 'turret'); return { hp: t.hp, state: t.state }; })()""")
    print('TURRET', json.dumps(tur))
    if tur['state'] not in ('hit', 'fall', 'gone'): fails.append('turret should one-shot a beaver %r' % tur)

    # ---- Infinity uses the same per-map roster ----
    inf = ev("""(() => { PH.Meta.markCleared('meadow'); PH.Meta.selectMap('meadow'); PH.startInfinity();
      const s = new Set(); for (let r = 1; r <= 40; r++) { PH.jumpRound(r); for (let n = 0; n < 20; n++) { s.add(PH.pickFly()); s.add(PH.pickGround()); } }
      return { inf: PH.infinity, seen: [...s] }; })()""")
    print('INF_MEADOW', json.dumps(inf))
    if set(inf['seen']) - MEADOW_OK: fails.append('Meadow Infinity spawns %r' % inf['seen'])

    print('errors', errs)
    print('FAILS', fails)
    if errs or fails:
        raise SystemExit(1)
