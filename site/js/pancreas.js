// pancreas.js — 3D pancreas viewer (three.js, loaded on demand). Presentation only; no model calculations here.
// Anatomy: BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 Japan (see models/LICENSE-BodyParts3D.txt).
// The islet points are SCHEMATIC (illustrative, not anatomical data, not to scale).

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = () => window.matchMedia('(pointer: coarse)').matches;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

let assetPromise = null;
function loadAsset(base) {
  if (!assetPromise) {
    assetPromise = Promise.all([
      fetch(new URL('models/pancreas.json', base)).then((r) => { if (!r.ok) throw new Error(`pancreas.json HTTP ${r.status}`); return r.json(); }),
      fetch(new URL('models/pancreas.bin', base)).then((r) => { if (!r.ok) throw new Error(`pancreas.bin HTTP ${r.status}`); return r.arrayBuffer(); }),
    ]);
  }
  return assetPromise;
}
let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')])
      .then(([THREE, oc]) => ({ THREE, OrbitControls: oc.OrbitControls }));
  }
  return threePromise;
}

/**
 * Create a viewer inside `stage` (a positioned element). mode: 'hero' (no tools, gentle) or 'full' (tools + hotspots).
 * Returns a promise of an API: { setActivity(u01), setTool(name, on), zoom(f), reset(), select(key), dispose() }.
 */
export async function createPancreasViewer(stage, { mode = 'full', base = document.baseURI, onSelect, onLowPower } = {}) {
  if (!webglAvailable()) {
    stage.dataset.fallback = 'true';
    stage.insertAdjacentHTML('beforeend', '<p class="viewer-fallback">The 3D view needs WebGL, which this browser has turned off. The rest of the page works without it.</p>');
    return null;
  }
  const [{ THREE, OrbitControls }, [meta, bin]] = await Promise.all([loadThree(), loadAsset(base)]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.domElement.className = 'viewer-canvas';
  // Low-power mode: software WebGL (e.g. SwiftShader in headless test browsers) or slow first frames. The model then
  // stops animating and renders a frame only when something changes, so the page stays responsive.
  let lowPower = false;
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    lowPower = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { /* keep the default */ }
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  // hero: aim below the organ so it sits high in the frame, clear of the glucose card at the bottom
  const TARGET = mode === 'hero' ? new THREE.Vector3(0.15, -0.42, 0) : new THREE.Vector3(0, 0, 0);
  const HOME = mode === 'hero' ? new THREE.Vector3(0.45, 0.2, 5.2) : new THREE.Vector3(0.6, 0.7, 5.6);
  camera.position.copy(HOME);

  scene.add(new THREE.HemisphereLight(0xf2f4ee, 0x2a302c, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd6c4, 1.4); rim.position.set(-3, 1.5, -3); scene.add(rim);

  // geometry from the binary asset
  const geo = {};
  for (const p of meta.parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, p.positionsOffset, p.vertices * 3), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin, p.indicesOffset, p.triangles * 3), 1));
    g.computeVertexNormals();
    geo[p.key] = g;
  }
  // per-vertex colour on the pancreas so a selected region (head/neck/body/tail) can be tinted
  const pv = geo.pancreas.attributes.position;
  const colors = new Float32Array(pv.count * 3).fill(1);
  geo.pancreas.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  let xmin = Infinity, xmax = -Infinity;
  for (let i = 0; i < pv.count; i++) { const x = pv.getX(i); if (x < xmin) xmin = x; if (x > xmax) xmax = x; }

  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.04); // removes the front half when the cross-section is on
  const mats = {
    pancreas: new THREE.MeshStandardMaterial({ color: 0xd9ab8f, roughness: 0.62, metalness: 0.0, vertexColors: true, side: THREE.DoubleSide }),
    duct: new THREE.MeshStandardMaterial({ color: 0xe9cf7a, roughness: 0.4, emissive: 0x3a2c08, emissiveIntensity: 0.6 }),
    duodenum: new THREE.MeshStandardMaterial({ color: 0xc79a86, roughness: 0.7, transparent: true, opacity: 0.38, depthWrite: false }),
  };
  const meshes = {};
  for (const k of ['pancreas', 'duct', 'duodenum']) { meshes[k] = new THREE.Mesh(geo[k], mats[k]); scene.add(meshes[k]); }
  meshes.duodenum.visible = false;
  meshes.duct.visible = mode === 'full';
  meshes.duct.renderOrder = 2;

  // schematic islets: soft round points whose glow follows the insulin rate
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ip = new THREE.BufferGeometry();
  ip.setAttribute('position', new THREE.Float32BufferAttribute(meta.islets.points.flat(), 3));
  const isletMat = new THREE.PointsMaterial({ color: 0xf6e7a8, map: sprite, size: 0.075, sizeAttenuation: true, transparent: true,
    opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const islets = new THREE.Points(ip, isletMat);
  scene.add(islets);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !lowPower; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.enableZoom = false; // the wheel keeps scrolling the page; zoom has its own buttons
  controls.minDistance = 2.2; controls.maxDistance = 9;
  controls.autoRotate = !REDUCED() && !lowPower; controls.autoRotateSpeed = mode === 'hero' ? 0.6 : 0.9;
  controls.target.copy(TARGET);
  if (mode === 'hero' && COARSE()) { controls.enabled = false; renderer.domElement.style.touchAction = 'pan-y'; } // phones: don't trap page scrolling

  // state
  const state = { wireframe: false, section: false, isolate: false, context: false, selected: null, activity: 0.5 };
  const applyState = () => {
    mats.pancreas.wireframe = state.wireframe;
    mats.pancreas.clippingPlanes = state.section ? [clip] : [];
    mats.pancreas.transparent = state.isolate; mats.pancreas.opacity = state.isolate ? 0.14 : 1; mats.pancreas.depthWrite = !state.isolate;
    meshes.duct.visible = mode === 'full' || state.isolate || state.section;
    meshes.duodenum.visible = state.context;
    islets.visible = !state.isolate;
    mats.pancreas.needsUpdate = true;
  };
  const tint = (key) => {
    const bands = { head: [0, 0.22], neck: [0.22, 0.42], body: [0.42, 0.75], tail: [0.75, 1.01] };
    const b = bands[key];
    for (let i = 0; i < pv.count; i++) {
      const f = (pv.getX(i) - xmin) / (xmax - xmin);
      const on = b && f >= b[0] && f < b[1];
      colors[i * 3] = on ? 0.78 : 1; colors[i * 3 + 1] = on ? 1.08 : 1; colors[i * 3 + 2] = on ? 0.78 : 1;
    }
    geo.pancreas.attributes.color.needsUpdate = true;
  };

  // hotspots (full mode): HTML buttons that follow their 3D anchor
  const hotspotEls = [];
  if (mode === 'full') {
    for (const h of meta.hotspots) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hotspot'; b.dataset.key = h.key;
      b.innerHTML = `<span class="hs-dot" aria-hidden="true"></span><span class="hs-label">${h.label}</span>`;
      b.setAttribute('aria-label', `${h.label} (${h.part})`);
      b.addEventListener('click', () => api.select(state.selected === h.key ? null : h.key));
      stage.appendChild(b);
      hotspotEls.push({ el: b, v: new THREE.Vector3(...h.at), key: h.key });
    }
  }

  // sizing and a render loop that runs only while the stage is on screen
  let w = 0, h = 0;
  const resize = () => {
    const r = stage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole organ in frame on narrow (portrait) stages: widen the view instead of cropping
    camera.zoom = Math.min(1, camera.aspect / (mode === 'hero' ? 1.15 : 1.3));
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(stage);
  let visible = false, raf = 0, frames = 0, slow = 0, lastT = 0;
  const goLowPower = () => {
    if (lowPower) return;
    lowPower = true; controls.autoRotate = false; controls.enableDamping = false;
    stage.dataset.lowpower = 'true';
    if (onLowPower) onLowPower();
  };
  if (lowPower) stage.dataset.lowpower = 'true';
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden || !stage.offsetParent) return;
    resize();
    const moving = controls.update();
    // adaptive: if the first frames are slow, switch to on-demand rendering
    if (!lowPower && lastT) { frames++; if (now - lastT > 45) slow++; if (frames === 24 && slow > 12) goLowPower(); }
    lastT = now;
    const a = state.activity;
    isletMat.size = 0.05 + 0.09 * a; isletMat.opacity = 0.25 + 0.75 * a;
    renderer.render(scene, camera);
    for (const hs of hotspotEls) {
      tmp.copy(hs.v).project(camera);
      // on the far side of the organ when the anchor points away from the camera (relative to the organ's centre)
      const facing = tmp2.copy(hs.v).sub(controls.target).dot(tmp3.copy(camera.position).sub(controls.target)) > -0.05;
      hs.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px)${hs.key === 'head' ? ' translateX(calc(-100% + 18px))' : ''}`;
      // the duct is internal: its label shows only when the duct is exposed (isolate or cross-section)
      const hidden = !facing || (hs.key === 'duct' && !(state.isolate || state.section));
      hs.el.classList.toggle('behind', hidden);
    }
    if (!stage.dataset.ready) stage.dataset.ready = 'true';
    if (lowPower && !moving) { lastT = 0; return; } // on demand: stop until the next change
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }, { threshold: 0.01 });
  io.observe(stage);
  document.addEventListener('visibilitychange', kick);
  controls.addEventListener('change', kick);

  const api = {
    setActivity(u01) { state.activity = Math.max(0, Math.min(1, u01)); if (REDUCED() && !lowPower) kick(); },
    setTool(name, on) {
      if (name === 'rotate') controls.autoRotate = on; // in low-power mode this still works, at the cost of continuous frames
      else if (name in state) { state[name] = on; applyState(); }
      kick();
    },
    zoom(f) {
      const d = Math.min(controls.maxDistance, Math.max(controls.minDistance, camera.position.distanceTo(controls.target) * f));
      camera.position.sub(controls.target).setLength(d).add(controls.target); controls.update(); kick();
    },
    reset() {
      camera.position.copy(HOME); controls.target.copy(TARGET);
      Object.assign(state, { wireframe: false, section: false, isolate: false, context: false });
      controls.autoRotate = !REDUCED() && !lowPower; applyState(); api.select(null); controls.update(); kick();
    },
    select(key) {
      state.selected = key;
      tint(key);
      if (key === 'duct') { state.isolate = true; applyState(); }
      for (const hs of hotspotEls) hs.el.classList.toggle('active', hs.key === key);
      if (onSelect) onSelect(key);
      kick();
    },
    get rotating() { return controls.autoRotate; },
    get lowPower() { return lowPower; },
    dispose() { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); renderer.dispose(); },
  };
  applyState();
  resize();
  kick();
  return api;
}
