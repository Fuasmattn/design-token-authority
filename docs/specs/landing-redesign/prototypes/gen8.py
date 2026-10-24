# p9: the orbit on the band, always exploded, with a warp gate at the centre. python3 gen8.py -> p9-page.html
# Decisions from the 18 Oct review of p8: ground C (band) chosen; the contracted state looked wrong (smaller,
# off-centre), so the cycle is gone: the parts stay out and ride the rings. The centre is a gate into the other
# dimension: a disc in the opposite theme's surface and grid (dark on the light page, light on the dark page),
# a slow tunnel of rings falling inward, and the token chip hovering in front of it.
import math
import gen5
import gen6
import gen7

M = dict(w=300, h=300, r1='66px', r2='116px', gate='38px')
Dk = dict(w=540, h=540, r1='110px', r2='190px', gate='66px')


def layout(L):
    cx, cy = L['w'] // 2, L['h'] // 2
    return (f".stage{{width:{L['w']}px;height:{L['h']}px;--pc:{cx}px {cy}px;--r1:{L['r1']};--r2:{L['r2']};--rg:{L['gate']}}}"
            f".loupe{{width:calc(var(--r1)*2);height:calc(var(--r1)*2)}}.loupe::after{{inset:calc(var(--r1) - var(--r2))}}")


PARTS = [('o1', -90, 'r1'), ('o2', 30, 'r1'), ('o3', 150, 'r1'), ('o4', -150, 'r2'), ('o5', -30, 'r2'), ('o6', 70, 'r2')]
pos = ''.join(f".{n}{{translate:calc(-50% + var(--{rv}) * {math.cos(math.radians(a)):.3f}) calc(-50% + var(--{rv}) * {math.sin(math.radians(a)):.3f})}}" for n, a, rv in PARTS)

# gate tokens: the other theme's ground and ink
GATE = (":root{--gate-bg:#161513;--gate-bg-2:#1F1E1B;--gate-line:rgba(242,237,226,.16);--gate-line-2:rgba(242,237,226,.07);--gate-glow:rgba(117,144,230,.35)}"
        "@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--gate-bg:#F5F1E8;--gate-bg-2:#FFFFFF;--gate-line:rgba(19,33,63,.22);--gate-line-2:rgba(19,33,63,.08);--gate-glow:rgba(47,85,212,.28)}}"
        ":root[data-theme=\"dark\"]{--gate-bg:#F5F1E8;--gate-bg-2:#FFFFFF;--gate-line:rgba(19,33,63,.22);--gate-line-2:rgba(19,33,63,.08);--gate-glow:rgba(47,85,212,.28)}")

HERO_CSS = f"""
{GATE}
*{{box-sizing:border-box}}
body{{position:relative;margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;min-height:100vh;
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.band{{position:absolute;left:0;top:0;width:100%;height:var(--band-h,0px);background-color:var(--surface);border-bottom:1px solid var(--rule);
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.w{{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
nav{{display:flex;justify-content:space-between;align-items:center;padding-block:14px;font-size:13px}}nav b{{font-weight:600}}nav span{{display:flex;gap:14px;align-items:center;color:var(--muted)}}
nav a{{color:inherit;text-decoration:none}}nav a:hover{{color:var(--ink)}}
.tt{{all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--rule-strong);font-size:13px}}.tt:focus-visible{{outline:2px solid var(--blue);outline-offset:2px}}
.hero{{display:grid;gap:8px;padding-block:8px 24px;align-items:center;justify-items:center}}.hero .stage{{order:-1}}.hero .copy{{justify-self:stretch;min-width:0}}
h1{{font:700 34px/1.04 var(--sans);letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}}h1 i{{color:var(--blue)}}
.lede{{color:var(--muted);font-size:17px;line-height:1.5;max-width:36ch;margin:0 0 22px;text-wrap:pretty}}
.ctas{{display:flex;gap:8px;flex-wrap:wrap}}.btn-p,.btn-o{{padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}}.btn-p{{background:var(--ink);color:var(--btn-fg);font-family:var(--mono);font-size:13px}}.btn-o{{box-shadow:inset 0 0 0 1.5px var(--ink)}}
.stage{{position:relative;max-width:100%;touch-action:manipulation}}
/* the gate: a disc in the other theme, rings falling inward, a faint blueprint glow at the rim */
.gate{{position:absolute;left:0;top:0;translate:var(--pc);width:calc(var(--rg)*2);height:calc(var(--rg)*2);margin:calc(var(--rg)*-1) 0 0 calc(var(--rg)*-1);border-radius:50%;overflow:hidden;
 background:radial-gradient(circle at 50% 50%,var(--gate-bg-2) 0%,var(--gate-bg) 55%,var(--gate-bg) 100%);box-shadow:0 0 0 1px var(--rule),0 0 0 4px var(--gate-glow)}}
.gate::before,.gate::after{{content:'';position:absolute;inset:-30%;border-radius:50%;
 background:repeating-radial-gradient(circle at 50% 50%,var(--gate-line) 0 1px,transparent 1px 11px);animation:fall 7s linear infinite}}
.gate::after{{animation-delay:-3.5s}}
.gate i{{position:absolute;inset:0;border-radius:50%;background:linear-gradient(0deg,var(--gate-line-2) 0 1px,transparent 1px 12px),linear-gradient(90deg,var(--gate-line-2) 0 1px,transparent 1px 12px);background-size:12px 12px;
 -webkit-mask-image:radial-gradient(circle,transparent 30%,#000 85%);mask-image:radial-gradient(circle,transparent 30%,#000 85%)}}
@keyframes fall{{from{{scale:1.6;opacity:0}}18%{{opacity:1}}to{{scale:.35;opacity:0}}}}
.tok{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}
.lift{{position:absolute;left:0;top:-13px;width:max-content;height:26px;transform:translateX(-50%);animation:hover 5s ease-in-out infinite}}
@keyframes hover{{0%,100%{{translate:0 -2px}}50%{{translate:0 -6px}}}}
.chip{{height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 8px 0 6px;border:1px solid var(--rule-strong)}}
.chip i{{width:14px;height:14px;border-radius:4px;background:var(--sw);flex:none}}.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.loupe{{position:absolute;left:0;top:0;translate:var(--pc);margin:calc(var(--r1) * -1) 0 0 calc(var(--r1) * -1);border-radius:50%;border:1.5px dashed var(--blue-2);animation:spin 60s linear infinite}}
.loupe::after{{content:'';position:absolute;border-radius:50%;border:1.5px dashed var(--grid-2);animation:spin-r 90s linear infinite}}
@keyframes spin{{to{{rotate:360deg}}}}@keyframes spin-r{{to{{rotate:-360deg}}}}
.pc{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}.pc.in{{animation:spin 60s linear infinite}}.pc.out{{animation:spin-r 90s linear infinite}}
.part{{position:absolute;left:0;top:0;margin:0}}{pos}
.up{{display:block;animation:spin-r 60s linear infinite}}.pc.out .up{{animation:spin 90s linear infinite}}
.sw{{display:block;width:16px;height:16px;border-radius:5px;background:var(--sw)}}
.split{{display:flex;width:26px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.dot{{display:block;width:10px;height:10px;border-radius:50%;background:var(--sw)}}.dot.l{{background:var(--sw-l)}}
.paused *{{animation-play-state:paused!important}}
{layout(M)}
@media (max-width:559px){{nav .nl{{display:none}}}}
@media (min-width:1000px){{.hero{{grid-template-columns:minmax(0,1fr) auto;gap:48px;padding-block:56px 48px}}.hero .stage{{order:0}}h1{{font-size:46px}}{layout(Dk)}.loupe,.loupe::after{{border-width:2px}}.gate::before,.gate::after{{background:repeating-radial-gradient(circle at 50% 50%,var(--gate-line) 0 1.5px,transparent 1.5px 16px)}}}}
@media (prefers-reduced-motion:reduce){{.stage *{{animation:none!important}}.pc,.up{{rotate:0deg}}.gate::after{{display:none}}.gate::before{{scale:1;opacity:1}}}}
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

BODY = gen7.BODY.replace('Prototype p8 · the orbit as decoration on three grounds (switch at the bottom) · tap the orbit to pause',
                         'Prototype p9 · the orbit on the band, always exploded, with the gate · tap the orbit to pause')

HTML = f"""<title>DTA landing page</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{gen5.tokens}
{HERO_CSS}
{gen6.CSS}</style>
<div class="band" aria-hidden="true"></div>
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
  <span class="gate"><i></i></span>
  <span class="pc in">
   <span class="part o1"><span class="up"><span class="sw"></span></span></span><span class="part o2"><span class="up">{gen5.split}</span></span><span class="part o3"><span class="up"><span class="link"></span></span></span>
  </span>
  <span class="pc out">
   <span class="part o4"><span class="up">{gen7.tiles}</span></span><span class="part o5"><span class="up"><span class="dot l"></span></span></span><span class="part o6"><span class="up"><span class="dot"></span></span></span>
  </span>
  <div class="tok"><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span></span></div>
 </div>
</header>
{BODY}
</div>
<script>
(function(){{var st=document.getElementById('stage');st.addEventListener('click',function(){{st.classList.toggle('paused')}});
var hero=document.querySelector('.hero');function place(){{var b=document.body.getBoundingClientRect(),h=hero.getBoundingClientRect();document.documentElement.style.setProperty('--band-h',(h.bottom-b.top)+'px')}}
place();addEventListener('resize',place);setTimeout(place,300);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);if(window.ResizeObserver){{var ro=new ResizeObserver(place);ro.observe(document.body);ro.observe(hero)}}
var tt=document.getElementById('tt'),k='dta-hero-theme';try{{var v=localStorage.getItem(k);if(v)document.documentElement.dataset.theme=v}}catch(e){{}}
tt.addEventListener('click',function(){{var cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var n=cur==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{{localStorage.setItem(k,n)}}catch(e){{}}}});}})();
</script>
"""

if __name__ == '__main__':
    open('p9-page.html', 'w').write(HTML)
