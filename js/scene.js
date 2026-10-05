// 3D view: the object (sphere), the polyhedron of frames, light and shadow.
//
// The sphere is shaded by a fragment shader that, for every point of its
// surface, counts how many active frames can see it (dot(n, v) >= 1/d).
// That single test drives the three readings of the view:
//   - coverage: how many frames see each zone (0 = collective blind spot)
//   - one frame: what it sees vs. its blind spot
//   - one edge: what both neighbours see (their dialogue zone)

import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Vector2, Quaternion, Raycaster,
  SphereGeometry, CylinderGeometry, ConeGeometry, Mesh, Group, ShaderMaterial,
  MeshBasicMaterial, MeshStandardMaterial, AmbientLight, DirectionalLight, DoubleSide,
  OrbitControls, CSS2DRenderer, CSS2DObject,
} from '../vendor/three.bundle.js';
import { getSolid, capCos } from './geometry.js';

const MAX_FRAMES = 20;
const Y_AXIS = new Vector3(0, 1, 0);
const DEFAULT_EYE = new Vector3(0.5, 0.35, 1).normalize();

export const PALETTE = {
  paper: '#f5f2ec',
  ink: '#1f1b17',
  accent: '#c84b2f',
  shadow: '#4f4740',
  hatch: '#5f564d',
  lit: '#f6e5d6',
  neutral: '#e4ddd0',
  ramp: ['#f1eadc', '#ebc4b0', '#dd937a', '#c84b2f'],
  vacant: '#b5aa98',
};

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vViewNormal;
  void main() {
    vPos = position;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #define MAX_FRAMES ${MAX_FRAMES}
  uniform vec3 uDirs[MAX_FRAMES];
  uniform float uActive[MAX_FRAMES];
  uniform int uCount;
  uniform float uCos;
  uniform int uMode;
  uniform int uSelA;
  uniform int uSelB;
  uniform int uHover;
  uniform int uPrincipal;
  uniform float uPixelRatio;
  uniform vec3 uRamp[4];
  uniform vec3 uShadow;
  uniform vec3 uHatch;
  uniform vec3 uLit;
  uniform vec3 uNeutral;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  varying vec3 vPos;
  varying vec3 vViewNormal;

  // Anti-aliased iso-line where d == 0, about \`width\` pixels wide.
  float isoLine(float d, float width) {
    float aa = fwidth(d);
    return 1.0 - smoothstep(width * aa, (width + 1.0) * aa, abs(d));
  }

  vec3 rampColor(int c) {
    if (c <= 1) return uRamp[0];
    if (c == 2) return uRamp[1];
    if (c == 3) return uRamp[2];
    return uRamp[3];
  }

  void main() {
    vec3 n = normalize(vPos);
    int count = 0;
    float activeSum = 0.0;
    float inA = 0.0;
    float inB = 0.0;
    float rings = 0.0;
    float principalRing = 0.0;
    float accentRing = 0.0;
    for (int i = 0; i < MAX_FRAMES; i++) {
      if (i >= uCount) break;
      float d = dot(n, uDirs[i]) - uCos;
      float inside = step(0.0, d);
      if (uActive[i] > 0.5 && inside > 0.5) count++;
      activeSum += uActive[i];
      if (i == uSelA) inA = inside;
      if (i == uSelB) inB = inside;
      rings = max(rings, isoLine(d, 0.6) * (uActive[i] > 0.5 ? 1.0 : 0.35));
      if (i == uPrincipal) principalRing = max(principalRing, isoLine(d, 1.6));
      if (i == uSelA || i == uSelB || i == uHover) accentRing = max(accentRing, isoLine(d, 1.6));
    }

    // Engraving-like hatch for the blind spot, constant in CSS pixels.
    float hatch = step(mod((gl_FragCoord.x + gl_FragCoord.y) / uPixelRatio, 6.0), 1.1);
    vec3 shadow = mix(uShadow, uHatch, hatch);

    vec3 col;
    if (uMode == 1) {
      col = inA > 0.5 ? uLit : shadow;
    } else if (uMode == 2) {
      col = inA > 0.5 && inB > 0.5 ? uRamp[2] : (inA > 0.5 || inB > 0.5 ? uRamp[0] : shadow);
    } else if (activeSum < 0.5) {
      col = uNeutral;
    } else {
      col = count == 0 ? shadow : rampColor(count);
    }

    // Soft headlight so the sphere keeps its volume.
    vec3 vn = normalize(vViewNormal);
    float diffuse = max(dot(vn, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
    col *= 0.74 + 0.36 * diffuse;
    col = mix(col, uInk, pow(1.0 - max(vn.z, 0.0), 3.0) * 0.18);

    col = mix(col, uInk, rings * (uMode == 0 ? 0.3 : 0.14));
    if (uMode == 0) col = mix(col, uInk, principalRing * 0.8);
    col = mix(col, uAccent, accentRing);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const color = hex => new Color(hex);

export class PolyhedronView {
  /**
   * @param {HTMLElement} host element that receives the canvas and labels
   * @param {{onSelect: Function, onHover: Function, onUserRotate: Function, labelText: Function}} hooks
   */
  constructor(host, hooks) {
    this.host = host;
    this.hooks = hooks;
    this.distance = 1.6;
    this.solidId = null;
    this.frames = [];
    this.edges = [];
    this.selection = null;
    this.hover = null;
    this.principal = -1;
    this.dirty = true;
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

    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(-2, 3, 4);
    this.camera.add(sun);
    this.scene.add(this.camera);

    this.uniforms = {
      uDirs: { value: Array.from({ length: MAX_FRAMES }, () => new Vector3()) },
      uActive: { value: new Array(MAX_FRAMES).fill(0) },
      uCount: { value: 0 },
      uCos: { value: capCos(this.distance) },
      uMode: { value: 0 },
      uSelA: { value: -1 },
      uSelB: { value: -1 },
      uHover: { value: -1 },
      uPrincipal: { value: -1 },
      uPixelRatio: { value: this.renderer.getPixelRatio() },
      uRamp: { value: PALETTE.ramp.map(color) },
      uShadow: { value: color(PALETTE.shadow) },
      uHatch: { value: color(PALETTE.hatch) },
      uLit: { value: color(PALETTE.lit) },
      uNeutral: { value: color(PALETTE.neutral) },
      uInk: { value: color(PALETTE.ink) },
      uAccent: { value: color(PALETTE.accent) },
    };
    this.sphere = new Mesh(
      new SphereGeometry(1, 160, 120),
      new ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader }),
    );
    this.sphere.userData.target = { type: 'object' };
    this.scene.add(this.sphere);

    this.solidGroup = new Group();
    this.scene.add(this.solidGroup);

    // Shared geometries and materials.
    this.geo = {
      marker: new SphereGeometry(0.055, 28, 18),
      markerHit: new SphereGeometry(0.15, 12, 8),
      edge: new CylinderGeometry(1, 1, 1, 12, 1, true),
      cone: new ConeGeometry(1, 1, 64, 1, true),
    };
    this.hitMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.cones = [0, 1].map(() => {
      const cone = new Mesh(
        this.geo.cone,
        new MeshBasicMaterial({
          color: color(PALETTE.accent), transparent: true, opacity: 0.1,
          side: DoubleSide, depthWrite: false,
        }),
      );
      cone.visible = false;
      this.scene.add(cone);
      return cone;
    });

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
    for (const child of [...this.solidGroup.children]) {
      this.solidGroup.remove(child);
      if (child.isCSS2DObject) child.element.remove();
      if (child.material && child.material !== this.hitMaterial) child.material.dispose();
    }
    const { vertices, edges } = getSolid(solidId);
    this.solidId = solidId;
    this.dirs = vertices.map(v => new Vector3(...v));

    this.frames = this.dirs.map((dir, index) => {
      const marker = new Mesh(this.geo.marker, new MeshStandardMaterial({ roughness: 0.55, metalness: 0 }));
      const hit = new Mesh(this.geo.markerHit, this.hitMaterial);
      hit.userData.target = { type: 'frame', index };

      const anchor = document.createElement('div');
      anchor.className = 'v-anchor';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v-label';
      const num = document.createElement('span');
      num.className = 'v-label-num';
      num.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'v-label-name';
      button.append(num, name);
      button.addEventListener('click', e => {
        e.stopPropagation();
        this.hooks.onSelect({ type: 'frame', index });
      });
      button.addEventListener('pointerenter', e => this.hooks.onHover({ type: 'frame', index }, e.clientX, e.clientY));
      button.addEventListener('pointerleave', () => this.hooks.onHover(null));
      anchor.appendChild(button);
      const label = new CSS2DObject(anchor);

      this.solidGroup.add(marker, hit, label);
      return { dir, marker, hit, label, anchor, button, name };
    });

    this.edges = edges.map(([a, b]) => {
      const line = new Mesh(this.geo.edge, new MeshBasicMaterial({ transparent: true }));
      const hit = new Mesh(this.geo.edge, this.hitMaterial);
      hit.userData.target = { type: 'edge', a, b };
      this.solidGroup.add(line, hit);
      return { a, b, line, hit };
    });

    for (let i = 0; i < MAX_FRAMES; i++) {
      this.uniforms.uDirs.value[i].copy(this.dirs[i] || Y_AXIS);
    }
    this.uniforms.uCount.value = this.dirs.length;
    this.layout();
  }

  /** Places markers, edges and labels for the current distance. */
  layout() {
    const d = this.distance;
    for (const f of this.frames) {
      f.marker.position.copy(f.dir).multiplyScalar(d);
      f.hit.position.copy(f.marker.position);
      f.label.position.copy(f.marker.position);
    }
    const pa = new Vector3();
    const pb = new Vector3();
    for (const e of this.edges) {
      pa.copy(this.dirs[e.a]).multiplyScalar(d);
      pb.copy(this.dirs[e.b]).multiplyScalar(d);
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const dir = pb.clone().sub(pa);
      const len = dir.length();
      const q = new Quaternion().setFromUnitVectors(Y_AXIS, dir.normalize());
      for (const mesh of [e.line, e.hit]) {
        mesh.position.copy(mid);
        mesh.quaternion.copy(q);
      }
      e.length = len;
      e.hit.scale.set(0.06, len, 0.06);
    }
    this.uniforms.uCos.value = capCos(d);
    this.fit();
    this.dirty = true;
  }

  // ── State → view ─────────────────────────────────────────────────────────

  /**
   * @param {{solid: string, distance: number, frames: {active: boolean, principal: boolean}[],
   *          dialogues: Set<string>, selection: object|null}} view
   *   `dialogues` holds "a-b" vertex pairs whose edge has notes.
   */
  update(view) {
    if (view.solid !== this.solidId) this.buildSolid(view.solid);
    if (view.distance !== this.distance) {
      this.distance = view.distance;
      this.layout();
    }
    this.selection = view.selection;
    this.principal = view.frames.findIndex(f => f.principal);

    const u = this.uniforms;
    view.frames.forEach((f, i) => { u.uActive.value[i] = f.active ? 1 : 0; });
    u.uPrincipal.value = this.principal;
    const sel = view.selection;
    u.uMode.value = sel?.type === 'frame' ? 1 : sel?.type === 'edge' ? 2 : 0;
    u.uSelA.value = sel?.type === 'frame' ? sel.index : sel?.type === 'edge' ? sel.a : -1;
    u.uSelB.value = sel?.type === 'edge' ? sel.b : -1;

    this.frames.forEach((f, i) => {
      const info = view.frames[i];
      const selected = sel?.type === 'frame' && sel.index === i;
      const inEdge = sel?.type === 'edge' && (sel.a === i || sel.b === i);
      f.marker.material.color.set(
        selected || inEdge || info.principal ? PALETTE.ink : info.active ? PALETTE.accent : PALETTE.vacant,
      );
      f.marker.scale.setScalar(selected || inEdge ? 1.55 : info.active ? 1 : 0.8);
      f.name.textContent = this.hooks.labelText(i);
      f.button.classList.toggle('is-vacant', !info.active);
      f.button.classList.toggle('is-selected', selected || inEdge);
      f.button.classList.toggle('is-principal', info.principal);
      f.button.setAttribute('aria-pressed', String(selected));
    });

    this.edgeContent = view.dialogues;
    this.styleEdges();
    this.placeCones();
    this.dirty = true;
  }

  styleEdges() {
    const sel = this.selection;
    const hov = this.hover;
    for (const e of this.edges) {
      const isSel = sel?.type === 'edge' && sel.a === e.a && sel.b === e.b;
      const isHov = hov?.type === 'edge' && hov.a === e.a && hov.b === e.b;
      const touchesFrame = sel?.type === 'frame' && (sel.index === e.a || sel.index === e.b);
      const filled = this.edgeContent?.has(`${e.a}-${e.b}`);
      const m = e.line.material;
      if (isSel || isHov) {
        m.color.set(PALETTE.accent);
        m.opacity = 1;
      } else if (filled) {
        m.color.set(PALETTE.accent);
        m.opacity = touchesFrame ? 0.95 : 0.7;
      } else {
        m.color.set(PALETTE.ink);
        m.opacity = touchesFrame ? 0.75 : 0.42;
      }
      const r = isSel ? 0.018 : isHov ? 0.015 : filled ? 0.011 : 0.008;
      e.line.scale.set(r, e.length, r);
    }
  }

  placeCones() {
    const sel = this.selection;
    const idx = sel?.type === 'frame' ? [sel.index] : sel?.type === 'edge' ? [sel.a, sel.b] : [];
    const d = this.distance;
    const radius = Math.sqrt(1 - 1 / (d * d));
    this.cones.forEach((cone, k) => {
      const i = idx[k];
      cone.visible = i !== undefined;
      if (!cone.visible) return;
      const dir = this.dirs[i];
      cone.quaternion.setFromUnitVectors(Y_AXIS, dir);
      cone.position.copy(dir).multiplyScalar((d + 1 / d) / 2);
      cone.scale.set(radius, d - 1 / d, radius);
    });
  }

  setHover(target) {
    this.hover = target;
    this.uniforms.uHover.value = target?.type === 'frame' ? target.index : -1;
    this.styleEdges();
    this.dirty = true;
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  /**
   * Moves the camera so the polyhedron fits the free area of the stage:
   * room is kept for labels on the sides and for the overlays above/below.
   */
  fit() {
    const w = this.host.clientWidth || 800;
    const h = this.host.clientHeight || 600;
    const compact = w < 700;
    const sidePx = Math.min(150, w * 0.22);
    const usable = Math.max(
      Math.min(w - 2 * sidePx, h - (compact ? 130 : 210)),
      Math.min(w, h) * 0.45,
    );
    const radius = this.distance + 0.08;
    const k = (usable / h) * Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = radius * Math.sqrt(1 + 1 / (k * k));
    const dir = this.camera.position.clone().normalize();
    this.camera.position.copy(dir.lengthSq() ? dir : DEFAULT_EYE).multiplyScalar(dist);
    this.controls.minDistance = this.distance + 0.6;
    this.controls.maxDistance = dist * 2.5;
    this.controls.update();
  }

  resetView() {
    this.camera.position.copy(DEFAULT_EYE);
    this.fit();
    this.dirty = true;
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
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

  // ── Picking ──────────────────────────────────────────────────────────────

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointermove', e => {
      this.pointer = { x: e.clientX, y: e.clientY };
      this.pointerMoved = true;
    });
    el.addEventListener('pointerleave', () => {
      this.pointer = null;
      if (this.hover) {
        this.setHover(null);
        this.hooks.onHover(null);
      }
    });
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      this.hooks.onSelect(this.pick(e.clientX, e.clientY));
    });
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const sphereHit = this.raycaster.intersectObject(this.sphere, false)[0];
    const limit = sphereHit ? sphereHit.distance : Infinity;
    const front = list => this.raycaster.intersectObjects(list, false).find(h => h.distance < limit);
    const frameHit = front(this.frames.map(f => f.hit));
    if (frameHit) return frameHit.object.userData.target;
    const edgeHit = front(this.edges.map(e => e.hit));
    if (edgeHit) return edgeHit.object.userData.target;
    return sphereHit ? sphereHit.object.userData.target : null;
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  loop() {
    requestAnimationFrame(this.loop);
    const moved = this.controls.update();
    if (this.pointerMoved && this.pointer) {
      this.pointerMoved = false;
      const target = this.pick(this.pointer.x, this.pointer.y);
      const same = JSON.stringify(target) === JSON.stringify(this.hover);
      if (!same) this.setHover(target);
      this.renderer.domElement.style.cursor = target && target.type !== 'object' ? 'pointer' : 'grab';
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
    this.updateLabelPlacement();
  }

  /** Dims labels hidden behind the object and flips labels on the left half. */
  updateLabelPlacement() {
    const cam = this.camera.position;
    const center = new Vector3(0, 0, 0).project(this.camera);
    for (const f of this.frames) {
      const p = f.marker.position;
      f.anchor.classList.toggle('is-behind', segmentHitsUnitSphere(cam, p));
      f.anchor.classList.toggle('is-left', p.clone().project(this.camera).x < center.x - 0.01);
    }
  }

  /** Screen positions of the vertices (CSS pixels) for compositing exports. */
  projectedFrames() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const cam = this.camera.position;
    return this.frames.map(f => {
      const v = f.marker.position.clone().project(this.camera);
      return {
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        behind: segmentHitsUnitSphere(cam, f.marker.position),
        left: f.anchor.classList.contains('is-left'),
      };
    });
  }

  /** Renders a frame and returns the WebGL canvas (valid until the next frame). */
  capture() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }
}

/** True if the segment from `a` to `b` passes through the unit sphere before reaching `b`. */
function segmentHitsUnitSphere(a, b) {
  const d = b.clone().sub(a);
  const A = d.dot(d);
  const B = 2 * a.dot(d);
  const C = a.dot(a) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return false;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t > 0 && t < 0.999;
}
