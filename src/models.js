import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_REGISTRY = {
  25544: { path: '/models/iss.glb', size: 0.06 },
  20580: { path: '/models/hst.glb', size: 0.035 },
  28424: { path: '/models/aqua.glb', size: 0.035 },
};

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

export function loadModel(noradId) {
  const entry = MODEL_REGISTRY[noradId];
  if (!entry) return Promise.resolve(null);

  return new Promise((resolve) => {
    new GLTFLoader().load(
      entry.path,
      (gltf) => resolve(prepare(gltf.scene, entry.size)),
      undefined,
      () => resolve(null)
    );
  });
}
