// JSON projection — spec §7.2.
// Emits structured shape: { type, frontmatter, sections, preamble, trailer, references }.

export function renderJson({ frontmatter, sections, preamble, trailer }) {
  return {
    type: frontmatter?.type || 'unknown',
    frontmatter,
    sections: Object.fromEntries(sections),
    preamble: preamble || '',
    trailer: trailer || '',
    references: {
      depends_on: frontmatter?.depends_on || [],
      companion: frontmatter?.companion || [],
      supersedes: frontmatter?.supersedes || null,
      parent: frontmatter?.parent || null,
    },
  };
}
