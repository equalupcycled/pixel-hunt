import sys, json, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv)>1 else 'https://pixel-hunt-o4vw.onrender.com/'
TAG = sys.argv[2] if len(sys.argv)>2 else 'pre'
def run(p, name, btype, dev):
    errs=[]; log=[]
    b = getattr(p,btype).launch(); c = b.new_context(**p.devices[dev]); pg=c.new_page()
    pg.on('pageerror',lambda e:errs.append('pageerror: '+str(e)))
    pg.on('console',lambda m: m.type in('error','warning') and errs.append(m.type+': '+m.text))
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(1200)
    vis=lambda s: pg.evaluate(f"(()=>{{const e=document.querySelector('{s}');return !!e && !e.classList.contains('hidden') && e.offsetParent!==null}})()")
    def ftap(sel):
        r = pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const t=document.elementFromPoint(x,y);return [x,y,!!t&&(t===e||e.contains(t)), t&&(t.id||t.className||t.tagName)]}})()")
        x,y,ok,top=r
        pg.touchscreen.tap(x,y); log.append(f"tap {sel} hitTop={ok}" + ("" if ok else f" (covered by {top})"))
        pg.wait_for_timeout(350)
    if vis('#ov-daily'): ftap('#btn-daily-claim')
    log.append(f"daily gone={not vis('#ov-daily')}")
    ftap('#btn-play'); pg.wait_for_timeout(1200)
    log.append(f"title gone={not vis('#ov-title')}")
    st=lambda: pg.evaluate("(()=>{const r=document.getElementById('btn-reload');return {reload:r&&r.textContent.trim()}})()")
    cv = pg.evaluate("(()=>{const r=document.getElementById('game').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    top = pg.evaluate(f"(()=>{{const t=document.elementFromPoint({cv[0]+cv[2]/2},{cv[1]+cv[3]*0.35});return t&&(t.id||t.tagName)}})()")
    log.append(f"element over sky = {top}")
    before = st(); 
    for i in range(3): pg.touchscreen.tap(cv[0]+cv[2]*(0.2+0.3*i), cv[1]+cv[3]*0.3); pg.wait_for_timeout(250)
    log.append(f"shots: reload btn {before} -> {st()}")
    ftap('#btn-reload'); pg.wait_for_timeout(2500); log.append(f"after reload {st()}")
    # survive-less: keep shooting empty corners until death/continue
    t0=time.time()
    while time.time()-t0<150 and not (vis('#ov-continue') or vis('#ov-over') or vis('#ov-ad')):
        pg.touchscreen.tap(cv[0]+cv[2]*0.05, cv[1]+cv[3]*0.12); pg.wait_for_timeout(700)
        if 'RELOAD' in (st()['reload'] or '').upper() and pg.evaluate("document.getElementById('btn-reload').classList.contains('need')"): ftap('#btn-reload')
    log.append(f"died in {time.time()-t0:.0f}s continue={vis('#ov-continue')} ad={vis('#ov-ad')} over={vis('#ov-over')}")
    if vis('#ov-continue'): ftap('#btn-norevive'); pg.wait_for_timeout(500)
    log.append(f"ad shown={vis('#ov-ad')}")
    t0=time.time()
    while vis('#ov-ad') and time.time()-t0<20:
        if pg.evaluate("(()=>{const b=document.querySelector('.ad-close');return b&&!b.disabled})()"): ftap('.ad-close')
        pg.wait_for_timeout(500)
    pg.wait_for_timeout(800)
    if vis('#ov-name'):
        log.append('name entry shown'); ftap('#btn-name-ok'); pg.wait_for_timeout(500)
    log.append(f"game over shown={vis('#ov-over')}")
    pg.screenshot(path=f'/workspace/pixel-hunt/screenshots/81-{TAG}-{name}-gameover.png')
    if vis('#ov-over'): ftap('#btn-again'); pg.wait_for_timeout(800); log.append(f"play again -> over gone={not vis('#ov-over')}")
    print('==',name); [print('  ',l) for l in log]; print('   errors:',errs)
    b.close()
with sync_playwright() as p:
    for a in [('webkit-iphone13','webkit','iPhone 13'),('webkit-iphone14','webkit','iPhone 14'),('chromium-pixel7','chromium','Pixel 7')]:
        try: run(p,*a)
        except Exception as e: print(a[0],'FAILED',str(e)[:500])
