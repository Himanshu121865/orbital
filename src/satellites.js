import * as THREE from 'three';
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js';
import { fetchTLE } from './tle.js';
import { createOrbitLines } from './orbits.js';
import { geodeticToVec3 } from './coords.js';
import { loadModel } from './models.js';

export async function trackSatellite({
  scene,
  onTick,
  noradId,
  name: providedName,
  satrec: providedSatrec,
}) {
  let name, satrec;
  if (providedSatrec) {
    name = providedName || `NORAD ${noradId}`;
    satrec = providedSatrec;
  } else {
    const tle = await fetchTLE(noradId);
    name = tle.name;
    satrec = twoline2satrec(tle.line1, tle.line2);
  }

  const object = new THREE.Group();
  const placeholder = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  object.add(placeholder);

  loadModel(noradId).then((model) => {
    if (!model) return;
    object.remove(placeholder);
    object.add(model);
  });

  const orbit = createOrbitLines(satrec);

  const dropGeometry = new THREE.BufferGeometry();
  dropGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
  );
  const dropMaterial = new THREE.LineBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.5,
  });
  const dropLine = new THREE.Line(dropGeometry, dropMaterial);

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

  const groundPos = new THREE.Vector3();

  let tickHandle = null;

  function attach(sceneRef, onTickRef) {
    sceneRef.add(object);
    sceneRef.add(orbit.group);
    sceneRef.add(dropLine);

    tickHandle = () => {
      const t = telemetryAt(new Date());
      if (!t) return;
      object.position.copy(t.position);

      groundPos.copy(t.position).normalize();

      const positions = dropLine.geometry.attributes.position.array;
      positions[0] = t.position.x;
      positions[1] = t.position.y;
      positions[2] = t.position.z;
      positions[3] = groundPos.x;
      positions[4] = groundPos.y;
      positions[5] = groundPos.z;
      dropLine.geometry.attributes.position.needsUpdate = true;
    };
    onTickRef(tickHandle);
  }

  return {
    noradId,
    name,
    satrec,
    object,
    telemetryAt,
    periodMin: orbit.periodMin,
    orbitGroup: orbit.group,
    dropLine,
    attach,
  };
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

export function untrackSatellite(scene, tracked) {
  if (!tracked) return;
  scene.remove(tracked.object);
  scene.remove(tracked.orbitGroup);
  scene.remove(tracked.dropLine);
  disposeObject(tracked.orbitGroup);
  disposeObject(tracked.object);
  tracked.dropLine.geometry.dispose();
  tracked.dropLine.material.dispose();
}
