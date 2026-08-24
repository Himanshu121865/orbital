import * as THREE from 'three';
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js';
import { fetchTLE } from './tle.js';
import { createOrbitLines } from './orbits.js';
import { geodeticToVec3 } from './coords.js';
import { loadModel } from './models.js';

export async function trackSatellite({ scene, onTick, noradId }) {
  const { name, line1, line2 } = await fetchTLE(noradId);
  const satrec = twoline2satrec(line1, line2);

  const object = new THREE.Group();
  const placeholder = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  object.add(placeholder);
  scene.add(object);

  loadModel(noradId).then((model) => {
    if (!model) return;
    object.remove(placeholder);
    object.add(model);
  });

  const orbit = createOrbitLines(satrec);
  scene.add(orbit.group);

  function telemetryAt(date) {
    const pv = propagate(satrec, date);
    if (!pv.position) return null;
    const gd = eciToGeodetic(pv.position, gstime(date));
    const v = pv.velocity;
    return {
      latitudeDeg: (gd.latitude * 180) / Math.PI,
      longitudeDeg: (gd.longitude * 180) / Math.PI,
      altitudeKm: gd.height,
      speedKmS: Math.hypot(v.x, v.y, v.z),
      position: geodeticToVec3(gd.longitude, gd.latitude, gd.height),
    };
  }

  onTick(() => {
    const t = telemetryAt(new Date());
    if (t) object.position.copy(t.position);
  });

  return {
    noradId,
    name,
    satrec,
    object,
    telemetryAt,
    periodMin: orbit.periodMin,
    orbitGroup: orbit.group,
  };
}
