// XML projection — spec §7.3.
// Section content stays as text (Markdown preserved within section tags).
// Deeper structuring of within-section content is intentionally NOT done in v0.0 —
// the spec allows latitude here; we pick the conservative default.

const xmlEscape = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function renderFrontmatterXml(fm) {
  return Object.entries(fm).map(([k, v]) => {
    if (Array.isArray(v)) {
      const items = v.map(item => `    <item>${xmlEscape(item)}</item>`).join('\n');
      return `  <${k}>\n${items}\n  </${k}>`;
    }
    return `  <${k}>${xmlEscape(v)}</${k}>`;
  }).join('\n');
}

function renderSectionXml(name, content) {
  // Preserve markdown content as CDATA-wrapped text. Consumers that want
  // structured content can re-parse the inner markdown themselves.
  const safe = content.replace(/]]>/g, ']]]]><![CDATA[>');
  return `  <section name="${xmlEscape(name)}">\n<![CDATA[${safe}]]>\n  </section>`;
}

export function renderXml({ frontmatter, sections, preamble, trailer }) {
  const type = frontmatter?.type || 'unknown';
  return `<?xml version="1.0" encoding="UTF-8"?>
<artifact type="${xmlEscape(type)}" version="0.1">
<frontmatter>
${renderFrontmatterXml(frontmatter || {})}
</frontmatter>
${preamble ? `<preamble><![CDATA[${preamble}]]></preamble>` : ''}
<sections>
${Array.from(sections.entries()).map(([n, c]) => renderSectionXml(n, c)).join('\n')}
</sections>
${trailer ? `<trailer><![CDATA[${trailer}]]></trailer>` : ''}
</artifact>
`;
}
