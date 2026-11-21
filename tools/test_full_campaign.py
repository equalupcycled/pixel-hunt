# Full Classic campaign in ONE run: Meadow R1 -> Night Hunt R30 (+ perfect R31 bonus rounds), fast-forwarded with an
# in-page aim bot that uses the real weapon path (fireTap / hold for MG+laser). Logs every round header, boss, new animal,
# map shift, money/score continuity, softlocks, and console errors.
# usage: python3 tools/test_full_campaign.py URL TAG [weapon]
import json, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
WEAPON = sys.argv[3] if len(sys.argv) > 3 else 'shotgun'
OUT = '/workspace/pixel-hunt/screenshots/qa/'
MEADOW_OK = {'bird', 'blue', 'gold', 'decoy', 'deer', 'egg', 'fawn', 'boss', 'bag'}

INSTALL = r"""
window.QA = { log: [], kinds: {}, bosses: [], shifts: [], lastKey: '', stuck: 0, events: [], shot: null, seenShift: {}, seenBonus: {}, seenNews: {}, maxCashDrop: 0, prevCash: 0, prevScore: 0, scoreDrops: [] };
QA.watch = function () {
  const s = PH.stateX, key = s.map + ':' + s.round + ':' + (s.infinity ? 'i' : 'c');
  if (key !== QA.lastKey && (s.state === 'intro' || s.state === 'bonus')) {
    QA.lastKey = key; QA.stuck = 0;
    QA.log.push({ map: s.map, round: s.round, state: s.state, b1: PH.banner, b2: PH.banner2, news: PH.news && PH.news.kind, miss: s.missRun, score: s.score, cash: s.runCash });
    if (PH.news && !QA.seenNews[key]) { QA.seenNews[key] = 1; QA.shot = 'news-' + s.map + '-r' + s.round; return true; }
    if (s.state === 'bonus' && !QA.seenBonus[s.map]) { QA.seenBonus[s.map] = 1; }
  }
  QA.stuck++;
  for (const t of PH.targets) {
    const m = s.map; QA.kinds[m] = QA.kinds[m] || {};
    QA.kinds[m][t.kind] = Math.min(QA.kinds[m][t.kind] || 99, s.round);
    if (t.kind === 'boss' && !QA.bosses.some(b => b.map === m && b.round === s.round)) QA.bosses.push({ map: m, round: s.round, name: t.name, hp: t.hp0, ground: PH.isGroundBoss(t) });
  }
  if (s.state === 'mapshift' && !QA.seenShift[s.map]) { QA.seenShift[s.map] = 1; QA.shifts.push({ map: s.map, b1: PH.banner, b2: PH.banner2, score: s.score, cash: s.runCash }); QA.shot = 'shift-' + s.map; return true; }
  if (s.state === 'bonus' && PH.targets.some(t => t.kind === 'bag') && !QA.seenBonus['shot-' + s.map]) { QA.seenBonus['shot-' + s.map] = 1; QA.shot = 'bonus-' + s.map; return true; }
  if (s.score < QA.prevScore - 0.5 && s.state !== 'title') QA.scoreDrops.push({ map: s.map, round: s.round, from: QA.prevScore, to: s.score });
  QA.prevScore = s.score;
  if (s.state === 'dying' || s.state === 'ad' || s.state === 'over' || s.state === 'title') return true;
  if (QA.stuck > 60 * 240) { QA.events.push({ softlock: key, state: s.state, queue: s.queue, targets: PH.targets.map(t => [t.kind, t.state, Math.round(t.x), Math.round(t.y)]) }); QA.stuck = 0; return true; }
  return false;
};
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text))
    ev = pg.evaluate
    fails = []
    pg.goto(URL, wait_until='networkidle', timeout=60000); pg.wait_for_timeout(500)
    ev("localStorage.clear()"); pg.reload(wait_until='networkidle'); pg.wait_for_timeout(600)
    ev("document.getElementById('ov-daily') && document.getElementById('ov-daily').classList.add('hidden')")
    # Late-game loadout: every upgrade, three turrets, ad-free (so continue/2X resolve without a timed placeholder ad)
    ev("""(() => { PH.grantAll(); PH.grantAdFree('qa'); PH.equipPrimary(%s);
      ['pellet','tesla','missile'].forEach(id => { try { PH.Meta.mountTurret(id, true); } catch (e) {} }); PH.Meta.persist(); PH.toTitle(); })()""" % json.dumps(WEAPON))
    pg.wait_for_timeout(300)
    if ev("!document.getElementById('ov-daily').classList.contains('hidden')"):
        pg.locator('#ov-daily button').first.click(); pg.wait_for_timeout(300)  # claim the day-1 reward like a player
    ev("document.getElementById('toast').classList.add('hidden')")
    # Real tap on PLAY
    box = pg.locator('#btn-play').bounding_box()
    pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(500)
    ev(INSTALL)
    start = ev("PH.stateX")
    print('START', json.dumps(start))
    t0 = time.time(); sim = 0; ended = None
    while time.time() - t0 < 1500:
        sim += ev("PH.ff(40, { bot: true, until: QA.watch })")
        shot = ev("QA.shot")
        if shot:
            ev("QA.shot = null")
            pg.screenshot(path=OUT + f'{shot}-{TAG}.png')
        st = ev("PH.stateX")
        if st['state'] in ('dying', 'ad', 'over', 'title'):
            ended = st; break
    print('SIM_SECONDS', round(sim), 'WALL', round(time.time() - t0))
    pg.wait_for_timeout(2500)  # let dying -> ad -> over/name settle in real time
    for _ in range(20):
        vis = ev("""(() => { const v = id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); };
          return { over: v('ov-over'), name: v('ov-name'), cont: v('ov-continue'), ad: v('ov-ad') }; })()""")
        if vis['name']:
            pg.fill('#name-input', 'QA BOT'); pg.click('#btn-name-ok'); pg.wait_for_timeout(500); continue
        if vis['over']: break
        pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + f'end-{TAG}.png')
    over = ev("""({ title: document.getElementById('go-title').innerText, score: document.getElementById('go-score').innerText,
      earned: document.getElementById('go-earned').innerText, note: document.getElementById('go-unranked').innerText,
      round: document.getElementById('go-round').innerText, overVis: !document.getElementById('ov-over').classList.contains('hidden') })""")
    qa = ev("({ log: QA.log, kinds: QA.kinds, bosses: QA.bosses, shifts: QA.shifts, events: QA.events, scoreDrops: QA.scoreDrops, bot: PH.botStats, cleared: ['meadow','lake','snow','desert','night'].map(m => [m, PH.Meta.isCleared(m)]) })")
    json.dump({'over': over, 'qa': qa, 'errs': errs, 'ended': ended}, open(f'/tmp/qa/full_campaign_{TAG}.json', 'w'), indent=1)

    print('ENDED', json.dumps(ended)); print('OVER', json.dumps(over))
    print('CLEARED', qa['cleared']); print('SHIFTS', json.dumps(qa['shifts']))
    print('BOSSES', json.dumps(qa['bosses']))
    for m, ks in qa['kinds'].items(): print('KINDS', m, json.dumps(dict(sorted(ks.items(), key=lambda x: x[1]))))
    news = [(l['map'], l['round'], l['b2']) for l in qa['log'] if l['news']]
    print('NEWS', news)
    print('EVENTS', json.dumps(qa['events'])); print('SCORE_DROPS', json.dumps(qa['scoreDrops'][:10])); print('BOT', qa['bot'])

    # ---- assertions ----
    if not all(v for _, v in qa['cleared']): fails.append('not every map cleared %r' % qa['cleared'])
    if 'ALL MAPS CLEARED' not in over['title']: fails.append('ending title %r' % over['title'])
    if [s['map'] for s in qa['shifts']] != ['meadow', 'lake', 'snow', 'desert']: fails.append('map shifts %r' % [s['map'] for s in qa['shifts']])
    for s in qa['shifts']:
        if 'CLEARED' not in s['b1']: fails.append('shift banner %r' % s)
    bad = set(qa['kinds'].get('meadow', {})) - MEADOW_OK
    if bad: fails.append('meadow spawned %r' % bad)
    want_news = {('lake', 1), ('lake', 4), ('lake', 6), ('lake', 14), ('lake', 22), ('snow', 1), ('snow', 4), ('snow', 6), ('snow', 14), ('snow', 22),
                 ('desert', 1), ('desert', 4), ('desert', 6), ('desert', 14), ('desert', 22), ('night', 1), ('night', 4), ('night', 6), ('night', 14), ('night', 22)}
    got_news = {(m, r) for m, r, _ in news}
    if want_news - got_news: fails.append('missing NEW headers %r' % sorted(want_news - got_news))
    if got_news - want_news: fails.append('unexpected NEW headers %r' % sorted(got_news - want_news))
    want_boss = {(m, r) for m in ['meadow', 'lake', 'snow', 'desert', 'night'] for r in (10, 20, 30)}
    got_boss = {(b['map'], b['round']) for b in qa['bosses']}
    if want_boss - got_boss: fails.append('missing bosses %r' % sorted(want_boss - got_boss))
    if qa['events']: fails.append('softlocks %r' % qa['events'][:3])
    if qa['scoreDrops']: print('NOTE score decreases (decoy penalties expected):', len(qa['scoreDrops']))
    # nothing from the CURRENT map's own roster may appear before its header announces it
    DEBUT = {'lake': {'goose': 1, 'swimgoose': 4, 'kingfisher': 6, 'frog': 14, 'beaver': 22},
             'snow': {'owl': 1, 'rabbit': 4, 'wolf': 4, 'ptarmigan': 6, 'fox': 14, 'weasel': 22},
             'desert': {'vulture': 1, 'roadrunner': 4, 'coyote': 4, 'hawk': 6, 'scorpion': 14, 'jackrabbit': 22},
             'night': {'bat': 1, 'eyes': 4, 'moth': 6, 'raccoon': 14, 'skunk': 22}}
    PRIOR = {'lake': ['meadow'], 'snow': ['meadow', 'lake'], 'desert': ['meadow', 'lake', 'snow'], 'night': ['meadow', 'lake', 'snow', 'desert']}
    for m, d in DEBUT.items():
        earlier = set().union(*[set(DEBUT.get(x, {})) for x in PRIOR[m]]) | {'owl'} if m == 'night' else set().union(*[set(DEBUT.get(x, {})) for x in PRIOR[m]])
        for k, r in d.items():
            seen = qa['kinds'].get(m, {}).get(k)
            if seen is not None and seen < r and k not in earlier: fails.append('%s %s appeared R%d before its R%d header' % (m, k, seen, r))
    rounds = {(l['map'], l['round']) for l in qa['log']}
    for m in ['meadow', 'lake', 'snow', 'desert', 'night']:
        miss = [r for r in range(1, 31) if (m, r) not in rounds]
        if miss: fails.append('%s rounds never started %r' % (m, miss))
    if errs: fails.append('console errors %r' % errs[:5])
    print('FAILS', fails)
    if fails: raise SystemExit(1)
