import asyncio, sys
from playwright.async_api import async_playwright
OUT='/workspace/pixel-hunt/screenshots/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        pg.on('console', lambda m: m.type=='error' and errs.append('console: '+m.text))
        await pg.goto('http://localhost:8799/index.html')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT+'1-title.png')
        await pg.click('#btn-play')
        await pg.wait_for_timeout(4500)
        box = await pg.eval_on_selector('#game','e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
        H = await pg.evaluate('document.getElementById("game").height/document.getElementById("game").width*180')
        async def tap_target():
            t = await pg.evaluate('PH.targets.filter(t=>t.state==="fly").map(t=>[t.x,t.y])')
            if not t: return False
            x,y=t[0]
            await pg.mouse.click(box[0]+x/180*box[2], box[1]+y/H*box[3])
            return True
        hit=False
        for i in range(40):
            if await tap_target(): hit=True; break
            await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(150)
        await pg.screenshot(path=OUT+'2-gameplay-hit.png')
        print('hit',hit,'score',await pg.evaluate('PH.score'),'money',await pg.evaluate('PH.money'),'shells',await pg.evaluate('PH.shells'))
        await pg.click('#btn-reload'); await pg.wait_for_timeout(1600)
        print('shells after reload', await pg.evaluate('PH.shells'))
        # later round with deer and multiple birds
        await pg.evaluate('PH.setMoney(500); PH.jumpRound(6)')
        await pg.wait_for_timeout(5200)
        await pg.mouse.click(box[0]+60, box[1]+300)
        await pg.wait_for_timeout(100)
        await pg.screenshot(path=OUT+'3-gameplay-round6.png')
        print('targets r6', await pg.evaluate('PH.targets.map(t=>t.kind+":"+t.state)'), 'missRun', await pg.evaluate('PH.missRun'), 'state', await pg.evaluate('PH.state'))
        # shop
        await pg.evaluate('PH.forceClear()')
        await pg.wait_for_function('PH.state==="shop"', timeout=8000)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'4-shop.png')
        await pg.click('.item .pbtn >> nth=0'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=OUT+'4b-shop-bought.png')
        await pg.click('#btn-next'); await pg.wait_for_timeout(2500)
        await pg.click('#btn-pause'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'5-pause.png')
        await pg.click('#btn-resume'); await pg.wait_for_timeout(300)
        # natural death: wait until 3 escape
        await pg.wait_for_function('PH.state==="ad"||PH.state==="dying"', timeout=60000)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'6-dying.png')
        await pg.wait_for_selector('#ov-continue:not(.hidden)', timeout=5000)
        await pg.screenshot(path=OUT+'7-continue.png')
        await pg.click('#btn-revive'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT+'8-rewarded-ad.png')
        await pg.wait_for_timeout(4500)
        await pg.click('.ad-close'); await pg.wait_for_timeout(500)
        print('after revive state', await pg.evaluate('PH.state'), 'missRun', await pg.evaluate('PH.missRun'))
        await pg.evaluate('PH.forceDie()')
        await pg.wait_for_selector('#ov-ad:not(.hidden)', timeout=5000)
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=OUT+'9-interstitial-ad.png')
        await pg.wait_for_timeout(4500)
        await pg.click('.ad-close')
        await pg.wait_for_selector('#ov-over:not(.hidden)', timeout=3000)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'10-game-over.png')
        print('best saved', await pg.evaluate('localStorage.getItem("pixelhunt.best")'))
        # desktop
        d = await b.new_page(viewport={'width':1280,'height':800})
        d.on('pageerror', lambda e: errs.append('desktop pageerror: '+str(e)))
        await d.goto('http://localhost:8799/index.html'); await d.wait_for_timeout(1000)
        await d.click('#btn-play'); await d.wait_for_timeout(2500); await d.mouse.move(640,300); await d.wait_for_timeout(200)
        await d.screenshot(path=OUT+'11-desktop.png')
        print('ERRORS', errs)
        await b.close()
asyncio.run(main())
