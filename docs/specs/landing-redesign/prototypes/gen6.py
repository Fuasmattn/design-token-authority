# The hero key visual (p6, lap 1, borders only) in the full landing page: hero -> four scenes -> facts -> final call.
# python3 gen6.py -> p7-page.html. Hero comes unchanged from gen5.page(1); the rest follows landing-redesign.md
# ("The page", decisions 1, 2, 5) and the round-6 concept (page-concept.astro.txt). Throwaway, literal colours.
import gen5

EX = """.ex{--ex-void:#15122b;--ex-void-2:#1f1a3d;--ex-star:#f4efe6;--ex-dust:#a79fc4;--ex-500:#ff7a1a;--ex-600:#e0600a;--ex-fg:#1a0f00;--ex-mint:#8fe3c0}"""

CSS = EX + """
/* page rhythm: one surface, examples embedded without borders (decision 1) */
nav a{color:inherit;text-decoration:none}nav a:hover{color:var(--ink)}
.scene{padding-block:96px}.scene+.scene{padding-top:0}
.sg{display:grid;gap:40px;align-items:center}
.copy{min-width:0}.step{display:block;font:400 12px/1.4 var(--mono);color:var(--blue);margin-bottom:16px}
h2{font:700 30px/1.06 var(--sans);letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
.copy p{margin:0;color:var(--muted);font-size:16px;line-height:1.55;max-width:44ch;text-wrap:pretty}
.cmd{display:inline-block;margin-top:20px;font:400 13px/1 var(--mono);color:var(--ink)}.cmd::before{content:'$ ';color:var(--red)}
.art{position:relative;display:grid;gap:18px;justify-items:center;min-width:0}
.mono{font-family:var(--mono)}
/* scene 1: token rows */
.rows{width:min(100%,420px);display:grid;gap:8px}
.trow{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border-radius:10px;background:var(--ex-void);color:var(--ex-star);font:400 12px/1.2 var(--mono)}
.trow .val{color:var(--ex-dust)}.trow.ed .val{color:var(--ex-500)}
.tsw{width:24px;height:24px;border-radius:6px}.tsw.rad{border:2px solid var(--ex-500);border-radius:4px 4px 4px 14px}
/* scene 2: Orbit Burger before / after */
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;width:100%;align-items:start}
.lbl{display:block;margin-bottom:10px;font:400 11px/1 var(--mono);color:var(--faint)}.lbl.chg{color:var(--red)}
.card{position:relative;overflow:hidden;padding:24px;display:grid;gap:8px;background:var(--ex-void);color:var(--ex-star)}
.card .k{font:400 10px/1.3 var(--mono);color:var(--ex-mint);letter-spacing:.04em}.card .t{font-weight:700;font-size:20px;letter-spacing:-.01em}
.card .m{color:var(--ex-dust);font-size:13px;line-height:1.4}
.card .go{justify-self:start;margin-top:6px;padding:8px 14px;border-radius:8px;color:var(--ex-fg);font-size:13px;font-weight:600}
.ring{position:absolute;width:150px;height:150px;border-radius:50%;border:2px dashed rgba(167,159,196,.35);right:-60px;top:-60px;pointer-events:none}
.ring.two{left:-70px;right:auto;top:auto;bottom:-80px;width:120px;height:120px}
.burger{display:grid;gap:3px;width:64px;margin-bottom:6px}.burger span{display:block;border-radius:999px}
.bt{height:15px;background:#e8a85a;border-radius:999px 999px 6px 6px!important}.le{height:6px;background:var(--ex-mint)}.ch{height:5px;background:var(--ex-500)}.pa{height:11px;background:#6b3a2a}.bb{height:11px;background:#d9944a;border-radius:6px 6px 999px 999px!important}
.notes{display:grid;gap:10px;justify-self:start}
.note{display:flex;align-items:center;gap:10px;margin:0;font:400 12px/1.4 var(--mono);color:var(--muted)}.note::before{content:'';flex:none;width:22px;border-top:2px solid var(--red)}
.note b{color:var(--ink);font-weight:500}.note.plain::before{border-top-color:var(--faint);border-top-width:1px}
/* scene 3: checks */
.checks{width:min(100%,420px);display:grid;gap:8px;font:400 12px/1.3 var(--mono)}
.chk{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:10px;background:var(--surface);border:1px solid var(--rule)}
.chk .r{color:var(--muted);text-align:right}
.cdot{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:var(--red)}.cdot.ok{background:var(--green)}
.approve{justify-self:start;margin-left:max(0px,calc((100% - 420px)/2));padding:9px 14px;border-radius:10px;background:var(--blue);color:#fff;font-size:13px;font-weight:600}
/* scene 4: terminal */
.term{margin:0;width:100%;padding:22px 26px;border-radius:14px;background:#13213F;color:#E9E4D8;font:400 12.5px/1.9 var(--mono);white-space:pre;overflow-x:auto}
:root[data-theme="dark"] .term{background:#0E0D0C}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .term{background:#0E0D0C}}
.term .p{color:#F58B58}.term .ok{color:#7FB887}.term .dim{opacity:.55}
.who{display:inline-block;padding:0 6px;border-radius:4px;background:#2F55D4;color:#fff;font-size:10.5px}
/* facts, final, footer */
.facts{display:grid;gap:28px;padding-block:24px 96px;grid-template-columns:minmax(0,1fr)}
.fact b{display:block;margin-bottom:6px;font-weight:600}.fact span{color:var(--muted);font-size:15px;line-height:1.5}
.final{text-align:center;padding-block:96px}.final h2{font-size:clamp(34px,6vw,60px);margin-bottom:14px}
.final p{color:var(--muted);margin:0 auto 26px;max-width:46ch;line-height:1.55}
.foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-block:24px 40px;border-top:1px solid var(--rule);font:400 12px/1.5 var(--mono);color:var(--faint)}
.proto{padding-block:0 32px}
@media (min-width:560px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:559px){nav .nl{display:none}.term{font-size:11px;padding:18px}.pair{grid-template-columns:minmax(0,1fr)}.scene{padding-block:72px}.approve{margin-left:0}}
@media (min-width:1000px){.scene{padding-block:144px}.sg{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:96px}
 .scene:nth-of-type(even) .sg>.copy{order:2}h2{font-size:40px}.facts{grid-template-columns:repeat(4,minmax(0,1fr));gap:40px;padding-block:40px 144px}.final{padding-block:144px}}
"""

BURGER = '<span class="burger" aria-hidden="true"><span class="bt"></span><span class="le"></span><span class="ch"></span><span class="pa"></span><span class="bb"></span></span>'


def card(radius, btn):
    return (f'<div class="card" style="border-radius:{radius}px"><span class="ring"></span><span class="ring two"></span>{BURGER}'
            f'<span class="k">ORBIT BURGER · ISS DOCK 3</span><span class="t">Saturn Smash</span><span class="m">Double patty, ring sauce, zero-g pickles</span>'
            f'<span class="go" style="background:var({btn})">Launch order · 12 min</span></div>')


BODY = f"""<main>
<section class="scene" id="story"><div class="sg">
 <div class="copy"><span class="step">01 · Something changes</span><h2>A change lands as a pull request.</h2>
  <p>A rounder card and a slightly deeper brand orange. Made in Figma Variables or in a token file; either way DTA pulls them into the repository as one change.</p><span class="cmd">dta pull</span></div>
 <div class="art ex"><div class="rows">
  <div class="trow"><span class="tsw" style="background:var(--ex-void-2)"></span><span>Colors.Surface.Default</span><span class="val">Void.900</span></div>
  <div class="trow ed"><span class="tsw" style="background:var(--ex-600)"></span><span>Colors.Brand.Primary</span><span class="val">Nova.500 → 600</span></div>
  <div class="trow ed"><span class="tsw rad"></span><span>Radius.Card</span><span class="val">8 → 24</span></div>
 </div></div>
</div></section>
<section class="scene"><div class="sg">
 <div class="copy"><span class="step">02 · The pull request shows the differences</span><h2>There are differences to review. DTA knows whether tokens caused them.</h2>
  <p>dta diff renders the stories before and after and names the token behind each change. The rounder card is obvious. The darker button is easy to miss.</p><span class="cmd">dta diff</span></div>
 <div class="art ex">
  <div class="pair"><div><span class="lbl">main</span>{card(8, '--ex-500')}</div><div><span class="lbl chg">this change</span>{card(24, '--ex-600')}</div></div>
  <div class="notes"><p class="note"><span><b>Radius.Card</b> 8 → 24 · explains 94 % of the changed pixels</span></p><p class="note"><span><b>Colors.Brand.Primary</b> Nova 500 → 600 · explains the other 6 %</span></p>
   <p class="note plain"><span>illustrative numbers until the Orbit Burger fixture exists</span></p></div>
 </div>
</div></section>
<section class="scene"><div class="sg">
 <div class="copy"><span class="step">03 · A person decides</span><h2>Approve by token, not by screenshot.</h2>
  <p>The check stays pending until someone adds the label. Then every output rebuilds: CSS per brand, JavaScript, Tailwind.</p><span class="cmd">dta build</span></div>
 <div class="art"><div class="checks">
  <div class="chk"><span><span class="cdot ok"></span>dta lint</span><span class="r">passed</span></div>
  <div class="chk"><span><span class="cdot"></span>dta diff</span><span class="r">2 tokens · 9 stories · to review</span></div>
 </div><span class="approve">Add label dta-diff-approved</span></div>
</div></section>
<section class="scene" id="agents"><div class="sg">
 <div class="copy"><span class="step">04 · Your agent uses the same commands</span><h2>It looks the token up before it writes a value.</h2>
  <p>The skill teaches the loop; the context file lists your tokens. The agent proposes, the checks decide, and nothing reaches Figma without a person.</p><span class="cmd">dta skill add</span></div>
 <div class="art"><pre class="term"><span class="who">Agent</span> The button needs the brand blue. Looking it up first.
<span class="p">$</span> dta token find '#2f55d4'
  <span class="ok">action.bg</span>      Light       var(--action-bg)
  <span class="dim">blueprint.600  every mode  var(--blueprint-600)</span>
<span class="p">$</span> dta audit src
<span class="ok">No hard-coded token values in 50 files.</span></pre>
  <p class="note plain"><span>real output, from this website's own tokens</span></p></div>
</div></section>
<section class="facts">
 <div class="fact"><b>Open source</b><span>MIT. Runs locally, in CI and in your agent's terminal. No account.</span></div>
 <div class="fact"><b>Your structure</b><span>Your collections, modes and names, in the open DTCG format.</span></div>
 <div class="fact"><b>Every Figma plan</b><span>REST API on Enterprise, plugin export everywhere else.</span></div>
 <div class="fact"><b>Deterministic</b><span>Same input, same result, on every machine.</span></div>
</section>
<section class="final"><h2>Start with one command.</h2><p>Sets up the config, the token folder, the GitHub workflow and the agent skill.</p>
 <div class="ctas" style="justify-content:center"><a class="btn-p" href="#">npm create dta</a></div></section>
</main>
<footer class="foot"><span>Design Token Authority · MIT</span><span>Docs · CLI reference · GitHub</span></footer>
<p class="proto">Prototype p7 · the p6 hero (lap 1, borders) in the full page · tap the board to pause</p>"""


def build():
    html = gen5.page(1)
    a = html.index('<p class="next">')
    b = html.index('</div>\n<script>')
    html = html[:a] + BODY + '\n' + html[b:]
    html = html.replace('<title>DTA hero orbit</title>', '<title>DTA landing page</title>')
    html = html.replace('Workflow · Docs ', '<span class="nl"><a href="#story">How it works</a> · <a href="#agents">Agents</a> · </span><a href="#">Docs</a> ')
    html = html.replace('\n</style>', '\n' + CSS + '</style>', 1)
    return html


if __name__ == '__main__':
    open('p7-page.html', 'w').write(build())
