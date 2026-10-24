# p17: the page follows the key visual. python3 gen16.py -> p17-page.html (the current landing page prototype)
# Keeps p16's hero (the whirlpool) untouched and adapts the rest of the page to it, visually only:
# - the drafting-table grid is gone everywhere (body, hero band); one plain surface, the mesh fades into it
# - the recurring device is the orbit: every scene's example sits at the centre of faint concentric rings, so the
#   page reads as "things orbit the token"; the changed token is the mass, components and outputs are what moves
# - facts get an orbit glyph, the final call sits in a ring set, dust particles drift across the page
# - no borders on the example surfaces (they are bodies in a field), text and copy unchanged
import gen15

PATCH_CSS = """
/* p17: the page follows the key visual. The hero carries the geometry; the sections stay quiet. */
body{background-image:none}.band{background-image:none;border-bottom:0;background-color:transparent}
.hero{padding-bottom:28px;overflow-x:clip}
.hero .copy .lede{margin:0 0 28px}.hero .copy h1{margin-bottom:18px}
@media (max-width:999px){.sz-S .stage{height:210px}.sz-L .stage{height:240px}.hero{gap:4px;padding-block:0 20px}h1{font-size:31px}.hero .copy h1{margin-bottom:14px}.hero .copy .lede{font-size:16px;margin-bottom:22px}}
.scene,.final,.facts{position:relative;overflow:clip}
.art{position:relative;padding:8px 0;gap:22px}
/* example components: more room, more contrast. The example palette stays the customer's (Orbit Burger). */
.ex{--ex-star:#F6F2EA;--ex-dust:#CFC7E4;--ex-mint:#9BEBCB}
/* the step labels: a deeper blue (AAA against the page: 9.7:1 light, 8:1 dark), a size up and a weight up */
:root{--blue-deep:#1C348C}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--blue-deep:#96AAEC}}:root[data-theme="dark"]{--blue-deep:#96AAEC}
.step{font:500 13px/1.4 var(--mono);color:var(--blue-deep);letter-spacing:.01em}
/* 01 token rows */
.rows{width:min(100%,480px);gap:18px}
.trow{grid-template-columns:28px minmax(0,1fr) auto;gap:16px;padding:16px 18px;border-radius:12px;font-size:13px;line-height:1.3}
.trow .val{color:var(--ex-dust)}.trow.ed .val{color:#FF9A4D;font-weight:500}
.tsw{width:28px;height:28px;border-radius:8px}.tsw.rad{border-width:2.5px;border-radius:5px 5px 5px 16px}
/* 02 before / after */
.pair{gap:24px}
.lbl{font-size:12px;margin-bottom:12px;color:var(--muted)}.lbl.chg{color:var(--blue)}
.card{padding:28px 26px 26px;gap:10px}
.card .k{font-size:10.5px;letter-spacing:.05em;white-space:nowrap}.card .t{font-size:22px}.card .m{font-size:14px;line-height:1.45}
.card .go{margin-top:10px;padding:10px 16px;font-size:14px;border-radius:9px;white-space:nowrap}
.ring{opacity:.6}
.notes{gap:12px;margin-top:4px}
.note{font-size:13px;line-height:1.45;color:var(--muted)}.note b{color:var(--ink)}.note::before{width:24px}
/* 03 checks */
.checks{width:min(100%,480px);gap:10px;font-size:13px}
.chk{padding:14px 16px;border-radius:12px;background:var(--surface);border:1px solid var(--rule);gap:10px;align-items:center}.chk>span:first-child{white-space:nowrap}
.chk .r{color:var(--muted);font-size:12px}.cdot{width:10px;height:10px;margin-right:10px}
.approve{margin-left:max(0px,calc((100% - 480px)/2));padding:11px 16px;border-radius:11px;font-size:14px}
/* 02: the two states */
.pair.two{grid-template-columns:repeat(2,max-content);gap:28px;justify-content:center;align-items:end}
.btn-ex{display:inline-block;padding:14px 22px;color:var(--ex-fg);font:600 15px/1 var(--sans);white-space:nowrap}
.pair.two .lbl{margin-bottom:10px}
@media (max-width:559px){.pair.two{grid-template-columns:repeat(2,max-content);gap:18px}.pair>div:first-child{display:block}.pair .lbl.chg::after{content:''}.btn-ex{padding:12px 16px;font-size:14px}}
/* the call to action is a command: the same chip as the scene commands (ink on cream, cream on ink in the dark theme), one step larger, with a copy affordance */
.btn-p{display:inline-flex;align-items:center;gap:10px;background:var(--ink);color:var(--btn-fg);font:500 14px/1 var(--mono);letter-spacing:.01em;padding:14px 18px;border-radius:11px;border:0;cursor:pointer}
.btn-p::before{content:'$';color:var(--red);font-weight:400}
.btn-p .cp{display:inline-block;width:14px;height:14px;margin-left:4px;opacity:.6;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='12' height='12' rx='2'/%3E%3Cpath d='M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='12' height='12' rx='2'/%3E%3Cpath d='M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4'/%3E%3C/svg%3E") center/contain no-repeat}
.btn-p:hover .cp{opacity:1}.btn-p.done .cp{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12.5l5 5L20 6.5'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12.5l5 5L20 6.5'/%3E%3C/svg%3E");opacity:1}
.btn-o{padding:12px 18px;border-radius:11px;box-shadow:inset 0 0 0 1.5px var(--rule-strong);color:var(--ink)}
.cmd{cursor:pointer}.cmd .cp{display:inline-block;width:12px;height:12px;margin-left:2px;opacity:.55;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='12' height='12' rx='2'/%3E%3Cpath d='M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='12' height='12' rx='2'/%3E%3Cpath d='M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4'/%3E%3C/svg%3E") center/contain no-repeat}
.cmd:hover .cp{opacity:1}.cmd.done .cp{-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12.5l5 5L20 6.5'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12.5l5 5L20 6.5'/%3E%3C/svg%3E");opacity:1}
.btn-p:hover{filter:brightness(1.08)}.btn-p:focus-visible,.btn-o:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.ctas{gap:10px;align-items:center}
/* the command of each scene: a command chip, like the hero's npm create dta */
.cmd{display:inline-flex;align-items:center;gap:8px;margin-top:22px;padding:9px 14px;border-radius:9px;background:var(--ink);color:var(--btn-fg);font:500 13px/1 var(--mono);letter-spacing:.01em}
.cmd::before{content:'$';color:var(--red);font-weight:400}
/* 04 terminal */
.term{padding:24px 28px;border-radius:16px;font-size:13.5px;line-height:1.85}
.term .dim{opacity:.62}
/* the changed token is the mass */
.trow.ed{outline:1.5px dashed var(--blue-2);outline-offset:4px}
.pair .lbl.chg{color:var(--blue)}
/* facts: four big words, a rule above each, no glyphs */
.facts{gap:36px 40px;padding-block:48px 96px}
.fact{padding-top:22px;border-top:1.5px solid var(--rule-strong)}
.fact b{display:block;margin-bottom:10px;font:700 26px/1.1 var(--sans);letter-spacing:-.015em;color:var(--ink)}
.fact span{font-size:15px;line-height:1.55;color:var(--muted)}
@media (min-width:1000px){.facts{gap:48px;padding-block:64px 144px}.fact b{font-size:30px}}
.foot{border-top-color:var(--rule)}
@media (max-width:559px){.trow{font-size:12px;padding:14px 15px;gap:12px}.term{font-size:12px;padding:18px 20px}.card{padding:24px 22px 22px}}
@media (min-width:1000px) and (max-width:1199px){.pair .card{padding:22px 18px 20px}.card .t{font-size:20px}}
/* the end: a few objects floating free (nothing holds them yet), each at its own depth against the scroll */
.final{padding-block:120px 110px}@media (min-width:1000px){.final{padding-block:170px 150px}}
.final>*{position:relative;z-index:1}.final>.free{z-index:0}
.free{position:absolute;left:var(--x);top:var(--y);width:0;height:0;perspective:500px;animation:drift var(--d) ease-in-out infinite alternate;animation-delay:var(--dl)}
.free .tilt{display:block;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(0deg);animation:tumble var(--t) linear infinite}
.free .mote{translate:0 0}
@keyframes drift{to{translate:var(--dx) var(--dy)}}
@keyframes tumble{to{transform:rotateX(-24deg) rotateY(360deg)}}
@media (prefers-reduced-motion:reduce){.free,.free .tilt{animation:none}}
/* AAA everywhere: every text pair at 7:1 (4.5:1 for large text) in both themes */
:root{--muted:#3E4860}
.foot{color:var(--muted)}.foot span{color:var(--muted)}
.lbl.chg,.pair .lbl.chg{color:var(--blue-deep)}
.term .dim{opacity:.78}.term .p{color:#FFAD7A}.term .ok{color:#9AD3A2}
.approve,.who{background:var(--blue-deep);color:var(--btn-fg)}
/* the example button: large text (19px bold), so its own brand orange passes at 4.5:1 in both states */
.btn-ex{font:700 19px/1 var(--sans);padding:15px 24px}
@media (max-width:559px){.pair.two{grid-template-columns:max-content;justify-content:start;gap:18px}.btn-ex{font-size:19px;padding:14px 20px}}
"""

HTML = gen15.HTML.replace("{gen6.CSS}</style>", "{gen6.CSS}</style>")  # no-op guard; gen15.HTML is already rendered
import re as _re
HTML = HTML.replace("</style>", PATCH_CSS + "</style>", 1)
# scene 02: one component, two states (the button carries both changed tokens), no redlines
_old = _re.search(r'<div class="pair">.*?</div></div></div>', HTML, _re.S).group(0)
_new = ('<div class="pair two">'
        '<div><span class="lbl">main</span><span class="go btn-ex" style="background:var(--ex-500);border-radius:8px">Launch order · 12 min</span></div>'
        '<div><span class="lbl chg">this change</span><span class="go btn-ex" style="background:var(--ex-600);border-radius:24px">Launch order · 12 min</span></div>'
        '</div>')
HTML = HTML.replace(_old, _new, 1)
HTML = HTML.replace('A design change in Figma becomes a pull request: validated, built, visually diffed and approved by the people who care about it.',
                    'A toolset to lint, structure-check, transform and visually diff design tokens. Synced with Figma, shipped as pull requests.', 1)
HTML = HTML.replace('The rounder card is obvious. The darker button is easy to miss.', 'The rounder corners are obvious. The darker orange is easy to miss.', 1)


# the final section: a second canvas (same renderer, mouth under the button) and a few free-floating objects
def free(x, y, dx, dy, d, dl, t, inner, p=0.1):
    return (f'<span class="free" aria-hidden="true" style="--x:{x}%;--y:{y}%;--dx:{dx}px;--dy:{dy}px;--d:{d}s;--dl:{dl}s;--t:{t}s;--p:{p}">'
            f'<span class="tilt">{inner}</span></span>')
def fcube(c, s): return f'<span class="cube {c}" style="--s:{s}px"><i></i><i></i><i></i><i></i><i></i><i></i></span>'
def fsphere(c, s): return f'<span class="sphere {c}" style="--s:{s}px"></span>'
def fmote(s): return f'<i class="mote" style="--s:{s}px"></i>'
FREE = ''.join([
    free(14, 24, 18, -26, 11, -3, 38, fcube('orange', 13), .22),
    free(84, 32, -22, 20, 13, -7, 46, fsphere('blue', 12), .3),
    free(76, 80, 14, -18, 12, -1, 52, fcube('ink', 9), .14),
    free(20, 76, -16, 14, 14, -9, 0, fsphere('orange', 9), .4),
    free(90, 60, -10, 12, 9, -4, 0, fmote(3), .18),
    free(8, 50, 12, -10, 10, -6, 0, fmote(2), .34),
    free(60, 12, -8, 8, 12, -2, 0, fmote(3), .26),
    free(36, 90, 10, -8, 11, -5, 0, fmote(2), .12),
])
HTML = HTML.replace('<section class="final">', '<section class="final" id="final">' + FREE, 1)
ECHO_JS = """
// the free particles at the end: each at its own depth, so they slide against the page while scrolling
var fin=document.getElementById('final'),frees=[].slice.call(fin.querySelectorAll('.free'));
var fx=0;function freePar(){fx=0;if(reduce)return;var r=fin.getBoundingClientRect(),d=(innerHeight/2-(r.top+r.height/2));
 frees.forEach(function(el){el.style.transform='translateY('+(d*parseFloat(el.style.getPropertyValue('--p'))).toFixed(1)+'px)'})}
addEventListener('scroll',function(){if(!fx)fx=requestAnimationFrame(freePar)},{passive:true});addEventListener('resize',freePar);freePar();"""
HTML = HTML.replace("apply();requestAnimationFrame(frame);})();", ECHO_JS + "\napply();requestAnimationFrame(frame);})();", 1)
assert 'freePar();\napply()' in HTML
HTML = HTML.replace('<a class="btn-p" href="#">npm create dta</a>', '<button class="btn-p" type="button" title="Copy command" aria-label="Copy: npm create dta">npm create dta<i class="cp" aria-hidden="true"></i></button>')
HTML = _re.sub(r'<(\w+) class="cmd">([^<]+)</\1>', lambda m: f'<button class="cmd" type="button" title="Copy command" aria-label="Copy: {m.group(2)}">{m.group(2)}<i class="cp" aria-hidden="true"></i></button>', HTML)
COPY_JS = """
document.querySelectorAll('.btn-p,.cmd').forEach(function(b){b.addEventListener('click',function(){var t=b.textContent.trim();var done=function(){b.classList.add('done');setTimeout(function(){b.classList.remove('done')},1600)};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,done);else done()})});"""
HTML = HTML.replace("freePar();\napply()", "freePar();" + COPY_JS + "\napply()", 1)
assert 'navigator.clipboard' in HTML
HTML = HTML.replace('<h2>It looks the token up before it writes a value.</h2>', '<h2>No hard-coded values, even from agents.</h2>', 1)
HTML = HTML.replace("Prototype p16 · the whirlpool: a polar mesh swirling into the well, with perspective · tilt, size and position at the bottom · tap the well to pause",
                    "Prototype p17 · the page follows the key visual: no grid, quiet sections, free particles at the end · tilt, size and position at the bottom · tap the well to pause")

if __name__ == '__main__':
    open('p17-page.html', 'w').write(HTML)
