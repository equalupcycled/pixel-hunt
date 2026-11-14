# Audio + legal pages. usage: python3 tools/test_audio.py URL
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8799/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='networkidle')
    pg.wait_for_timeout(600)
    ev = pg.evaluate
    ev("document.getElementById('ov-daily') && document.getElementById('ov-daily').classList.add('hidden')")
    R = {}
    R['title'] = ev("""({
      sfx: !!document.getElementById('btn-sfx-t'),
      music: !!document.getElementById('btn-music-t'),
      sfxSize: (()=>{const r=document.getElementById('btn-sfx-t').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})(),
      musicSize: (()=>{const r=document.getElementById('btn-music-t').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})(),
      copy: document.querySelector('.title-legal') && document.querySelector('.title-legal').innerText,
      privacy: !!document.querySelector('a[href=\"privacy.html\"]'),
      terms: !!document.querySelector('a[href=\"terms.html\"]'),
      credits: !!document.getElementById('btn-about'),
      sLetter: (document.querySelector('#btn-sfx-t .icon-face')||{}).textContent,
      mLetter: (document.querySelector('#btn-music-t .icon-face')||{}).textContent,
      labels: [...document.querySelectorAll('#title-audio .audio-lbl')].map(e=>e.textContent),
      face: (()=>{const e=document.querySelector('#btn-sfx-t .icon-face'); const r=e.getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height)]})(),
      combined: !!document.querySelector('.audio-hint')
    })""")
    R['calls'] = ev("""(()=>{
      Sfx.init();
      const skip = new Set(['init','setMuted','setSfxOn','setMusicOn','setMusic']);
      const names = Object.keys(Sfx).filter(k => typeof Sfx[k] === 'function' && !skip.has(k));
      const failed = [];
      names.forEach(n => { try { n === 'cry' ? Sfx.cry('deer') : n === 'streak' ? Sfx.streak(3) : Sfx[n](); } catch (e) { failed.push(n+': '+e.message); } });
      try { Sfx.setMusic('menu'); Sfx.setSfxOn(true); Sfx.setMusicOn(true); } catch (e) { failed.push('reset: '+e.message); }
      const kinds = ['bird','blue','gold','deer','goose','swimgoose','owl','rabbit','wolf','vulture','roadrunner','coyote','bat','eyes','decoy','boss'];
      kinds.forEach(k => { try { Sfx.cry(k); } catch (e) { failed.push('cry '+k+': '+e.message); } });
      return { n: names.length, failed };
    })()""")
    # toggle sound and music
    ev("document.getElementById('btn-sfx-t').click()")
    ev("document.getElementById('btn-music-t').click()")
    R['toggles'] = ev("""({
      sfxOn: Sfx.sfxOn, musicOn: Sfx.musicOn,
      sfxOffClass: document.getElementById('btn-sfx-t').classList.contains('off'),
      musicOffClass: document.getElementById('btn-music-t').classList.contains('off'),
      mutedStore: localStorage.getItem('pixelhunt.muted'),
      musicStore: localStorage.getItem('pixelhunt.music')
    })""")
    ev("document.getElementById('btn-about').click()")
    R['about'] = ev("""({
      vis: !document.getElementById('ov-about').classList.contains('hidden'),
      text: document.querySelector('#ov-about .panel').innerText.slice(0, 200),
      x: !!document.getElementById('btn-about-close')
    })""")
    ev("document.getElementById('btn-about-close').click()")
    R['aboutClosed'] = ev("document.getElementById('ov-about').classList.contains('hidden')")
    # legal pages
    pg.goto(URL.rstrip('/') + '/privacy.html', wait_until='networkidle')
    R['privacy'] = ev("""({
      title: document.title,
      last: document.body.innerText.includes('Last updated Nov 14, 2026'),
      llc: document.body.innerText.includes('Cache Brands LLC'),
      ullin: document.body.innerText.includes('Ullin, IL 62992'),
      local: document.body.innerText.includes('local storage') || document.body.innerText.includes('local storage'.toUpperCase()) || /local storage/i.test(document.body.innerText),
      ads: /AdMob/i.test(document.body.innerText),
      coppa: /under 13/i.test(document.body.innerText),
      share: /Web Share|Facebook/i.test(document.body.innerText)
    })""")
    pg.goto(URL.rstrip('/') + '/terms.html', wait_until='networkidle')
    R['terms'] = ev("""({
      title: document.title,
      last: document.body.innerText.includes('Last updated Nov 14, 2026'),
      virtual: /no real-money value/i.test(document.body.innerText),
      illinois: /Illinois/i.test(document.body.innerText),
      cheating: /cheat/i.test(document.body.innerText),
      names: /leaderboard/i.test(document.body.innerText)
    })""")
    b.close()

for k,v in R.items():
    print(f'{k:12}', json.dumps(v))
print('errors', errs)
fails = []
if not R['title']['sfx'] or not R['title']['music']: fails.append('missing icon toggles')
if min(R['title']['sfxSize'] + R['title']['musicSize']) < 44: fails.append('icon tap target < 44: %r' % R['title'])
if R['title'].get('sLetter') != 'S' or R['title'].get('mLetter') != 'M': fails.append('letters should be S and M, %r' % R['title'])
if R['title'].get('labels') != ['SOUND', 'MUSIC']: fails.append('labels %r' % R['title'].get('labels'))
if R['title'].get('combined'): fails.append('combined SOUND · MUSIC label still present')
if R['title'].get('face') and not (36 <= R['title']['face'][0] <= 40 and 36 <= R['title']['face'][1] <= 40):
    fails.append('visual box should be 36-40px, %r' % R['title'].get('face'))
if 'Cache Brands LLC' not in (R['title']['copy'] or ''): fails.append('missing copyright')
if not R['title']['privacy'] or not R['title']['terms']: fails.append('missing legal links')
if R['calls']['failed']: fails.append('sfx threw: ' + ', '.join(R['calls']['failed']))
if R['toggles']['sfxOn'] or R['toggles']['musicOn']: fails.append('toggles did not turn off, %r' % R['toggles'])
if not R['toggles']['sfxOffClass'] or not R['toggles']['musicOffClass']: fails.append('off class missing')
if not R['about']['vis'] or not R['aboutClosed']: fails.append('credits overlay')
if not R['privacy']['last'] or not R['privacy']['ads'] or not R['privacy']['coppa']: fails.append('privacy incomplete %r' % R['privacy'])
if not R['terms']['last'] or not R['terms']['virtual'] or not R['terms']['illinois']: fails.append('terms incomplete %r' % R['terms'])
if errs: fails.append('js errors: ' + '; '.join(errs))
print('FAILS', fails)
if fails: raise SystemExit(1)
