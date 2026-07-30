// PRISM layout: `pipeline` — a linear-timeline comparison of pipeline strategies.
//
// Renders a data-driven Gantt/timeline: each row is one work unit (a chunk), with
// a SYNTHESIS bar and a PLAYBACK bar positioned on a shared time axis, so stalls
// between playback bars are visible as literal gaps rather than as a number in a
// table.
//
// Designed for the question "where does the time go, and would a different
// strategy be better" — pipelined producer/consumer systems generally, not just
// text-to-speech.
//
// ── Contract ────────────────────────────────────────────────────────────────
// Frontmatter:
//   type: pipeline
//   data: ./something.json      ← fetched at render time; never inlined by hand
//
// The JSON is emitted by a generator/collector and is the ONLY place numbers
// live. Editing this file to change a number is the failure mode it exists to
// prevent.
//
// JSON shape:
//   { data_state: "modelled" | "measured", data_state_note, assumptions{},
//     observed_evidence?{note,...},
//     scenarios: [ { label, note, strategy, overhead_ms, crossover_chars,
//                    chunks:[{i,chars,text,synth_start_ms,synth_ms,
//                             play_start_ms,play_ms,gap_before_ms}],
//                    metrics:{chunk_count,time_to_first_word_ms,total_wall_ms,
//                             total_gap_ms,gap_count,worst_gap_ms} } ] }
//
// Scenarios sharing an `overhead_ms` are grouped and share an x-axis, so the
// comparison is like-for-like. A `data_state` other than "measured" renders a
// loud banner — an artifact that looks authoritative while displaying guesses is
// worse than no artifact.

import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13/+esm';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => marked.parse(s || '', { gfm: true, breaks: false });
const ms = (n) => n >= 10000 ? `${(n / 1000).toFixed(1)}s` : n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`;

const STYLE = `
<style>
.pl-wrap{--pl-synth:#7c5cff;--pl-play:#18a999;--pl-gap:#e5484d;--pl-ink:#1a1a22;--pl-dim:#6b7280;--pl-line:#e4e4ee;--pl-bg:#fff;color:var(--pl-ink);font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Inter,sans-serif}
@media (prefers-color-scheme:dark){.pl-wrap{--pl-ink:#e8e8f0;--pl-dim:#9aa0ae;--pl-line:#2a2a36;--pl-bg:#14141b}}
.pl-wrap h1{font-size:1.6rem;margin:0 0 .2em}
.pl-banner{border-radius:10px;padding:.85em 1.1em;margin:1.2em 0;border:1px solid}
.pl-banner.modelled{background:#fff4e5;border-color:#f0a23c;color:#5c3a00}
.pl-banner.measured{background:#e9f9f2;border-color:#18a999;color:#04503f}
@media (prefers-color-scheme:dark){.pl-banner.modelled{background:#33240c;color:#ffd9a0}.pl-banner.measured{background:#0c2e26;color:#8ff0d6}}
.pl-banner b{display:block;margin-bottom:.25em;letter-spacing:.02em}
.pl-evidence{border-left:3px solid var(--pl-dim);padding:.5em 0 .5em 1em;margin:1.2em 0;color:var(--pl-dim);font-size:.93em}
.pl-group{margin:2.2em 0;border:1px solid var(--pl-line);border-radius:12px;overflow:hidden}
.pl-group>header{padding:.7em 1em;background:color-mix(in srgb,var(--pl-line) 40%,transparent);font-weight:600;display:flex;justify-content:space-between;gap:1em;flex-wrap:wrap;align-items:baseline}
.pl-group>header .pl-xo{font-weight:400;color:var(--pl-dim);font-size:.88em}
.pl-scn{padding:1em 1.1em;border-top:1px solid var(--pl-line)}
.pl-scn:first-of-type{border-top:none}
.pl-scn h3{margin:0 0 .15em;font-size:1.02rem}
.pl-note{color:var(--pl-dim);font-size:.9em;margin:.2em 0 .9em}
.pl-metrics{display:flex;gap:1.4em;flex-wrap:wrap;margin:.2em 0 1em;font-size:.9em}
.pl-metrics div{display:flex;flex-direction:column}
.pl-metrics span{color:var(--pl-dim);font-size:.82em}
.pl-metrics b{font-variant-numeric:tabular-nums;font-size:1.05em}
.pl-metrics b.bad{color:var(--pl-gap)}
.pl-row{display:grid;grid-template-columns:5.5em 1fr;gap:.6em;align-items:center;margin:.22em 0}
.pl-lbl{font-size:.78em;color:var(--pl-dim);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pl-track{position:relative;height:22px;background:color-mix(in srgb,var(--pl-line) 35%,transparent);border-radius:5px;overflow:hidden}
.pl-bar{position:absolute;top:0;height:100%;border-radius:4px;display:flex;align-items:center;padding:0 5px;font-size:.7em;color:#fff;white-space:nowrap;overflow:hidden;box-sizing:border-box}
.pl-bar.synth{background:repeating-linear-gradient(45deg,var(--pl-synth),var(--pl-synth) 5px,color-mix(in srgb,var(--pl-synth) 72%,#000) 5px,color-mix(in srgb,var(--pl-synth) 72%,#000) 10px);opacity:.92}
.pl-bar.play{background:var(--pl-play)}
.pl-bar.gap{background:repeating-linear-gradient(45deg,transparent,transparent 4px,var(--pl-gap) 4px,var(--pl-gap) 8px);opacity:.85;border:1px solid var(--pl-gap)}
.pl-axis{display:flex;justify-content:space-between;font-size:.72em;color:var(--pl-dim);margin:.35em 0 .1em;font-variant-numeric:tabular-nums;border-top:1px dashed var(--pl-line);padding-top:.25em}
.pl-legend{display:flex;gap:1.1em;flex-wrap:wrap;font-size:.8em;color:var(--pl-dim);margin:.9em 0 0}
.pl-legend i{display:inline-block;width:22px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:.35em}
.pl-tbl{width:100%;border-collapse:collapse;font-size:.82em;margin-top:.8em}
.pl-tbl th,.pl-tbl td{text-align:right;padding:.3em .5em;border-bottom:1px solid var(--pl-line);font-variant-numeric:tabular-nums}
.pl-tbl th:first-child,.pl-tbl td:first-child{text-align:left;font-variant-numeric:normal}
.pl-tbl td.gap{color:var(--pl-gap);font-weight:600}
.pl-assume{font-size:.85em;color:var(--pl-dim);margin-top:2em;border-top:1px solid var(--pl-line);padding-top:.9em}
.pl-assume code{font-size:.95em}
</style>`;

function bars(chunks, scale) {
  return chunks.map(c => {
    const pct = (v) => `${(v / scale * 100).toFixed(3)}%`;
    const gap = c.gap_before_ms > 150 && c.i > 0
      ? `<div class="pl-bar gap" style="left:${pct(c.play_start_ms - c.gap_before_ms)};width:${pct(c.gap_before_ms)}" title="stall ${ms(c.gap_before_ms)}"></div>`
      : '';
    return `
    <div class="pl-row" title="${esc(c.text)}">
      <div class="pl-lbl">#${c.i + 1} · ${c.chars}c</div>
      <div class="pl-track">
        <div class="pl-bar synth" style="left:${pct(c.synth_start_ms)};width:${pct(c.synth_ms)}" title="synthesis ${ms(c.synth_ms)}">${c.synth_ms / scale > 0.07 ? 'synth' : ''}</div>
        ${gap}
        <div class="pl-bar play" style="left:${pct(c.play_start_ms)};width:${pct(c.play_ms)}" title="playback ${ms(c.play_ms)}">${c.play_ms / scale > 0.07 ? 'play' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function scenario(s, scale) {
  const m = s.metrics || {};
  const badGap = m.gap_count > 0;
  return `
  <div class="pl-scn">
    <h3>${esc(s.label)}</h3>
    <p class="pl-note">${esc(s.note || '')}</p>
    <div class="pl-metrics">
      <div><span>time to first word</span><b>${ms(m.time_to_first_word_ms)}</b></div>
      <div><span>total wall</span><b>${ms(m.total_wall_ms)}</b></div>
      <div><span>stalls</span><b class="${badGap ? 'bad' : ''}">${m.gap_count}</b></div>
      <div><span>time lost to stalls</span><b class="${badGap ? 'bad' : ''}">${ms(m.total_gap_ms)}</b></div>
      <div><span>worst stall</span><b class="${badGap ? 'bad' : ''}">${ms(m.worst_gap_ms)}</b></div>
      <div><span>chunks</span><b>${m.chunk_count}</b></div>
    </div>
    ${bars(s.chunks || [], scale)}
    <div class="pl-axis"><span>0s</span><span>${ms(scale / 2)}</span><span>${ms(scale)}</span></div>
  </div>`;
}

export async function renderPipeline({ frontmatter: fm, sections, preamble }) {
  const src = fm.data;
  let d;
  try {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    d = await res.json();
  } catch (err) {
    return `<div class="prism-error"><strong>Pipeline data failed to load</strong><br>
      <small><code>${esc(src)}</code> — ${esc(err.message)}</small><br>
      <small>This layout deliberately has no fallback numbers: showing stale or invented
      data under a real-looking chart is the failure it exists to prevent.</small></div>`;
  }

  const measured = d.data_state === 'measured';
  const banner = `
    <div class="pl-banner ${measured ? 'measured' : 'modelled'}">
      <b>${measured ? '✅ MEASURED DATA' : '🔴 MODELLED — NOT MEASURED'}</b>
      ${esc(d.data_state_note || '')}
    </div>`;

  const evidence = d.observed_evidence ? `
    <div class="pl-evidence"><strong>Observed evidence.</strong> ${esc(d.observed_evidence.note)}</div>` : '';

  // Group scenarios by overhead so each comparison shares one x-axis.
  const groups = new Map();
  for (const s of d.scenarios || []) {
    const k = s.overhead_ms ?? 'default';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const groupHtml = [...groups.entries()].map(([k, list]) => {
    const scale = Math.max(...list.map(s => s.metrics?.total_wall_ms || 1));
    const xo = list[0]?.crossover_chars;
    return `
    <div class="pl-group">
      <header>
        <span>${k === 'default' ? 'Comparison' : `Per-chunk synthesis overhead: ${ms(k)}`}</span>
        ${xo != null ? `<span class="pl-xo">synthesis loses ground below <b>${xo}</b> chars/chunk</span>` : ''}
      </header>
      ${list.map(s => scenario(s, scale)).join('')}
    </div>`;
  }).join('');

  const legend = `
    <div class="pl-legend">
      <span><i class="pl-bar synth" style="position:static"></i>synthesis (producer)</span>
      <span><i style="background:var(--pl-play)"></i>playback (consumer)</span>
      <span><i style="background:repeating-linear-gradient(45deg,transparent,transparent 3px,var(--pl-gap) 3px,var(--pl-gap) 6px);border:1px solid var(--pl-gap)"></i>stall — silence the listener hears</span>
    </div>`;

  const a = d.assumptions || {};
  const assume = `
    <div class="pl-assume">
      <strong>Assumptions</strong> — every one of these is a number we should be measuring:
      <code>${esc(JSON.stringify(a))}</code><br>
      Generated by <code>${esc(d.generated_by || 'unknown')}</code>. To change any number here,
      edit the generator and re-run it — never this layout.
    </div>`;

  const body = [...(sections?.entries?.() || [])]
    .map(([name, content]) => `<section id="section-${esc(name)}">${md(content)}</section>`).join('');

  return `${STYLE}<div class="pl-wrap">
    <h1>${esc(fm.title || 'Pipeline comparison')}</h1>
    ${banner}
    ${md(preamble || '')}
    ${evidence}
    ${groupHtml}
    ${legend}
    ${body}
    ${assume}
  </div>`;
}
