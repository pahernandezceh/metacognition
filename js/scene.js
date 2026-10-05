// 3D view: the object of study (a sphere) inside a polyhedron of windows.
//
// Each face is a frame of observation: a glass pane that only shows the part
// of the object behind it. A fragment shader tints every point of the sphere
// with the colour of the window it is seen through (the face whose normal is
// closest), so the windows' regions move over the object as either of them
// rotates. Findings are pinned to the object; rotating it carries one frame's
// findings in front of another frame's window.

import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Vector2, Quaternion, Raycaster,
  SphereGeometry, CylinderGeometry, CircleGeometry, BufferGeometry, Float32BufferAttribute,
  Mesh, Group, ShaderMaterial, MeshBasicMaterial, DoubleSide,
  OrbitControls, CSS2DRenderer, CSS2DObject,
} from '../vendor/three.bundle.js';
import { getSolid } from './geometry.js';
import { PALETTE } from './palette.js';

const MAX_FACES = 20;
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const DEFAULT_EYE = new Vector3(0.5, 0.35, 1).normalize();
const ANIMATION_MS = 850;

const vertexShader = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vViewNormal;
  void main() {
    vLocal = position;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #define MAX_FACES ${MAX_FACES}
  #define PI 3.141592653589793
  uniform vec3 uNormals[MAX_FACES];
  uniform vec3 uTints[MAX_FACES];
  uniform float uActive[MAX_FACES];
  uniform int uCount;
  uniform int uSelA;
  uniform int uSelB;
  uniform int uHover;
  uniform float uPixelRatio;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uShadow;
  uniform vec3 uHatch;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vViewNormal;

  // Anti-aliased iso-line where d == 0, about \`width\` pixels wide.
  float isoLine(float d, float width) {
    float aa = fwidth(d);
    return 1.0 - smoothstep(width * aa, (width + 1.0) * aa, abs(d));
  }

  void main() {
    vec3 p = normalize(vWorld);
    float best = -2.0;
    float second = -2.0;
    int bi = 0;
    int si = 0;
    vec3 tint = uPaper;
    float named = 0.0;
    for (int i = 0; i < MAX_FACES; i++) {
      if (i >= uCount) break;
      float d = dot(p, uNormals[i]);
      if (d > best) {
        second = best; si = bi;
        best = d; bi = i;
        tint = uTints[i]; named = uActive[i];
      } else if (d > second) {
        second = d; si = i;
      }
    }

    // Each window's region of the object, tinted with its frame's colour.
    vec3 col = mix(uPaper, tint, named > 0.5 ? 0.36 : 0.1);
    if (bi == uHover && uSelA < 0) col = mix(col, tint, 0.18);

    // Graticule pinned to the object, so its own rotation is visible.
    vec3 q = normalize(vLocal);
    float grid = 0.0;
    for (int k = 0; k < 6; k++) {
      float a = float(k) * PI / 6.0;
      grid = max(grid, isoLine(dot(q, vec3(cos(a), 0.0, sin(a))), 0.45));
    }
    for (int k = -2; k <= 2; k++) grid = max(grid, isoLine(q.y - sin(float(k) * PI / 6.0), 0.45));
    col = mix(col, uInk, grid * 0.1);

    // Outside the selected window(s) the object is not seen: engraved shadow.
    bool selected = bi == uSelA || bi == uSelB;
    if (uSelA >= 0 && !selected) {
      float hatch = step(mod((gl_FragCoord.x + gl_FragCoord.y) / uPixelRatio, 6.0), 1.1);
      col = mix(mix(uShadow, uHatch, hatch), col, 0.22);
    }

    // Soft headlight so the sphere keeps its volume.
    vec3 vn = normalize(vViewNormal);
    float diffuse = max(dot(vn, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
    col *= 0.76 + 0.32 * diffuse;
    col = mix(col, uInk, pow(1.0 - max(vn.z, 0.0), 3.0) * 0.16);

    // Borders between windows; the one shared by a selected pair is drawn bold.
    float border = isoLine(best - second, 0.6);
    bool sharedEdge = uSelB >= 0 && ((bi == uSelA && si == uSelB) || (bi == uSelB && si == uSelA));
    col = mix(col, uInk, sharedEdge ? isoLine(best - second, 1.8) : border * 0.4);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const color = hex => new Color(hex);
const toArray = q => [q.x, q.y, q.z, q.w];
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class PolyhedronView {
  /**
   * @param {HTMLElement} host element that receives the canvas and labels
   * @param {{onSelect: Function, onHover: Function, onUserRotate: Function, onOrientation: Function}} hooks
   */
  constructor(host, hooks) {
    this.host = host;
    this.hooks = hooks;
    this.solidId = null;
    this.faces = [];
    this.edges = [];
    this.findings = new Map();
    this.selection = null;
    this.hover = null;
    this.dragMode = 'view';
    this.dirty = true;
    this.anim = null;
    this.pointer = null;
    this.pointerMoved = false;

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(color(PALETTE.paper), 1);
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    host.appendChild(this.labels.domElement);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.copy(DEFAULT_EYE).multiplyScalar(8);
    this.scene.add(this.camera);

    // The object of study: rotates on its own and carries the findings.
    this.objectGroup = new Group();
    this.scene.add(this.objectGroup);
    this.uniforms = {
      uNormals: { value: Array.from({ length: MAX_FACES }, () => new Vector3(0, 1, 0)) },
      uTints: { value: Array.from({ length: MAX_FACES }, () => color(PALETTE.paper)) },
      uActive: { value: new Array(MAX_FACES).fill(0) },
      uCount: { value: 0 },
      uSelA: { value: -1 },
      uSelB: { value: -1 },
      uHover: { value: -1 },
      uPixelRatio: { value: this.renderer.getPixelRatio() },
      uPaper: { value: color(PALETTE.paper) },
      uInk: { value: color(PALETTE.ink) },
      uShadow: { value: color(PALETTE.shadow) },
      uHatch: { value: color(PALETTE.hatch) },
    };
    this.sphere = new Mesh(
      new SphereGeometry(1, 160, 120),
      new ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader }),
    );
    this.sphere.userData.target = { type: 'object' };
    this.objectGroup.add(this.sphere);

    // The polyhedron of windows: rotates on its own too.
    this.polyGroup = new Group();
    this.scene.add(this.polyGroup);

    this.geo = {
      edge: new CylinderGeometry(1, 1, 1, 10, 1, true),
      halo: new CircleGeometry(0.056, 28),
      dot: new CircleGeometry(0.041, 28),
      ring: new CircleGeometry(0.074, 32),
      findingHit: new SphereGeometry(0.075, 10, 8),
    };
    this.hitMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.haloMaterial = new MeshBasicMaterial({ color: color(PALETTE.paper) });
    this.ringMaterial = new MeshBasicMaterial({ color: color(PALETTE.ink) });

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.7;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.addEventListener('start', () => this.hooks.onUserRotate?.());

    this.raycaster = new Raycaster();
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ── Building ──────────────────────────────────────────────────────────────

  buildSolid(solidId) {
    for (const child of [...this.polyGroup.children]) {
      this.polyGroup.remove(child);
      if (child.isCSS2DObject) child.element.remove();
      if (child.material && child.material !== this.hitMaterial) child.material.dispose();
      if (child.geometry && !Object.values(this.geo).includes(child.geometry)) child.geometry.dispose();
    }
    const solid = getSolid(solidId);
    this.solidId = solidId;
    this.solid = solid;
    const V = solid.vertices.map(v => new Vector3(...v));

    this.faces = solid.faces.map((face, index) => {
      const pts = face.verts.map(i => V[i]);
      const centre = pts.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / pts.length);
      const positions = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        positions.push(centre.x, centre.y, centre.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const pane = new Mesh(geometry, new MeshBasicMaterial({
        transparent: true, opacity: 0.06, depthWrite: false, side: DoubleSide,
      }));
      pane.userData.target = { type: 'frame', index };
      pane.renderOrder = 2;

      const anchor = document.createElement('div');
      anchor.className = 'face-anchor';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'face-label';
      const swatch = document.createElement('i');
      const num = document.createElement('span');
      num.className = 'face-num';
      num.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'face-name';
      button.append(swatch, num, name);
      button.addEventListener('click', e => {
        e.stopPropagation();
        this.hooks.onSelect({ type: 'frame', index });
      });
      button.addEventListener('pointerenter', e => this.hooks.onHover({ type: 'frame', index }, e.clientX, e.clientY));
      button.addEventListener('pointerleave', () => this.hooks.onHover(null));
      anchor.appendChild(button);
      const label = new CSS2DObject(anchor);
      // Off-centre, towards a corner: the middle of the window belongs to the findings.
      label.position.copy(centre).lerp(pts[0], 0.58);

      this.polyGroup.add(pane, label);
      return { index, normal: new Vector3(...face.normal), centre, pane, label, anchor, button, swatch, name };
    });

    this.edges = solid.edges.map(({ a, b, verts }) => {
      const pa = V[verts[0]];
      const pb = V[verts[1]];
      const dir = pb.clone().sub(pa);
      const length = dir.length();
      const q = new Quaternion().setFromUnitVectors(Y_AXIS, dir.normalize());
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const line = new Mesh(this.geo.edge, new MeshBasicMaterial({ transparent: true }));
      const hit = new Mesh(this.geo.edge, this.hitMaterial);
      for (const m of [line, hit]) { m.position.copy(mid); m.quaternion.copy(q); }
      hit.scale.set(0.055, length, 0.055);
      hit.userData.target = { type: 'edge', a, b };
      this.polyGroup.add(line, hit);
      return { a, b, line, hit, length, mid };
    });

    this.uniforms.uCount.value = this.faces.length;
    this.syncNormals();
    this.fit();
  }

  /** World-space face normals for the shader (the polyhedron may be rotated). */
  syncNormals() {
    this.faces.forEach((f, i) => {
      this.uniforms.uNormals.value[i].copy(f.normal).applyQuaternion(this.polyGroup.quaternion);
    });
  }

  /** Creates, updates and removes finding markers to match `findings`. */
  syncFindings(findings) {
    const keep = new Set(findings.map(f => f.id));
    for (const [id, m] of this.findings) {
      if (keep.has(id)) continue;
      this.objectGroup.remove(m.group, m.hit, m.label);
      m.label.element.remove();
      m.dot.material.dispose();
      this.findings.delete(id);
    }
    for (const f of findings) {
      let m = this.findings.get(f.id);
      if (!m) {
        const group = new Group();
        const ring = new Mesh(this.geo.ring, this.ringMaterial);
        const halo = new Mesh(this.geo.halo, this.haloMaterial);
        const dot = new Mesh(this.geo.dot, new MeshBasicMaterial());
        ring.position.z = 0.001;
        halo.position.z = 0.002;
        dot.position.z = 0.003;
        group.add(ring, halo, dot);
        const hit = new Mesh(this.geo.findingHit, this.hitMaterial);
        hit.userData.target = { type: 'finding', id: f.id };

        const anchor = document.createElement('div');
        anchor.className = 'finding-anchor';
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'finding-chip';
        chip.addEventListener('click', e => {
          e.stopPropagation();
          this.hooks.onSelect({ type: 'finding', id: f.id });
        });
        chip.addEventListener('pointerenter', e => this.hooks.onHover({ type: 'finding', id: f.id }, e.clientX, e.clientY));
        chip.addEventListener('pointerleave', () => this.hooks.onHover(null));
        anchor.appendChild(chip);
        const label = new CSS2DObject(anchor);
        this.objectGroup.add(group, hit, label);
        m = { group, ring, dot, hit, label, anchor, chip };
        this.findings.set(f.id, m);
      }
      const pos = new Vector3(...f.pos).normalize();
      m.pos = pos;
      m.group.position.copy(pos).multiplyScalar(1.004);
      m.group.quaternion.setFromUnitVectors(Z_AXIS, pos);
      m.hit.position.copy(pos);
      m.label.position.copy(pos);
      m.dot.material.color.set(f.color);
      m.ring.visible = f.selected;
      const key = `${f.color}|${f.label}|${f.rereadColors.join()}|${f.selected}`;
      if (m.key !== key) {
        m.key = key;
        const sw = document.createElement('i');
        sw.style.background = f.color;
        const text = document.createElement('span');
        text.textContent = f.label;
        const dots = document.createElement('b');
        for (const c of f.rereadColors) {
          const d = document.createElement('i');
          d.style.background = c;
          dots.append(d);
        }
        m.chip.replaceChildren(sw, text, dots);
        m.chip.classList.toggle('is-selected', f.selected);
        m.chip.setAttribute('aria-label', f.aria);
      }
    }
  }

  // ── State → view ─────────────────────────────────────────────────────────

  /**
   * @param {{solid: string, frames: {label: string, color: string, active: boolean, principal: boolean}[],
   *          findings: {id: string, pos: number[], color: string, label: string, aria: string,
   *                     rereadColors: string[], selected: boolean}[],
   *          edgeNotes: Set<string>, selection: object|null}} view
   *   `edgeNotes` holds "a-b" face pairs whose edge has notes.
   */
  update(view) {
    if (view.solid !== this.solidId) this.buildSolid(view.solid);
    this.selection = view.selection;
    this.frames = view.frames;
    const sel = view.selection;
    const u = this.uniforms;
    u.uSelA.value = sel?.type === 'frame' ? sel.index : sel?.type === 'edge' ? sel.a : -1;
    u.uSelB.value = sel?.type === 'edge' ? sel.b : -1;
    view.frames.forEach((f, i) => {
      u.uTints.value[i].set(f.color);
      u.uActive.value[i] = f.active ? 1 : 0;
      const face = this.faces[i];
      face.color = f.color;
      face.name.textContent = f.label;
      face.swatch.style.background = f.color;
      face.button.classList.toggle('is-vacant', !f.active);
      face.button.classList.toggle('is-principal', f.principal);
      face.button.setAttribute('aria-pressed', String(sel?.type === 'frame' && sel.index === i));
    });
    this.edgeNotes = view.edgeNotes;
    this.syncFindings(view.findings);
    this.stylePanes();
    this.dirty = true;
  }

  stylePanes() {
    const sel = this.selection;
    const hov = this.hover;
    this.faces.forEach((f, i) => {
      const m = f.pane.material;
      const selected = sel?.type === 'frame' && sel.index === i;
      const inEdge = sel?.type === 'edge' && (sel.a === i || sel.b === i);
      const hovered = hov?.type === 'frame' && hov.index === i;
      if (sel?.type === 'frame') {
        // Looking through one window: the others frost over.
        m.color.set(selected ? f.color || PALETTE.paper : PALETTE.paper);
        m.opacity = selected ? 0.03 : hovered ? 0.4 : 0.55;
      } else {
        m.color.set(f.color || PALETTE.paper);
        m.opacity = inEdge ? 0.16 : hovered ? 0.15 : 0.06;
      }
      f.anchor.classList.toggle('is-current', selected);
    });
    for (const e of this.edges) {
      const isSel = sel?.type === 'edge' && sel.a === e.a && sel.b === e.b;
      const isHov = hov?.type === 'edge' && hov.a === e.a && hov.b === e.b;
      const ofFrame = sel?.type === 'frame' && (sel.index === e.a || sel.index === e.b);
      const noted = this.edgeNotes?.has(`${e.a}-${e.b}`);
      const m = e.line.material;
      m.color.set(isSel || isHov || noted ? PALETTE.accent : PALETTE.ink);
      m.opacity = isSel || isHov ? 1 : noted ? 0.8 : ofFrame ? 0.75 : 0.45;
      const r = isSel ? 0.02 : isHov ? 0.016 : noted ? 0.012 : 0.008;
      e.line.scale.set(r, e.length, r);
    }
    this.uniforms.uHover.value = hov?.type === 'frame' ? hov.index : -1;
    for (const [id, m] of this.findings) {
      m.chip.classList.toggle('is-hover', hov?.type === 'finding' && hov.id === id);
    }
    this.dirty = true;
  }

  setHover(target) {
    this.hover = target;
    this.stylePanes();
  }

  // ── Rotation ─────────────────────────────────────────────────────────────

  setDragMode(mode) {
    this.dragMode = mode;
    this.controls.enableRotate = mode === 'view';
    this.renderer.domElement.dataset.drag = mode;
  }

  getOrientation() {
    return { object: toArray(this.objectGroup.quaternion), poly: toArray(this.polyGroup.quaternion) };
  }

  setOrientation({ object, poly }) {
    this.objectGroup.quaternion.set(...object);
    this.polyGroup.quaternion.set(...poly);
    this.syncNormals();
    this.dirty = true;
  }

  /**
   * Smoothly turns the object and/or polyhedron and points the camera along `look`
   * (a world direction), e.g. to look through a window or at a finding.
   */
  animate({ object, poly, look }, done) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = {
      object: this.objectGroup.quaternion.clone(),
      poly: this.polyGroup.quaternion.clone(),
      cam: this.camera.position.clone(),
    };
    const to = {
      object: object ? new Quaternion(...object) : from.object,
      poly: poly ? new Quaternion(...poly) : from.poly,
    };
    let camTurn = null;
    if (look) {
      const target = new Vector3(...look).normalize();
      camTurn = new Quaternion().setFromUnitVectors(from.cam.clone().normalize(), target);
    }
    this.anim = { t0: performance.now(), dur: reduce ? 0 : ANIMATION_MS, from, to, camTurn, done };
    this.controls.enabled = false;
  }

  stepAnimation(now) {
    const a = this.anim;
    const t = a.dur ? Math.min(1, (now - a.t0) / a.dur) : 1;
    const k = ease(t);
    this.objectGroup.quaternion.slerpQuaternions(a.from.object, a.to.object, k);
    this.polyGroup.quaternion.slerpQuaternions(a.from.poly, a.to.poly, k);
    this.syncNormals();
    if (a.camTurn) {
      const q = new Quaternion().slerp(a.camTurn, k);
      this.camera.position.copy(a.from.cam).applyQuaternion(q);
      this.camera.lookAt(0, 0, 0);
    }
    this.dirty = true;
    if (t >= 1) {
      this.anim = null;
      this.controls.enabled = true;
      this.controls.update();
      this.hooks.onOrientation?.(this.getOrientation());
      a.done?.();
    }
  }

  resetView() {
    this.camera.position.copy(DEFAULT_EYE);
    this.fit();
    this.dirty = true;
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  /** Keeps the whole polyhedron in the free area of the stage (labels and overlays aside). */
  fit() {
    const w = this.host.clientWidth || 800;
    const h = this.host.clientHeight || 600;
    const compact = w < 700;
    const sidePx = compact ? w * 0.09 : Math.min(110, w * 0.16);
    const usable = Math.max(Math.min(w - 2 * sidePx, h - (compact ? 70 : 190)), Math.min(w, h) * 0.5);
    const radius = (this.solid?.circumradius || 2) + 0.06;
    const k = (usable / h) * Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = radius * Math.sqrt(1 + 1 / (k * k));
    const dir = this.camera.position.clone().normalize();
    this.camera.position.copy(dir.lengthSq() ? dir : DEFAULT_EYE).multiplyScalar(dist);
    this.controls.minDistance = radius + 0.5;
    this.controls.maxDistance = dist * 2.5;
    this.controls.update();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    this.fit();
    this.dirty = true;
  }

  // ── Pointer: picking and dragging ────────────────────────────────────────

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointermove', e => {
      this.pointer = { x: e.clientX, y: e.clientY };
      this.pointerMoved = true;
      if (!down || this.dragMode === 'view' || this.anim) return;
      const dx = e.clientX - down.last.x;
      const dy = e.clientY - down.last.y;
      down.last = { x: e.clientX, y: e.clientY };
      if (!dx && !dy) return;
      // Trackball: drag direction on screen → rotation axis in world space.
      const axis = new Vector3(dy, dx, 0).normalize().applyQuaternion(this.camera.quaternion);
      const q = new Quaternion().setFromAxisAngle(axis, Math.hypot(dx, dy) * 0.008);
      const group = this.dragMode === 'object' ? this.objectGroup : this.polyGroup;
      group.quaternion.premultiply(q).normalize();
      if (this.dragMode === 'poly') this.syncNormals();
      down.rotated = true;
      this.dirty = true;
    });
    el.addEventListener('pointerleave', () => {
      this.pointer = null;
      if (this.hover) {
        this.setHover(null);
        this.hooks.onHover(null);
      }
    });
    el.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, last: { x: e.clientX, y: e.clientY }, rotated: false };
      if (this.dragMode !== 'view') {
        el.setPointerCapture(e.pointerId);
        this.hooks.onUserRotate?.();
      }
    });
    const finish = e => {
      if (!down) return;
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6;
      const rotated = down.rotated;
      down = null;
      if (rotated) this.hooks.onOrientation?.(this.getOrientation());
      if (click) this.hooks.onSelect(this.pick(e.clientX, e.clientY));
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', () => { down = null; });
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const sphereHit = this.raycaster.intersectObject(this.sphere, false)[0];
    const limit = sphereHit ? sphereHit.distance + 0.08 : Infinity;
    const nearest = list => this.raycaster.intersectObjects(list, false).find(h => h.distance < limit);
    const finding = nearest([...this.findings.values()].map(m => m.hit));
    if (finding) return finding.object.userData.target;
    const edge = nearest(this.edges.map(e => e.hit));
    if (edge) return edge.object.userData.target;
    const pane = this.raycaster.intersectObjects(this.faces.map(f => f.pane), false)[0];
    if (pane) return pane.object.userData.target;
    return sphereHit ? sphereHit.object.userData.target : null;
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.anim) this.stepAnimation(now);
    const moved = this.anim ? false : this.controls.update();
    if (this.pointerMoved && this.pointer && !this.anim) {
      this.pointerMoved = false;
      const target = this.pick(this.pointer.x, this.pointer.y);
      if (JSON.stringify(target) !== JSON.stringify(this.hover)) this.setHover(target?.type === 'object' ? null : target);
      const el = this.renderer.domElement;
      el.style.cursor = this.dragMode !== 'view' ? 'grab' : target && target.type !== 'object' ? 'pointer' : 'grab';
      this.hooks.onHover(target, this.pointer.x, this.pointer.y);
    }
    if (moved || this.dirty) {
      this.dirty = false;
      this.render();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.updateLabelVisibility();
  }

  /** Hides finding chips on the far side, dims labels of faces turned away. */
  updateLabelVisibility() {
    const cam = this.camera.position;
    const sel = this.selection;
    const w = new Vector3();
    for (const f of this.faces) {
      w.copy(f.normal).applyQuaternion(this.polyGroup.quaternion);
      const centre = f.centre.clone().applyQuaternion(this.polyGroup.quaternion);
      f.anchor.classList.toggle('is-behind', w.dot(cam.clone().sub(centre)) < 0);
    }
    for (const m of this.findings.values()) {
      w.copy(m.pos).applyQuaternion(this.objectGroup.quaternion);
      const facing = w.dot(cam.clone().sub(w).normalize());
      m.anchor.classList.toggle('is-hidden', facing < 0.08);
      let dim = false;
      if (sel?.type === 'frame' || sel?.type === 'edge') {
        const win = this.windowOf(w);
        dim = sel.type === 'frame' ? win !== sel.index : win !== sel.a && win !== sel.b;
      }
      m.anchor.classList.toggle('is-dim', dim);
      m.group.visible = facing > -0.2;
    }
  }

  windowOf(worldDir) {
    let best = -1;
    let max = -Infinity;
    this.uniforms.uNormals.value.slice(0, this.faces.length).forEach((n, i) => {
      const d = n.dot(worldDir);
      if (d > max) { max = d; best = i; }
    });
    return best;
  }

  /** Screen positions (CSS px) of visible labels, for compositing exports. */
  projectedLabels() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const project = obj => {
      const v = obj.getWorldPosition(new Vector3()).project(this.camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    };
    const faces = this.faces
      .filter(f => !f.anchor.classList.contains('is-behind') && !f.anchor.classList.contains('is-current'))
      .map(f => ({ ...project(f.label), text: f.name.textContent, num: f.index + 1, color: f.color }));
    const findings = [...this.findings.values()]
      .filter(m => !m.anchor.classList.contains('is-hidden'))
      .map(m => ({ ...project(m.label), text: m.chip.textContent, dim: m.anchor.classList.contains('is-dim') }));
    return { faces, findings };
  }

  /** Renders a frame and returns the WebGL canvas (valid until the next frame). */
  capture() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }
}
