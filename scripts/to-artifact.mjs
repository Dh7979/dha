// Turn Vite's single-file dist/index.html into the Artifact page format:
// no doctype/html/head/body wrappers (the platform adds them), <title> first.
import {readFileSync, writeFileSync} from 'node:fs';

const src = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const title = head.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>DHA</title>';
const links = head.match(/<link[^>]*>/gi) ?? [];
const styles = head.match(/<style[\s\S]*?<\/style>/gi) ?? [];
const scripts = head.match(/<script[\s\S]*?<\/script>/gi) ?? [];

const out = [
  title,
  ...links,
  ...styles,
  body.trim(),
  ...scripts,
]
  .join('\n')
  // Library code uses a literal U+FFFD inside JS strings; the publisher rejects it, so escape it.
  .replace(/�/g, '\\uFFFD');

writeFileSync(new URL('../../dha.html', import.meta.url), out);
console.log('wrote ../dha.html', (out.length / 1024).toFixed(1) + ' KB');
