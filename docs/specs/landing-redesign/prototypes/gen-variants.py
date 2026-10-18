P='./'
tokens=open(P+'tokens.css').read()
CYC=17.0
def kf(name, frames):
    props=sorted({p for _,d in frames for p in d}); cur={}; out=[]
    for t,d in frames:
        for p in props:
            if p in d: cur[p]=d[p]
        for p in props: cur.setdefault(p, frames[0][1].get(p))
        out.append(f"{t/CYC*100:.3f}%{{{';'.join(f'{p}:{cur[p]}' for p in props)}}}")
    return f"@keyframes {name}{{{''.join(out)}}}"
DX,CX,PX=56,179,298; Y=186
def hop(t0,x0,x1):
    mv=[(t0,{'translate':f'{x0}px {Y}px'}),(t0+.35,{'translate':f'{x0}px {Y}px'}),(t0+1.25,{'translate':f'{x1}px {Y}px'}),(t0+1.5,{'translate':f'{x1}px {Y}px'})]
    lf=[(t0,{'translate':'0 0','scale':'1'}),(t0+.35,{'translate':'0 -14px','scale':'1.3'}),(t0+1.15,{'translate':'0 -14px','scale':'1.3'}),(t0+1.5,{'translate':'0 0','scale':'1'})]
    sh=[(t0,{'translate':'2px 3px','scale':'1','filter':'blur(1px)','opacity':'.35'}),(t0+.35,{'translate':'12px 18px','scale':'1.25','filter':'blur(5px)','opacity':'.14'}),(t0+1.15,{'translate':'12px 18px','scale':'1.25','filter':'blur(5px)','opacity':'.14'}),(t0+1.5,{'translate':'2px 3px','scale':'1','filter':'blur(1px)','opacity':'.35'})]
    return mv,lf,sh
hops=[(0.9,DX,CX),(6.6,CX,DX),(9.8,DX,CX),(13.0,CX,PX)]
mv=[(0,{'translate':f'{DX}px {Y}px'})]; lf=[(0,{'translate':'0 0','scale':'1'})]; sh=[(0,{'translate':'2px 3px','scale':'1','filter':'blur(1px)','opacity':'.35'})]
for t0,a,b in hops:
    m,l,s=hop(t0,a,b); mv+=m; lf+=l; sh+=s
mv.append((CYC,{})); lf.append((CYC,{})); sh.append((CYC,{}))
tokop=[(0,{'opacity':'0'}),(0.5,{'opacity':'1'}),(15.6,{'opacity':'1'}),(16.4,{'opacity':'0'}),(CYC,{'opacity':'0'})]
INS=[(2.7,5.9),(11.5,12.6)]
def pulse(opens, closed={'scale':'0','opacity':'0'}, open_={'scale':'1','opacity':'1'}, d=.5, dc=.4):
    fr=[(0,closed)]
    for o,c in opens: fr+=[(o,closed),(o+d,open_),(c,open_),(c+dc,closed)]
    fr.append((CYC,closed)); return fr
loupe=pulse(INS)
# generic part slide-out keyframes: name -> (dx,dy,start offset)
def part(name,dx,dy,o=2.9,c=5.7):
    home={'translate':'-50% -50%','opacity':'0','scale':'.6'}; out={'translate':f'calc(-50% + {dx}px) calc(-50% + {dy}px)','opacity':'1','scale':'1'}
    return kf(name,[(0,home),(o,home),(o+.5,out),(c,out),(c+.4,home),(CYC,home)])
def pop(name,o,c,dx=0,dy=0):
    a={'opacity':'0','translate':f'calc(-50% + {dx}px) calc(-50% + {dy+8}px)'}; b={'opacity':'1','translate':f'calc(-50% + {dx}px) calc(-50% + {dy}px)'}; e=dict(b,opacity='0')
    return kf(name,[(0,a),(o,a),(o+.3,b),(c,b),(c+.3,e),(CYC,e)])
# variant A: stack — plates on a diagonal; B: orbit; C: callouts (chip zooms)
A=[part('a1',-62,-54),part('a2',62,-48,3.0),part('a3',0,64,3.1)]
B=[part('b1',0,-62,2.9),part('b2',54,31,3.0),part('b3',-54,31,3.1),part('b4',-84,-40,3.2),part('b5',84,-40,3.25),part('b6',92,8,3.3)]
C=[part('c1',-78,-44,3.0),part('c2',78,-44,3.1),part('c3',0,72,3.2)]
zoom=kf('zoom',pulse(INS,{'scale':'1'},{'scale':'2.1'}))
zoom2=kf('zoom2',[(0,{'scale':'1'}),(11.5,{'scale':'1'}),(12.0,{'scale':'1.5'}),(12.6,{'scale':'1.5'}),(13.0,{'scale':'1'}),(CYC,{'scale':'1'})])
spin=f"@keyframes spin{{to{{rotate:360deg}}}}"
checks=[pop('c-lint',3.8,6.0,-30,-104),pop('c-build',4.2,6.0,0,-104),pop('c-diff',4.8,6.0,30,-104),pop('c-pair',5.0,6.0,0,-138)]
flag=kf('flag',[(0,{'opacity':'0','scale':'.6'}),(5.9,{'opacity':'0','scale':'.6'}),(6.2,{'opacity':'1','scale':'1'}),(8.5,{'opacity':'1','scale':'1'}),(8.8,{'opacity':'0','scale':'.6'}),(CYC,{'opacity':'0','scale':'.6'})])
fix=pop('fix',8.4,9.9,0,-60); appr=pop('appr',11.9,12.8,0,-104); ship=pop('ship',14.6,15.9,0,-62)
def rise(name, spans):
    flat={'transform':'translateY(0)','box-shadow':'0 0 0 rgba(19,33,63,0),0 0 0 rgba(255,255,255,0)'}; up={'transform':'translateY(-3px)','box-shadow':'var(--sh-dark),var(--sh-light)'}
    fr=[(0,flat)]
    for a,b in spans: fr+=[(a,flat),(a+.3,up),(b,up),(b+.4,flat)]
    fr.append((CYC,flat)); return kf(name,fr)
rises=[rise('r-d',[(0.05,0.9),(8.1,9.8)]),rise('r-c',[(2.4,6.6),(11.3,13.0)]),rise('r-p',[(14.5,16.0)])]
ret=kf('ret',[(0,{'stroke-dashoffset':'1','opacity':'1'}),(6.4,{'stroke-dashoffset':'1','opacity':'1'}),(7.6,{'stroke-dashoffset':'0','opacity':'1'}),(8.6,{'stroke-dashoffset':'0','opacity':'1'}),(9.2,{'stroke-dashoffset':'0','opacity':'0'}),(CYC,{'stroke-dashoffset':'0','opacity':'0'})])
allkf='\n'.join([kf('mv',mv),kf('lf',lf),kf('sh',sh),kf('tokop',tokop),kf('loupe',loupe),zoom,zoom2,spin]+A+B+C+checks+[flag,fix,appr,ship]+rises+[ret])
T=f"{CYC}s"
anim=f"animation-duration:{T};animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-iteration-count:infinite;animation-fill-mode:both"
# shared visual bits
mini_btn=lambda dark,outl='': f'<span class="mb{outl}"><i style="background:#e0600a"></i><em style="background:{"#5a2a08" if dark else "#fff3e8"}"></em></span>'
split='<span class="split"><i style="background:#ff7a1a"></i><i style="background:#e0600a"></i></span>'
tiles='<span class="tiles"><i>{ }</i><i>tw</i><i>ios</i></span>'
html=f"""<title>Orbit Loop · exploded variants</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{tokens}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;min-height:100vh;
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.w{{max-width:400px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 40px}}
.kicker{{font:400 11px/1.4 var(--mono);color:var(--blue);letter-spacing:.02em;margin:0 0 8px}}
h1{{font:700 26px/1.05 var(--sans);letter-spacing:-.02em;margin:0 0 8px;text-wrap:balance}}
.lede{{margin:0;font-size:14px;line-height:1.5;color:var(--muted);max-width:34ch}}
.stage{{position:relative;width:358px;max-width:100%;height:340px;margin:18px auto 0;touch-action:manipulation}}
.lane{{position:absolute;top:0;font:500 10px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}}
.lane.c{{left:50%;translate:-50% 0}}.lane.r{{right:0}}
.rail{{position:absolute;left:{DX}px;right:{358-PX}px;top:{Y}px;border-top:1.5px dashed var(--grid-2)}}
svg.ret{{position:absolute;inset:0;width:100%;height:100%;overflow:visible}}
svg.ret path{{fill:none;stroke:var(--red);stroke-width:1.5;stroke-linecap:butt;stroke-dasharray:1;animation:ret {T} linear infinite}}
.pad{{position:absolute;width:30px;height:30px;border-radius:50%;translate:-50% -50%;box-shadow:inset 0 0 0 1px var(--grid-2);top:{Y}px}}
.st{{position:absolute;top:{Y+92}px;translate:-50% 0;padding:6px 9px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--ink);white-space:nowrap;background:var(--bg);animation-duration:{T};animation-timing-function:ease-out;animation-iteration-count:infinite;animation-fill-mode:both}}
.st.d{{left:{DX}px;animation-name:r-d}}.st.c{{left:{CX}px;animation-name:r-c}}.st.p{{left:{PX}px;animation-name:r-p}}
.tok{{position:absolute;left:0;top:0;width:0;height:0;animation:mv {T} cubic-bezier(.5,0,.2,1) infinite,tokop {T} linear infinite}}
.tsh{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;border-radius:12px;background:var(--shadow-ink);animation:sh {T} cubic-bezier(.5,0,.2,1) infinite}}
.lift{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;animation:lf {T} cubic-bezier(.5,0,.2,1) infinite;transform-origin:50% 50%}}
.chip{{width:52px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 6px;box-shadow:inset 0 0 0 1px var(--grid-2);transform-origin:50% 50%}}
.chip i{{width:14px;height:14px;border-radius:4px;background:#e0600a;flex:none}}
.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.flag{{position:absolute;right:-8px;top:-8px;width:12px;height:12px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--bg);animation:flag {T} ease-out infinite}}
.loupe{{position:absolute;left:{CX}px;top:{Y}px;width:124px;height:124px;translate:-50% -50%;border-radius:50%;border:1.5px dashed var(--blue-2);animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite}}
.loupe::after{{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px solid var(--grid-2)}}
.part{{position:absolute;left:{CX}px;top:{Y}px;{anim};display:none}}
.plate{{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--bg);box-shadow:var(--sh-dark),var(--sh-light)}}
.sw{{display:block;width:22px;height:22px;border-radius:6px;background:#e0600a}}
.split{{display:flex;width:24px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.badge{{position:absolute;left:{CX}px;top:{Y}px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 var(--mono);color:var(--bg);background:var(--green);box-shadow:0 0 0 3px var(--bg);{anim};opacity:0}}
.badge.bad{{background:var(--red)}}
.c-lint{{animation-name:c-lint}}.c-build{{animation-name:c-build}}.c-diff{{animation-name:c-diff}}
.pair{{position:absolute;left:{CX}px;top:{Y}px;display:flex;gap:6px;align-items:center;{anim};animation-name:c-pair;opacity:0}}
.mb{{display:flex;align-items:center;justify-content:center;width:34px;height:16px;border-radius:999px;position:relative}}.mb i{{position:absolute;inset:0;border-radius:999px}}.mb em{{position:relative;width:16px;height:3px;border-radius:2px}}
.mb.o::after{{content:'';position:absolute;inset:-3px;border-radius:999px;border:1.5px solid var(--red)}}
.pair .arr{{width:10px;border-top:1px solid var(--faint)}}
.pop{{position:absolute;left:0;top:{Y}px;padding:6px 8px;border-radius:999px;background:var(--bg);display:flex;gap:6px;align-items:center;box-shadow:var(--sh-dark),var(--sh-light);{anim};opacity:0}}
.pop .aa{{font:600 10px/1 var(--sans);width:16px;height:16px;border-radius:4px;display:grid;place-items:center;background:#e0600a}}
.fix{{left:{DX}px;animation-name:fix}}.appr{{left:{CX}px;animation-name:appr;width:22px;height:22px;border-radius:50%;padding:0;justify-content:center;background:var(--green);color:var(--bg);font:600 11px/1 var(--mono);box-shadow:0 0 0 3px var(--bg)}}.ship{{left:{PX}px;animation-name:ship}}
/* variants */
.stage[data-v="a"] .va,.stage[data-v="b"] .vb,.stage[data-v="c"] .vc{{display:block}}
.a1{{animation-name:a1}}.a2{{animation-name:a2}}.a3{{animation-name:a3}}
.b1{{animation-name:b1}}.b2{{animation-name:b2}}.b3{{animation-name:b3}}.b4{{animation-name:b4}}.b5{{animation-name:b5}}.b6{{animation-name:b6}}
.c1{{animation-name:c1}}.c2{{animation-name:c2}}.c3{{animation-name:c3}}
.stage[data-v="b"] .loupe{{animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite, spin 24s linear infinite}}
.stage[data-v="b"] .loupe::after{{inset:-30px;border:1.5px dashed var(--grid-2)}}
.stage[data-v="c"] .loupe{{border-radius:8px;width:150px;height:96px}}.stage[data-v="c"] .loupe::after{{border-radius:12px}}
.stage[data-v="c"] .chip{{animation:zoom {T} cubic-bezier(.2,.8,.2,1) infinite}}
.lead{{position:absolute;left:{CX}px;top:{Y}px;width:0;height:0;{anim};display:none}}
.lead::before{{content:'';position:absolute;left:0;top:0;height:1px;background:var(--red);transform-origin:0 0}}
.paused *{{animation-play-state:paused!important}}
.switch{{display:flex;gap:6px;justify-content:center;margin:14px auto 0}}
.switch button{{all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--muted);background:var(--bg)}}.switch button[aria-pressed="true"]{{color:var(--ink);box-shadow:var(--sh-dark),var(--sh-light)}}
.foot{{max-width:360px;margin:12px auto 0;font:400 11px/1.5 var(--mono);color:var(--faint)}}
@media (prefers-reduced-motion:reduce){{.stage *{{animation:none!important}}.tok{{translate:{CX}px {Y}px;opacity:1}}.loupe{{scale:1;opacity:1}}.part{{opacity:1;scale:1}}.a1,.b5,.c1{{translate:calc(-50% - 62px) calc(-50% - 50px)}}.a2,.b6,.c2{{translate:calc(-50% + 62px) calc(-50% - 48px)}}.a3,.b4,.c3{{translate:-50% calc(-50% + 56px)}}.b1{{translate:-50% calc(-50% - 46px)}}.b2{{translate:calc(-50% + 44px) calc(-50% + 16px)}}.b3{{translate:calc(-50% - 44px) calc(-50% + 16px)}}.tsh{{opacity:.3}}svg.ret path{{opacity:0}}}}
{allkf}
</style>
<div class="w">
 <header>
  <p class="kicker">THE LOOP · PROTOTYPE 3 · VARIANTS</p>
  <h1>Design on one side, product on the other.</h1>
  <p class="lede">A token leaves Figma, is taken apart in the pull request, goes back once with a finding, and ships.</p>
 </header>
 <div class="stage" id="stage" data-v="a" aria-label="A token travels from design to the pull request, is inspected, returns once with a finding, is fixed and ships to the product">
  <span class="lane">Design</span><span class="lane c">Pull request</span><span class="lane r">Product</span>
  <span class="rail"></span>
  <svg class="ret" viewBox="0 0 358 330" aria-hidden="true"><path pathLength="1" d="M {CX} {Y-10} C {CX} {Y-70}, {DX} {Y-70}, {DX} {Y-10}"/></svg>
  <span class="pad" style="left:{DX}px"></span><span class="pad" style="left:{CX}px"></span><span class="pad" style="left:{PX}px"></span>
  <span class="st d">Figma</span><span class="st c">lint · diff</span><span class="st p">CSS · Tailwind</span>
  <span class="loupe" aria-hidden="true"></span>
  <!-- A: plates -->
  <span class="part va a1"><span class="plate"><span class="sw"></span></span></span>
  <span class="part va a2"><span class="plate">{split}</span></span>
  <span class="part va a3"><span class="plate" style="width:auto;padding:0 8px">{tiles}</span></span>
  <!-- B: orbit -->
  <span class="part vb b1"><span class="sw" style="width:16px;height:16px"></span></span>
  <span class="part vb b2">{split}</span>
  <span class="part vb b3"><span class="link"></span></span>
  <span class="part vb b4">{tiles}</span>
  <span class="part vb b5"><span class="sw" style="width:10px;height:10px;background:#ff7a1a;border-radius:50%"></span></span>
  <span class="part vb b6"><span class="sw" style="width:10px;height:10px;border-radius:50%"></span></span>
  <!-- C: callouts -->
  <span class="part vc c1">{split}</span>
  <span class="part vc c2"><span class="link"></span></span>
  <span class="part vc c3">{tiles}</span>
  <!-- checks -->
  <span class="badge c-lint">✓</span><span class="badge c-build">✓</span><span class="badge bad c-diff">!</span>
  <span class="pair">{mini_btn(False)}<span class="arr"></span>{mini_btn(True,' o')}</span>
  <span class="pop fix"><span class="aa" style="color:#5a2a08">Aa</span><span style="font:400 10px/1 var(--mono);color:var(--faint)">→</span><span class="aa" style="color:#fff">Aa</span></span>
  <span class="pop appr">✓</span>
  <span class="pop ship">{tiles}</span>
  <div class="tok" aria-hidden="true"><span class="tsh"></span><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span><span class="flag"></span></span></div>
 </div>
 <div class="switch" role="group" aria-label="Exploded view variant"><button type="button" data-v="a" aria-pressed="true">A · plates</button><button type="button" data-v="b" aria-pressed="false">B · orbit</button><button type="button" data-v="c" aria-pressed="false">C · zoom</button></div>
 <p class="foot">Tap the board to pause. One lap is {int(CYC)} s. Details are shown as shapes only: colour, old → new value, outputs; the finding is the button whose label went dark.</p>
</div>
<script>
(function(){{var st=document.getElementById('stage'),sw=document.querySelector('.switch'),k='orbit-exploded-v';try{{var v=localStorage.getItem(k);if(v)st.dataset.v=v}}catch(e){{}}
function sync(){{sw.querySelectorAll('button').forEach(function(b){{b.setAttribute('aria-pressed',String(b.dataset.v===st.dataset.v))}})}}sync();
sw.addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;st.dataset.v=b.dataset.v;try{{localStorage.setItem(k,b.dataset.v)}}catch(x){{}}sync()}});
st.addEventListener('click',function(){{st.classList.toggle('paused')}});}})();
</script>
"""
open('p3-exploded-variants.html','w').write(html)
