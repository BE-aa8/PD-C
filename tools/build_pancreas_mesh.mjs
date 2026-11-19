// Build the 3D pancreas asset for the website from BodyParts3D (no dependencies).
//   node tools/build_pancreas_mesh.mjs [dir-with-stl-files]
// Without a directory, the three STL files are downloaded from the public BodyParts3D mirror on GitHub.
// Output: site/models/pancreas.bin (positions Float32 + indices Uint16 per part), site/models/pancreas.json (layout,
// hotspot anchors, schematic islet points, attribution). Re-running gives byte-identical output.
//
// Source data: BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan.
// Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37:D782-5.
// Adaptations made here (so the output is also CC BY-SA 2.1 JP): duplicate vertices merged, coordinates re-centred,
// scaled and rotated into a y-up frame; surfaces smoothed (Taubin, volume-preserving); hotspot anchors and schematic
// islet points added.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site/models');
const MIRROR = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/master/assets/BodyParts3D_data/stl';
const PARTS = [
  { key: 'pancreas', fma: 'FMA7198nsn', name: 'Pancreas' },
  { key: 'duct', fma: 'FMA10419', name: 'Pancreatic duct' },
  { key: 'duodenum', fma: 'FMA7206', name: 'Duodenum' },
];
const MM_PER_UNIT = 50; // 1 scene unit = 50 mm

async function readStl(fma) {
  const dir = process.argv[2];
  if (dir && existsSync(join(dir, `${fma}.stl`))) return readFileSync(join(dir, `${fma}.stl`));
  const r = await fetch(`${MIRROR}/${fma}.stl`);
  if (!r.ok) throw new Error(`download ${fma}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// binary STL -> triangles (positions in mm, BodyParts3D frame: x = patient's left, y = posterior(-) / anterior, z = up)
function parseStl(buf) {
  const n = buf.readUInt32LE(80);
  if (84 + 50 * n !== buf.length) throw new Error('not a binary STL');
  const tris = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + 50 * i;
    const f = (k) => buf.readFloatLE(o + k);
    tris.push({ n: [f(0), f(4), f(8)], v: [[f(12), f(16), f(20)], [f(24), f(28), f(32)], [f(36), f(40), f(44)]] });
  }
  return tris;
}

// BodyParts3D (x, y, z-up) -> scene (x right, y up, z toward the viewer = anterior, which is -y in BodyParts3D)
const toScene = ([x, y, z], c) => [(x - c[0]) / MM_PER_UNIT, (z - c[2]) / MM_PER_UNIT, -(y - c[1]) / MM_PER_UNIT];

// deterministic RNG (mulberry32), so the schematic islets are identical on every build
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;

const raw = {};
for (const p of PARTS) raw[p.key] = parseStl(await readStl(p.fma));

// centre on the pancreas bounding-box centre
const pv = raw.pancreas.flatMap((t) => t.v);
const lo = [0, 1, 2].map((k) => Math.min(...pv.map((v) => v[k])));
const hi = [0, 1, 2].map((k) => Math.max(...pv.map((v) => v[k])));
const centre = lo.map((l, k) => (l + hi[k]) / 2);

// Taubin smoothing (lambda/mu): removes the faceted look of the segmentation without shrinking the shape
function taubin(pos, idx, iters, lambda = 0.5, mu = -0.53) {
  const n = pos.length / 3;
  const nb = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  const step = (f) => {
    const out = pos.slice();
    for (let v = 0; v < n; v++) {
      if (!nb[v].size) continue;
      const m = [0, 0, 0];
      for (const u of nb[v]) { m[0] += pos[3 * u]; m[1] += pos[3 * u + 1]; m[2] += pos[3 * u + 2]; }
      for (let k = 0; k < 3; k++) out[3 * v + k] = pos[3 * v + k] + f * (m[k] / nb[v].size - pos[3 * v + k]);
    }
    for (let k = 0; k < pos.length; k++) pos[k] = Math.fround(out[k]);
  };
  for (let it = 0; it < iters; it++) { step(lambda); step(mu); }
}
const smooth = {};
const chunks = [];
let offset = 0;
const layout = [];
const scenePos = {};
for (const p of PARTS) {
  const map = new Map();
  const pos = [];
  const idx = [];
  for (const t of raw[p.key]) {
    for (const v of t.v) {
      const s = toScene(v, centre).map((x) => Math.fround(x));
      const key = s.join(',');
      let i = map.get(key);
      if (i === undefined) { i = pos.length / 3; map.set(key, i); pos.push(...s); }
      idx.push(i);
    }
  }
  if (pos.length / 3 > 65535) throw new Error(`${p.key}: too many vertices for Uint16 indices`);
  taubin(pos, idx, p.key === 'duct' ? 6 : 12);
  const posArr = new Float32Array(pos);
  smooth[p.key] = { pos: posArr, idx };
  const idxArr = new Uint16Array(idx);
  const posBuf = Buffer.from(posArr.buffer);
  const idxBuf = Buffer.from(idxArr.buffer);
  const pad = Buffer.alloc((4 - (idxBuf.length % 4)) % 4);
  layout.push({ key: p.key, name: p.name, fma: p.fma, vertices: posArr.length / 3, triangles: idxArr.length / 3,
    positionsOffset: offset, indicesOffset: offset + posBuf.length });
  chunks.push(posBuf, idxBuf, pad);
  offset += posBuf.length + idxBuf.length + pad.length;
  scenePos[p.key] = posArr;
}

// hotspot anchors on the front (anterior) surface of the pancreas, by position along its length (x)
const P = scenePos.pancreas;
const verts = [];
for (let i = 0; i < P.length; i += 3) verts.push([P[i], P[i + 1], P[i + 2]]);
const xs = verts.map((v) => v[0]);
const xmin = Math.min(...xs), xmax = Math.max(...xs);
const along = (f) => xmin + f * (xmax - xmin);
function frontAt(f, width = 0.06) {
  const x0 = along(f), w = width * (xmax - xmin);
  const band = verts.filter((v) => Math.abs(v[0] - x0) < w);
  return band.reduce((a, b) => (b[2] > a[2] ? b : a)); // most anterior vertex in the band
}
const D = scenePos.duct;
const dverts = [];
for (let i = 0; i < D.length; i += 3) dverts.push([D[i], D[i + 1], D[i + 2]]);
const ductMid = dverts.reduce((a, b) => (Math.abs(b[0] - along(0.48)) < Math.abs(a[0] - along(0.48)) ? b : a));
const hotspots = [
  { key: 'head', label: 'Head', part: 'Pancreas', at: frontAt(0.1) },
  { key: 'neck', label: 'Neck', part: 'Pancreas', at: frontAt(0.32) },
  { key: 'body', label: 'Body', part: 'Pancreas', at: frontAt(0.7) },
  { key: 'tail', label: 'Tail', part: 'Pancreas', at: frontAt(0.92) },
  { key: 'duct', label: 'Main pancreatic duct', part: 'Pancreatic duct', at: ductMid },
].map((h) => ({ ...h, at: h.at.map(r4) }));

// schematic islets: area-weighted random points on the pancreas surface, pushed slightly outward (NOT anatomical data)
const R = rng(20261119);
const SP = smooth.pancreas;
const tris = [];
for (let i = 0; i < SP.idx.length; i += 3) tris.push({ v: [0, 1, 2].map((k) => [SP.pos[3 * SP.idx[i + k]], SP.pos[3 * SP.idx[i + k] + 1], SP.pos[3 * SP.idx[i + k] + 2]]) });
const triInfo = tris.map((t) => {
  const v = t.v;
  const e1 = v[1].map((x, k) => x - v[0][k]), e2 = v[2].map((x, k) => x - v[0][k]);
  const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const area = Math.hypot(...c) / 2;
  const nrm = c.map((x) => x / (2 * area || 1));
  return { v, area, nrm };
});
const total = triInfo.reduce((s, t) => s + t.area, 0);
const cum = [];
triInfo.reduce((s, t) => { cum.push(s + t.area); return s + t.area; }, 0);
const islets = [];
for (let k = 0; k < 160; k++) {
  const u = R() * total;
  let lo2 = 0, hi2 = cum.length - 1;
  while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (cum[m] < u) lo2 = m + 1; else hi2 = m; }
  const t = triInfo[lo2];
  let a = R(), b = R();
  if (a + b > 1) { a = 1 - a; b = 1 - b; }
  const p = [0, 1, 2].map((d) => t.v[0][d] + a * (t.v[1][d] - t.v[0][d]) + b * (t.v[2][d] - t.v[0][d]) + 0.012 * t.nrm[d]);
  islets.push(p.map(r4));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'pancreas.bin'), Buffer.concat(chunks));
writeFileSync(join(OUT, 'pancreas.json'), JSON.stringify({
  generatedBy: 'tools/build_pancreas_mesh.mjs',
  attribution: 'BodyParts3D, (c) The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan',
  citation: 'Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5. doi:10.1093/nar/gkn613',
  license: 'https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en',
  adaptations: 'duplicate vertices merged; re-centred on the pancreas, scaled (1 unit = 50 mm) and rotated to y-up, anterior toward +z; surfaces smoothed (Taubin); hotspot anchors and schematic islet points added',
  frame: { unitMm: MM_PER_UNIT, centreMm: centre.map(r4), x: 'patient left', y: 'superior', z: 'anterior' },
  parts: layout,
  hotspots,
  islets: { schematic: true, note: 'Illustrative points on the surface, not anatomical data and not to scale', points: islets },
}, null, 1) + '\n');
console.log(`wrote site/models/pancreas.bin (${offset} bytes) and pancreas.json:`, layout.map((l) => `${l.key} ${l.vertices}v/${l.triangles}t`).join(', '));
