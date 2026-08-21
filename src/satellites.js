import * as THREE from 'three';
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js';
import { fetchTLE } from './tle.js';
import { createOrbitLines } from './orbits.js';
import { geodeticToVec3 } from './coords.js';

export async function trackSatellite({ scene, onTick, noradId }) {
  const { name, line1, line2 } = await fetchTLE(noradId);
  const satrec = twoline2satrec(line1, line2);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  scene.add(marker);

  const orbit = createOrbitLines(satrec);
  scene.add(orbit.group);

  function positionAt(date) {
    const pv = propagate(satrec, date);
    if (!pv.position) return null;
    const gd = eciToGeodetic(pv.position, gstime(date));
    return geodeticToVec3(gd.longitude, gd.latitude, gd.height);
  }

  onTick(() => {
    const pos = positionAt(new Date());
    if (pos) marker.position.copy(pos);
  });

  return { name, satrec, marker, positionAt, periodMin: orbit.periodMin };
}
