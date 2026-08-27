import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.01,
    200
  );
  camera.position.set(0, 1.2, 3);

  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.enablePan = false;
  orbitControls.rotateSpeed = 0.5;
  orbitControls.minDistance = 1.15;
  orbitControls.maxDistance = 20;

  const trackballControls = new TrackballControls(camera, canvas);
  trackballControls.rotateSpeed = 4.0;
  trackballControls.dynamicDampingFactor = 0.1;
  trackballControls.minDistance = 0.002;
  trackballControls.maxDistance = 10;
  trackballControls.enabled = false;

  function setSatelliteLock(enabled) {
    if (enabled) {
      orbitControls.enabled = false;
      trackballControls.enabled = true;
    } else {
      trackballControls.enabled = false;
      orbitControls.enabled = true;
      camera.up.set(0, 1, 0);
    }
  }

  function setControlsTarget(pos) {
    orbitControls.target.copy(pos);
    trackballControls.target.copy(pos);
  }

  const tickHandlers = [];
  function onTick(fn) {
    tickHandlers.push(fn);
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    for (const fn of tickHandlers) fn(dt);
    orbitControls.update();
    trackballControls.update();
    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    scene,
    camera,
    orbitControls,
    trackballControls,
    setSatelliteLock,
    setControlsTarget,
    onTick,
  };
}
