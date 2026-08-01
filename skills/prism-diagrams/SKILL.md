---
name: prism-diagrams
description: |
  How to build hand-laid SVG diagrams — architecture maps, topologies, before/after
  comparisons — that render correctly everywhere and can be PROVEN correct rather
  than eyeballed. Covers fixed-canvas sizing, measuring text instead of guessing at
  it, the attach-before-measure trap, file://-loadable data, ES-module cache busting,
  and a copy-paste layout gate that fails on real defects.
  Use this skill when authoring or debugging any SVG-rendering PRISM layout or
  standalone diagram page. Sibling of prism-contributing (which covers data
  discipline and contribution process; this covers rendering mechanics).
version: 0.1.0
status: active
type: skill
spec-version: prism/0.1
created: 2026-08-01
license: MIT
---

# prism-diagrams — hand-laid SVG that renders right and can be proven right

## TL;DR

1. **A hand-laid diagram must be a FIXED canvas in a scrolling band.** Never `width:100%`.
2. **Measure text with `getComputedTextLength()`. Never estimate characters-per-pixel.**
3. 🔴 **Attach before you measure** — a detached node measures **0**, and 0 fits everything.
4. **Load data with `<script>`, not `fetch`** — a diagram you must start a server to see is a
   diagram nobody looks at.
5. **Ship a layout gate**: assert nothing escapes the viewBox, nothing overlaps, then *sabotage it*
   and confirm it goes red.

---

## 1. Sizing: fixed canvas, scrolling band

A hand-laid diagram assigns absolute `x`/`y`/`width` to every box. Scaling that to the viewport
does **not** degrade gracefully:

- boxes keep their aspect ratio, but **text does not stay legible**;
- any label truncation computed from node width **stops matching what is drawn**;
- at narrow widths a 2320-unit canvas collapses to ~400 px and the diagram becomes decorative.

```css
.scroll { overflow-x: auto; overflow-y: hidden; padding: 0 12px; }
svg#map  { display:block; width:1520px; height:470px;
           max-width:none; min-width:1520px; flex:0 0 auto; }
```
```html
<svg id="map" viewBox="0 0 1520 470" width="1520" height="470"
     preserveAspectRatio="xMinYMin meet"></svg>
```

`xMinYMin` anchors top-left so clipping happens at the far edge instead of centring and cutting
both sides. **The window changes what you can SEE; never what is DRAWN.**

**Prove it** — the container width must not move the SVG:

```js
const s = document.getElementById('map'), band = document.querySelector('.scroll');
const m = () => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
const wide = m(); band.style.width = '400px'; const narrow = m(); band.style.width = '';
console.assert(String(wide) === String(narrow), 'svg resized with its container');
```

---

## 2. Text: measure it, never guess

SVG `<text>` **does not wrap**. The tempting shortcut is a character estimate:

```js
sub.length > Math.floor(w / 5.1) ? sub.slice(0, …) + '…' : sub      // ❌ WRONG
```

`5.1` is a guess at average glyph width. It is wrong for capitals, digits, punctuation and emoji —
i.e. for most real labels — so text escapes its box while the code looks like it handles overflow.

Ask the renderer instead. Greedy word wrap into `<text>` lines, ellipsis only if the last line
still overflows, hard-break any single word wider than the box:

```js
function wrapSub(parent, s, x, y, maxW, maxLines, attrs) {
  const words = String(s).split(/\s+/).filter(Boolean);
  const mk = () => { const t = el('text', { ...attrs, x, y: 0 }); parent.appendChild(t); return t; };
  const fits = (t) => t.getComputedTextLength() <= maxW;
  const lines = []; let cur = mk(), curWords = [];
  for (const w of words) {
    cur.textContent = curWords.concat(w).join(' ');
    if (fits(cur) || !curWords.length) {
      if (!fits(cur) && !curWords.length) {            // one word wider than the box
        let cut = w;
        while (cut.length > 1 && !fits(cur)) { cut = cut.slice(0, -1); cur.textContent = cut + '…'; }
      }
      curWords.push(w);
    } else {
      cur.textContent = curWords.join(' '); lines.push(cur);
      if (lines.length === maxLines) { curWords = null; break; }
      cur = mk(); curWords = [w]; cur.textContent = w;
    }
  }
  if (curWords) { cur.textContent = curWords.join(' '); lines.push(cur); }
  lines.forEach((t, i) => t.setAttribute('y', y + i * 12));
  return lines.length;
}
```

### 🔴 2a. Attach before you measure — the trap that hides itself

**`getComputedTextLength()` returns `0` for an element that is not in the render tree.**

Build a `<g>`, fill it with text, wrap it, *then* append it — and every `fits()` call sees `0`,
concludes everything fits, and emits one long line. **You get exactly the overflow the wrapper was
written to prevent, now behind a function that looks correct.**

```js
svg.appendChild(g);                 // ← FIRST
wrapSub(g, node.sub, cx, y, w - 18, 3, attrs);
```

This is the general shape worth carrying: **a measurement that silently returns nothing is
indistinguishable from a measurement that passed.** Any measuring API that can return a falsy
"no answer" needs a canary — assert a known-wide string reports non-zero before trusting the run.

---

## 3. Make it openable: `<script>`, not `fetch`

Browsers block `fetch` and ES-module imports over `file://`. A diagram that requires
`python3 -m http.server` to look at is a diagram that goes unlooked-at — and standing that server
up has its own cost (see §6).

```html
<script src="topology.js"></script>   <!-- topology.js: window.TOPOLOGY = { … } -->
```

Keep the split `prism-contributing` §3 already requires — **facts in the data file, none in the
HTML** — but choose the transport that survives a double-click.

---

## 4. Cache-busting ES modules

An edited layout will **not** be picked up on reload; module caching is aggressive. Version the
URL and bump it on every layout change:

```html
<link rel="stylesheet" href="…/styles.css?v=registry-35">
<script type="module" src="…/render.mjs?v=registry-35"></script>
```

Skipping the bump produces a false "my change did nothing" diagnosis and sends you debugging code
that is not running.

---

## 5. The layout gate — and proving it can fail

Ship this with any hand-laid diagram. It catches the three defects that eyeballing misses.

```js
(() => {
  const s = document.getElementById('map');
  const [W, H] = s.getAttribute('viewBox').split(' ').slice(2).map(Number);
  const out = [], overlaps = [], boxes = [];
  s.querySelectorAll('rect').forEach(r => {
    const x=+r.getAttribute('x'), y=+r.getAttribute('y'),
          w=+r.getAttribute('width'), h=+r.getAttribute('height');
    if (x < 0 || y < 0 || x + w > W || y + h > H) out.push({ x, y, w, h });
    boxes.push({ x, y, w, h });
  });
  // text must sit inside ITS OWN box, not merely inside the canvas
  let escaped = 0;
  s.querySelectorAll('g').forEach(g => {
    const r = g.querySelector('rect'); if (!r) return;
    const bx=+r.getAttribute('x'), bw=+r.getAttribute('width'),
          by=+r.getAttribute('y'), bh=+r.getAttribute('height');
    g.querySelectorAll('text').forEach(t => {
      const b = t.getBBox();
      if (b.x < bx || b.x + b.width > bx + bw || b.y + b.height > by + bh) escaped++;
    });
  });
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 1; i < boxes.length; i++)
    if (boxes[i].y === boxes[i-1].y && boxes[i].x < boxes[i-1].x + boxes[i-1].w)
      overlaps.push(i);
  console.log({ outsideViewBox: out.length, textEscapingItsBox: escaped, overlaps: overlaps.length });
})();
```

**Then sabotage it.** A gate you have never seen fail is decoration:

- set `width:100%` on the SVG → the size-stability check must report a squeeze;
- widen one label past its box → `textEscapingItsBox` must rise;
- nudge two boxes into each other → `overlaps` must rise.

Measuring text against the **canvas** rather than against **its own box** is the classic
wrong-dimension gate: everything is inside the viewBox and half the labels still spill.

---

## 6. Comparison diagrams: read ACROSS the band

For before/after, keep NOW and TARGET **side by side with shared horizontal bands**, and let the
page scroll sideways.

Stacking them vertically fits the window and **destroys the comparison** — the counterpart row ends
up hundreds of pixels away and can no longer be read in one glance. A layout that renders perfectly
and communicates less is a worse layout. Fit is a constraint; comparison is the purpose.

---

## 7. Small traps that cost real time

- **Backticks inside a JS template literal terminate the string.** Writing `` title="the `program:` field" `` inside a `` `…` `` template is a syntax error. Use plain prose in attribute text.
- **Test from a clean state.** A filter left active from an earlier probe silently becomes the baseline for every measurement after it — a nonsense search left applied made every subsequent count read as "no change" and produced three wrong diagnoses in a row. Reload, then perform exactly one action, then measure.
- **Wire new controls into the existing listener list.** Adding a `<select>` and its handle is not enough; if the file registers listeners over an array of elements, the new one must be added there or it renders and does nothing.
- **A local static server is a security surface.** `python3 -m http.server` binds `0.0.0.0` and serves its entire document root to the LAN unauthenticated. Bind loopback, and scope the root to the directory you actually need.

---

## 8. Status

v0.1.0 — extracted from a live session building three architecture diagrams
(topology, before/after, ownership boundary). Every rule here has a defect behind it that reached
a rendered page. Complements `prism-contributing` §3 (data discipline) and §4 (agent failure modes);
this file is the rendering-mechanics half.
