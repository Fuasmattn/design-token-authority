P='./'
tokens=open(P+'tokens.css').read().split('@media')[0].replace('--grid:rgba(19,33,63,.07); --grid-2:rgba(19,33,63,.09);','--grid:rgba(19,33,63,.045); --grid-2:rgba(19,33,63,.06);')
CYC=32.0
def kf(name, frames):
    props=sorted({p for _,d in frames for p in d}); cur={}; out=[]
    for t,d in frames:
        for p in props:
            if p in d: cur[p]=d[p]
        for p in props: cur.setdefault(p, frames[0][1].get(p))
        out.append(f"{t/CYC*100:.3f}%{{{';'.join(f'{p}:{cur[p]}' for p in props)}}}")
    return f"@keyframes {name}{{{''.join(out)}}}"
D,C,Pp='var(--pd)','var(--pc)','var(--pp)'
GND={'translate':'0 0','scale':'1'}; AIR={'translate':'0 -14px','scale':'1.3'}
SG={'translate':'2px 3px','scale':'1','filter':'blur(1px)','opacity':'.35'}; SA={'translate':'12px 18px','scale':'1.25','filter':'blur(5px)','opacity':'.14'}
def hop(mv,lf,sh,t0,a,b,dur=1.5):
    mv+=[(t0,{'translate':a}),(t0+.3,{'translate':a}),(t0+dur-.25,{'translate':b}),(t0+dur,{'translate':b})]
    lf+=[(t0,GND),(t0+.3,AIR),(t0+dur-.35,AIR),(t0+dur,GND)]
    sh+=[(t0,SG),(t0+.3,SA),(t0+dur-.35,SA),(t0+dur,SG)]
# ---- token timeline
# lap 1 (usual): 0 appear D; 1.0 fly D->C; 2.8-6.2 inspect (checks, drift finding); 6.4 finding leaves to P; 9.8 finding returns to C; 11.2 approved; 11.8 token C->P; 13.6 shipped; 15.0 fade
# lap 2 (rare): 16.0 appear D; 17.0 fly D->C; 18.8-21.4 inspect (contrast finding); 21.6 token C->D red; 23.6 fix; 24.6 D->C; 26.4 approved; 27.0 C->P; 28.8 shipped; 30.2 fade
mv=[(0,{'translate':D})]; lf=[(0,GND)]; sh=[(0,SG)]
hop(mv,lf,sh,1.0,D,C); hop(mv,lf,sh,11.8,C,Pp)
mv+=[(15.4,{'translate':Pp}),(15.5,{'translate':D})]; 
hop(mv,lf,sh,17.0,D,C); hop(mv,lf,sh,21.6,C,D); hop(mv,lf,sh,24.6,D,C); hop(mv,lf,sh,27.0,C,Pp)
mv+=[(CYC,{'translate':Pp})]; lf+=[(CYC,GND)]; sh+=[(CYC,SG)]
tokop=[(0,{'opacity':'0'}),(0.5,{'opacity':'1'}),(14.6,{'opacity':'1'}),(15.3,{'opacity':'0'}),(15.6,{'opacity':'0'}),(16.2,{'opacity':'1'}),(29.8,{'opacity':'1'}),(30.6,{'opacity':'0'}),(CYC,{'opacity':'0'})]
# finding chip (lap 1): appears at C 6.0, flies to P 6.4-7.9, "fixed" 8.2-9.6 (glyph # -> swatch), flies back 9.8-11.3, merges 11.5
fm=[(0,{'translate':C})]; fl=[(0,GND)]; fs=[(0,SG)]
hop(fm,fl,fs,6.4,C,Pp); hop(fm,fl,fs,9.8,Pp,C); fm+=[(CYC,{'translate':C})]; fl+=[(CYC,GND)]; fs+=[(CYC,SG)]
fop=[(0,{'opacity':'0','scale':'.5'}),(5.9,{'opacity':'0','scale':'.5'}),(6.2,{'opacity':'1','scale':'1'}),(11.3,{'opacity':'1','scale':'1'}),(11.6,{'opacity':'0','scale':'.5'}),(CYC,{'opacity':'0','scale':'.5'})]
fhash=[(0,{'opacity':'1'}),(8.4,{'opacity':'1'}),(8.8,{'opacity':'0'}),(CYC,{'opacity':'0'})]   # the # glyph fades at the fix
fsw=[(0,{'opacity':'0'}),(8.4,{'opacity':'0'}),(8.8,{'opacity':'1'}),(CYC,{'opacity':'1'})]
# orbit inspection windows
INS=[(2.8,6.2),(11.0,11.6),(18.8,21.4),(26.0,26.6)]
def pulse(opens,closed,open_,d=.5,dc=.4):
    fr=[(0,closed)]
    for o,c in opens: fr+=[(o,closed),(o+d,open_),(c,open_),(c+dc,closed)]
    fr.append((CYC,closed)); return fr
loupe=kf('loupe',pulse(INS,{'scale':'0','opacity':'0'},{'scale':'1','opacity':'1'}))
def part(name,ang,r,o=.2):
    import math
    dx=math.cos(math.radians(ang))*f"{r}"if False else None
    return None
import math
def partkf(name,ang,rv,delay):
    # position via calc with --r1/--r2 vars: translate(calc(-50% + cos*r)) — r is a var, use calc(var(--r1) * cos)
    cx=f"calc(-50% + var(--{rv}) * {math.cos(math.radians(ang)):.3f})"; cy=f"calc(-50% + var(--{rv}) * {math.sin(math.radians(ang)):.3f})"
    home={'translate':'-50% -50%','opacity':'0','scale':'.5'}; out={'translate':f'{cx} {cy}','opacity':'1','scale':'1'}
    fr=[(0,home)]
    for o,c in [INS[0],INS[2]]:
        fr+=[(o+delay,home),(o+delay+.5,out),(c,out),(c+.4,home)]
    fr.append((CYC,home)); return kf(name,fr)
orbit=[partkf('o1',-90,'r1',.1),partkf('o2',30,'r1',.2),partkf('o3',150,'r1',.3),partkf('o4',-150,'r2',.4),partkf('o5',-30,'r2',.5),partkf('o6',70,'r2',.6)]
spin="@keyframes spin{to{rotate:360deg}}"
def pop(name,spans,dx='0px',dy='0px'):
    a={'opacity':'0','translate':f'calc(-50% + {dx}) calc(-50% + {dy} + 8px)'}; b={'opacity':'1','translate':f'calc(-50% + {dx}) calc(-50% + {dy})'}; e=dict(b,opacity='0')
    fr=[(0,a)]
    for o,c in spans: fr+=[(o,a),(o+.3,b),(c,b),(c+.3,e)]
    fr.append((CYC,e)); return kf(name,fr)
# checks above the orbit (dy = -(r2+?)) use var --cy
checks=[pop('c-lint',[(3.8,6.3),(19.6,21.5)],'-30px','var(--cy)'),pop('c-build',[(4.2,6.3),(20.0,21.5)],'0px','var(--cy)'),pop('c-diff',[(4.8,6.3),(20.6,21.5)],'30px','var(--cy)'),
        pop('pair1',[(5.0,6.3)],'0px','calc(var(--cy) - 34px)'),pop('pair2',[(20.8,21.5)],'0px','calc(var(--cy) - 34px)'),
        pop('appr',[(11.1,11.7),(26.1,26.7)],'0px','var(--cy)'),
        pop('fixp',[(8.2,9.7)],'var(--pox)','-58px'),   # at P (developer): # -> swatch
        pop('fixd',[(23.4,24.6)],'var(--dox)','-58px'), # at D: Aa dark -> white
        pop('ship',[(13.5,14.8),(28.7,29.9)],'var(--pox)','-58px')]
def rise(name, spans):
    flat={'transform':'translateY(0)','box-shadow':'0 0 0 rgba(19,33,63,0),0 0 0 rgba(255,255,255,0)'}; up={'transform':'translateY(-3px)','box-shadow':'var(--sh-dark),var(--sh-light)'}
    fr=[(0,flat)]
    for a,b in spans: fr+=[(a,flat),(a+.3,up),(b,up),(b+.4,flat)]
    fr.append((CYC,flat)); return kf(name,fr)
rises=[rise('r-d',[(0.05,1.0),(16.2,17.0),(23.1,24.6)]),rise('r-c',[(2.5,6.4),(11.3,11.8),(18.5,21.6),(25.9,27.0)]),rise('r-p',[(7.9,9.8),(13.3,15.0),(28.5,30.2)])]
ret=kf('ret',[(0,{'stroke-dashoffset':'1','opacity':'0'}),(21.4,{'stroke-dashoffset':'1','opacity':'1'}),(22.8,{'stroke-dashoffset':'0','opacity':'1'}),(24.4,{'stroke-dashoffset':'0','opacity':'1'}),(25.0,{'stroke-dashoffset':'0','opacity':'0'}),(CYC,{'stroke-dashoffset':'0','opacity':'0'})])
lapkf=kf('lap',[(0,{'opacity':'0'}),(0.3,{'opacity':'1'}),(15,{'opacity':'1'}),(15.5,{'opacity':'0'}),(CYC,{'opacity':'0'})])
lap2kf=kf('lap2',[(0,{'opacity':'0'}),(15.6,{'opacity':'0'}),(16.1,{'opacity':'1'}),(30.4,{'opacity':'1'}),(31,{'opacity':'0'}),(CYC,{'opacity':'0'})])

def mpos(st,dx,dy):
    return f"calc(var(--ox) + var(--p{st}x) * var(--z) + {dx}px) calc(var(--oy) + var(--p{st}y) * var(--z) + {dy}px)"
G={'mask-size':'104px 62px'}; Fz={'mask-size':'160px 100px'}
def lhop(fr,t0,a,b,dur=1.5,gw=52,gh=31,fw=80,fh=50):
    # a,b station letters; ground offset (-gw+2,-gh+4), flight (-fw+12,-fh+18)
    fr+=[(t0,dict(G,**{'mask-position':mpos(a,-gw+9,-gh+13)})),(t0+.3,dict(Fz,**{'mask-position':mpos(a,-fw+16,-fh+24)})),(t0+dur-.35,dict(Fz,**{'mask-position':mpos(b,-fw+16,-fh+24)})),(t0+dur,dict(G,**{'mask-position':mpos(b,-gw+9,-gh+13)}))]
lt=[(0,dict(G,**{'mask-position':mpos('d',-43,-18)}))]
lhop(lt,1.0,'d','c'); lhop(lt,11.8,'c','p'); lt+=[(15.4,dict(G,**{'mask-position':mpos('p',-43,-18)})),(15.5,dict(G,**{'mask-position':mpos('d',-43,-18)}))]
lhop(lt,17.0,'d','c'); lhop(lt,21.6,'c','d'); lhop(lt,24.6,'d','c'); lhop(lt,27.0,'c','p'); lt+=[(CYC,dict(G,**{'mask-position':mpos('p',-43,-18)}))]
lf_=[(0,dict(G,**{'mask-position':mpos('c',-43,-18)}))]; lhop(lf_,6.4,'c','p'); lhop(lf_,9.8,'p','c'); lf_+=[(CYC,dict(G,**{'mask-position':mpos('c',-43,-18)}))]
lsk=[kf('ls-tok',lt),kf('ls-fnd',lf_)]
allkf='\n'.join(lsk+[kf('mv',mv),kf('lf',lf),kf('sh',sh),kf('tokop',tokop),kf('fm',fm),kf('fl',fl),kf('fs',fs),kf('fop',fop),kf('fop-o',[(t,{'opacity':d['opacity']}) for t,d in fop]),kf('fhash',fhash),kf('fsw',fsw),loupe,spin,lapkf,lap2kf]+orbit+checks+rises+[ret])
T=f"{CYC}s"
anim=f"animation-duration:{T};animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-iteration-count:infinite;animation-fill-mode:both"
tiles='<span class="tiles"><i>{ }</i><i>tw</i><i>ios</i></span>'
split='<span class="split"><i style="background:#ff7a1a"></i><i style="background:#e0600a"></i></span>'
def mb(label_dark=False, region=False):
    return f'<span class="mb{" o" if region else ""}"><i></i><em style="background:{"#5a2a08" if label_dark else "#fff3e8"}"></em>{"<u></u>" if region else ""}</span>'
# geometry per layout (mobile vertical / desktop horizontal)
M=dict(w=358,h=600,pd='222px 92px',pc='222px 300px',pp='222px 508px',px=('222px','222px','222px'),py=('92px','300px','508px'),z='1',r1='58px',r2='88px',cy='-112px',
       rail='left:222px;top:92px;height:416px;border-left:1.5px dashed var(--grid-2)',
       retpath='M 212 290 C 141 290, 141 102, 212 102', lanes='.lane.d{left:0;top:78px}.lane.c{left:0;top:286px}.lane.p{left:0;top:494px}',
       st='.st{translate:0 0}.st.d{left:-6px;top:92px}.st.c{left:-6px;top:300px}.st.p{left:-6px;top:508px}')
Dk=dict(w=860,h=400,pd='110px 210px',pc='430px 210px',pp='750px 210px',px=('110px','430px','750px'),py=('210px','210px','210px'),z='1.25',r1='80px',r2='120px',cy='-150px',
       rail='left:110px;top:210px;width:640px;border-top:1.5px dashed var(--grid-2)',
       retpath='M 430 198 C 430 90, 110 90, 110 198', lanes='.lane.d{left:0;top:0}.lane.c{left:50%;top:0;translate:-50% 0}.lane.p{left:auto;right:0;top:0}',
       st='.st{translate:-50% 0}.st.d{left:110px;top:346px}.st.c{left:430px;top:346px}.st.p{left:750px;top:346px}')
def layout(L):
    return (f".stage{{width:{L['w']}px;height:{L['h']}px;--pd:{L['pd']};--pc:{L['pc']};--pp:{L['pp']};--r1:{L['r1']};--r2:{L['r2']};--cy:{L['cy']}}}"
            f":root{{--z:{L['z']};--pox:0px;--dox:0px;--pdx:{L['px'][0]};--pcx:{L['px'][1]};--ppx:{L['px'][2]};--pdy:{L['py'][0]};--pcy:{L['py'][1]};--ppy:{L['py'][2]}}}"
            f".rail{{{L['rail']}}}{L['lanes']}{L['st']}"
            f".loupe{{width:calc(var(--r1)*2);height:calc(var(--r1)*2)}}.loupe::after{{inset:calc(var(--r1) - var(--r2))}}")
html=f"""<title>Orbit Loop · two findings</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Martian+Mono:wght@400;500&display=swap">
<style>
{tokens}
*{{box-sizing:border-box}}
body{{position:relative;margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;min-height:100vh;
 background-image:linear-gradient(0deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(90deg,var(--grid-2) 0 1px,transparent 1px 120px),linear-gradient(0deg,var(--grid) 0 1px,transparent 1px 24px),linear-gradient(90deg,var(--grid) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}}
.ls{{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:0;
 background-image:linear-gradient(0deg,rgba(19,33,63,.5) 0 1px,transparent 1px 120px),linear-gradient(90deg,rgba(19,33,63,.5) 0 1px,transparent 1px 120px),linear-gradient(0deg,rgba(19,33,63,.38) 0 1px,transparent 1px 24px),linear-gradient(90deg,rgba(19,33,63,.38) 0 1px,transparent 1px 24px);background-size:120px 120px,120px 120px,24px 24px,24px 24px;
 -webkit-mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.7) 30%,transparent 88%);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation-duration:{T};animation-timing-function:cubic-bezier(.5,0,.2,1);animation-iteration-count:infinite}}
.ls.la{{animation-name:ls-tok,tokop}}.ls.lb{{animation-name:ls-fnd,fop-o}}
.w{{position:relative;z-index:1;max-width:400px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 40px}}
.kicker{{font:400 11px/1.4 var(--mono);color:var(--blue);letter-spacing:.02em;margin:0 0 8px}}
h1{{font:700 26px/1.05 var(--sans);letter-spacing:-.02em;margin:0 0 8px;text-wrap:balance}}
.lede{{margin:0;font-size:14px;line-height:1.5;color:var(--muted);max-width:38ch}}
.stage{{position:relative;max-width:100%;margin:18px auto 0;touch-action:manipulation}}
.lane{{position:absolute;font:500 10px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}}
.rail{{position:absolute}}
svg.ret{{position:absolute;inset:0;width:100%;height:100%;overflow:visible}}svg.ret.dk{{display:none}}
svg.ret path{{fill:none;stroke:var(--red);stroke-width:1.5;stroke-linecap:butt;stroke-dasharray:1;animation:ret {T} linear infinite}}
.pad{{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;margin:-15px 0 0 -15px;box-shadow:inset 0 0 0 1px var(--grid-2)}}
.pad.d{{translate:var(--pd)}}.pad.c{{translate:var(--pc)}}.pad.p{{translate:var(--pp)}}
.st{{position:absolute;translate:-50% 0;padding:6px 9px;border-radius:999px;font:400 11px/1 var(--mono);color:var(--ink);white-space:nowrap;background:var(--bg);animation-duration:{T};animation-timing-function:ease-out;animation-iteration-count:infinite;animation-fill-mode:both}}
.st.d{{animation-name:r-d}}.st.c{{animation-name:r-c}}.st.p{{animation-name:r-p}}
.lap{{position:absolute;right:0;bottom:-2px;font:400 10px/1.4 var(--mono);color:var(--faint);text-align:right;opacity:0;animation:lap {T} linear infinite}}.lap.two{{animation-name:lap2}}
/* token + finding */
.tok,.fnd{{position:absolute;left:0;top:0;width:0;height:0}}
.tok{{animation:mv {T} cubic-bezier(.5,0,.2,1) infinite,tokop {T} linear infinite}}
.fnd{{animation:fm {T} cubic-bezier(.5,0,.2,1) infinite,fop {T} ease-out infinite}}
.tsh{{display:none;position:absolute;left:-26px;top:-13px;width:52px;height:26px;border-radius:12px;background:var(--shadow-ink);animation:sh {T} cubic-bezier(.5,0,.2,1) infinite}}
.lift{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;animation:lf {T} cubic-bezier(.5,0,.2,1) infinite;transform-origin:50% 50%}}
.fnd .tsh{{left:-11px;top:-11px;width:22px;height:22px;border-radius:50%;animation-name:fs}}.fnd .lift{{left:-11px;top:-11px;width:22px;height:22px;animation-name:fl}}
.chip{{width:52px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 6px;box-shadow:inset 0 0 0 1px var(--grid-2)}}
.chip i{{width:14px;height:14px;border-radius:4px;background:#e0600a;flex:none}}.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.fchip{{position:relative;width:22px;height:22px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--bg);display:grid;place-items:center;color:var(--bg);font:700 11px/1 var(--mono)}}
.fchip .h{{animation:fhash {T} linear infinite}}.fchip .s{{position:absolute;inset:5px;border-radius:3px;background:#e0600a;box-shadow:0 0 0 2px var(--bg);animation:fsw {T} linear infinite}}
/* orbit */
.loupe{{position:absolute;left:0;top:0;translate:var(--pc);margin:0;border-radius:50%;border:1.5px dashed var(--blue-2);margin:calc(var(--r1) * -1) 0 0 calc(var(--r1) * -1);animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite,spin 30s linear infinite}}
.loupe::after{{content:'';position:absolute;border-radius:50%;border:1.5px dashed var(--grid-2)}}
.part{{position:absolute;left:0;top:0;margin:0;{anim}}}
.pc{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}
.sw{{display:block;width:16px;height:16px;border-radius:5px;background:#e0600a}}
.split{{display:flex;width:26px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.dot{{display:block;width:10px;height:10px;border-radius:50%;background:#e0600a}}.dot.l{{background:#ff7a1a}}
.o1{{animation-name:o1}}.o2{{animation-name:o2}}.o3{{animation-name:o3}}.o4{{animation-name:o4}}.o5{{animation-name:o5}}.o6{{animation-name:o6}}
/* pops: all positioned from a station anchor */
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
.foot{{max-width:360px;margin:12px auto 0;font:400 11px/1.5 var(--mono);color:var(--faint)}}
{layout(M)}
@media (min-width:900px){{svg.ret.m{{display:none}}svg.ret.dk{{display:block}}.w{{max-width:1120px}}.lede{{max-width:60ch}}{layout(Dk)}.stage{{zoom:1.25;margin-top:28px}}svg.ret path{{stroke-width:2}}.loupe,.loupe::after{{border-width:2px}}.rail{{border-width:2px}}.st{{font-size:12px;padding:7px 11px}}.lane{{font-size:11px}}.foot{{max-width:1120px}}}}
@media (prefers-reduced-motion:reduce){{.stage *{{animation:none!important}}.tok{{translate:var(--pc);opacity:1}}.loupe{{scale:1;opacity:1}}.part{{opacity:1;scale:1}}.fnd{{opacity:0}}.pop{{opacity:0}}.tsh{{opacity:.3}}svg.ret path{{opacity:0}}}}
{allkf}
</style>
<div class="ls la" aria-hidden="true"></div><div class="ls lb" aria-hidden="true"></div>
<div class="w">
 <header>
  <p class="kicker">THE LOOP · PROTOTYPE 4 · ORBIT</p>
  <h1>Design on one side, product on the other.</h1>
  <p class="lede">A token crosses into the pull request and is taken apart there. Usually the finding is on the product side: a component that drifted from the tokens. Sometimes the token itself was wrong. Each finding goes back to the side that can fix it.</p>
 </header>
 <div class="stage" id="stage" aria-label="A token travels from design into the pull request and is inspected. Lap one: the finding is a hard-coded value in a component; a developer fixes it and the token ships. Lap two: the token itself was wrong; it goes back to Figma, is fixed and ships.">
  <span class="lane d">Design</span><span class="lane c">Pull request</span><span class="lane p">Product</span>
  <span class="rail"></span>
  <svg class="ret m" viewBox="0 0 {M['w']} {M['h']}" aria-hidden="true"><path pathLength="1" d="{M['retpath']}"/></svg><svg class="ret dk" viewBox="0 0 {Dk['w']} {Dk['h']}" aria-hidden="true"><path pathLength="1" d="{Dk['retpath']}"/></svg>
  <span class="pad d"></span><span class="pad c"></span><span class="pad p"></span>
  <span class="st d">Figma</span><span class="st c">lint · build · diff</span><span class="st p">components · outputs</span>
  <span class="loupe" aria-hidden="true"></span>
  <span class="pc" aria-hidden="true">
   <span class="part o1"><span class="sw"></span></span>
   <span class="part o2">{split}</span>
   <span class="part o3"><span class="link"></span></span>
   <span class="part o4">{tiles}</span>
   <span class="part o5"><span class="dot l"></span></span>
   <span class="part o6"><span class="dot"></span></span>
   <span class="pop c-lint"><span class="badge">✓</span></span><span class="pop c-build"><span class="badge">✓</span></span><span class="pop c-diff"><span class="badge bad">!</span></span>
   <span class="pop pair1"><span class="pill">{mb(False)}<span class="arr"></span>{mb(False,True)}<span class="hash">#</span></span></span>
   <span class="pop pair2"><span class="pill">{mb(False)}<span class="arr"></span>{mb(True,True)}</span></span>
   <span class="pop appr"><span class="badge">✓</span></span>
  </span>
  <span class="pc" style="translate:var(--pp)" aria-hidden="true">
   <span class="pop fixp"><span class="pill"><span class="hash">#</span><span class="lit">e0600a</span><span class="arr"></span><span class="sw"></span></span></span>
   <span class="pop ship"><span class="pill">{tiles}</span></span>
  </span>
  <span class="pc" style="translate:var(--pd)" aria-hidden="true">
   <span class="pop fixd"><span class="pill"><span class="aa" style="color:#5a2a08">Aa</span><span class="arr"></span><span class="aa" style="color:#fff">Aa</span></span></span>
  </span>
  <div class="fnd" aria-hidden="true"><span class="tsh"></span><span class="lift"><span class="fchip"><span class="h">#</span><span class="s"></span></span></span></div>
  <div class="tok" aria-hidden="true"><span class="tsh"></span><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span></span></div>
  <span class="lap">lap 1 · the usual case<br>a component drifted from the tokens</span>
  <span class="lap two">lap 2 · the rarer case<br>the token itself was wrong</span>
 </div>
 <p class="foot">Tap the board to pause. Two laps, {int(CYC)} s. Lap 1: the diff finds a change the tokens do not explain (a hard-coded value); the finding goes to the developer, is replaced by the token, and the change ships. Lap 2: the token was wrong; it goes back to Figma, is fixed, and ships.</p>
</div>
<script>
(function(){{var st=document.getElementById('stage');st.addEventListener('click',function(){{st.classList.toggle('paused')}});
function place(){{var r=st.getBoundingClientRect(),b=document.body.getBoundingClientRect();document.documentElement.style.setProperty('--ox',(r.left-b.left)+'px');document.documentElement.style.setProperty('--oy',(r.top-b.top)+'px')}}
place();addEventListener('resize',place);setTimeout(place,300);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);if(window.ResizeObserver){{var ro=new ResizeObserver(place);ro.observe(document.body);ro.observe(st)}}}})();
</script>
"""
open('p4-orbit-two-laps.html','w').write(html)
