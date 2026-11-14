# Lose rule (3 X total) + checkpoints, touch at 390x844.  usage: python3 tools/test_checkpoints.py URL TAG
import sys, json
from playwright.sync_api import sync_playwright
URL, TAG = sys.argv[1], sys.argv[2]; OUT = '/workspace/pixel-hunt/screenshots/'
with sync_playwright() as p:
    b = p.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True); pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(800)
    ev = pg.evaluate; vis = lambda s: ev(f"!document.querySelector('{s}').classList.contains('hidden')")
    def tap(sel):
        r = ev(f"(()=>{{const e=document.querySelector('{sel}');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()"); pg.touchscreen.tap(*r); pg.wait_for_timeout(500)
    cv = lambda: ev("(()=>{const r=document.getElementById('game').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    def shoot_target(timeout=15000):
        ev("1"); pg.wait_for_function("PH.targets.some(t=>t.state==='fly'&&t.kind!=='decoy'&&t.x>25&&t.x<150)", timeout=timeout)
        x, y = ev("(()=>{const t=PH.targets.find(t=>t.state==='fly'&&t.kind!=='decoy'&&t.x>25&&t.x<150);return [t.x+t.vx*0.03,t.y+(t.vy||0)*0.03]})()")
        k = cv(); d = ev("PH.dims()"); pg.touchscreen.tap(k[0] + x / 180 * k[2], k[1] + y / d['H'] * k[3]); pg.wait_for_timeout(300)
    def finish_death():
        pg.wait_for_function("PH.state==='dying'||!document.getElementById('ov-continue').classList.contains('hidden')", timeout=20000); pg.wait_for_timeout(1900)
        if vis('#ov-continue'): tap('#btn-norevive')
        pg.wait_for_function("!document.getElementById('ov-ad').classList.contains('hidden')", timeout=5000)
        pg.wait_for_function("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()", timeout=10000); tap('.ad-close')
        pg.wait_for_timeout(700)
    R = {}
    if vis('#ov-daily'): tap('#btn-daily-claim')
    tap('#btn-play'); pg.wait_for_timeout(1800)
    # 1) a hit does NOT clear X's
    ev("PH.setMiss(1)"); kills0 = ev("PH.Meta.save.stats.kills")
    for _ in range(4):
        try: shoot_target()
        except Exception: pass
        if ev("PH.Meta.save.stats.kills") > kills0: break
    R['hit_keeps_X'] = {'kills': ev("PH.Meta.save.stats.kills") - kills0, 'missRun_after_hit': ev("PH.missRun")}
    # 2) perfect round gives one X back
    ev("PH.setMiss(2); PH.perfectClear()"); pg.wait_for_timeout(600); R['perfect_gives_back'] = ev("PH.missRun")
    pg.wait_for_function("PH.state!=='clear'", timeout=8000); pg.wait_for_timeout(300)
    if vis('#ov-shop'): tap('#btn-next'); pg.wait_for_timeout(300)
    # 3) reach round 5 checkpoint -> banner
    ev("PH.jumpRound(5)"); pg.wait_for_timeout(700)
    pg.screenshot(path=OUT + f'95-checkpoint-banner-{TAG}.png')
    R['ckpt_saved'] = ev("PH.checkpoint('meadow')")
    # 4) die by 3 escapes total (X's carried) -> continue offer -> ad -> game over choice
    ev("PH.setMiss(2)"); finish_death()
    R['name_entry_fresh_run'] = vis('#ov-name')
    if vis('#ov-name'): tap('#btn-name-ok'); pg.wait_for_timeout(500)
    R['over_buttons'] = ev("[document.getElementById('btn-ckpt').innerText.replace(/\\n/g,' | '), document.getElementById('btn-again').innerText.replace(/\\n/g,' | '), !document.getElementById('btn-ckpt').classList.contains('hidden')]")
    ev("document.getElementById('btn-ckpt').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT + f'96-gameover-choice-{TAG}.png')
    best0 = ev("PH.Meta.save.bestByMap.meadow||0"); board0 = ev("JSON.stringify(localStorage.getItem('pixelhunt.board')||'')")
    # 5) continue from checkpoint: round 5, X cleared, score 0, unranked
    tap('#btn-ckpt'); pg.wait_for_timeout(1200)
    R['continue'] = ev("({round: PH.round, miss: PH.missRun, score: PH.score, fromCkpt: PH.fromCkpt, state: PH.state})")
    ev("PH.setMiss(PH.maxMiss-1)"); finish_death()
    R['ckpt_run_over'] = {'name_entry': vis('#ov-name'), 'unranked_label': ev("document.getElementById('go-unranked').innerText"), 'best_unchanged': ev("PH.Meta.save.bestByMap.meadow||0") == best0}
    # 6) boss round 10: checkpoint + boss
    tap('#btn-ckpt'); pg.wait_for_timeout(800); ev("PH.jumpRound(10)"); pg.wait_for_timeout(900)
    R['boss_ckpt'] = {'ckpt': ev("PH.checkpoint('meadow')"), 'boss': ev("!!PH.boss || PH.targets.some(t=>t.kind==='boss') || 'queued'")}
    pg.screenshot(path=OUT + f'97-checkpoint-boss-{TAG}.png')
    # 7) Lucky Feather -> 5 allowed
    ev("PH.Meta.save.lv.luck=2; PH.Meta.persist()"); ev("PH.forceDie()"); finish_death()
    if vis('#ov-name'): tap('#btn-name-ok')
    tap('#btn-again'); pg.wait_for_timeout(1200); R['feather_maxMiss'] = ev("PH.maxMiss"); R['fresh_after_again'] = ev("({round:PH.round, fromCkpt:PH.fromCkpt})")
    for k, v in R.items(): print(f'{k:22}', json.dumps(v))
    print('errors', errs); b.close()
