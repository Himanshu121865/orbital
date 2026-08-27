import * as THREE from 'three';
import { twoline2satrec, propagate, gstime } from 'satellite.js';
import { fetchAllActive } from './tle.js';
import { EARTH_RADIUS_KM } from './earth.js';

const SATS_PER_FRAME = 4000;

const CATEGORY_RULES = [
  ['STATIONS', /^(25544|48274)$/],
  ['STARLINK', /STARLINK/i],
  ['ONEWEB', /ONEWEB/i],
  ['COMMS', /IRIDIUM|O3B|GLOBALSTAR|FLOCK|LEMUR|ORBCOMM/i],
  ['GPS', /NAVSTAR|GLONASS|BEIDOU|GALILEO|GPS/i],
  ['WEATHER', /NOAA|GOES|AQUA|TERRA|METEOR|SENTINEL|LANDSAT/i],
];

function categorize(name, noradId) {
  for (const [cat, regex] of CATEGORY_RULES) {
    if (regex.test(name) || (cat === 'STATIONS' && regex.test(noradId)))
      return cat;
  }
  return 'OTHER';
}

function eciToThree(posEci, gmst) {
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  return new THREE.Vector3(
    (posEci.x * cosG + posEci.y * sinG) / EARTH_RADIUS_KM,
    posEci.z / EARTH_RADIUS_KM,
    (posEci.x * sinG - posEci.y * cosG) / EARTH_RADIUS_KM
  );
}

function parseTLEs(text) {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const sats = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    if (lines[i + 1]?.charAt(0) !== '1' || lines[i + 2]?.charAt(0) !== '2')
      continue;
    const noradId = lines[i + 1].substring(2, 7).trim();
    try {
      const satrec = twoline2satrec(lines[i + 1], lines[i + 2]);
      sats.push({
        name: lines[i],
        noradId,
        satrec,
        category: categorize(lines[i], noradId),
      });
    } catch {}
  }
  return sats;
}

export async function createConstellation(scene, onTick) {
  let text;
  try {
    text = await fetchAllActive();
  } catch (err) {
    console.warn('Bulk fetch failed:', err.message);
    return null;
  }

  const constellation = parseTLEs(text);
  if (constellation.length === 0) return null;

  const geometry = new THREE.SphereGeometry(0.0045, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    constellation.length
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  let currentIndex = 0;
  let activeFilter = 'ALL';
  let activeTarget = null;

  onTick(() => {
    const now = new Date();
    const gmst = gstime(now);
    const limit = Math.min(currentIndex + SATS_PER_FRAME, constellation.length);

    for (let i = currentIndex; i < limit; i++) {
      const sat = constellation[i];
      const pv = propagate(sat.satrec, now);
      if (!pv.position || isNaN(pv.position.x)) continue;

      const pos = eciToThree(pv.position, gmst);
      dummy.position.copy(pos);

      const isHidden =
        (activeFilter !== 'ALL' && sat.category !== activeFilter) ||
        (activeTarget && activeTarget.noradId === sat.noradId);

      dummy.scale.setScalar(isHidden ? 0 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    currentIndex = limit >= constellation.length ? 0 : limit;
  });

  function dispose() {
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  }

  return {
    constellation,
    mesh,
    dispose,
    setFilter(f) {
      activeFilter = f;
    },
    setActiveTarget(t) {
      activeTarget = t;
    },
    getCountForFilter(f) {
      if (f === 'ALL') return constellation.length;
      return constellation.filter((s) => s.category === f).length;
    },
  };
}
