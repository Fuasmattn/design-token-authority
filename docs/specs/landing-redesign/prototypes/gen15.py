# p16: the whirlpool. python3 gen15.py -> p16-page.html
# The hero background is one polar mesh (spokes and log-spaced rings) lifted onto the well z = K(1/r - 1/R_far),
# seen tilted AND with perspective, so the surface narrows to a vanishing point below the mouth: the tube to
# infinity is the surface itself, nothing is drawn for it. Outside the well the view blends back to a flat 2D
# plane (rings become circles, spokes straighten) before the mesh fades out, so 3D hands over to the page. The rings flow inward at constant speed in log(r);
# the spokes are logarithmic spirals that slowly turn, so the whole mesh swirls into the hole like the
# reference GIF. The surface is painted as opaque cells, back to front, so the funnel's near wall hides the
# far wall and the tube (no see-through). The mesh fades toward the screen edges and darkens inside the well. Objects, chip, switches
# and reduced-motion behaviour as in p15.
import math
import random
import gen5
import gen6
import gen7
import gen8

TILTS = (40, 52, 64)
SIZES = {'S': dict(m=dict(w=300, r1=66, r2=116, rmin=22), d=dict(w=540, r1=110, r2=190, rmin=36)),
         'L': dict(m=dict(w=350, r1=78, r2=136, rmin=26), d=dict(w=640, r1=130, r2=226, rmin=42))}

JS_RENDER = r"""
// ---- the surface renderer -------------------------------------------------------------------------
var cv=document.getElementById('flow'),R=document.documentElement,st=document.getElementById('stage'),hero=document.querySelector('.hero');
var P={theta:64,size:'S',pos:'A',ox:8,oy:0},col={},t0=performance.now(),reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
function readCol(){var s=getComputedStyle(R);col.ink=s.getPropertyValue('--ink').trim();col.gate=s.getPropertyValue('--gate-bg').trim();col.glow=s.getPropertyValue('--gate-glow').trim();col.line=s.getPropertyValue('--gate-line').trim();col.blue=s.getPropertyValue('--blue-2').trim();col.grid2=s.getPropertyValue('--grid-2').trim();col.tunnel=s.getPropertyValue('--tunnel').trim();col.bg=s.getPropertyValue('--bg').trim();col.inkRGB=hex(col.ink);col.tunRGB=hex(col.tunnel);col.bgRGB=hex(col.bg)}
function hex(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
var SPOKES=28,RINGSTEP=Math.log(1.12),SPEED=0.085,SWIRL=0.32,OMEGA=Math.PI*2/180; // log-radius per second; spiral tightness; one turn in 120 s
// one well per canvas. opt: wash (fade the top), rings (the dashed orbits), dim (line alpha multiplier)
function Well(cv,opt){var cx2=cv.getContext('2d'),geo={};opt=opt||{};var dim=opt.dim||1;
 function size(W,H){var dpr=Math.min(2,devicePixelRatio||1);cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';cx2.setTransform(dpr,0,0,dpr,0,0)}
 function layout(W,H,cx,cy,sz,theta){geo={W:W,H:H,cx:cx,cy:cy,R:sz.w/2,r1:sz.r1,r2:sz.r2,rmin:sz.rmin};
  geo.Rf=Math.max(W,H)*1.6;geo.th=theta*Math.PI/180;geo.ct=Math.cos(geo.th);geo.st=Math.sin(geo.th);
  geo.K=0.5*geo.R/(geo.st*(1/geo.rmin-1/geo.R));   // the mouth sits half a board-radius below the centre
  geo.fade0=geo.R*0.95;geo.fade1=geo.R*2.6;geo.F=geo.R*1.3;geo.flat0=geo.R*0.9;geo.flat1=geo.R*2.2;return geo}
 function z(r){return -geo.K*(1/Math.max(r,1.5)-1/geo.Rf)}
 function sc(r){return geo.F/(geo.F-z(r))}
 function mouthY(){var mr=geo.rmin*0.55,ms=sc(mr);return geo.cy+(-z(mr)*geo.st)*ms}
 // the view: full 3D (tilt + perspective) inside the well, blending to a flat 2D plane before the mesh fades out
 function flat(r){var t=Math.max(0,Math.min(1,(r-geo.flat0)/(geo.flat1-geo.flat0)));return t*t*(3-2*t)}
 function proj(x,y){var r=Math.hypot(x,y),zz=z(r),s=geo.F/(geo.F-zz),b=1-flat(r);return [geo.cx+x*((1-b)+b*s),geo.cy+(1-b)*y+b*(y*geo.ct-zz*geo.st)*s]}
 function alpha(r){var a=1-Math.max(0,Math.min(1,(r-geo.fade0)/(geo.fade1-geo.fade0)));a=a*a*(3-2*a);return a}
 function tun(r){var t=Math.max(0,Math.min(1,(geo.r1*2.2-r)/(geo.r1*2.2-geo.rmin*0.3)));return t*t*(3-2*t)}
 function inkAt(r){var k=tun(r),a=col.inkRGB,b=col.tunRGB;return 'rgb('+Math.round(a[0]+(b[0]-a[0])*k)+','+Math.round(a[1]+(b[1]-a[1])*k)+','+Math.round(a[2]+(b[2]-a[2])*k)+')'}
 function stroke(pts,a,w,r){if(pts.length<2)return;if(r!==undefined){cx2.strokeStyle=inkAt(r);a=a+(1-a)*tun(r)*dim}cx2.globalAlpha=Math.min(1,a);cx2.lineWidth=w;cx2.beginPath();cx2.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)cx2.lineTo(pts[i][0],pts[i][1]);cx2.stroke()}
 function spoke(a0,r){return a0+SWIRL*Math.log(geo.Rf/r)}
 function topFill(g){var c=col.bgRGB,gr=cx2.createLinearGradient(0,0,0,g.H*0.42);gr.addColorStop(0,'rgba('+c[0]+','+c[1]+','+c[2]+',1)');gr.addColorStop(.45,'rgba('+c[0]+','+c[1]+','+c[2]+',.7)');gr.addColorStop(1,'rgba('+c[0]+','+c[1]+','+c[2]+',0)');return gr}
 function draw(T){var g=geo;cx2.clearRect(0,0,g.W,g.H);cx2.strokeStyle=col.ink;cx2.lineCap='round';cx2.lineJoin='round';
  var rmax=Math.hypot(Math.max(g.cx,g.W-g.cx),Math.max(g.cy,g.H-g.cy))+40,base=0.16*dim,rin=g.rmin*0.3,rot=T*OMEGA;
  // the mouth: the other theme's ground at the bottom of the funnel, with a glow rim; the mesh continues inside it
  var mr=g.rmin*0.55,ms=sc(mr),my=mouthY();
  cx2.globalAlpha=1;cx2.fillStyle=col.gate;cx2.strokeStyle=col.glow;cx2.lineWidth=3;cx2.beginPath();cx2.ellipse(g.cx,my,mr*ms,mr*ms*g.ct,0,0,Math.PI*2);cx2.fill();cx2.stroke();cx2.strokeStyle=col.ink;
  // the surface, as a surface: cells between neighbouring spokes and rings, filled with the page colour and
  // painted back to front, so the near wall of the funnel hides the far wall and the tube behind it
  var lo=Math.log(rin),hi=Math.log(rmax),ph0=(T*SPEED)%RINGSTEP,radii=[];
  for(var L=hi+RINGSTEP;L>lo;L-=RINGSTEP){var rr=Math.exp(L-ph0);if(rr>=rin&&rr<=rmax)radii.push(rr)}
  radii.sort(function(a,b){return a-b});
  var cells=[];
  for(var i=0;i<radii.length-1;i++){var ra=radii[i],rb=radii[i+1];
   for(var k=0;k<SPOKES;k++){var a1=k/SPOKES*Math.PI*2+rot,a2=(k+1)/SPOKES*Math.PI*2+rot,p1=spoke(a1,ra),p2=spoke(a2,ra),p3=spoke(a2,rb),p4=spoke(a1,rb);
    var ym=((Math.sin(p1)*ra+Math.sin(p2)*ra+Math.sin(p3)*rb+Math.sin(p4)*rb)/4),zm=(z(ra)+z(rb))/2;
    cells.push({d:ym*g.st+zm*g.ct,q:[proj(ra*Math.cos(p1),ra*Math.sin(p1)),proj(ra*Math.cos(p2),ra*Math.sin(p2)),proj(rb*Math.cos(p3),rb*Math.sin(p3)),proj(rb*Math.cos(p4),rb*Math.sin(p4))],r:(ra+rb)/2,ra:ra,rb:rb})}}
  cells.sort(function(a,b){return a.d-b.d});
  var born=function(r){return Math.min(1,(hi+RINGSTEP-Math.log(r)-ph0)/RINGSTEP)},die=function(r){return Math.min(1,(Math.log(r)-lo)/(RINGSTEP*2.5))};
  cx2.lineJoin='round';
  for(var c=0;c<cells.length;c++){var q=cells[c].q,r=cells[c].r;
   cx2.globalAlpha=1;cx2.fillStyle=col.bg;cx2.beginPath();cx2.moveTo(q[0][0],q[0][1]);cx2.lineTo(q[1][0],q[1][1]);cx2.lineTo(q[2][0],q[2][1]);cx2.lineTo(q[3][0],q[3][1]);cx2.closePath();cx2.fill();
   // the cell's own edges: its inner ring (fading in at the edge, out at the bottom) and one spoke
   var al=alpha(r)*base; if(al<=0.003&&tun(r)<=0)continue;
   stroke([q[0],q[1]],al*1.2*born(cells[c].ra)*die(cells[c].ra),1,cells[c].ra);
   stroke([q[0],q[3]],al,1,r)}
  // fade toward the top: a wash of the page colour over the upper part
  if(opt.wash!==false){cx2.globalAlpha=1;cx2.fillStyle=topFill(g);cx2.fillRect(0,0,g.W,g.H*0.42)}
  // the two orbit rings, dashed
  if(opt.rings!==false){cx2.strokeStyle=col.ink;cx2.setLineDash([4,4]);[[g.r2,col.grid2,1.5],[g.r1,col.blue,1.5]].forEach(function(q){var p=[];for(var i=0;i<=90;i++){var b=i/90*Math.PI*2;p.push(proj(q[0]*Math.cos(b),q[0]*Math.sin(b)))}cx2.strokeStyle=q[1];stroke(p,1,q[2])});cx2.setLineDash([])}}
 return {size:size,layout:layout,draw:draw,z:z,sc:sc,mouthY:mouthY,geo:function(){return geo}}}
var well=Well(cv,{});
function layout(){var b=document.body.getBoundingClientRect(),h=hero.getBoundingClientRect(),r=st.getBoundingClientRect();
 var W=document.documentElement.clientWidth,H=Math.round(h.bottom-b.top);R.style.setProperty('--band-h',H+'px');well.size(W,H);
 st.style.translate='0 0';r=st.getBoundingClientRect();var dx=P.ox*W/100,dy=P.oy*H/100;st.style.translate=dx+'px '+dy+'px';
 var sz=SIZES[P.size][W>=1000?'d':'m'];well.layout(W,H,r.left-b.left+r.width/2+dx,r.top-b.top+r.height/2+dy,sz,P.theta)}
function frame(now){var T=reduce?0:(now-t0)/1000;well.draw(T);var g=well.geo(),z=well.z,sc=well.sc;
 // the ring groups' depth, scale and tilt
 R.style.setProperty('--dy1',(-(z(g.r1))*g.st*sc(g.r1))+'px');R.style.setProperty('--dy2',(-(z(g.r2))*g.st*sc(g.r2))+'px');R.style.setProperty('--dyd',(-(z((g.r1+g.r2)/2))*g.st*sc((g.r1+g.r2)/2))+'px');
 R.style.setProperty('--s1',sc(g.r1));R.style.setProperty('--s2',sc(g.r2));R.style.setProperty('--sd',sc((g.r1+g.r2)/2));
 R.style.setProperty('--tilt',P.theta+'deg');R.style.setProperty('--r1',g.r1+'px');R.style.setProperty('--r2',g.r2+'px');R.style.setProperty('--rd',((g.r1+g.r2)/2)+'px');
 if(window.frameExtra)frameExtra(T);
 if(!reduce&&!st.classList.contains('paused'))requestAnimationFrame(frame)}
"""

random.seed(7)
DUST = [(random.uniform(0, 360), random.uniform(.78, 1.22), random.choice((2, 2, 3, 4))) for _ in range(18)]
dust_html = ''.join(f'<i class="mote" style="--a:{a:.0f}deg;--k:{k:.2f};--s:{s}px"></i>' for a, k, s in DUST)

EXTRA = f"""
.band{{background-image:none}}
.flowwrap{{position:absolute;left:0;top:0;width:100%;height:var(--band-h,0px);overflow:hidden;pointer-events:none;z-index:0}}#flow{{position:absolute;left:0;top:0}}
.hero{{position:relative;z-index:1}}
.stage{{overflow:visible;background:transparent}}
.loupe,.gate,.ls{{display:none}}
.pc{{position:absolute;left:50%;top:50%;width:0;height:0;translate:0 0;transform-style:preserve-3d}}
.pc.in{{transform:translateY(var(--dy1)) scale(var(--s1)) rotateX(var(--tilt));--r:var(--r1)}}.pc.out{{transform:translateY(var(--dy2)) scale(var(--s2)) rotateX(var(--tilt));--r:var(--r2)}}.pc.dust{{transform:translateY(var(--dyd)) scale(var(--sd)) rotateX(var(--tilt));--r:var(--rd)}}
.spin{{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;animation:spin 60s linear infinite}}.pc.out .spin{{animation:spin-r 90s linear infinite}}.pc.dust .spin{{animation:spin 140s linear infinite}}
.part{{position:absolute;left:0;top:0;transform-style:preserve-3d;translate:calc(var(--r) * var(--cx)) calc(var(--r) * var(--cy))}}
.up{{display:block;transform-style:preserve-3d;animation:spin-r 60s linear infinite}}.pc.out .up{{animation:spin 90s linear infinite}}
.bill{{display:block;transform-origin:50% 100%;transform:rotateX(calc(var(--tilt) * -1))}}
.cube{{display:block;position:relative;width:var(--s);height:var(--s);margin:calc(var(--s) * -.5) 0 0 calc(var(--s) * -.5);transform-style:preserve-3d;transform:translateZ(calc(var(--s) * .5))}}
.cube i{{position:absolute;inset:0;background:var(--f);border:1px solid rgba(0,0,0,.12)}}
.cube i:nth-child(1){{transform:translateZ(calc(var(--s) * .5))}}.cube i:nth-child(2){{transform:rotateY(180deg) translateZ(calc(var(--s) * .5));background:var(--f3)}}
.cube i:nth-child(3){{transform:rotateY(90deg) translateZ(calc(var(--s) * .5));background:var(--f3)}}.cube i:nth-child(4){{transform:rotateY(-90deg) translateZ(calc(var(--s) * .5));background:var(--f2)}}
.cube i:nth-child(5){{transform:rotateX(90deg) translateZ(calc(var(--s) * .5));background:var(--f2)}}.cube i:nth-child(6){{transform:rotateX(-90deg) translateZ(calc(var(--s) * .5));background:var(--f3)}}
.cube.orange{{--f:#e0600a;--f2:#ff7a1a;--f3:#b84d08}}.cube.ink{{--f:var(--ink);--f2:var(--ink-2);--f3:var(--ink)}}.cube.blue{{--f:#2F55D4;--f2:#7590E6;--f3:#2244a8}}
.sphere{{display:block;width:var(--s);height:var(--s);margin:calc(var(--s) * -.5) 0 0 calc(var(--s) * -.5);border-radius:50%;background:radial-gradient(circle at 32% 30%,var(--hi) 0,var(--f) 42%,var(--f3) 100%)}}
.sphere.orange{{--hi:#ffb27a;--f:#e0600a;--f3:#8a3a06}}.sphere.blue{{--hi:#b9c7f5;--f:#2F55D4;--f3:#1a3488}}.sphere.ink{{--hi:var(--ink-2);--f:var(--ink);--f3:var(--ink)}}
.mote{{position:absolute;left:0;top:0;width:var(--s);height:var(--s);margin:calc(var(--s) * -.5) 0 0 calc(var(--s) * -.5);border-radius:50%;background:var(--faint);opacity:.8;translate:calc(var(--r) * var(--k) * cos(var(--a))) calc(var(--r) * var(--k) * sin(var(--a)))}}
.chip{{border-color:var(--rule-strong)}}
.vbar{{position:fixed;left:50%;bottom:max(12px,env(safe-area-inset-bottom,0px));translate:-50% 0;z-index:5;display:flex;gap:6px;padding:4px;border-radius:999px;background:var(--bg);border:1.5px solid var(--rule-strong);max-width:calc(100vw - 24px)}}
.vbar span{{display:flex;gap:2px;align-items:center;padding-left:6px;font:400 10px/1 var(--mono);color:var(--faint)}}
.vbar input[type=range]{{width:72px;accent-color:var(--blue);margin:0 2px}}.vbar{{flex-wrap:wrap;justify-content:center;border-radius:18px}}
.vbar button{{all:unset;cursor:pointer;padding:6px 8px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--muted)}}.vbar button[aria-pressed="true"]{{background:var(--ink);color:var(--bg)}}.vbar button:focus-visible{{outline:2px solid var(--blue);outline-offset:2px}}
.pos-B .hero .stage{{order:1}}
@media (min-width:1000px){{.pos-B .hero{{grid-template-columns:auto minmax(0,1fr)}}.pos-B .hero .stage{{order:-1}}}}
{''.join(f".sz-{k} .stage{{width:{v['m']['w']}px;height:{v['m']['w']}px}}@media (min-width:1000px){{.sz-{k} .stage{{width:{v['d']['w']}px;height:{v['d']['w']}px}}}}" for k, v in SIZES.items())}
"""

BODY = gen7.BODY.replace('Prototype p8 · the orbit as decoration on three grounds (switch at the bottom) · tap the orbit to pause',
                         'Prototype p16 · the whirlpool: a polar mesh swirling into the well, with perspective · tilt, size and position at the bottom · tap the well to pause')


def cube(col, s, a):
    return f'<span class="part" style="--cx:{math.cos(math.radians(a)):.3f};--cy:{math.sin(math.radians(a)):.3f}"><span class="cube {col}" style="--s:{s}px"><i></i><i></i><i></i><i></i><i></i><i></i></span></span>'


def sphere(col, s, a):
    return f'<span class="part" style="--cx:{math.cos(math.radians(a)):.3f};--cy:{math.sin(math.radians(a)):.3f}"><span class="up"><span class="bill"><span class="sphere {col}" style="--s:{s}px"></span></span></span></span>'


STAGE = f"""<div class="stage" id="stage" aria-hidden="true">
  <span class="pc dust"><span class="spin">{dust_html}</span></span>
  <span class="pc in"><span class="spin">{cube('orange', 14, -90)}{sphere('blue', 12, 40)}{cube('ink', 10, 160)}</span></span>
  <span class="pc out"><span class="spin">{sphere('orange', 16, -150)}{cube('blue', 12, -30)}{sphere('ink', 8, 75)}{cube('orange', 8, 125)}</span></span>
  
 </div>"""

HTML = f"""<title>DTA landing page</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{gen5.tokens}
{gen8.HERO_CSS}
:root{{--tunnel:#070b16}}@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--tunnel:#000}}}}:root[data-theme="dark"]{{--tunnel:#000}}
{EXTRA}
{gen6.CSS}</style>
<div class="band" aria-hidden="true"></div><div class="flowwrap" aria-hidden="true"><canvas id="flow"></canvas></div>
<div class="w">
<nav><b>Design Token Authority</b><span><span class="nl"><a href="#story">How it works</a> · <a href="#agents">Agents</a> · </span><a href="#">Docs</a> <button class="tt" id="tt" type="button" aria-label="Toggle theme">◐</button></span></nav>
<header class="hero">
 <div class="copy">
  <h1>The deterministic centre of gravity for design token workflows, built for humans and <i>agents.</i></h1>
  <p class="lede">A design change in Figma becomes a pull request: validated, built, visually diffed and approved by the people who care about it.</p>
  <div class="ctas"><a class="btn-p" href="#">npm create dta</a><a class="btn-o" href="#">Read the quick start</a></div>
 </div>
 {STAGE}
</header>
{BODY}
</div>
<div class="vbar" role="group" aria-label="Well variants (prototype)">
 <span>tilt<button type="button" data-k="theta" data-v="40">40</button><button type="button" data-k="theta" data-v="52">52</button><button type="button" data-k="theta" data-v="64">64</button></span>
 <span>size<button type="button" data-k="size" data-v="S">S</button><button type="button" data-k="size" data-v="L">L</button></span>
 <span>pos<button type="button" data-k="pos" data-v="A">A</button><button type="button" data-k="pos" data-v="B">B</button></span>
 <span>x<input type="range" id="ox" min="-45" max="45" step="1" value="0" aria-label="Well x offset"></span>
 <span>y<input type="range" id="oy" min="-40" max="40" step="1" value="0" aria-label="Well y offset"></span>
</div>
<script>
(function(){{var SIZES={{{', '.join(f'"{k}":{{"m":{v["m"]},"d":{v["d"]}}}' for k, v in SIZES.items())}}};
{JS_RENDER}
st.addEventListener('click',function(){{st.classList.toggle('paused');if(!st.classList.contains('paused')){{t0=performance.now()-(st._t||0);requestAnimationFrame(frame)}}else st._t=performance.now()-t0}});
var vk='dta-hero-well15';try{{var sv=JSON.parse(localStorage.getItem(vk)||'null');if(sv)P=Object.assign(P,sv)}}catch(e){{}}
(location.hash||'').slice(1).split(',').forEach(function(p){{var m=/^(theta|size|pos|ox|oy)=(-?\\w+)$/.exec(p);if(m)P[m[1]]=(m[1]==='theta'||m[1]==='ox'||m[1]==='oy')?+m[2]:m[2]}});
function apply(){{R.className=R.className.replace(/\\b(sz|pos)-\\w+/g,'').trim();R.classList.add('sz-'+P.size,'pos-'+P.pos);
 document.querySelectorAll('.vbar button').forEach(function(x){{x.setAttribute('aria-pressed',String(String(P[x.dataset.k])===x.dataset.v))}});try{{localStorage.setItem(vk,JSON.stringify(P))}}catch(e){{}}syncRanges();readCol();layout();if(reduce)frame(performance.now())}}
document.querySelectorAll('.vbar button').forEach(function(x){{x.addEventListener('click',function(){{P[x.dataset.k]=x.dataset.k==='theta'?+x.dataset.v:x.dataset.v;apply()}})}});
['ox','oy'].forEach(function(k){{var el=document.getElementById(k);el.addEventListener('input',function(){{P[k]=+el.value;apply()}})}});
function syncRanges(){{document.getElementById('ox').value=P.ox;document.getElementById('oy').value=P.oy}}
addEventListener('resize',apply);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(apply);if(window.ResizeObserver){{new ResizeObserver(apply).observe(hero)}}
var tt=document.getElementById('tt'),k='dta-hero-theme';try{{var v=localStorage.getItem(k);if(v)R.dataset.theme=v}}catch(e){{}}
tt.addEventListener('click',function(){{var cur=R.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var n=cur==='dark'?'light':'dark';R.dataset.theme=n;try{{localStorage.setItem(k,n)}}catch(e){{}}readCol();if(reduce)frame(performance.now())}});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(){{readCol()}});
var px=0;function parallax(){{var y=scrollY;if(reduce)y=0;cv.style.transform='translateY('+(y*0.35)+'px)';st.style.transform='translateY('+(y*0.18)+'px)';px=0}}
addEventListener('scroll',function(){{if(!px){{px=requestAnimationFrame(parallax)}}}},{{passive:true}});parallax();
apply();requestAnimationFrame(frame);}})();
</script>
"""

if __name__ == '__main__':
    open('p16-page.html', 'w').write(HTML)
