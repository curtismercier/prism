// Acceptance tests for the registry decomposition + the shared shell header.
//
//   node branches/cdn-renderer/tests/registry-decompose.test.mjs [path/to/registry.json]
//
// Two kinds of check, deliberately:
//
//  A. RULE TESTS over the menu. The two branches that decide whether the menu is
//     correct — an ABSENT dashboard and an EMPTY one — cannot be produced from live
//     data, which is exactly why nobody runs them. Testing with everything present
//     and populated proves nothing, so those two are asserted directly.
//
//  B. A DIFFERENTIAL for "behaviour identical". A refactor that only ever compares
//     against itself cannot detect that it changed something: the new file agrees
//     with the new file. So the PRE-SPLIT registry.mjs is checked out of git at the
//     merge-base and rendered against the same data, and the two outputs are diffed.
//     Everything between the sticky sentinel and the preview pane — cards, controls,
//     legend, the whole project→arc→phase tree, the flat table — must match BYTE FOR
//     BYTE. The header and the pane are the two regions that changed on purpose.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYOUTS = resolve(HERE, '../layouts');
const REPO = resolve(HERE, '../../..');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`); fail++; }
};
const ta = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); fail++; }
};

// ── A. the menu's rules ───────────────────────────────────────────────────────
const { selectDashboards, buildDashboardMenu, deriveDashboardsFromRows, renderShellHeader } =
  await import(pathToFileURL(join(LAYOUTS, 'shell-header.mjs')).href);

console.log('\nshell-header — availability HIDES, usage NEVER does');

t('ABSENT (present:false) is hidden — the branch nobody runs #1', () => {
  const out = buildDashboardMenu([
    { id: 'registry', label: 'Cycle Registry', href: './registry.md' },
    { id: 'ghost', label: 'Deleted Dashboard', href: './ghost.md', present: false },
  ], {});
  assert.ok(out.includes('Cycle Registry'), 'the present one must still render');
  assert.ok(!out.includes('Deleted Dashboard'), 'an absent dashboard must not appear');
  assert.ok(!out.includes('ghost.md'));
});

t('ABSENT (no href — nowhere to navigate) is hidden', () => {
  const out = buildDashboardMenu([
    { id: 'registry', label: 'Cycle Registry', href: './registry.md' },
    { id: 'nohref', label: 'Unbuilt Dashboard' },
  ], {});
  assert.ok(!out.includes('Unbuilt Dashboard'));
});

t('EMPTY (empty:true) is LISTED AND MARKED — the branch nobody runs #2', () => {
  const out = buildDashboardMenu([
    { id: 'registry', label: 'Cycle Registry', href: './registry.md' },
    { id: 'timeline', label: 'Delegation Timeline', href: './timeline.md', empty: true },
  ], {});
  assert.ok(out.includes('Delegation Timeline'), 'empty ≠ absent: it must still be listed');
  assert.ok(out.includes('timeline.md'), 'and it must still be navigable');
  assert.match(out, /Delegation Timeline\s*<span class="shell-nav-empty"/, 'and marked empty');
  assert.ok(out.includes('is-empty'));
});

t('EMPTY (count:0) is the same fact arriving as a number', () => {
  const out = buildDashboardMenu([{ id: 'x', label: 'Zero Rows', href: './x.md', count: 0 }], {});
  assert.ok(out.includes('Zero Rows'));
  assert.ok(out.includes('shell-nav-empty'));
});

t('a POPULATED dashboard carries no empty marker', () => {
  const out = buildDashboardMenu([{ id: 'x', label: 'Full', href: './x.md', count: 42 }], {});
  assert.ok(out.includes('Full'));
  assert.ok(!out.includes('shell-nav-empty'));
});

t('USAGE never hides — an unvisited, never-used dashboard still renders', () => {
  // The self-reinforcing filter: never shown → never used → never shown. If any
  // usage signal could hide an entry, this assertion is the one that fails.
  const out = buildDashboardMenu([
    { id: 'new', label: 'Brand New', href: './new.md', count: 0, visits: 0, last_used: null, empty: true },
  ], {});
  assert.ok(out.includes('Brand New'), 'the newest dashboard is exactly the one a usage filter buries');
});

t('the current dashboard is marked, and is not a link to itself', () => {
  const out = buildDashboardMenu([
    { id: 'registry', label: 'Cycle Registry', href: './registry.md' },
    { id: 'other', label: 'Other', href: './other.md' },
  ], { current: 'registry' });
  assert.match(out, /<span class="shell-nav-item is-current" aria-current="page">Cycle Registry/);
  assert.match(out, /<a class="shell-nav-item" href="\.\/other\.md">Other/);
});

t('order: declared `order` first, then alphabetical — never by usage', () => {
  const sel = selectDashboards([
    { id: 'c', label: 'Charlie', href: './c.md' },
    { id: 'a', label: 'Alpha', href: './a.md' },
    { id: 'z', label: 'Zulu', href: './z.md', order: 1 },
  ], {});
  assert.deepEqual(sel.map((d) => d.id), ['z', 'a', 'c']);
});

t('nothing to federate renders NO chrome (an empty <nav> would assert a family that is not there)', () => {
  assert.equal(buildDashboardMenu([], {}), '');
  assert.equal(buildDashboardMenu([{ id: 'gone', href: './g.md', present: false }], {}), '');
});

t('labels are escaped — a manifest is data, and data is never trusted markup', () => {
  const out = buildDashboardMenu([{ id: 'x', label: '<img src=x onerror=alert(1)>', href: './x.md' }], {});
  assert.ok(!out.includes('<img'), 'must not emit raw markup from the manifest');
  assert.ok(out.includes('&lt;img'));
});

console.log('\nshell-header — G3: the list is DERIVED, adding a dashboard edits no source');

t('a row self-declares by TAG and joins the menu — zero edits to shell-header.mjs', () => {
  const rows = [
    { slug: '002-registry-dashboard', title: 'Cycle Registry', tags: ['dashboard'], bucket: 'Active',
      artifacts: [{ name: 'registry.md', href: './_browser/registry.md', kind: 'view' }] },
    { slug: 'not-a-dashboard', title: 'Some Cycle', tags: ['renderer'], bucket: 'Active', artifacts: [] },
  ];
  const before = buildDashboardMenu(deriveDashboardsFromRows(rows), {});
  assert.ok(before.includes('Cycle Registry'));
  assert.ok(!before.includes('Some Cycle'), 'only self-declared rows are dashboards');

  // The acceptance test for "derived": a NEW dashboard appears with no code change.
  rows.push({ slug: '003-delegation-timeline', title: 'Delegation Timeline', tags: ['dashboard'],
    bucket: 'Active', artifacts: [{ name: 'timeline.html', href: './timeline.html', kind: 'view' }] });
  const after = buildDashboardMenu(deriveDashboardsFromRows(rows), {});
  assert.ok(after.includes('Delegation Timeline'));
});

t('a self-declared dashboard with no rendered page is UNAVAILABLE, not merely empty', () => {
  const rows = [{ slug: 'x', title: 'Planned Dashboard', tags: ['dashboard'], bucket: 'Seeded', artifacts: [] }];
  const derived = deriveDashboardsFromRows(rows);
  assert.equal(derived.length, 1, 'derivation keeps it…');
  assert.equal(selectDashboards(derived, {}).length, 0, '…and availability drops it: there is nowhere to go');
});

t('a Seeded dashboard WITH a page is listed and marked empty (not hidden)', () => {
  const rows = [{ slug: 'x', title: 'Seeded Dashboard', tags: ['dashboard'], bucket: 'Seeded',
    artifacts: [{ name: 'x.html', href: './x.html', kind: 'view' }] }];
  const out = buildDashboardMenu(deriveDashboardsFromRows(rows), {});
  assert.ok(out.includes('Seeded Dashboard'));
  assert.ok(out.includes('shell-nav-empty'));
});

console.log('\nshell-header — g.1 breadcrumb');

t('the product name is a home link, and the brand keeps its own url when given', () => {
  const h = renderShellHeader({ brand: { name: 'Soma', symbol: 'σ', url: 'https://example.test' },
    product: 'Cycle Registry', dashboards: [] });
  assert.match(h, /<a class="shell-brand" href="https:\/\/example\.test">/);
  assert.match(h, /<a class="shell-crumb" data-shell-home/);
  assert.ok(h.includes('Cycle Registry'));
});

t('with no brand url the whole lockup goes home', () => {
  const h = renderShellHeader({ brand: { name: 'Soma', symbol: 'σ' }, product: 'Cycle Registry', dashboards: [] });
  assert.match(h, /<span class="shell-brand" data-shell-home>/);
});

t('the lockup swaps the first o for the symbol, and stays plain when there is no o', () => {
  const h = renderShellHeader({ brand: { name: 'Soma', symbol: 'σ' }, product: 'X', dashboards: [] });
  assert.ok(h.includes('shell-brand-sigma'));
  const h2 = renderShellHeader({ brand: { name: 'Kite', symbol: 'σ' }, product: 'X', dashboards: [] });
  assert.ok(!h2.includes('shell-brand-sigma'), 'a brand with nowhere to put the mark must not get a stray one');
});

// ── B. behaviour identical — differential against the pre-split file ─────────
console.log('\nregistry — differential vs the pre-split registry.mjs');

const DATA = process.argv[2]
  || join(process.env.HOME || '', 'Gravicity/meetsoma/.soma/cycles/_browser/registry.json');

if (!existsSync(DATA)) {
  console.log(`  SKIP differential — no registry.json at ${DATA}`);
} else {
  // file:// fetch, which the platform does not provide.
  globalThis.fetch = async (u) => {
    const p = u instanceof URL ? fileURLToPath(u) : fileURLToPath(new URL(u));
    const body = readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body), headers: { get: () => null } };
  };
  globalThis.document = { baseURI: pathToFileURL(DATA).href };

  // PINNED, not computed. This was `merge-base(HEAD, exp/cycles-mechanic)`, which meant "the last
  // commit before the split" only while the split lived on an unmerged branch. Once it merged,
  // merge-base resolved to a POST-split commit, so the "old" side stopped being old: the two
  // shape guards below could never pass again and the suite carried permanent red. A red that
  // cannot go green is a dead gate -- the same failure as the ERR_MODULE_NOT_FOUND crash this
  // file already fixed once, arriving by a different road.
  //
  // 7fadb17 is the commit immediately before the split (registry.mjs 974 lines, no
  // shell-header.mjs). It is an ancestor of main, so it cannot be GC'd or rebased away.
  const base = '7fadb17a9b43202959a0c399de0042b9afbb6e2d';
  const scratch = join(tmpdir(), `prism-old-registry-${base.slice(0, 7)}`);
  mkdirSync(scratch, { recursive: true });
  // ENUMERATE, never list. This was `['registry.mjs', 'registry-flat.mjs']` hardcoded. When the
  // renderer was decomposed further, `registry-tree.mjs` was added to the imports and NOT to this
  // list, so the old module could not resolve its own import and the differential died with
  // ERR_MODULE_NOT_FOUND -- a CRASH, not a failure, which is why it read as noise and went
  // unnoticed. The guard that protects the tree markup has therefore been dead for exactly as
  // long as the tree markup has been worth guarding. A list of files that must match an import
  // graph is a second copy of that graph; ask git for the real one.
  const layoutFiles = execFileSync(
    'git', ['-C', REPO, 'ls-tree', '--name-only', `${base}:branches/cdn-renderer/layouts`],
    { encoding: 'utf8' },
  ).split('\n').filter((f) => f.endsWith('.mjs'));
  assert.ok(layoutFiles.length >= 2, `expected layout modules at ${base}, got ${layoutFiles.length}`);
  for (const f of layoutFiles) {
    writeFileSync(join(scratch, f),
      execFileSync('git', ['-C', REPO, 'show', `${base}:branches/cdn-renderer/layouts/${f}`]));
  }

  const fm = { data: pathToFileURL(DATA).href, title: 'Cycle registry' };
  const srcUrl = pathToFileURL(DATA).href;
  const oldMod = await import(pathToFileURL(join(scratch, 'registry.mjs')).href);
  const newMod = await import(pathToFileURL(join(LAYOUTS, 'registry.mjs')).href);
  const oldHtml = await oldMod.renderRegistry({ frontmatter: fm, preamble: '<p>hi</p>', srcUrl });
  const newHtml = await newMod.renderRegistry({ frontmatter: fm, preamble: '<p>hi</p>', srcUrl });

  // (The `middle()` region slicer that lived here was deleted with the differential it served.
  //  Dead code left beside a retired test is how the next reader concludes the test still runs.)

  // ── RETIRED: the byte-identical differential ──────────────────────────────────────────────
  //
  // It did its job and the job is over. It existed to prove ONE migration -- that splitting
  // registry.mjs by concern changed no rendered byte outside the header and the pane -- and it
  // proved exactly that, at 55cb306, on ~400KB of markup.
  //
  // Everything it guarded has since been deliberately changed, by rows the gap table authorised:
  //   S8  36c7ad6  background orbs, a 48px scroll-aware header, a 240px filter rail
  //   S9  a65cc9e  card anatomy -- the leaf row RESTRUCTURED (eyebrow/title/description/footer)
  //   S10 f4cd7a9  283 colour literals become 29 roles
  // So "byte-identical to the pre-split render" is now a claim we do not want to be true, and an
  // assertion nobody wants to pass is noise that hides the 18 that matter.
  //
  // 🔑 A MIGRATION test is not a regression test. Delete it when the migration lands, or it decays
  //    into permanent red and takes the suite's signal with it.
  //
  // The SHAPE guards below are kept and are NOT the same thing: they assert the refactor's
  // invariants still hold (the pane is out of flow, the header is the shared module, nothing calls
  // scrollIntoView) and they stay meaningful for as long as those decisions do.
  //
  // Coverage did not shrink -- it moved and widened. What renders correctly is now checked by
  // verify-all-layouts.py, which drives all SEVEN registered layouts rather than one page, and by
  // verify-widths / verify-chrome / verify-typography.
  //   → releases/cycles/prism-universal-registry/p1-family-consolidation/

  await ta('the preview pane keeps every hook the close ✕ and the projection need', () => {
    for (const hook of ['data-reg-detail', 'data-reg-detail-title', 'data-reg-detail-body',
      'data-reg-close', 'close ✕']) {
      assert.ok(newHtml.includes(hook), `lost ${hook}`);
    }
  });

  await ta('the pane is no longer in the list flow, and nothing scrolls the page to it', () => {
    assert.ok(oldHtml.includes('<div class="reg-detail"'), 'guard: the old pane WAS an inline div');
    assert.ok(newHtml.includes('<aside class="reg-detail"'), 'the new pane is a distinct surface');
    for (const f of ['registry.mjs', 'registry-tree.mjs', 'registry-detail.mjs', 'shell-header.mjs']) {
      assert.ok(!readFileSync(join(LAYOUTS, f), 'utf8').match(/^[^/*\n]*scrollIntoView/m),
        `${f} still calls scrollIntoView`);
    }
  });

  await ta('the header is the shared module, and the old private chrome is gone', () => {
    assert.ok(oldHtml.includes('class="reg-topbar"'), 'guard: the old header WAS registry-private');
    assert.ok(newHtml.includes('class="shell-topbar"'));
    assert.ok(!newHtml.includes('reg-topbar'));
    assert.ok(newHtml.includes('data-shell-home'), 'breadcrumb present');
  });

  await ta('G1 — registry.mjs is back under its own 600-line gate', () => {
    const n = readFileSync(join(LAYOUTS, 'registry.mjs'), 'utf8').split('\n').length;
    assert.ok(n < 600, `registry.mjs is ${n} lines`);
    console.log(`       registry.mjs = ${n} lines`);
  });
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
