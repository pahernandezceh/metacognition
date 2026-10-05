// Entry point for the vendored three.js bundle (`npm run build:vendor`).
// Only what js/scene.js uses is exported, so esbuild can tree-shake the rest.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Vector2, Quaternion, Raycaster,
  SphereGeometry, CylinderGeometry, CircleGeometry, BufferGeometry, Float32BufferAttribute,
  Mesh, Group, ShaderMaterial, MeshBasicMaterial, DoubleSide,
} from 'three';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
