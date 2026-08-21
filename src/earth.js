import * as THREE from 'three';

export const EARTH_RADIUS = 1;

export function createEarth(scene) {
  const loader = new THREE.TextureLoader();
  const dayMap = loader.load('/textures/earth_daymap.jpg');
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;

  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
  const material = new THREE.MeshPhongMaterial({
    map: dayMap,
    specular: new THREE.Color(0x202020),
    shininess: 12,
  });

  const earth = new THREE.Mesh(geometry, material);
  scene.add(earth);

  return { mesh: earth, radius: EARTH_RADIUS };
}

export function createStarfield(scene) {
  const loader = new THREE.TextureLoader();
  const starsMap = loader.load('/textures/stars_milky_way.jpg');
  starsMap.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.SphereGeometry(80, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    map: starsMap,
    side: THREE.BackSide,
  });

  const stars = new THREE.Mesh(geometry, material);
  scene.add(stars);

  return stars;
}
