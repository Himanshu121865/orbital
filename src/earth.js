import * as THREE from 'three';

export const EARTH_RADIUS = 1;
export const EARTH_RADIUS_KM = 6371;

export function createEarth(scene, manager) {
  const loader = new THREE.TextureLoader(manager);

  const dayMap = loader.load('/textures/earth_daymap.jpg');
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;

  const nightMap = loader.load('/textures/earth_nightmap.jpg');
  nightMap.colorSpace = THREE.SRGBColorSpace;

  const normalMap = loader.load('/textures/8k_earth_normal_map.jpg');
  normalMap.anisotropy = 8;

  const specularMap = loader.load('/textures/8k_earth_specular_map.jpg');
  specularMap.anisotropy = 8;

  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
  const material = new THREE.MeshPhongMaterial({
    map: dayMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    specularMap: specularMap,
    specular: new THREE.Color('grey'),
    shininess: 25,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tNight = { value: nightMap };
    shader.uniforms.sunDir = { value: new THREE.Vector3(1, 0, 0) };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_pars_fragment>',
      `#include <map_pars_fragment>
      uniform sampler2D tNight;
      uniform vec3 sunDir;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float intensity = dot(vNormal, sunDir);
      float nightMix = 1.0 - smoothstep(-0.2, 0.2, intensity);
      vec4 nightColor = texture2D(tNight, vMapUv);
      float luminance = dot(nightColor.rgb, vec3(0.299, 0.587, 0.114));
      luminance = smoothstep(0.1, 0.5, luminance);
      vec3 realisticLights = vec3(1.0, 0.75, 0.3) * luminance;
      totalEmissiveRadiance += realisticLights * nightMix * 2.0;`
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
