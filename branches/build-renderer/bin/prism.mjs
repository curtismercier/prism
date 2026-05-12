#!/usr/bin/env node
// prism — build-step CLI (Branch A of cycle 001).
// Reads a PRISM Inscribed Source (.md), emits projections (.html, .json, .xml).
//
// Usage:
//   prism render <file.md> [--format html|json|xml|all] [--out <path>]
//   prism read <file.md> --section <name>
//   prism append <file.md> --section <name> --content <text>
//   prism edit <file.md> --section <name> --content <text>
//   prism validate <file.md>

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePrism } from '../src/parse.mjs';
import { renderHtmlDocument } from '../src/render-html.mjs';
import { renderJson } from '../src/render-json.mjs';
import { renderXml } from '../src/render-xml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');

function usage(code = 1) {
  const u = `prism — PRISM build-step renderer (Branch A)

Usage:
  prism render <file.md> [--format html|json|xml|all] [--out <path>]
  prism read   <file.md> --section <name>
  prism append <file.md> --section <name> --content <text>
  prism edit   <file.md> --section <name> --content <text>
  prism validate <file.md>

Examples:
  prism render examples/cycle-215.md
  prism render examples/cycle-215.md --format all
  prism read examples/cycle-215.md --section trigger
`;
  console.log(u);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true;
      args.flags[k] = v;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function ensureStylesheet(outDir) {
  // Copy styles.css from the CDN renderer to the output dir if not present.
  // The two branches share a stylesheet for fair comparison.
  const targetPath = join(outDir, 'styles.css');
  const cdnStyles = resolve(PKG_ROOT, '../cdn-renderer/styles.css');
  if (!existsSync(targetPath) && existsSync(cdnStyles)) {
    copyFileSync(cdnStyles, targetPath);
  }
}

function cmdRender(file, flags) {
  const abs = resolve(process.cwd(), file);
  const text = readFileSync(abs, 'utf8');
  const parsed = parsePrism(text);

  const fmt = flags.format || 'html';
  const base = basename(abs, extname(abs));
  const dir = flags.out ? resolve(process.cwd(), flags.out) : dirname(abs);

  const formats = fmt === 'all' ? ['html', 'json', 'xml'] : [fmt];
  for (const f of formats) {
    if (f === 'html') {
      ensureStylesheet(dir);
      const html = renderHtmlDocument(parsed, { stylesPath: './styles.css' });
      const outPath = join(dir, `${base}.html`);
      writeFileSync(outPath, html);
      console.log(`✓ ${outPath}`);
    } else if (f === 'json') {
      const json = JSON.stringify(renderJson(parsed), null, 2);
      const outPath = join(dir, `${base}.json`);
      writeFileSync(outPath, json);
      console.log(`✓ ${outPath}`);
    } else if (f === 'xml') {
      const xml = renderXml(parsed);
      const outPath = join(dir, `${base}.xml`);
      writeFileSync(outPath, xml);
      console.log(`✓ ${outPath}`);
    } else {
      console.error(`Unknown format: ${f}`);
      process.exit(1);
    }
  }
}

function cmdRead(file, flags) {
  if (!flags.section) { console.error('--section required'); process.exit(1); }
  const text = readFileSync(resolve(process.cwd(), file), 'utf8');
  const parsed = parsePrism(text);
  const content = parsed.sections.get(flags.section);
  if (!content) {
    console.error(`Section not found: ${flags.section}`);
    console.error(`Available: ${Array.from(parsed.sections.keys()).join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(content + '\n');
}

function cmdAppend(file, flags) {
  if (!flags.section || !flags.content) { console.error('--section and --content required'); process.exit(1); }
  const abs = resolve(process.cwd(), file);
  let text = readFileSync(abs, 'utf8');
  const closeTag = `<!-- /@section: ${flags.section} -->`;
  if (!text.includes(closeTag)) {
    console.error(`Section close tag not found: ${closeTag}`);
    process.exit(1);
  }
  // Insert content just before the close tag (with newline padding)
  const insertion = `\n${flags.content}\n`;
  text = text.replace(closeTag, `${insertion}${closeTag}`);
  writeFileSync(abs, text);
  console.log(`✓ appended to section: ${flags.section}`);
}

function cmdEdit(file, flags) {
  if (!flags.section || !flags.content) { console.error('--section and --content required'); process.exit(1); }
  const abs = resolve(process.cwd(), file);
  let text = readFileSync(abs, 'utf8');
  const openTag = `<!-- @section: ${flags.section} -->`;
  const closeTag = `<!-- /@section: ${flags.section} -->`;
  const start = text.indexOf(openTag);
  const end = text.indexOf(closeTag);
  if (start < 0 || end < 0 || end < start) {
    console.error(`Section not found or anchors malformed: ${flags.section}`);
    process.exit(1);
  }
  const before = text.slice(0, start + openTag.length);
  const after = text.slice(end);
  text = `${before}\n${flags.content}\n${after}`;
  writeFileSync(abs, text);
  console.log(`✓ replaced section: ${flags.section}`);
}

function cmdValidate(file) {
  const abs = resolve(process.cwd(), file);
  const text = readFileSync(abs, 'utf8');
  const parsed = parsePrism(text);
  const issues = [];
  if (!parsed.frontmatter?.type) issues.push('missing frontmatter: type');
  if (!parsed.frontmatter?.status) issues.push('missing frontmatter: status');
  if (parsed.frontmatter?.type === 'cycle') {
    for (const required of ['trigger', 'context', 'phases']) {
      if (!parsed.sections.has(required)) issues.push(`cycle missing required section: ${required}`);
    }
  }
  if (issues.length === 0) {
    console.log(`✓ ${file}: clean (${parsed.sections.size} sections, type=${parsed.frontmatter?.type || '?'})`);
  } else {
    console.error(`✗ ${file}:`);
    for (const i of issues) console.error(`  - ${i}`);
    process.exit(1);
  }
}

// ── Dispatch ──
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const file = args._[1];
if (!cmd || !file) usage();

switch (cmd) {
  case 'render':   cmdRender(file, args.flags); break;
  case 'read':     cmdRead(file, args.flags); break;
  case 'append':   cmdAppend(file, args.flags); break;
  case 'edit':     cmdEdit(file, args.flags); break;
  case 'validate': cmdValidate(file); break;
  default: usage();
}
