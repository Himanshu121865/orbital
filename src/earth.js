import * as THREE from 'three';

export const EARTH_RADIUS = 1;
export const EARTH_RADIUS_KM = 6371;

export function createEarth(scene) {
  const loader = new THREE.TextureLoader();

  const dayMap = loader.load('/textures/earth_daymap.jpg');
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;

  const nightMap = loader.load('/textures/earth_nightmap.jpg');
  nightMap.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
  const material = new THREE.MeshPhongMaterial({
    map: dayMap,
    emissiveMap: nightMap,
    emissive: new THREE.Color(0xffa040),
    emissiveIntensity: 1.0,
    specular: new THREE.Color(0x202020),
    shininess: 12,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.sunDir = { value: new THREE.Vector3(1, 0, 0) };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vWorldNormal;\n'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);\n'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform vec3 sunDir;\nvarying vec3 vWorldNormal;\n'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#ifdef USE_EMISSIVEMAP
        vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
        float sunDot = dot(vWorldNormal, sunDir);
        float nightFactor = smoothstep(0.15, -0.15, sunDot);
        totalEmissiveRadiance = emissiveColor.rgb * nightFactor * 3.0;
      #endif`
    );

    material.userData.shader = shader;
  };

  const earth = new THREE.Mesh(geometry, material);
  scene.add(earth);

  return { mesh: earth, material, radius: EARTH_RADIUS };
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
