# p8: the orbit as decoration. python3 gen7.py -> p8-page.html
# The hero visual keeps the exploded view (the part the maintainer liked) and drops the story: no stations,
# no travel, no finding, no checks. One token sits in the centre; every ~12 s it lifts, its parts drift out
# into two slow rings, hold, and settle back. Phone: a compact orbit above the headline. Desktop: text left,
# orbit right. Borders only; the lines-only grid shadow under the token is the only depth.
# Scene 02 on phones: one card, redlined (changed regions outlined in signal red with the token named),
# instead of two stacked cards (spec decision 7's presentation, brought forward for the phone).
import math
import gen5
import gen6

CYC = 12.0


def kf(name, frames):
    props = sorted({p for _, d in frames for p in d})
    cur, out = {}, []
    for t, d in frames:
        for p in props:
            if p in d:
                cur[p] = d[p]
        for p in props:
            cur.setdefault(p, frames[0][1].get(p))
        out.append(f"{t/CYC*100:.3f}%{{{';'.join(f'{p}:{cur[p]}' for p in props)}}}")
    return f"@keyframes {name}{{{''.join(out)}}}"


# one cycle: exploded at rest (the first frame is the picture); 8.0 settle into the chip, 10.4 lift and explode again
GND = {'translate': '0 0', 'scale': '1'}
AIR = {'translate': '0 -8px', 'scale': '1.1'}
lift = kf('lf', [(0, AIR), (8.0, AIR), (8.8, GND), (10.4, GND), (11.2, AIR), (CYC, AIR)])
loupe = kf('loupe', [(0, {'scale': '1', 'opacity': '1'}), (8.0, {'scale': '1', 'opacity': '1'}), (8.9, {'scale': '.8', 'opacity': '.35'}),
                     (10.4, {'scale': '.8', 'opacity': '.35'}), (11.3, {'scale': '1', 'opacity': '1'}), (CYC, {'scale': '1', 'opacity': '1'})])
PARTS = [('o1', -90, 'r1', .0), ('o2', 30, 'r1', .1), ('o3', 150, 'r1', .2), ('o4', -150, 'r2', .3), ('o5', -30, 'r2', .4), ('o6', 70, 'r2', .5)]
static = []


def part_out(ang, rv):
    return f"calc(-50% + var(--{rv}) * {math.cos(math.radians(ang)):.3f}) calc(-50% + var(--{rv}) * {math.sin(math.radians(ang)):.3f})"


def partkf(name, ang, rv, d):
    home = {'translate': '-50% -50%', 'opacity': '0', 'scale': '.4'}
    out = {'translate': part_out(ang, rv), 'opacity': '1', 'scale': '1'}
    static.append(f".{name}{{translate:{part_out(ang, rv)};opacity:1;scale:1}}")
    return kf(name, [(0, out), (8.0, out), (8.6 + d * .5, home), (10.4 + d, home), (11.3 + d, out), (CYC, out)])


orbit = [partkf(*p) for p in PARTS]
# lines-only shadow: tucked under the chip at rest, larger while lifted
G = {'mask-size': '104px 62px', 'mask-position': 'calc(var(--ox) + var(--pcx) - 43px) calc(var(--oy) + var(--pcy) - 18px)'}
A = {'mask-size': '140px 86px', 'mask-position': 'calc(var(--ox) + var(--pcx) - 61px) calc(var(--oy) + var(--pcy) - 22px)'}
shadow = kf('ls-tok', [(0, A), (8.0, A), (8.8, G), (10.4, G), (11.2, A), (CYC, A)])
allkf = '\n'.join([lift, loupe, shadow, '@keyframes spin{to{rotate:360deg}}', '@keyframes spin-r{to{rotate:-360deg}}'] + orbit)
T = f"{CYC}s"
anim = f"animation-duration:{T};animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-iteration-count:infinite;animation-fill-mode:both"

tiles = '<span class="tiles"><i>{ }</i><i>tw</i><i>js</i></span>'
split = gen5.split

M = dict(w=300, h=300, r1='66px', r2='112px')
Dk = dict(w=540, h=540, r1='110px', r2='186px')


def layout(L):
    cx, cy = L['w'] // 2, L['h'] // 2
    return (f".stage{{width:{L['w']}px;height:{L['h']}px;--pc:{cx}px {cy}px;--r1:{L['r1']};--r2:{L['r2']}}}:root{{--pcx:{cx}px;--pcy:{cy}px}}"
            f".loupe{{width:calc(var(--r1)*2);height:calc(var(--r1)*2)}}.loupe::after{{inset:calc(var(--r1) - var(--r2))}}")


HERO_CSS = f"""
*{{box-sizing:border-box}}
body{{position:relative;margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;min-height:100vh;
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.ls{{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:0;
 background-image:linear-gradient(0deg,var(--line-ink) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--line-ink) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--line-ink-2) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--line-ink-2) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px;
 -webkit-mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation:ls-tok {T} cubic-bezier(.5,0,.2,1) infinite}}
.w{{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
nav{{display:flex;justify-content:space-between;align-items:center;padding-block:14px;font-size:13px}}nav b{{font-weight:600}}nav span{{display:flex;gap:14px;align-items:center;color:var(--muted)}}
nav a{{color:inherit;text-decoration:none}}nav a:hover{{color:var(--ink)}}
.tt{{all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--rule-strong);font-size:13px}}.tt:focus-visible{{outline:2px solid var(--blue);outline-offset:2px}}
.hero{{display:grid;gap:24px;padding-block:8px 24px;align-items:center;justify-items:center}}.hero .stage{{order:-1}}.hero .copy{{position:relative;min-width:0}}
.hero .copy{{justify-self:stretch;min-width:0}}
h1{{font:700 34px/1.04 var(--sans);letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}}h1 i{{color:var(--blue)}}
.lede{{color:var(--muted);font-size:17px;line-height:1.5;max-width:36ch;margin:0 0 22px;text-wrap:pretty}}
.ctas{{display:flex;gap:8px;flex-wrap:wrap}}.btn-p,.btn-o{{padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}}.btn-p{{background:var(--ink);color:var(--btn-fg);font-family:var(--mono);font-size:13px}}.btn-o{{box-shadow:inset 0 0 0 1.5px var(--ink)}}
.stage{{position:relative;max-width:100%;touch-action:manipulation}}
.tok{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}
.lift{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;animation:lf {T} cubic-bezier(.5,0,.2,1) infinite;transform-origin:50% 50%}}
.chip{{width:52px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 6px;border:1px solid var(--rule)}}
.chip i{{width:14px;height:14px;border-radius:4px;background:var(--sw);flex:none}}.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.loupe{{position:absolute;left:0;top:0;translate:var(--pc);margin:calc(var(--r1) * -1) 0 0 calc(var(--r1) * -1);border-radius:50%;border:1.5px dashed var(--blue-2);animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite,spin 60s linear infinite}}
.loupe::after{{content:'';position:absolute;border-radius:50%;border:1.5px dashed var(--grid-2);animation:spin-r 90s linear infinite}}
.part{{position:absolute;left:0;top:0;margin:0;{anim}}}
.pc{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}.pc.in{{animation:spin 60s linear infinite}}.pc.out{{animation:spin-r 90s linear infinite}}
.up{{display:block;animation:spin-r 60s linear infinite}}.pc.out .up{{animation-name:spin}}.pc.out .up{{animation-duration:90s}}
.sw{{display:block;width:16px;height:16px;border-radius:5px;background:var(--sw)}}
.split{{display:flex;width:26px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.dot{{display:block;width:10px;height:10px;border-radius:50%;background:var(--sw)}}.dot.l{{background:var(--sw-l)}}
.o1{{animation-name:o1}}.o2{{animation-name:o2}}.o3{{animation-name:o3}}.o4{{animation-name:o4}}.o5{{animation-name:o5}}.o6{{animation-name:o6}}
.paused *{{animation-play-state:paused!important}}
{layout(M)}
/* A board: a rounded surface panel the size of the orbit */
.v-board .stage{{background:var(--surface);border:1px solid var(--rule);border-radius:32px}}.v-board .ls{{display:none}}
/* B disc: a filled surface circle behind the rings */
.v-disc .stage::before{{content:'';position:absolute;inset:0;border-radius:50%;background:var(--surface);border:1px solid var(--rule)}}.v-disc .ls{{display:none}}
/* C band: the whole hero on a surface band, grid and line shadow kept (the band starts at the body origin, so its grid aligns) */
.band{{display:none;position:absolute;left:0;top:0;width:100%;height:var(--band-h,0px);background-color:var(--surface);border-bottom:1px solid var(--rule);
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.v-band .band{{display:block}}.v-band .ls{{z-index:0}}
.vsw{{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom,0px));translate:-50% 0;z-index:5;display:flex;padding:3px;border-radius:999px;background:var(--bg);border:1.5px solid var(--rule-strong)}}
.vsw button{{all:unset;cursor:pointer;padding:7px 11px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--muted)}}.vsw button[aria-pressed="true"]{{background:var(--ink);color:var(--bg)}}.vsw button:focus-visible{{outline:2px solid var(--blue);outline-offset:2px}}
@media (max-width:559px){{nav .nl{{display:none}}}}
@media (min-width:1000px){{.hero{{grid-template-columns:minmax(0,1fr) auto;gap:48px;padding-block:56px 48px}}.hero .stage{{order:0}}h1{{font-size:46px}}{layout(Dk)}.loupe,.loupe::after{{border-width:2px}}}}
@media (prefers-reduced-motion:reduce){{.stage *,.ls{{animation:none!important}}.pc,.up{{rotate:0deg}}.ls{{display:none}}.loupe{{scale:1;opacity:1}}{''.join(static)}}}
{allkf}
/* scene 02 on phones: one redlined card instead of two stacked */
.rl{{display:none}}
@media (max-width:559px){{
 .pair>div:first-child{{display:none}}.pair .lbl.chg{{color:var(--faint)}}.pair .lbl.chg::after{{content:' · changes outlined'}}
 .card.after .go{{outline:2px dashed var(--red);outline-offset:3px}}
 .rl{{display:block;position:absolute;font:500 10px/1 var(--mono);color:var(--red);pointer-events:none}}
 .rl.corner{{left:6px;top:6px;width:40px;height:40px;border-left:2px dashed var(--red);border-top:2px dashed var(--red);border-top-left-radius:20px}}
 .rl.t1{{left:30px;top:10px;padding:3px 6px;background:var(--bg);border-radius:4px}}
 .rl.t2{{right:16px;bottom:30px;padding:3px 6px;background:var(--bg);border-radius:4px}}
}}
"""


def after_card():
    c = gen6.card(24, '--ex-600')
    c = c.replace('<div class="card"', '<div class="card after"', 1)
    return c[:-6] + '<span class="rl corner" aria-hidden="true"></span><span class="rl t1">Radius.Card 8 → 24</span><span class="rl t2">Nova 500 → 600</span></div>'


BODY = gen6.BODY.replace(gen6.card(24, '--ex-600'), after_card())
BODY = BODY.replace('Prototype p7 · the p6 hero (lap 1, borders) in the full page · tap the board to pause', 'Prototype p8 · the orbit as decoration on three grounds (switch at the bottom) · tap the orbit to pause')

HTML = f"""<title>DTA landing page</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{gen5.tokens}
{HERO_CSS}
{gen6.CSS}</style>
<div class="band" aria-hidden="true"></div><div class="ls" aria-hidden="true"></div>
<div class="w">
<nav><b>Design Token Authority</b><span><span class="nl"><a href="#story">How it works</a> · <a href="#agents">Agents</a> · </span><a href="#">Docs</a> <button class="tt" id="tt" type="button" aria-label="Toggle theme">◐</button></span></nav>
<header class="hero">
 <div class="copy">
  <h1>The deterministic backbone for design token workflows, built for humans and <i>agents.</i></h1>
  <p class="lede">A design change in Figma becomes a pull request: validated, built, visually diffed and approved by the people who care about it.</p>
  <div class="ctas"><a class="btn-p" href="#">npm create dta</a><a class="btn-o" href="#">Read the quick start</a></div>
 </div>
 <div class="stage" id="stage" aria-hidden="true">
  <span class="loupe"></span>
  <span class="pc in">
   <span class="part o1"><span class="up"><span class="sw"></span></span></span><span class="part o2"><span class="up">{split}</span></span><span class="part o3"><span class="up"><span class="link"></span></span></span>
  </span>
  <span class="pc out">
   <span class="part o4"><span class="up">{tiles}</span></span><span class="part o5"><span class="up"><span class="dot l"></span></span></span><span class="part o6"><span class="up"><span class="dot"></span></span></span>
  </span>
  <div class="tok"><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span></span></div>
 </div>
</header>
{BODY}
</div>
<div class="vsw" role="group" aria-label="Hero ground (prototype)"><button type="button" data-v="board">A board</button><button type="button" data-v="disc">B disc</button><button type="button" data-v="band">C band</button></div>
<script>
(function(){{var st=document.getElementById('stage');st.addEventListener('click',function(){{st.classList.toggle('paused')}});
var hero=document.querySelector('.hero');function place(){{var r=st.getBoundingClientRect(),b=document.body.getBoundingClientRect(),h=hero.getBoundingClientRect();document.documentElement.style.setProperty('--ox',(r.left-b.left)+'px');document.documentElement.style.setProperty('--oy',(r.top-b.top)+'px');document.documentElement.style.setProperty('--band-h',(h.bottom-b.top)+'px')}}
place();addEventListener('resize',place);setTimeout(place,300);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);if(window.ResizeObserver){{var ro=new ResizeObserver(place);ro.observe(document.body);ro.observe(st)}}
var R=document.documentElement,vk='dta-hero-ground',vb=document.querySelectorAll('.vsw button');
function setv(v){{R.classList.remove('v-board','v-disc','v-band');R.classList.add('v-'+v);vb.forEach(function(x){{x.setAttribute('aria-pressed',String(x.dataset.v===v))}});try{{localStorage.setItem(vk,v)}}catch(e){{}}}}
var v0=(location.hash||'').slice(1);if(!/^(board|disc|band)$/.test(v0)){{v0=null;try{{v0=localStorage.getItem(vk)}}catch(e){{}}}}setv(/^(board|disc|band)$/.test(v0||'')?v0:'board');
vb.forEach(function(x){{x.addEventListener('click',function(){{setv(x.dataset.v)}})}});
var tt=document.getElementById('tt'),k='dta-hero-theme';try{{var v=localStorage.getItem(k);if(v)document.documentElement.dataset.theme=v}}catch(e){{}}
tt.addEventListener('click',function(){{var cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var n=cur==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{{localStorage.setItem(k,n)}}catch(e){{}}}});}})();
</script>
"""

if __name__ == '__main__':
    open('p8-page.html', 'w').write(HTML)
