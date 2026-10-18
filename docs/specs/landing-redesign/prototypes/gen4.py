import gen3
from gen3 import allkf, T, anim, tiles, split, mb, CYC
light="""--bg:#F5F1E8;--surface:#FFFFFF;--grid:rgba(19,33,63,.045);--grid-2:rgba(19,33,63,.065);--ink:#13213F;--ink-2:#3E4A66;--muted:#5A6480;--faint:#9AA2B4;--blue:#2F55D4;--blue-2:#7590E6;--red:#E8632A;--green:#3C7646;--sh-dark:8px 8px 18px rgba(19,33,63,.16);--sh-light:-6px -6px 14px rgba(255,255,255,.95);--line-ink:rgba(19,33,63,.5);--line-ink-2:rgba(19,33,63,.38);--btn-fg:#F5F1E8"""
dark="""--bg:#161513;--surface:#1F1E1B;--grid:rgba(242,237,226,.05);--grid-2:rgba(242,237,226,.075);--ink:#F2EDE2;--ink-2:#D9D2C2;--muted:#C2BAA8;--faint:#8F8878;--blue:#7590E6;--blue-2:#A9B8F0;--red:#F58B58;--green:#7FB887;--sh-dark:8px 8px 18px rgba(0,0,0,.55);--sh-light:-6px -6px 14px rgba(255,255,255,.04);--line-ink:rgba(242,237,226,.45);--line-ink-2:rgba(242,237,226,.32);--btn-fg:#161513;color-scheme:dark"""
tokens=f""":root{{{light};--sans:'Instrument Sans',system-ui,sans-serif;--mono:'Martian Mono',ui-monospace,Menlo,monospace;--shadow-ink:#000}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{{dark}}}}}
:root[data-theme="dark"]{{{dark}}}"""
# layouts: phone hero (compact horizontal) and desktop
M=dict(w=358,h=372,pd='34px 212px',pc='179px 212px',pp='324px 212px',px=('34px','179px','324px'),py=('212px','212px','212px'),z='1',r1='54px',r2='84px',cy='-120px',pox='-44px',dox='44px',
       rail='left:34px;top:212px;width:290px;border-top:1.5px dashed var(--grid-2)',
       retpath='M 169 202 C 169 128, 34 128, 34 202',
       lanes='.lane.d{left:0;top:0}.lane.c{left:50%;top:0;translate:-50% 0}.lane.p{left:auto;right:0;top:0}',
       st='.st{translate:0 0}.st.d{left:0;top:318px}.st.c{left:50%;top:318px;translate:-50% 0}.st.p{left:auto;right:0;top:318px}')
Dk=dict(w=720,h=430,pd='70px 246px',pc='360px 246px',pp='650px 246px',px=('70px','360px','650px'),py=('246px','246px','246px'),z='1',r1='72px',r2='108px',cy='-138px',pox='0px',dox='0px',
       rail='left:70px;top:246px;width:580px;border-top:1.5px dashed var(--grid-2)',
       retpath='M 360 234 C 360 134, 70 134, 70 234',
       lanes='.lane.d{left:0;top:0}.lane.c{left:50%;top:0;translate:-50% 0}.lane.p{left:auto;right:0;top:0}',
       st='.st{translate:-50% 0}.st.d{left:70px;top:372px}.st.c{left:360px;top:372px}.st.p{left:650px;top:372px}')
def layout(L):
    return (f".stage{{width:{L['w']}px;height:{L['h']}px;--pd:{L['pd']};--pc:{L['pc']};--pp:{L['pp']};--r1:{L['r1']};--r2:{L['r2']};--cy:{L['cy']};--pox:{L['pox']};--dox:{L['dox']}}}"
            f":root{{--z:{L['z']};--pdx:{L['px'][0]};--pcx:{L['px'][1]};--ppx:{L['px'][2]};--pdy:{L['py'][0]};--pcy:{L['py'][1]};--ppy:{L['py'][2]}}}"
            f".rail{{{L['rail']}}}{L['lanes']}{L['st']}.loupe{{width:calc(var(--r1)*2);height:calc(var(--r1)*2)}}.loupe::after{{inset:calc(var(--r1) - var(--r2))}}")
html=f"""<title>DTA hero · orbit</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{tokens}
*{{box-sizing:border-box}}
body{{position:relative;margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;min-height:100vh;
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.ls{{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:0;
 background-image:linear-gradient(0deg,var(--line-ink) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--line-ink) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--line-ink-2) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--line-ink-2) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px;
 -webkit-mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation-duration:{T};animation-timing-function:cubic-bezier(.5,0,.2,1);animation-iteration-count:infinite}}
.ls.la{{animation-name:ls-tok,tokop}}.ls.lb{{animation-name:ls-fnd,fop-o}}
.w{{position:relative;z-index:1;max-width:1160px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
nav{{display:flex;justify-content:space-between;align-items:center;padding-block:14px;font-size:13px}}nav b{{font-weight:600}}nav span{{display:flex;gap:14px;align-items:center;color:var(--muted)}}
.tt{{all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px var(--grid-2);font-size:13px}}
.hero{{display:grid;gap:24px;padding-block:28px 48px;align-items:center}}
h1{{font:700 34px/1.04 var(--sans);letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}}h1 i{{color:var(--blue)}}
.lede{{color:var(--muted);font-size:17px;line-height:1.5;max-width:36ch;margin:0 0 22px;text-wrap:pretty}}
.ctas{{display:flex;gap:8px;flex-wrap:wrap}}.btn-p,.btn-o{{padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}}.btn-p{{background:var(--ink);color:var(--btn-fg);font-family:var(--mono);font-size:13px}}.btn-o{{box-shadow:inset 0 0 0 1.5px var(--ink)}}
.stage{{position:relative;max-width:100%;margin:0 auto;touch-action:manipulation}}
.lane{{position:absolute;font:500 10px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}}
.rail{{position:absolute}}
svg.ret{{position:absolute;inset:0;width:100%;height:100%;overflow:visible}}svg.ret.dk{{display:none}}
svg.ret path{{fill:none;stroke:var(--red);stroke-width:1.5;stroke-linecap:butt;stroke-dasharray:1;animation:ret {T} linear infinite}}
.pad{{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;margin:-15px 0 0 -15px;box-shadow:inset 0 0 0 1px var(--grid-2)}}
.pad.d{{translate:var(--pd)}}.pad.c{{translate:var(--pc)}}.pad.p{{translate:var(--pp)}}
.st{{position:absolute;padding:6px 9px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--ink);white-space:nowrap;background:var(--bg);animation-duration:{T};animation-timing-function:ease-out;animation-iteration-count:infinite;animation-fill-mode:both}}
.st.d{{animation-name:r-d}}.st.c{{animation-name:r-c}}.st.p{{animation-name:r-p}}
.tok,.fnd{{position:absolute;left:0;top:0;width:0;height:0}}
.tok{{animation:mv {T} cubic-bezier(.5,0,.2,1) infinite,tokop {T} linear infinite}}
.fnd{{animation:fm {T} cubic-bezier(.5,0,.2,1) infinite,fop {T} ease-out infinite}}
.lift{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;animation:lf {T} cubic-bezier(.5,0,.2,1) infinite;transform-origin:50% 50%}}
.fnd .lift{{left:-11px;top:-11px;width:22px;height:22px;animation-name:fl}}
.chip{{width:52px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 6px;box-shadow:inset 0 0 0 1px var(--grid-2)}}
.chip i{{width:14px;height:14px;border-radius:4px;background:#e0600a;flex:none}}.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.fchip{{position:relative;width:22px;height:22px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--bg);display:grid;place-items:center;color:var(--bg);font:700 11px/1 var(--mono)}}
.fchip .h{{animation:fhash {T} linear infinite}}.fchip .s{{position:absolute;inset:5px;border-radius:3px;background:#e0600a;box-shadow:0 0 0 2px var(--bg);animation:fsw {T} linear infinite}}
.loupe{{position:absolute;left:0;top:0;translate:var(--pc);margin:calc(var(--r1) * -1) 0 0 calc(var(--r1) * -1);border-radius:50%;border:1.5px dashed var(--blue-2);animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite,spin 30s linear infinite}}
.loupe::after{{content:'';position:absolute;border-radius:50%;border:1.5px dashed var(--grid-2)}}
.part{{position:absolute;left:0;top:0;margin:0;{anim}}}
.pc{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}
.sw{{display:block;width:16px;height:16px;border-radius:5px;background:#e0600a}}
.split{{display:flex;width:26px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.dot{{display:block;width:10px;height:10px;border-radius:50%;background:#e0600a}}.dot.l{{background:#ff7a1a}}
.o1{{animation-name:o1}}.o2{{animation-name:o2}}.o3{{animation-name:o3}}.o4{{animation-name:o4}}.o5{{animation-name:o5}}.o6{{animation-name:o6}}
.pop{{position:absolute;left:0;top:0;{anim};opacity:0;display:flex;gap:6px;align-items:center}}
.badge{{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 var(--mono);color:var(--bg);background:var(--green);box-shadow:0 0 0 3px var(--bg)}}.badge.bad{{background:var(--red)}}
.pill{{padding:6px 8px;border-radius:999px;background:var(--bg);display:flex;gap:6px;align-items:center;box-shadow:var(--sh-dark),var(--sh-light)}}
.mb{{display:flex;align-items:center;justify-content:center;width:34px;height:16px;border-radius:999px;position:relative}}.mb i{{position:absolute;inset:0;border-radius:999px;background:#e0600a}}.mb em{{position:relative;width:16px;height:3px;border-radius:2px}}
.mb.o::after{{content:'';position:absolute;inset:-3px;border-radius:999px;border:1.5px solid var(--red)}}
.mb u{{position:absolute;right:-2px;top:-2px;width:8px;height:8px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 1.5px var(--bg)}}
.arr{{width:10px;border-top:1px solid var(--faint)}}
.aa{{font:600 10px/1 var(--sans);width:16px;height:16px;border-radius:4px;display:grid;place-items:center;background:#e0600a}}
.hash{{font:700 11px/1 var(--mono);color:var(--red)}}.lit{{font:400 9px/1 var(--mono);color:var(--muted);text-decoration:line-through}}
.c-lint{{animation-name:c-lint}}.c-build{{animation-name:c-build}}.c-diff{{animation-name:c-diff}}.pair1{{animation-name:pair1}}.pair2{{animation-name:pair2}}.appr{{animation-name:appr}}.fixp{{animation-name:fixp}}.fixd{{animation-name:fixd}}.ship{{animation-name:ship}}
.paused *{{animation-play-state:paused!important}}
.next{{padding-block:10px 60px;color:var(--faint);font:400 12px/1.6 var(--mono)}}
{layout(M)}
@media (min-width:1000px){{svg.ret.m{{display:none}}svg.ret.dk{{display:block}}.hero{{grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:40px;padding-block:56px 72px}}h1{{font-size:46px}}{layout(Dk)}svg.ret path{{stroke-width:2}}.loupe,.loupe::after{{border-width:2px}}.rail{{border-width:2px}}}}
@media (prefers-reduced-motion:reduce){{.stage *,.ls{{animation:none!important}}.tok{{translate:var(--pc);opacity:1}}.loupe{{scale:1;opacity:1}}.part{{opacity:1;scale:1}}.fnd{{opacity:0}}.pop{{opacity:0}}.ls{{opacity:0}}svg.ret path{{opacity:0}}}}
{allkf}
</style>
<div class="ls la" aria-hidden="true"></div><div class="ls lb" aria-hidden="true"></div>
<div class="w">
<nav><b>Design Token Authority</b><span>Workflow · Docs <button class="tt" id="tt" type="button" aria-label="Toggle theme">◐</button></span></nav>
<header class="hero">
 <div>
  <h1>The deterministic backbone for design token workflows, built for humans and <i>agents.</i></h1>
  <p class="lede">A design change in Figma becomes a pull request: validated, built, visually diffed and approved by the people who care about it.</p>
  <div class="ctas"><a class="btn-p" href="#">npm create dta</a><a class="btn-o" href="#">Read the quick start</a></div>
 </div>
 <div class="stage" id="stage" aria-label="A token travels from design into the pull request and is inspected; a finding goes to the side that can fix it; the change ships.">
  <span class="lane d">Design</span><span class="lane c">Pull request</span><span class="lane p">Product</span>
  <span class="rail"></span>
  <svg class="ret m" viewBox="0 0 {M['w']} {M['h']}" aria-hidden="true"><path pathLength="1" d="{M['retpath']}"/></svg><svg class="ret dk" viewBox="0 0 {Dk['w']} {Dk['h']}" aria-hidden="true"><path pathLength="1" d="{Dk['retpath']}"/></svg>
  <span class="pad d"></span><span class="pad c"></span><span class="pad p"></span>
  <span class="st d">Figma</span><span class="st c">lint · build · diff</span><span class="st p">code</span>
  <span class="loupe" aria-hidden="true"></span>
  <span class="pc" aria-hidden="true">
   <span class="part o1"><span class="sw"></span></span><span class="part o2">{split}</span><span class="part o3"><span class="link"></span></span><span class="part o4">{tiles}</span><span class="part o5"><span class="dot l"></span></span><span class="part o6"><span class="dot"></span></span>
   <span class="pop c-lint"><span class="badge">✓</span></span><span class="pop c-build"><span class="badge">✓</span></span><span class="pop c-diff"><span class="badge bad">!</span></span>
   <span class="pop pair1"><span class="pill">{mb(False)}<span class="arr"></span>{mb(False,True)}<span class="hash">#</span></span></span>
   <span class="pop pair2"><span class="pill">{mb(False)}<span class="arr"></span>{mb(True,True)}</span></span>
   <span class="pop appr"><span class="badge">✓</span></span>
  </span>
  <span class="pc" style="translate:var(--pp)" aria-hidden="true"><span class="pop fixp"><span class="pill"><span class="hash">#</span><span class="lit">e0600a</span><span class="arr"></span><span class="sw"></span></span></span><span class="pop ship"><span class="pill">{tiles}</span></span></span>
  <span class="pc" style="translate:var(--pd)" aria-hidden="true"><span class="pop fixd"><span class="pill"><span class="aa" style="color:#5a2a08">Aa</span><span class="arr"></span><span class="aa" style="color:#fff">Aa</span></span></span></span>
  <div class="fnd" aria-hidden="true"><span class="lift"><span class="fchip"><span class="h">#</span><span class="s"></span></span></span></div>
  <div class="tok" aria-hidden="true"><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span></span></div>
 </div>
</header>
<p class="next">↓ 01 · Something changes &nbsp;·&nbsp; 02 · The pull request shows the differences &nbsp;·&nbsp; 03 · A person decides &nbsp;·&nbsp; 04 · Your agent uses the same commands</p>
</div>
<script>
(function(){{var st=document.getElementById('stage');st.addEventListener('click',function(){{st.classList.toggle('paused')}});
function place(){{var r=st.getBoundingClientRect(),b=document.body.getBoundingClientRect();document.documentElement.style.setProperty('--ox',(r.left-b.left)+'px');document.documentElement.style.setProperty('--oy',(r.top-b.top)+'px')}}
place();addEventListener('resize',place);setTimeout(place,300);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);if(window.ResizeObserver){{var ro=new ResizeObserver(place);ro.observe(document.body);ro.observe(st)}}
var tt=document.getElementById('tt'),k='dta-hero-theme';try{{var v=localStorage.getItem(k);if(v)document.documentElement.dataset.theme=v}}catch(e){{}}
tt.addEventListener('click',function(){{var cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var n=cur==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{{localStorage.setItem(k,n)}}catch(e){{}}}});}})();
</script>
"""
open('p5-hero.html','w').write(html)
