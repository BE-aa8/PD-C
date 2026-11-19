// Render the two still images of the 3D pancreas used when live 3D is off (software renderer, or before "Explore in 3D").
//   python3 -m http.server 8000 -d site &
//   node tools/render_pancreas_stills.mjs --base http://localhost:8000
// Output: site/models/pancreas-hero.webp, site/models/pancreas-viewer.webp (transparent background, both themes).
// The images are renders of the BodyParts3D mesh (CC BY-SA 2.1 JP, see site/models/LICENSE-BodyParts3D.txt).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--base');
const BASE = (i > 0 ? process.argv[i + 1] : 'http://localhost:8000').replace(/\/$/, '');
const SHOTS = [
  { file: 'pancreas-hero.webp', mode: 'hero', W: 1120, H: 960, activity: 0.55 },
  { file: 'pancreas-viewer.webp', mode: 'full', W: 1480, H: 920, activity: 0.5 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
if (globalThis.__routeCdn) await globalThis.__routeCdn(page); // sandboxes without CDN access
await page.goto(`${BASE}/#references`, { waitUntil: 'networkidle' });
for (const s of SHOTS) {
  const url = await page.evaluate(async ({ mode, W, H, activity }) => {
    const stage = document.createElement('div');
    stage.style.cssText = `position:fixed;left:0;top:0;width:${W / 2}px;height:${H / 2}px;z-index:9999`;
    document.body.appendChild(stage);
    const mod = await import(new URL('js/pancreas.js', location.href));
    const v = await mod.createPancreasViewer(stage, { mode, pixelRatio: 2 });
    v.setTool('rotate', false);
    v.setActivity(activity);
    const out = v.snapshot(W, H, 'image/webp');
    v.dispose(); stage.remove();
    return out;
  }, s);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(ROOT, 'site/models', s.file), buf);
  console.log(`wrote site/models/${s.file} (${buf.length} bytes)`);
}
await browser.close();
