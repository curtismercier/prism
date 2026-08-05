// PRISM layout — `registry` FLAT TABLE mode. Split from registry.mjs by concern
// (grouped tree there, flat table here) to keep either file readable on its own.
//
// Flat is a LENS, not a replacement: the grouped tree stays the default (see the
// "WHY HIERARCHICAL" note in registry.mjs). This mode exists for the questions a
// tree answers badly — "what moved most recently, anywhere?", "oldest open work?"
//
// Every <tr> carries the SAME filter dataset the tree rows carry (data-blob,
// data-bucket, data-project, data-scope, data-git, data-broken, data-age) plus
// data-row + data-href, so registry.mjs's apply() and the detail-pane click
// handler cover flat rows with zero forked logic. Sort keys live in data-f* attrs.
//
// Column choice is grounded in measured field population over the 498 live rows
// (2026-08-01): slug 100% (493 unique), arc 100% (328u), project 100% (12u),
// bucket 100% (4u), created 89%, git 81%, age_days 100%. EXCLUDED as too sparse
// or unsortable: title 45%, phase 37%, claimed 28%, tags 10%, raw status (187
// distinct free-text values — the bucket is the sortable form; the raw string
// still renders in the pill, exactly as the tree does).
//
// Placeholder dates: `created` contains a literal em-dash on 53 rows and the
// literal string "YYYY-MM-DD" on 3 more. Both are template residue, not dates.
// isDate() therefore ACCEPTS a strict \d{4}-\d{2}-\d{2} and nulls everything
// else — sorting the raw string would silently rank "YYYY-MM-DD" after every
// real date and "—" wherever the collator feels like.

const COLS = [
  // [sort key, header label, header title]
  ['slug',    'cycle',   'the cycle / phase slug — near-unique per row'],
  ['arc',     'arc',     'the subject the row belongs to'],
  ['project', 'project', 'the .soma tree that owns it'],
  ['bucket',  'status',  'sorts on the normalised bucket (Active/Seeded/Closed/Other); the pill shows the raw status'],
  ['created', 'created', 'frontmatter created: — placeholders (em-dash, YYYY-MM-DD) sort last'],
  ['git',     'touched', 'last git commit — ground truth; rows with no git history sort last'],
  ['age',     'age',     'days since last activity'],
];
const COL_KEYS = COLS.map(([k]) => k);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export function buildFlatTable(rows, { esc, abs, blob, pill }) {
  const head = COLS.map(([k, label, title]) =>
    `<th data-fsort="${k}" title="${esc(title)} — click to sort, click again to reverse"
        tabindex="0" role="button" aria-sort="none">${esc(label)}<span class="reg-farrow" aria-hidden="true"></span></th>`).join('');

  const trs = rows.map((r) => `<tr class="reg-frow ${r.error ? 'reg-row-broken' : ''}"
      data-row data-href="${esc(abs(r.href))}" data-blob="${blob(r)}"
      data-bucket="${esc(r.bucket || '')}" data-broken="${r.error ? '1' : '0'}"
      data-project="${esc(r.project || '')}" data-scope="${esc(r.tree_kind || '')}"
      data-git="${r.git ? '1' : '0'}" data-age="${r.age_days ?? -1}"
      data-label="${esc(r.phase || r.slug)}"
      data-fslug="${esc(r.slug || '')}" data-farc="${esc(r.arc || '')}"
      data-fproject="${esc(r.project || '')}" data-fbucket="${esc(r.bucket || '')}"
      data-fcreated="${isDate(r.created) ? esc(r.created) : ''}"
      data-fgit="${isDate(r.git) ? esc(r.git) : ''}"
      data-fage="${r.age_days ?? ''}">
    <td class="reg-fslug">${r.error ? '<span class="reg-badge-broken">UNPARSEABLE</span> ' : ''}<span class="reg-nm">${esc(r.slug)}</span>${r.title ? `<span class="reg-title">${esc(r.title)}</span>` : ''}</td>
    <td class="reg-farc">${esc(r.arc || '—')}</td>
    <td class="reg-fproj">${esc(r.tree_kind === 'releases' && r.project ? `${r.project}/releases` : (r.project || '—'))}</td>
    <td>${pill(r)}</td>
    <td class="reg-fd">${isDate(r.created) ? esc(r.created) : '—'}</td>
    <td class="reg-fd">${isDate(r.git) ? esc(r.git) : '—'}</td>
    <td class="reg-fage">${r.age_days == null ? '—' : r.age_days + 'd'}</td>
  </tr>`).join('');

  return `<div class="reg-flat" data-reg-flat hidden>
    <table class="reg-ftable">
      <thead><tr>${head}</tr></thead>
      <tbody data-flat-body>${trs}</tbody>
    </table>
  </div>`;
}

// Null-last in BOTH directions: the null check runs BEFORE the direction flip,
// so reversing a sort reverses the values and leaves the blanks at the bottom.
// A null git date sorted as epoch 0 would crown 94 untouched rows "the oldest
// work" — a measurement blind spot dressed up as a finding.
function cmp(col, dir) {
  const numeric = col === 'age';
  return (a, b) => {
    const av = a.dataset['f' + col] || '';
    const bv = b.dataset['f' + col] || '';
    const an = av === '', bn = bv === '';
    if (an || bn) return an && bn ? 0 : an ? 1 : -1;      // nulls LAST, both ways
    const c = numeric ? Number(av) - Number(bv) : av.localeCompare(bv);
    return dir === 'desc' ? -c : c;
  };
}

// Returns a controller whose `state` getter/setter speaks the hash token
// ("col.dir", '' = unsorted) so registry.mjs owns WHERE state persists and this
// module only owns WHAT the state means.
export function attachFlat(wrap, onChange) {
  const box = wrap.querySelector('[data-reg-flat]');
  if (!box) return { get state() { return ''; }, set state(_) {} };
  const body = box.querySelector('[data-flat-body]');
  let col = '', dir = 'asc';

  function indicate() {
    for (const th of box.querySelectorAll('[data-fsort]')) {
      const on = th.dataset.fsort === col;
      th.classList.toggle('reg-fsorted', on);
      th.setAttribute('aria-sort', on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      th.querySelector('.reg-farrow').textContent = on ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    }
  }
  function sortNow() {
    if (!col) return;
    const trs = [...body.children];
    trs.sort(cmp(col, dir));
    trs.forEach((t) => body.appendChild(t));
  }
  function toggle(k) {
    if (col === k) dir = dir === 'asc' ? 'desc' : 'asc';
    else { col = k; dir = 'asc'; }
    indicate(); sortNow();
    if (onChange) onChange();
  }

  box.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('[data-fsort]');
    if (th) toggle(th.dataset.fsort);
  });
  box.querySelector('thead').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const th = e.target.closest('[data-fsort]');
    if (th) { e.preventDefault(); toggle(th.dataset.fsort); }
  });

  return {
    get state() { return col ? `${col}.${dir}` : ''; },
    set state(s) {
      const m = /^(\w+)\.(asc|desc)$/.exec(s || '');
      if (m && COL_KEYS.includes(m[1])) { col = m[1]; dir = m[2]; indicate(); sortNow(); }
    },
  };
}
