// PRISM parser — node-side port of branches/cdn-renderer/parsers/md.mjs.
// Spec §3 (section anchors) + §4 (frontmatter). Stays in sync with the
// CDN-side parser; differences here are bugs.

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const SECTION_OPEN_RE = /<!--\s*@section:\s*([a-z0-9.-]+)\s*-->/g;
const SECTION_CLOSE = (name) => new RegExp(`<!--\\s*/@section:\\s*${name.replace('.', '\\.')}\\s*-->`);

function parseFrontmatter(yamlText) {
  const out = {};
  const lines = yamlText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }
    const pipe = line.match(/^(\w[\w-]*):\s*\|\s*$/);
    if (pipe) {
      const key = pipe[1];
      const block = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        block.push(lines[i].replace(/^  /, ''));
        i++;
      }
      out[key] = block.join('\n').trim();
      continue;
    }
    const listHeader = line.match(/^(\w[\w-]*):\s*$/);
    if (listHeader && lines[i+1]?.match(/^\s+-\s+/)) {
      const key = listHeader[1];
      const items = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/\s*#.*$/, ''));
        i++;
      }
      out[key] = items;
      continue;
    }
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let val = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (val && /^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      else val = val.replace(/^['"]|['"]$/g, '');
      out[key] = val;
    }
    i++;
  }
  return out;
}

export function parsePrism(source) {
  const fmMatch = source.match(FRONTMATTER_RE);
  const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
  const body = fmMatch ? source.slice(fmMatch[0].length) : source;

  const sections = new Map();
  const ranges = [];
  // Names of anchors that open but never close. Reported so callers (notably
  // `prism validate`) can treat them as blocking errors: an unclosed anchor is
  // dropped from `sections`, which makes it unaddressable by read/edit/append
  // while a warning-only parse would still look "clean".
  const unclosed = [];
  let m;
  const openRe = new RegExp(SECTION_OPEN_RE.source, 'g');
  while ((m = openRe.exec(body)) !== null) {
    const name = m[1];
    const openStart = m.index;
    const openEnd = openRe.lastIndex;
    const closeRe = SECTION_CLOSE(name);
    closeRe.lastIndex = openEnd;
    const closeMatch = body.slice(openEnd).match(closeRe);
    if (!closeMatch) {
      console.warn(`[prism] unclosed section: @section: ${name}`);
      unclosed.push(name);
      continue;
    }
    const closeStart = openEnd + closeMatch.index;
    const closeEnd = closeStart + closeMatch[0].length;
    const content = body.slice(openEnd, closeStart).trim();
    ranges.push({ name, start: openStart, end: closeEnd, contentStart: openEnd, contentEnd: closeStart });
    if (!sections.has(name)) sections.set(name, content);
  }

  ranges.sort((a, b) => a.start - b.start);
  const preamble = ranges.length ? body.slice(0, ranges[0].start).trim() : body.trim();
  const trailer = ranges.length ? body.slice(ranges[ranges.length-1].end).trim() : '';

  return { frontmatter, sections, preamble, trailer, rawBody: body, unclosed };
}
