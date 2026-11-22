// Render site/og-preview.png (1200x630 link preview: Overview hero with the disclaimer strip, dark theme).
//   python3 -m http.server 8000 -d site &
//   node tools/render_og_preview.mjs --base http://localhost:8000
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--base');
const BASE = (i > 0 ? process.argv[i + 1] : 'http://localhost:8000').replace(/\/$/, '');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
if (globalThis.__routeCdn) await globalThis.__routeCdn(p); // sandboxes without CDN access
await p.goto(`${BASE}/?theme=dark#overview`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.addStyleTag({ content: '.hero-actions{display:none!important}' }); // the buttons would be cut by the 630 px frame
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(500);
await p.screenshot({ path: join(ROOT, 'site/og-preview.png') });
await b.close();
console.log('wrote site/og-preview.png');
