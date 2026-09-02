import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const MODEL_REGISTRY = {
  25544: { path: '/models/iss.glb', size: 0.06 },
  20580: { path: '/models/hst.glb', size: 0.035 },
  27424: { path: '/models/aqua.glb', size: 0.035 },
  28424: { path: '/models/aqua.glb', size: 0.035 },
  48274: { path: null, size: 0.035 },
  25994: { path: '/models/terra.glb', size: 0.035 },
};

const FRIENDLY_NAMES = {
  25544: 'ISS (ZARYA) — INTERNATIONAL SPACE STATION',
  20580: 'HST — HUBBLE SPACE TELESCOPE',
  48274: 'CSS (TIANHE) — TIANGONG SPACE STATION',
  27424: 'AQUA',
  28424: 'AQUA',
  25994: 'TERRA',
};

const gltfLoaders = new Map();

function getGLTFLoader(manager) {
  const key = manager ? manager.uuid : 'default';
  if (!gltfLoaders.has(key)) {
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);
    gltfLoaders.set(key, loader);
  }
  return gltfLoaders.get(key);
}

const fallbackLoader = new GLTFLoader();

export function getFriendlyName(noradId) {
  return FRIENDLY_NAMES[noradId] || null;
}

function prepare(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z);

  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));

  const material = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    metalness: 0.55,
    roughness: 0.45,
  });
  model.traverse((child) => {
    if (child.isMesh) child.material = material;
  });

  return model;
}

export function loadModel(noradId, manager) {
  const entry = MODEL_REGISTRY[noradId];
  if (!entry || !entry.path) return Promise.resolve(null);

  const loader = manager ? getGLTFLoader(manager) : fallbackLoader;
  return new Promise((resolve) => {
    loader.load(
      entry.path,
      (gltf) => resolve(prepare(gltf.scene, entry.size)),
      undefined,
      () => resolve(null)
    );
  });
}
