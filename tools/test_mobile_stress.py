import sys
from playwright.sync_api import sync_playwright
MODES={'A-no-native-click':"document.addEventListener('click',e=>{if(e.isTrusted){e.stopImmediatePropagation();e.preventDefault();}},true);",
       'B-AudioContext-throws':"window.AudioContext=window.webkitAudioContext=function(){throw new Error('NotAllowedError: audio blocked')};"}
with sync_playwright() as p:
  for label,url in [('LIVE(before)','https://pixel-hunt-o4vw.onrender.com/'),('FIXED(local)','http://localhost:8799/')]:
    for bt,dev in [('webkit','iPhone 13'),('chromium','Pixel 7')]:
      for m,js in MODES.items():
        errs=[]; b=getattr(p,bt).launch(); c=b.new_context(**p.devices[dev]); c.add_init_script(js); pg=c.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e)[:80]))
        pg.goto(url,wait_until='networkidle'); pg.wait_for_timeout(900)
        vis=lambda s: pg.evaluate(f"!document.querySelector('{s}').classList.contains('hidden')")
        def tap(sel):
            r=pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()"); pg.touchscreen.tap(*r); pg.wait_for_timeout(900)
        tap('#btn-daily-claim'); d=not vis('#ov-daily')
        if not d: pg.evaluate("document.getElementById('ov-daily').classList.add('hidden')")
        tap('#btn-play'); g=not vis('#ov-title')
        print(f"{label:13} {dev:9} {m:22} claim works={d!s:5} play works={g!s:5} pageerrors={errs[:1]}")
        b.close()
