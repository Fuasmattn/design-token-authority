# Fine-tuning round 1 of the hero key visual (p5 -> p6). Self-contained, no imports of gen3/gen4.
# python3 gen5.py  ->  p6-hero.html (lap 1 only) and p6-hero-2laps.html (both laps)
# Changes vs p5 (fine-tuning list in the 18 Oct handoff):
#  2  phone: lane names row dropped; pads carry a design glyph (selection frame) and a </> tile
#  3  pills: no shadow, hairline border (site rule: borders instead of shadows)
#  4  finding chip larger (28 px); rail gapped around the stations so it no longer reads as a line under the token
#  5  lap 1 only variant; timeline cut, lap-2 elements removed (not hidden)
#  +  borders, not shadows, on every surface (a11y: 3:1 edges, survive forced-colors); the lines-only grid shadow is the only depth
#     interactive outlines and the risen label border use --rule-strong (>= 3:1 on the ground in both themes)
#  7  reduced motion: frozen exploded state with parts, checks and the finding pill visible; no shadow layer
import math

light = """--bg:#F5F1E8;--surface:#FFFFFF;--grid:rgba(19,33,63,.045);--grid-2:rgba(19,33,63,.065);--rule:rgba(19,33,63,.16);--rule-strong:rgba(19,33,63,.55);--ink:#13213F;--ink-2:#3E4A66;--muted:#5A6480;--faint:#9AA2B4;--blue:#2F55D4;--blue-2:#7590E6;--red:#E8632A;--green:#3C7646;--line-ink:rgba(19,33,63,.5);--line-ink-2:rgba(19,33,63,.38);--btn-fg:#F5F1E8;--sw:#e0600a;--sw-l:#ff7a1a"""
dark = """--bg:#161513;--surface:#1F1E1B;--grid:rgba(242,237,226,.05);--grid-2:rgba(242,237,226,.075);--rule:rgba(242,237,226,.18);--rule-strong:rgba(242,237,226,.5);--ink:#F2EDE2;--ink-2:#D9D2C2;--muted:#C2BAA8;--faint:#8F8878;--blue:#7590E6;--blue-2:#A9B8F0;--red:#F58B58;--green:#7FB887;--line-ink:rgba(242,237,226,.45);--line-ink-2:rgba(242,237,226,.32);--btn-fg:#161513;color-scheme:dark"""
tokens = f""":root{{{light};--sans:'Instrument Sans',system-ui,sans-serif;--mono:'Martian Mono',ui-monospace,Menlo,monospace}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{{dark}}}}}
:root[data-theme="dark"]{{{dark}}}"""


def build(laps):
    two = laps == 2
    CYC = 32.0 if two else 16.0

    def kf(name, frames):
        frames = [f for f in frames if f[0] <= CYC]
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

    D, C, Pp = 'var(--pd)', 'var(--pc)', 'var(--pp)'
    GND = {'translate': '0 0', 'scale': '1'}
    AIR = {'translate': '0 -14px', 'scale': '1.3'}

    def hop(mv, lf, t0, a, b, dur=1.5):
        mv += [(t0, {'translate': a}), (t0 + .3, {'translate': a}), (t0 + dur - .25, {'translate': b}), (t0 + dur, {'translate': b})]
        lf += [(t0, GND), (t0 + .3, AIR), (t0 + dur - .35, AIR), (t0 + dur, GND)]

    # token. lap 1: appear D, fly to C at 1.0, inspect 2.8-6.2, finding out 6.4 / back 9.8, approved 11.2, C->P 11.8, shipped 13.6, fade 15
    mv, lf = [(0, {'translate': D})], [(0, GND)]
    hop(mv, lf, 1.0, D, C)
    hop(mv, lf, 11.8, C, Pp)
    mv += [(15.4, {'translate': Pp}), (15.5, {'translate': D})]
    if two:
        hop(mv, lf, 17.0, D, C); hop(mv, lf, 21.6, C, D); hop(mv, lf, 24.6, D, C); hop(mv, lf, 27.0, C, Pp)
    mv += [(CYC, {'translate': Pp if two else D})]
    lf += [(CYC, GND)]
    tokop = [(0, {'opacity': '0'}), (0.5, {'opacity': '1'}), (14.6, {'opacity': '1'}), (15.3, {'opacity': '0'})]
    if two:
        tokop += [(15.6, {'opacity': '0'}), (16.2, {'opacity': '1'}), (29.8, {'opacity': '1'}), (30.6, {'opacity': '0'})]
    tokop += [(CYC, {'opacity': '0'})]
    # finding chip (lap 1)
    fm, fl = [(0, {'translate': C})], [(0, GND)]
    hop(fm, fl, 6.4, C, Pp); hop(fm, fl, 9.8, Pp, C)
    fm += [(CYC, {'translate': C})]; fl += [(CYC, GND)]
    fop = [(0, {'opacity': '0', 'scale': '.5'}), (5.9, {'opacity': '0', 'scale': '.5'}), (6.2, {'opacity': '1', 'scale': '1'}), (11.3, {'opacity': '1', 'scale': '1'}), (11.6, {'opacity': '0', 'scale': '.5'}), (CYC, {'opacity': '0', 'scale': '.5'})]
    fhash = [(0, {'opacity': '1'}), (8.4, {'opacity': '1'}), (8.8, {'opacity': '0'}), (CYC, {'opacity': '0'})]
    fsw = [(0, {'opacity': '0'}), (8.4, {'opacity': '0'}), (8.8, {'opacity': '1'}), (CYC, {'opacity': '1'})]
    INS = [(2.8, 6.2), (11.0, 11.6)] + ([(18.8, 21.4), (26.0, 26.6)] if two else [])
    EXPLODE = [INS[0]] + ([INS[2]] if two else [])

    def pulse(opens, closed, open_, d=.5, dc=.4):
        fr = [(0, closed)]
        for o, c in opens:
            fr += [(o, closed), (o + d, open_), (c, open_), (c + dc, closed)]
        return fr + [(CYC, closed)]

    loupe = kf('loupe', pulse(INS, {'scale': '0', 'opacity': '0'}, {'scale': '1', 'opacity': '1'}))
    PARTS = [('o1', -90, 'r1', .1), ('o2', 30, 'r1', .2), ('o3', 150, 'r1', .3), ('o4', -150, 'r2', .4), ('o5', -30, 'r2', .5), ('o6', 70, 'r2', .6)]
    static = []  # reduced-motion resting state

    def part_out(ang, rv):
        return f"calc(-50% + var(--{rv}) * {math.cos(math.radians(ang)):.3f}) calc(-50% + var(--{rv}) * {math.sin(math.radians(ang)):.3f})"

    def partkf(name, ang, rv, delay):
        home = {'translate': '-50% -50%', 'opacity': '0', 'scale': '.5'}
        out = {'translate': part_out(ang, rv), 'opacity': '1', 'scale': '1'}
        fr = [(0, home)]
        for o, c in EXPLODE:
            fr += [(o + delay, home), (o + delay + .5, out), (c, out), (c + .4, home)]
        static.append(f".{name}{{translate:{part_out(ang, rv)};opacity:1;scale:1}}")
        return kf(name, fr + [(CYC, home)])

    orbit = [partkf(*p) for p in PARTS]

    def pop(name, spans, dx='0px', dy='0px', rest=False):
        spans = [s for s in spans if s[0] < CYC]
        if not spans:
            return ''
        at = f'calc(-50% + {dx}) calc(-50% + {dy})'
        a = {'opacity': '0', 'translate': f'calc(-50% + {dx}) calc(-50% + {dy} + 8px)'}
        b = {'opacity': '1', 'translate': at}
        e = dict(b, opacity='0')
        fr = [(0, a)]
        for o, c in spans:
            fr += [(o, a), (o + .3, b), (c, b), (c + .3, e)]
        if rest:
            static.append(f".{name}{{translate:{at};opacity:1}}")
        return kf(name, fr + [(CYC, e)])

    pops = [pop('c-lint', [(3.8, 6.3), (19.6, 21.5)], '-30px', 'var(--cy)', True),
            pop('c-build', [(4.2, 6.3), (20.0, 21.5)], '0px', 'var(--cy)', True),
            pop('c-diff', [(4.8, 6.3), (20.6, 21.5)], '30px', 'var(--cy)', True),
            pop('pair1', [(5.0, 6.3)], '0px', 'calc(var(--cy) - 36px)', True),
            pop('pair2', [(20.8, 21.5)], '0px', 'calc(var(--cy) - 36px)'),
            pop('appr', [(11.1, 11.7), (26.1, 26.7)], '0px', 'var(--cy)'),
            pop('fixp', [(8.2, 9.7)], 'var(--pox)', '-60px'),
            pop('fixd', [(23.4, 24.6)], 'var(--dox)', '-60px'),
            pop('ship', [(13.5, 14.8), (28.7, 29.9)], 'var(--pox)', '-60px')]

    def rise(name, spans):
        spans = [s for s in spans if s[0] < CYC]
        flat = {'transform': 'translateY(0)', 'border-color': 'transparent'}
        up = {'transform': 'translateY(-3px)', 'border-color': 'var(--rule-strong)'}
        fr = [(0, flat)]
        for a, b in spans:
            fr += [(a, flat), (a + .3, up), (b, up), (b + .4, flat)]
        return kf(name, fr + [(CYC, flat)])

    rises = [rise('r-d', [(0.05, 1.0), (16.2, 17.0), (23.1, 24.6)]), rise('r-c', [(2.5, 6.4), (11.3, 11.8), (18.5, 21.6), (25.9, 27.0)]), rise('r-p', [(7.9, 9.8), (13.3, 15.0), (28.5, 30.2)])]
    ret = kf('ret', [(0, {'stroke-dashoffset': '1', 'opacity': '0'}), (21.4, {'stroke-dashoffset': '1', 'opacity': '1'}), (22.8, {'stroke-dashoffset': '0', 'opacity': '1'}), (24.4, {'stroke-dashoffset': '0', 'opacity': '1'}), (25.0, {'stroke-dashoffset': '0', 'opacity': '0'}), (CYC, {'stroke-dashoffset': '0', 'opacity': '0'})]) if two else ''

    # lines-only shadow masks (follow token / finding)
    def mpos(st, dx, dy):
        return f"calc(var(--ox) + var(--p{st}x) + {dx}px) calc(var(--oy) + var(--p{st}y) + {dy}px)"
    G, Fz = {'mask-size': '104px 62px'}, {'mask-size': '160px 100px'}

    def lhop(fr, t0, a, b, dur=1.5, gw=52, gh=31, fw=80, fh=50):
        fr += [(t0, dict(G, **{'mask-position': mpos(a, -gw + 9, -gh + 13)})), (t0 + .3, dict(Fz, **{'mask-position': mpos(a, -fw + 16, -fh + 24)})),
               (t0 + dur - .35, dict(Fz, **{'mask-position': mpos(b, -fw + 16, -fh + 24)})), (t0 + dur, dict(G, **{'mask-position': mpos(b, -gw + 9, -gh + 13)}))]
    rest = lambda s: dict(G, **{'mask-position': mpos(s, -43, -18)})
    lt = [(0, rest('d'))]
    lhop(lt, 1.0, 'd', 'c'); lhop(lt, 11.8, 'c', 'p')
    lt += [(15.4, rest('p')), (15.5, rest('d'))]
    if two:
        lhop(lt, 17.0, 'd', 'c'); lhop(lt, 21.6, 'c', 'd'); lhop(lt, 24.6, 'd', 'c'); lhop(lt, 27.0, 'c', 'p')
    lt += [(CYC, rest('p' if two else 'd'))]
    lf_ = [(0, rest('c'))]
    lhop(lf_, 6.4, 'c', 'p'); lhop(lf_, 9.8, 'p', 'c')
    lf_ += [(CYC, rest('c'))]

    allkf = '\n'.join(x for x in [kf('ls-tok', lt), kf('ls-fnd', lf_), kf('mv', mv), kf('lf', lf), kf('tokop', tokop), kf('fm', fm), kf('fl', fl), kf('fop', fop),
                                  kf('fop-o', [(t, {'opacity': d['opacity']}) for t, d in fop]), kf('fhash', fhash), kf('fsw', fsw), loupe,
                                  '@keyframes spin{to{rotate:360deg}}'] + orbit + pops + rises + [ret] if x)
    return allkf, CYC, ''.join(static)


tiles = '<span class="tiles"><i>{ }</i><i>tw</i><i>ios</i></span>'
split = '<span class="split"><i style="background:var(--sw-l)"></i><i style="background:var(--sw)"></i></span>'


def mb(label_dark=False, region=False):
    return f'<span class="mb{" o" if region else ""}"><i></i><em style="background:{"#5a2a08" if label_dark else "#fff3e8"}"></em>{"<u></u>" if region else ""}</span>'


# geometry: phone strip (lane row dropped, everything 10 px higher) and desktop lanes
M = dict(w=358, h=350, pd='34px 200px', pc='179px 200px', pp='324px 200px', px=('34px', '179px', '324px'), py=('200px', '200px', '200px'), r1='54px', r2='84px', cy='-118px', pox='-44px', dox='44px',
         rail='left:34px;top:200px;width:290px', retpath='M 169 190 C 169 116, 34 116, 34 190',
         lanes='.lane{display:none}',
         st='.st{translate:0 0}.st.d{left:0;top:306px}.st.c{left:50%;top:306px;translate:-50% 0}.st.p{left:auto;right:0;top:306px}')
Dk = dict(w=720, h=430, pd='70px 246px', pc='360px 246px', pp='650px 246px', px=('70px', '360px', '650px'), py=('246px', '246px', '246px'), r1='72px', r2='108px', cy='-138px', pox='0px', dox='0px',
          rail='left:70px;top:246px;width:580px', retpath='M 360 234 C 360 134, 70 134, 70 234',
          lanes='.lane{display:block;top:0;translate:-50% 0}.lane.d{left:70px}.lane.c{left:360px}.lane.p{left:650px}',
          st='.st{translate:-50% 0}.st.d{left:70px;top:372px}.st.c{left:360px;top:372px}.st.p{left:650px;top:372px}')


def layout(L):
    return (f".stage{{width:{L['w']}px;height:{L['h']}px;--pd:{L['pd']};--pc:{L['pc']};--pp:{L['pp']};--r1:{L['r1']};--r2:{L['r2']};--cy:{L['cy']};--pox:{L['pox']};--dox:{L['dox']}}}"
            f":root{{--pdx:{L['px'][0]};--pcx:{L['px'][1]};--ppx:{L['px'][2]};--pdy:{L['py'][0]};--pcy:{L['py'][1]};--ppy:{L['py'][2]}}}"
            f".rail{{{L['rail']}}}{L['lanes']}{L['st']}.loupe{{width:calc(var(--r1)*2);height:calc(var(--r1)*2)}}.loupe::after{{inset:calc(var(--r1) - var(--r2))}}")


def page(laps):
    allkf, CYC, static = build(laps)
    two = laps == 2
    T = f"{CYC}s"
    anim = f"animation-duration:{T};animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-iteration-count:infinite;animation-fill-mode:both"
    other = ('p6-hero.html', 'lap 1 only') if two else ('p6-hero-2laps.html', 'both laps')
    lap2_html = (f'<span class="pop pair2"><span class="pill">{mb(False)}<span class="arr"></span>{mb(True, True)}</span></span>' if two else '')
    fixd_html = ('<span class="pc" style="translate:var(--pd)" aria-hidden="true"><span class="pop fixd"><span class="pill"><span class="aa" style="color:#5a2a08">Aa</span><span class="arr"></span><span class="aa" style="color:#fff">Aa</span></span></span></span>' if two else '')
    ret_html = (f'<svg class="ret m" viewBox="0 0 {M["w"]} {M["h"]}" aria-hidden="true"><path pathLength="1" d="{M["retpath"]}"/></svg><svg class="ret dk" viewBox="0 0 {Dk["w"]} {Dk["h"]}" aria-hidden="true"><path pathLength="1" d="{Dk["retpath"]}"/></svg>' if two else '')
    label = ('A token travels from design into the pull request and is inspected. Usually the finding is a hard-coded value in a component; the developer replaces it with the token and the change ships. Sometimes the token itself was wrong; it goes back to Figma, is fixed and ships.'
             if two else 'A token travels from design into the pull request and is inspected. The diff finds a hard-coded value in a component; the developer replaces it with the token and the change ships.')
    return f"""<title>DTA hero orbit</title>
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
.tt{{all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--rule-strong);font-size:13px}}.tt:focus-visible{{outline:2px solid var(--blue);outline-offset:2px}}
.hero{{display:grid;gap:20px;padding-block:28px 40px;align-items:center}}
h1{{font:700 34px/1.04 var(--sans);letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}}h1 i{{color:var(--blue)}}
.lede{{color:var(--muted);font-size:17px;line-height:1.5;max-width:36ch;margin:0 0 22px;text-wrap:pretty}}
.ctas{{display:flex;gap:8px;flex-wrap:wrap}}.btn-p,.btn-o{{padding:11px 16px;border-radius:10px;font-size:14px;font-weight:500;text-decoration:none;color:var(--ink)}}.btn-p{{background:var(--ink);color:var(--btn-fg);font-family:var(--mono);font-size:13px}}.btn-o{{box-shadow:inset 0 0 0 1.5px var(--ink)}}
.stage{{position:relative;max-width:100%;margin:0 auto;touch-action:manipulation}}
.lane{{position:absolute;font:500 10px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}}
/* rail: gapped around the three stations so a resting token does not sit on a line */
.rail{{position:absolute;height:0;border-top:1.5px dashed var(--grid-2);
 -webkit-mask-image:linear-gradient(90deg,transparent 0 34px,#000 34px calc(50% - 34px),transparent calc(50% - 34px) calc(50% + 34px),#000 calc(50% + 34px) calc(100% - 34px),transparent calc(100% - 34px));
 mask-image:linear-gradient(90deg,transparent 0 34px,#000 34px calc(50% - 34px),transparent calc(50% - 34px) calc(50% + 34px),#000 calc(50% + 34px) calc(100% - 34px),transparent calc(100% - 34px))}}
svg.ret{{position:absolute;inset:0;width:100%;height:100%;overflow:visible}}svg.ret.dk{{display:none}}
svg.ret path{{fill:none;stroke:var(--red);stroke-width:1.5;stroke-linecap:butt;stroke-dasharray:1;animation:ret {T} linear infinite}}
/* pads: the two ends carry what they are; the middle stays an empty pad (the orbit opens there) */
.pad{{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;margin:-15px 0 0 -15px;box-shadow:inset 0 0 0 1px var(--grid-2);display:grid;place-items:center}}
.pad.d{{translate:var(--pd)}}.pad.c{{translate:var(--pc)}}.pad.p{{translate:var(--pp)}}
.g-frame{{position:relative;width:13px;height:13px;border:1.5px solid var(--blue)}}
.g-frame i{{position:absolute;width:5px;height:5px;background:var(--bg);border:1.5px solid var(--blue)}}
.g-frame i:nth-child(1){{left:-4px;top:-4px}}.g-frame i:nth-child(2){{right:-4px;top:-4px}}.g-frame i:nth-child(3){{left:-4px;bottom:-4px}}.g-frame i:nth-child(4){{right:-4px;bottom:-4px}}
.g-code{{font:500 9px/1 var(--mono);color:var(--ink-2);letter-spacing:-.04em}}
.st{{position:absolute;padding:5px 8px;border:1px solid transparent;border-radius:999px;font:400 11px/1 var(--mono);color:var(--ink);white-space:nowrap;background:var(--bg);animation-duration:{T};animation-timing-function:ease-out;animation-iteration-count:infinite;animation-fill-mode:both}}
.st.d{{animation-name:r-d}}.st.c{{animation-name:r-c}}.st.p{{animation-name:r-p}}
.tok,.fnd{{position:absolute;left:0;top:0;width:0;height:0}}
.tok{{animation:mv {T} cubic-bezier(.5,0,.2,1) infinite,tokop {T} linear infinite}}
.fnd{{animation:fm {T} cubic-bezier(.5,0,.2,1) infinite,fop {T} ease-out infinite}}
.lift{{position:absolute;left:-26px;top:-13px;width:52px;height:26px;animation:lf {T} cubic-bezier(.5,0,.2,1) infinite;transform-origin:50% 50%}}
.fnd .lift{{left:-14px;top:-14px;width:28px;height:28px;animation-name:fl}}
.chip{{width:52px;height:26px;border-radius:8px;background:var(--surface);display:flex;align-items:center;gap:5px;padding:0 6px;box-shadow:inset 0 0 0 1px var(--grid-2)}}
.chip i{{width:14px;height:14px;border-radius:4px;background:var(--sw);flex:none}}.chip b{{font:500 7px/1 var(--mono);color:var(--muted)}}
.fchip{{position:relative;width:28px;height:28px;border-radius:50%;background:var(--red);box-shadow:0 0 0 2px var(--bg);display:grid;place-items:center;color:var(--bg);font:700 14px/1 var(--mono)}}
.fchip .h{{animation:fhash {T} linear infinite}}.fchip .s{{position:absolute;inset:6px;border-radius:4px;background:var(--sw);box-shadow:0 0 0 2px var(--bg);animation:fsw {T} linear infinite}}
.loupe{{position:absolute;left:0;top:0;translate:var(--pc);margin:calc(var(--r1) * -1) 0 0 calc(var(--r1) * -1);border-radius:50%;border:1.5px dashed var(--blue-2);animation:loupe {T} cubic-bezier(.2,.8,.2,1) infinite,spin 30s linear infinite}}
.loupe::after{{content:'';position:absolute;border-radius:50%;border:1.5px dashed var(--grid-2)}}
.part{{position:absolute;left:0;top:0;margin:0;{anim}}}
.pc{{position:absolute;left:0;top:0;width:0;height:0;translate:var(--pc)}}
.sw{{display:block;width:16px;height:16px;border-radius:5px;background:var(--sw)}}
.split{{display:flex;width:26px;height:22px;border-radius:6px;overflow:hidden}}.split i{{flex:1}}
.tiles{{display:flex;gap:4px}}.tiles i{{display:grid;place-items:center;width:20px;height:20px;border-radius:5px;background:var(--ink);color:var(--bg);font:500 7px/1 var(--mono);font-style:normal}}
.link{{display:block;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue);position:relative}}.link::after{{content:'';position:absolute;left:8px;top:0;width:22px;height:12px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--blue)}}
.dot{{display:block;width:10px;height:10px;border-radius:50%;background:var(--sw)}}.dot.l{{background:var(--sw-l)}}
.o1{{animation-name:o1}}.o2{{animation-name:o2}}.o3{{animation-name:o3}}.o4{{animation-name:o4}}.o5{{animation-name:o5}}.o6{{animation-name:o6}}
.pop{{position:absolute;left:0;top:0;{anim};opacity:0;display:flex;gap:6px;align-items:center}}
.badge{{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 var(--mono);color:var(--bg);background:var(--green);box-shadow:0 0 0 3px var(--bg)}}.badge.bad{{background:var(--red)}}
.pill{{padding:6px 8px;border-radius:999px;background:var(--bg);display:flex;gap:6px;align-items:center;border:1px solid var(--rule)}}
.mb{{display:flex;align-items:center;justify-content:center;width:34px;height:16px;border-radius:999px;position:relative}}.mb i{{position:absolute;inset:0;border-radius:999px;background:var(--sw)}}.mb em{{position:relative;width:16px;height:3px;border-radius:2px}}
.mb.o::after{{content:'';position:absolute;inset:-3px;border-radius:999px;border:1.5px solid var(--red)}}
.mb u{{position:absolute;right:-2px;top:-2px;width:8px;height:8px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 1.5px var(--bg)}}
.arr{{width:10px;border-top:1px solid var(--faint)}}
.aa{{font:600 10px/1 var(--sans);width:16px;height:16px;border-radius:4px;display:grid;place-items:center;background:var(--sw)}}
.hash{{font:700 11px/1 var(--mono);color:var(--red)}}.lit{{font:400 9px/1 var(--mono);color:var(--muted);text-decoration:line-through}}
.c-lint{{animation-name:c-lint}}.c-build{{animation-name:c-build}}.c-diff{{animation-name:c-diff}}.pair1{{animation-name:pair1}}.pair2{{animation-name:pair2}}.appr{{animation-name:appr}}.fixp{{animation-name:fixp}}.fixd{{animation-name:fixd}}.ship{{animation-name:ship}}
.paused *{{animation-play-state:paused!important}}
.next{{padding-block:10px 24px;color:var(--faint);font:400 12px/1.6 var(--mono)}}
.proto{{padding-block:0 48px;font:400 11px/1.6 var(--mono);color:var(--faint)}}.proto a{{color:var(--blue)}}
{layout(M)}
@media (min-width:1000px){{svg.ret.m{{display:none}}svg.ret.dk{{display:block}}.hero{{grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:40px;padding-block:56px 72px}}h1{{font-size:46px}}{layout(Dk)}svg.ret path{{stroke-width:2}}.loupe,.loupe::after{{border-width:2px}}.rail{{border-top-width:2px}}}}
@media (prefers-reduced-motion:reduce){{.stage *,.ls{{animation:none!important}}.ls{{display:none}}.tok{{translate:var(--pc);opacity:1}}.loupe{{scale:1;opacity:1}}.fnd,svg.ret path{{opacity:0}}.appr,.fixp,.fixd,.ship,.pair2{{display:none}}{static}}}
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
 <div class="stage" id="stage" role="img" aria-label="{label}">
  <span class="lane d">Design</span><span class="lane c">Pull request</span><span class="lane p">Product</span>
  <span class="rail"></span>
  {ret_html}
  <span class="pad d"><span class="g-frame"><i></i><i></i><i></i><i></i></span></span><span class="pad c"></span><span class="pad p"><span class="g-code">&lt;/&gt;</span></span>
  <span class="st d">Figma</span><span class="st c">lint · build · diff</span><span class="st p">code</span>
  <span class="loupe" aria-hidden="true"></span>
  <span class="pc" aria-hidden="true">
   <span class="part o1"><span class="sw"></span></span><span class="part o2">{split}</span><span class="part o3"><span class="link"></span></span><span class="part o4">{tiles}</span><span class="part o5"><span class="dot l"></span></span><span class="part o6"><span class="dot"></span></span>
   <span class="pop c-lint"><span class="badge">✓</span></span><span class="pop c-build"><span class="badge">✓</span></span><span class="pop c-diff"><span class="badge bad">!</span></span>
   <span class="pop pair1"><span class="pill">{mb(False)}<span class="arr"></span>{mb(False, True)}<span class="hash">#</span></span></span>
   {lap2_html}
   <span class="pop appr"><span class="badge">✓</span></span>
  </span>
  <span class="pc" style="translate:var(--pp)" aria-hidden="true"><span class="pop fixp"><span class="pill"><span class="hash">#</span><span class="lit">e0600a</span><span class="arr"></span><span class="sw"></span></span></span><span class="pop ship"><span class="pill">{tiles}</span></span></span>
  {fixd_html}
  <div class="fnd" aria-hidden="true"><span class="lift"><span class="fchip"><span class="h">#</span><span class="s"></span></span></span></div>
  <div class="tok" aria-hidden="true"><span class="lift"><span class="chip"><i></i><b>Brand.Primary</b></span></span></div>
 </div>
</header>
<p class="next">↓ 01 · Something changes &nbsp;·&nbsp; 02 · The pull request shows the differences &nbsp;·&nbsp; 03 · A person decides &nbsp;·&nbsp; 04 · Your agent uses the same commands</p>
<p class="proto">Prototype p6 · {'both laps' if two else 'lap 1 only'}, {CYC:g} s · tap the board to pause · <a href="{other[0]}">switch to {other[1]}</a></p>
</div>
<script>
(function(){{var st=document.getElementById('stage');st.addEventListener('click',function(){{st.classList.toggle('paused')}});
function place(){{var r=st.getBoundingClientRect(),b=document.body.getBoundingClientRect();document.documentElement.style.setProperty('--ox',(r.left-b.left)+'px');document.documentElement.style.setProperty('--oy',(r.top-b.top)+'px')}}
place();addEventListener('resize',place);setTimeout(place,300);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(place);if(window.ResizeObserver){{var ro=new ResizeObserver(place);ro.observe(document.body);ro.observe(st)}}
var tt=document.getElementById('tt'),k='dta-hero-theme';try{{var v=localStorage.getItem(k);if(v)document.documentElement.dataset.theme=v}}catch(e){{}}
tt.addEventListener('click',function(){{var cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var n=cur==='dark'?'light':'dark';document.documentElement.dataset.theme=n;try{{localStorage.setItem(k,n)}}catch(e){{}}}});}})();
</script>
"""


if __name__ == '__main__':
    open('p6-hero.html', 'w').write(page(1))
    open('p6-hero-2laps.html', 'w').write(page(2))
