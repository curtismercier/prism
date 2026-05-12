// PRISM parser for Markdown with section anchors.
// Parses frontmatter (YAML) + body, splitting body on <!-- @section: NAME --> ... <!-- /@section: NAME --> pairs.
// Returns { frontmatter, sections: Map<name, content>, preamble, trailer }
//
// No external deps. ~50 LOC of parsing.

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const SECTION_OPEN_RE = /<!--\s*@section:\s*([a-z0-9.-]+)\s*-->/g;
const SECTION_CLOSE = (name) => new RegExp(`<!--\\s*/@section:\\s*${name.replace('.', '\\.')}\\s*-->`);

/**
 * Parse YAML frontmatter — handles the subset we use: strings, numbers, booleans,
 * arrays (bracket OR indented dash form), nested objects (one level), pipe-multiline.
 * Not a full YAML parser — intentionally minimal so this stays dep-free.
 */
function parseFrontmatter(yamlText) {
  const out = {};
  const lines = yamlText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }

    // Pipe-multiline: `key: |`
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

    // Indented array: `key:\n  - item\n  - item`
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

    // Simple `key: value` (with optional inline-array)
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

/**
 * Parse a PRISM markdown source.
 * @returns {{ frontmatter: object, sections: Map<string, string>, preamble: string, trailer: string, rawBody: string }}
 */
export function parsePrism(source) {
  const fmMatch = source.match(FRONTMATTER_RE);
  const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
  const body = fmMatch ? source.slice(fmMatch[0].length) : source;

  // Walk body finding section anchor pairs.
  const sections = new Map();
  const ranges = []; // [{name, start, contentStart, contentEnd, end}]
  let m;
  const openRe = new RegExp(SECTION_OPEN_RE.source, 'g'); // fresh regex (lastIndex reset)
  while ((m = openRe.exec(body)) !== null) {
    const name = m[1];
    const openStart = m.index;
    const openEnd = openRe.lastIndex;
    const closeRe = SECTION_CLOSE(name);
    closeRe.lastIndex = openEnd;
    const closeMatch = body.slice(openEnd).match(closeRe);
    if (!closeMatch) {
      console.warn(`[prism] unclosed section: @section: ${name}`);
      continue;
    }
    const closeStart = openEnd + closeMatch.index;
    const closeEnd = closeStart + closeMatch[0].length;
    const content = body.slice(openEnd, closeStart).trim();
    ranges.push({ name, start: openStart, end: closeEnd, contentStart: openEnd, contentEnd: closeStart });
    if (!sections.has(name)) sections.set(name, content);
  }

  // preamble = body before first section anchor; trailer = body after last
  ranges.sort((a, b) => a.start - b.start);
  const preamble = ranges.length ? body.slice(0, ranges[0].start).trim() : body.trim();
  const trailer = ranges.length ? body.slice(ranges[ranges.length-1].end).trim() : '';

  return { frontmatter, sections, preamble, trailer, rawBody: body };
}
