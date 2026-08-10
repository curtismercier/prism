// PRISM parser for Markdown with section anchors.
// Parses frontmatter (YAML) + body, splitting body on <!-- @section: NAME --> ... <!-- /@section: NAME --> pairs.
// Returns { frontmatter, sections: Map<name, content>, preamble, trailer }
//
// No external deps. ~50 LOC of parsing.

// TOLERANT ON PURPOSE. This used to be /^---\n([\s\S]*?)\n---\n?/ and any of three ordinary
// things made it match NOTHING -- which yields no frontmatter, so no `type`, so a silent fall to
// renderDefault. This file's own header names that failure: "Malformed frontmatter renders BLANK,
// and blank reads as fine."
//   \uFEFF?   a UTF-8 BOM, which several editors write and nothing displays
//   [ \t]*    trailing whitespace after either --- , invisible in every editor
//   \r?\n     CRLF, from Windows or a pasted file
// The SERVER half (soma-cycles-registry.py) already tolerated all three, so a file could list in
// the registry and render blank in the drill-in. Two parsers, one corpus: they must agree on what
// counts as frontmatter.
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const SECTION_OPEN_RE = /<!--\s*@section:\s*([a-z0-9.-]+)\s*-->/g;
const SECTION_CLOSE = (name) => new RegExp(`<!--\\s*/@section:\\s*${name.replace('.', '\\.')}\\s*-->`);

/**
 * Parse YAML frontmatter — handles the subset we use: strings, numbers, booleans,
 * arrays (bracket OR indented dash form), nested objects (one level), pipe-multiline.
 * Not a full YAML parser — intentionally minimal so this stays dep-free.
 */
function parseFrontmatter(yamlText) {
  const out = {};
  const lines = yamlText.split(/\r?\n/);   // \r survives a CRLF file and corrupts every value
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }

    // BLOCK SCALARS: `key: |` (literal) and `key: >` (folded), each with an optional -/+ chomp.
    //
    // Only `|` was handled. `>-` is the DEFAULT shape for `description:` across this estate --
    // measured 218 of 1,211 frontmatter files (18%) use a folded or literal scalar. Unhandled, the
    // `key: value` branch below matched it and set the value to the literal string ">-", which is
    // worse than dropping it: a wrong value that looks parsed, rendered as the card's description.
    const blockScalar = line.match(/^(\w[\w-]*):\s*([|>])([-+]?)\s*$/);
    if (blockScalar) {
      const [, key, style, chomp] = blockScalar;
      const buf = [];
      i++;
      // A continuation line is indented; a blank line belongs to the block. Anything at column 0
      // ends it -- that is what keeps the NEXT key from being swallowed.
      while (i < lines.length && (/^[ \t]+\S/.test(lines[i]) || lines[i].trim() === '')) {
        buf.push(lines[i].replace(/^[ \t]{1,4}/, ''));
        i++;
      }
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();   // drop trailing blanks
      let text;
      if (style === '|') {
        text = buf.join('\n');
      } else {
        // Folded: lines join with a space; a blank line is a paragraph break.
        text = buf.reduce((acc, ln) => {
          if (!ln.trim()) return acc.replace(/\s+$/, '') + '\n\n';
          return acc && !acc.endsWith('\n') ? `${acc} ${ln.trim()}` : acc + ln.trim();
        }, '');
      }
      out[key] = chomp === '+' ? text : text.replace(/\s+$/, '');
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
