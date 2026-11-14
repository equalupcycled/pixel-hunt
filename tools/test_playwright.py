# Headless test + screenshots: python3 tools/test_playwright.py  (serve the folder on :8799 first:
#   python3 -m http.server 8799 --directory /workspace/pixel-hunt)
import asyncio, base64, json
from playwright.async_api import async_playwright
URL = 'http://localhost:8799/index.html'
OUT = '/workspace/pixel-hunt/screenshots/'
errs = []

def watch(pg, tag=''):
    pg.on('pageerror', lambda e: errs.append(tag + 'pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(tag + 'console: ' + m.text))

async def part_a(b):
    """Original flow: daily, first hits, reload, shop, pause, revive ad, death ad, initials, game over, missions."""
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); watch(pg)
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload()
    await pg.wait_for_selector('#ov-daily:not(.hidden)', timeout=5000); await pg.wait_for_timeout(800)
    await pg.screenshot(path=OUT + '01-daily-reward.png')
    await pg.click('#btn-daily-claim'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=OUT + '02-title.png')
    await pg.click('#btn-play'); await pg.wait_for_timeout(2500)
    box = await pg.eval_on_selector('#game', 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
    H = (await pg.evaluate('PH.dims()'))['H']
    async def tap_target():
        t = await pg.evaluate('PH.targets.filter(t=>t.state==="fly" && t.kind!=="decoy").map(t=>[t.x,t.y])')
        if not t: return False
        x, y = t[0]; await pg.mouse.click(box[0] + x / 180 * box[2], box[1] + y / H * box[3]); return True
    for i in range(40):
        if await tap_target(): break
        await pg.wait_for_timeout(200)
    await pg.wait_for_timeout(120)
    await pg.screenshot(path=OUT + '03-gameplay-hit.png')
    print('A: score', await pg.evaluate('PH.score'), 'bank', await pg.evaluate('PH.money'), 'shells', await pg.evaluate('PH.shells'))
    await pg.click('#btn-reload'); await pg.wait_for_timeout(1600)
    print('A: shells after reload', await pg.evaluate('PH.shells'))
    await pg.evaluate('PH.jumpRound(6)'); await pg.wait_for_timeout(5000)
    await pg.screenshot(path=OUT + '04-gameplay-round6.png')
    await pg.evaluate('PH.setMoney(9000); PH.forceClear()')
    await pg.wait_for_function('PH.state==="shop"', timeout=8000); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + '05-armory-between-rounds.png')
    await pg.click('.item .pbtn:not([disabled]) >> nth=0'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + '06-armory-bought.png')
    print('A: bought', {k: v for k, v in json.loads(await pg.evaluate('JSON.stringify(PH.Meta.save.lv)')).items() if v}, 'bank', await pg.evaluate('PH.money'))
    await pg.click('#btn-next'); await pg.wait_for_timeout(2500)
    await pg.click('#btn-pause'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + '07-pause.png')
    await pg.click('#btn-resume'); await pg.wait_for_timeout(300)
    await pg.wait_for_function('PH.state==="ad"||PH.state==="dying"', timeout=90000); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + '08-dying.png')
    await pg.wait_for_selector('#ov-continue:not(.hidden)', timeout=5000)
    await pg.screenshot(path=OUT + '09-continue-offer.png')
    await pg.click('#btn-revive'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=OUT + '10-rewarded-ad.png')
    await pg.wait_for_timeout(4500); await pg.click('.ad-close'); await pg.wait_for_timeout(500)
    print('A: after revive', await pg.evaluate('PH.state'), 'missRun', await pg.evaluate('PH.missRun'))
    await pg.evaluate('PH.forceDie()')
    await pg.wait_for_selector('#ov-ad:not(.hidden)', timeout=5000); await pg.wait_for_timeout(1200)
    await pg.screenshot(path=OUT + '11-interstitial-ad.png')
    await pg.wait_for_timeout(4500); await pg.click('.ad-close')
    await pg.wait_for_selector('#ov-initials:not(.hidden)', timeout=3000); await pg.wait_for_timeout(300)
    for _ in range(9): await pg.click('.ini-col >> nth=0 >> button >> nth=0')   # A -> J
    await pg.click('.ini-col >> nth=1 >> button >> nth=1'); await pg.click('.ini-col >> nth=1 >> button >> nth=1')  # A -> 8
    await pg.click('.ini-col >> nth=2 >> button >> nth=0'); await pg.click('.ini-col >> nth=2 >> button >> nth=0'); await pg.click('.ini-col >> nth=2 >> button >> nth=0')  # D
    await pg.screenshot(path=OUT + '12-initials.png')
    await pg.click('#btn-ini-ok')
    await pg.wait_for_selector('#ov-over:not(.hidden)', timeout=3000); await pg.wait_for_timeout(2600)
    await pg.screenshot(path=OUT + '13-game-over.png')
    print('A: rank text', await pg.text_content('#go-rank'))
    bank0 = await pg.evaluate('PH.money')
    await pg.click('#btn-double'); await pg.wait_for_timeout(5600); await pg.click('.ad-close'); await pg.wait_for_timeout(400)
    print('A: bank before/after double', bank0, await pg.evaluate('PH.money'))
    await pg.click('#btn-menu'); await pg.wait_for_timeout(500)
    await pg.click('#btn-missions'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + '14-missions-achievements.png')
    await pg.click('#btn-missions-close')
    await pg.reload(); await pg.wait_for_timeout(1000)
    print('A: persisted bank', await pg.evaluate('PH.money'), 'runs', await pg.evaluate('PH.Meta.save.stats.runs'),
          'board', await pg.evaluate('localStorage.getItem("pixelhunt.board.v1")'))
    await ctx.close()

async def part_b(b):
    """Arsenal: armory tabs, every weapon firing, turrets, maps, bosses, leaderboard, share."""
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg = await ctx.new_page(); watch(pg, 'B ')
    await pg.goto(URL); await pg.evaluate('localStorage.clear()'); await pg.reload(); await pg.wait_for_timeout(600)
    await pg.evaluate("document.getElementById('ov-daily').classList.add('hidden')")
    U = (await pg.evaluate('PH.dims()'))['U']
    box = await pg.eval_on_selector('#game', 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top]}')
    P = lambda x, y: (box[0] + x * U, box[1] + y * U)
    # a mid-game save: some weapons owned, then the armory tabs
    await pg.evaluate("""(()=>{const s=PH.Meta.save; s.bank=48000; ['own.handgun','own.rifle','map.lake','turret.slots','own.pellet'].forEach(k=>s.lv[k]=1);
      s.lv['shotgun.cap']=3; s.lv['shotgun.reload']=4; s.lv['shotgun.choke']=3; s.lv['handgun.cap']=2; s.lv['eye']=3; s.lv['gadget.flak']=1; s.lv['bounty']=2; s.equip.turrets=['pellet']; PH.Meta.persist();})()""")
    await pg.click('#btn-armory'); await pg.wait_for_timeout(300)
    await pg.click('.card-h >> nth=1'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + '20-armory-weapons.png')
    for tab, name in [('turrets', '21-armory-turrets'), ('gear', '22-armory-gear'), ('maps', '23-armory-maps'), ('style', '24-armory-style')]:
        await pg.click(f'#shop-tabs button[data-tab="{tab}"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + name + '.png')
    await pg.click('#shop-tabs button[data-tab="weapons"]'); await pg.click('#btn-next'); await pg.wait_for_timeout(300)
    # unlock everything for the showcase
    await pg.evaluate('PH.grantAll(); PH.setMoney(250000)')

    async def start(weapon, map_id='meadow', rnd=8, turrets='[]'):
        await pg.evaluate(f"""(()=>{{const M=PH.Meta; M.equipWeapon('{weapon}','primary'); M.save.equip.secondary=null; M.save.equip.turrets={turrets}; M.selectMap('{map_id}'); M.persist(); PH.rebuild();}})()""")
        for sel in ['#ov-shop', '#ov-over', '#ov-board', '#ov-daily']:
            await pg.evaluate(f"document.querySelector('{sel}').classList.add('hidden')")
        await pg.evaluate("document.getElementById('ov-title').classList.remove('hidden')")
        await pg.click('#btn-play'); await pg.wait_for_timeout(300)
        await pg.evaluate(f'PH.jumpRound({rnd})'); await pg.wait_for_timeout(2600)
    async def target(pred='true', wait=8000):
        await pg.wait_for_function(f'PH.targets.some(t=>t.state==="fly" && t.kind!=="decoy" && t.y < PH.dims().GROUND && ({pred}))', timeout=wait)
        return await pg.evaluate(f'(()=>{{const t=PH.targets.find(t=>t.state==="fly" && t.kind!=="decoy" && t.y < PH.dims().GROUND && ({pred})); return [t.x+t.vx*0.05, t.y+(t.vy||0)*0.05]}})()')
    async def quit():
        await pg.evaluate("PH.forceClear()"); await pg.click('#btn-pause'); await pg.click('#btn-quit'); await pg.wait_for_timeout(200)

    results = {}
    for w in ['shotgun', 'handgun', 'rifle']:
        await start(w)
        sc0 = await pg.evaluate('PH.score')
        x, y = await target('t.y>80')
        await pg.mouse.click(*P(x, y)); await pg.wait_for_timeout(40)
        await pg.screenshot(path=OUT + f'30-weapon-{w}.png')
        for _ in range(6):
            try: x, y = await target('true', 3000); await pg.mouse.click(*P(x, y)); await pg.wait_for_timeout(260)
            except Exception: pass
        results[w] = (await pg.evaluate('PH.score')) - sc0
        await quit()
    # bow: hold to draw (shows the arc preview), release, arrow in flight
    await start('bow')
    x, y = await target('t.y>90')
    await pg.mouse.move(*P(x, y - 6)); await pg.mouse.down(); await pg.wait_for_timeout(420)
    await pg.screenshot(path=OUT + '31-weapon-bow-draw.png')
    await pg.mouse.up(); await pg.wait_for_timeout(110)
    await pg.screenshot(path=OUT + '32-weapon-bow-arrow.png')
    print('B: arrows in flight', await pg.evaluate('PH.projs.filter(p=>p.type==="arrow").length'))
    await quit()
    # machine gun: hold to spray
    await start('mg', rnd=12)
    x, y = await target('t.y>80'); sc0 = await pg.evaluate('PH.score')
    await pg.mouse.move(*P(x, y)); await pg.mouse.down()
    for k in range(6):
        try: x, y = await target('true', 1500); await pg.mouse.move(*P(x, y))
        except Exception: pass
        await pg.wait_for_timeout(70)
    await pg.screenshot(path=OUT + '33-weapon-mg.png')
    await pg.mouse.up(); results['mg'] = (await pg.evaluate('PH.score')) - sc0
    print('B: mg ammo left', await pg.evaluate('PH.weapon.ammo'), '/', await pg.evaluate('PH.weapon.cap'))
    await quit()
    # laser: hold the beam, it heats up; vent
    await start('laser', rnd=12)
    x, y = await target('t.y>80'); sc0 = await pg.evaluate('PH.score')
    await pg.mouse.move(*P(x, y)); await pg.mouse.down()
    for k in range(5):
        try: x, y = await target('true', 1500); await pg.mouse.move(*P(x, y))
        except Exception: pass
        await pg.wait_for_timeout(60)
    await pg.screenshot(path=OUT + '34-weapon-laser.png')
    await pg.mouse.up(); results['laser'] = (await pg.evaluate('PH.score')) - sc0
    heat = await pg.evaluate('PH.weapon.heat'); await pg.click('#btn-reload'); await pg.wait_for_timeout(1200)
    print('B: laser heat before/after vent', round(heat, 2), await pg.evaluate('PH.weapon.heat'))
    await quit()
    print('B: points scored per weapon in the quick fire test', results)

    # turrets: 3 mounted, player does nothing
    await start('shotgun', rnd=12, turrets="['pellet','tesla','missile']")
    await pg.wait_for_function('PH.turrets.some(t=>t.ammo<t.ammo0)', timeout=20000); await pg.wait_for_timeout(120)
    await pg.screenshot(path=OUT + '35-turrets-in-action.png')
    await pg.wait_for_timeout(5000)
    print('B: turret ammo', await pg.evaluate('PH.turrets.map(t=>t.id+":"+t.ammo+"/"+t.ammo0)'), 'turret kills', await pg.evaluate('PH.Meta.save.stats.turretKills'))
    await pg.screenshot(path=OUT + '36-turrets-later.png')
    await quit()

    # gadgets: flak + decoy
    await start('handgun', rnd=9)
    await pg.wait_for_timeout(800)
    await pg.click('#btn-decoy'); await pg.wait_for_timeout(600)
    await pg.click('#btn-flak'); x, y = await target('true'); await pg.mouse.click(*P(x, y)); await pg.wait_for_timeout(420)
    await pg.screenshot(path=OUT + '37-gadgets-flak-decoy.png')
    await quit()

    # maps
    for i, (m, w) in enumerate([('meadow', 'shotgun'), ('lake', 'rifle'), ('snow', 'bow'), ('desert', 'handgun'), ('night', 'shotgun')]):
        await start(w, m, rnd=6)
        await pg.wait_for_timeout(2200)
        if m == 'night':
            x, y = await target('true'); await pg.evaluate(f'PH.setAim({x},{y})'); await pg.mouse.move(*P(x, y)); await pg.wait_for_timeout(100)
        await pg.screenshot(path=OUT + f'4{i}-map-{m}.png')
        await quit()

    # boss fights
    for m, w, name in [('meadow', 'rifle', '50-boss-eagle'), ('meadow', 'shotgun', '51-boss-buck'), ('snow', 'mg', '52-boss-yeti-owl')]:
        await start(w, m, rnd=(20 if 'buck' in name else 10))
        await pg.wait_for_function('PH.boss && PH.boss.risen', timeout=30000)
        for k in range(4):
            bx, by = await pg.evaluate('[PH.boss.x, PH.boss.y]')
            if w == 'mg':
                await pg.mouse.move(*P(bx, by)); await pg.mouse.down(); await pg.wait_for_timeout(300); await pg.mouse.up()
            else:
                await pg.mouse.click(*P(bx, by))
            await pg.wait_for_timeout(500 if w != 'mg' else 100)
            if w == 'rifle' or w == 'shotgun': await pg.click('#btn-reload'); await pg.wait_for_timeout(450)
        await pg.screenshot(path=OUT + name + '.png')
        print('B:', name, 'boss hp', await pg.evaluate('PH.boss ? PH.boss.hp.toFixed(1)+"/"+PH.boss.hp0+" timer "+PH.boss.timer.toFixed(1) : "down/escaped"'))
        await quit()
    # a boss kill end-to-end (laser, maxed) -> achievement
    await start('laser', 'meadow', rnd=10)
    await pg.wait_for_function('PH.boss && PH.boss.risen', timeout=30000)
    await pg.mouse.down()
    for k in range(120):
        alive = await pg.evaluate('!!PH.boss')
        if not alive: break
        bx, by = await pg.evaluate('[PH.boss.x, PH.boss.y]'); await pg.mouse.move(*P(bx, by)); await pg.wait_for_timeout(50)
        if await pg.evaluate('PH.weapon.overheated'):
            await pg.mouse.up(); await pg.click('#btn-reload'); await pg.wait_for_timeout(900); await pg.mouse.down()
    await pg.mouse.up(); await pg.wait_for_timeout(300)
    print('B: bosses defeated', await pg.evaluate('PH.Meta.save.stats.bosses'), 'boss1 ach', await pg.evaluate('!!PH.Meta.save.ach.boss1'))
    await pg.screenshot(path=OUT + '53-boss-down.png')
    await quit()

    # leaderboard + share
    await pg.evaluate("""(async()=>{const L=Leaderboard; const rows=[['ACE',182300,22,'laser'],['JD',151550,19,'rifle'],['BOB',98200,15,'shotgun'],['ZZZ',64000,12,'bow'],['KIM',51550,14,'handgun'],['MAX',23800,9,'mg']];
       for (const [i,s,r,w] of rows) await L.submitScore('lake',{initials:i,score:s,round:r,weapon:w,ts:Date.now()+s});
       await L.submitScore('meadow',{initials:'JDD',score:77700,round:12,weapon:'shotgun'});})()""")
    await pg.evaluate("PH.openBoard('lake')"); await pg.wait_for_timeout(400)
    await pg.screenshot(path=OUT + '60-leaderboard-lake.png')
    # Web Share API path (stubbed)
    await pg.evaluate("""window.__shared=null; navigator.canShare=()=>true; navigator.share=async d=>{window.__shared={title:d.title,text:d.text,url:d.url,files:(d.files||[]).map(f=>f.name+':'+f.type+':'+f.size)};}; 0""")
    await pg.click('#btn-board-share'); await pg.wait_for_timeout(600)
    print('B: navigator.share got', await pg.evaluate('JSON.stringify(window.__shared)'))
    # Facebook fallback path (no Web Share API)
    await pg.evaluate("""delete navigator.share; Object.defineProperty(navigator,'share',{value:undefined,configurable:true}); window.__opened=null; window.open=(u)=>{window.__opened=u; return null;}; 0""")
    await pg.click('#btn-board-share'); await pg.wait_for_timeout(600)
    print('B: fallback opened', await pg.evaluate('window.__opened'))
    await pg.click('#btn-board-close')
    # share card + OG banner images
    for o, path in [("{score:51550,round:14,map:'lake',mapName:'Lake'}", OUT + '61-share-card.png'), ('{}', '/workspace/pixel-hunt/icons/share-banner.png')]:
        d = await pg.evaluate(f'PH.makeCard({o})')
        open(path, 'wb').write(base64.b64decode(d.split(',')[1]))
    # game-over screen with SHARE button
    await start('rifle', 'lake', rnd=14)
    await pg.evaluate('AD_CONFIG.interstitialSeconds=1; AD_CONFIG.rewardedSeconds=1')
    await pg.wait_for_timeout(1500); await pg.evaluate('PH.forceDie()')
    await pg.wait_for_selector('#ov-continue:not(.hidden)', timeout=5000); await pg.click('#btn-norevive')
    await pg.wait_for_selector('#ov-ad:not(.hidden)', timeout=5000); await pg.wait_for_timeout(1300); await pg.click('.ad-close')
    await pg.wait_for_timeout(500)
    if await pg.is_visible('#ov-initials'): await pg.click('#btn-ini-ok')
    await pg.wait_for_selector('#ov-over:not(.hidden)', timeout=3000); await pg.wait_for_timeout(2600)
    await pg.screenshot(path=OUT + '62-game-over-share.png')
    # title with map selector
    await pg.click('#btn-menu'); await pg.wait_for_timeout(300); await pg.evaluate("document.getElementById('ov-daily').classList.add('hidden')")
    await pg.click('#btn-map-next'); await pg.wait_for_timeout(500)
    await pg.screenshot(path=OUT + '63-title-map-select.png')
    await ctx.close()

async def part_mig(b):
    ctx = await b.new_context(); pg = await ctx.new_page(); watch(pg, 'mig ')
    await pg.goto('http://localhost:8799/manifest.webmanifest')
    await pg.evaluate("""localStorage.clear(); localStorage.setItem('pixelhunt.save.v1', JSON.stringify({bank:12345, lv:{gun:3,reload:4,choke:2,focus:1,luck:0,eye:2,bounty:1}, stats:{runs:7,kills:200}})); localStorage.setItem('pixelhunt.best','42000'); 0""")
    await pg.goto(URL); await pg.wait_for_timeout(800)
    print('MIG: v1 -> v2', await pg.evaluate("JSON.stringify({bank:PH.Meta.save.bank, cap:PH.Meta.save.lv['shotgun.cap'], reload:PH.Meta.save.lv['shotgun.reload'], choke:PH.Meta.save.lv['shotgun.choke'], focus:PH.Meta.save.lv.focus, eye:PH.Meta.save.lv.eye, bounty:PH.Meta.save.lv.bounty, best:PH.Meta.save.bestByMap.meadow, runs:PH.Meta.save.stats.runs, primary:PH.Meta.save.equip.primary})"))
    await ctx.close()

async def part_c(b):
    d = await b.new_page(viewport={'width': 1280, 'height': 800}); watch(d, 'desktop ')
    await d.goto(URL); await d.wait_for_timeout(1000)
    if await d.is_visible('#btn-daily-claim'): await d.click('#btn-daily-claim')
    await d.click('#btn-play'); await d.wait_for_timeout(2500); await d.mouse.move(640, 300); await d.wait_for_timeout(200)
    await d.screenshot(path=OUT + '70-desktop.png')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await part_a(b)
        await part_b(b)
        await part_mig(b)
        await part_c(b)
        print('ERRORS', errs)
        await b.close()
asyncio.run(main())
