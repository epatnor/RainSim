// public/js/app.js  (minimal sanity build)
import * as THREE from 'three';

const host = document.getElementById('viewport');

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

// scene + camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x203040);

const camera = new THREE.PerspectiveCamera(
  60,
  host.clientWidth / host.clientHeight,
  0.1,
  1000
);
camera.position.set(3, 2, 5);
camera.lookAt(0, 0, 0);

// one spinning cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshNormalMaterial()
);
scene.add(cube);

// resize
addEventListener('resize', () => {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// loop
function tick() {
  cube.rotation.y += 0.01;
  cube.rotation.x += 0.005;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

console.log('hello-cube up');
