import * as THREE from 'three';
import { propagate, gstime, eciToGeodetic } from 'satellite.js';
import { geodeticToVec3 } from './coords.js';
import { loadModel, getFriendlyName, MODEL_REGISTRY } from './models.js';
import { EARTH_RADIUS_KM } from './earth.js';

const loadedModels = {};
const fallbackGeometry = new THREE.SphereGeometry(0.015, 16, 16);
const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
let activeModel = null;
let activeNoradId = null;
let activeFrozenGmst = null;
let activeSatrecForModel = null;

export function initModels(scene, manager) {
  const group = new THREE.Group();
  scene.add(group);

  const registry = MODEL_REGISTRY;

  Object.entries(registry).forEach(([id, config]) => {
    if (!config.path) {
      if (manager) manager.itemStart(`procedural-${id}`);
      const mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      mesh.visible = false;
      mesh.userData.noradId = String(id);
      group.add(mesh);
      loadedModels[id] = mesh;
      if (manager) manager.itemEnd(`procedural-${id}`);
      return;
    }
    loadModel(id, manager).then((model) => {
      if (!model) return;
      model.visible = false;
      model.userData.noradId = String(id);
      group.add(model);
      loadedModels[id] = model;
      if (String(id) === String(activeNoradId)) {
        if (activeFrozenGmst !== null && activeSatrecForModel) {
          const pos = getSatellitePosition(activeSatrecForModel, new Date(), activeFrozenGmst);
          if (pos) {
            model.position.copy(pos);
            model.visible = true;
          }
        } else {
          model.visible = true;
        }
      }
    });
  });

  return group;
}

export function showModel(noradId) {
  Object.values(loadedModels).forEach((m) => (m.visible = false));
  const m = loadedModels[noradId];
  activeModel = m || null;
  activeNoradId = m ? String(noradId) : null;
  if (m) {
    m.visible = true;
    m.userData.noradId = String(noradId);
  }
}

export function hideAllModels() {
  Object.values(loadedModels).forEach((m) => (m.visible = false));
  activeModel = null;
  activeNoradId = null;
  activeSatrecForModel = null;
  activeFrozenGmst = null;
}

// re-exported here since most callers already import from satellites.js
export { getFriendlyName };

export function getSatellitePosition(satrec, date, fixedGmst = null) {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || isNaN(pv.position.x)) return null;

  const gmst = fixedGmst !== null ? fixedGmst : gstime(date);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const x = pv.position.x * cosG + pv.position.y * sinG;
  const y = -pv.position.x * sinG + pv.position.y * cosG;
  const z = pv.position.z;

  // satellite.js gives us ECI coords (z = north pole), we want three's y-up frame
  const r = EARTH_RADIUS_KM;
  return new THREE.Vector3(x / r, z / r, -y / r);
}

export function getActiveInertialPosition(date) {
  if (!activeSatrecForModel || activeFrozenGmst === null) return null;
  return getSatellitePosition(activeSatrecForModel, date, activeFrozenGmst);
}

export function updateActiveModelPosition(date) {
  if (!activeModel || !activeSatrecForModel || activeFrozenGmst === null) return;
  const pos = getSatellitePosition(activeSatrecForModel, date, activeFrozenGmst);
  if (pos) activeModel.position.copy(pos);
}

let orbitLine = null;
let futureOrbitLine = null;

export function drawTrajectory(scene, satrec, frozenGmst = null) {
  if (orbitLine) {
    scene.remove(orbitLine);
    orbitLine.geometry.dispose();
    orbitLine.material.dispose();
    orbitLine = null;
  }
  if (futureOrbitLine) {
    scene.remove(futureOrbitLine);
    futureOrbitLine.geometry.dispose();
    futureOrbitLine.material.dispose();
    futureOrbitLine = null;
  }

  const pastPoints = [];
  const futurePoints = [];
  const now = Date.now();
  // snapshot gmst once so the whole path stays rigid while the earth rotates underneath
  const frozen = frozenGmst !== null ? frozenGmst : gstime(new Date(now));
  activeFrozenGmst = frozen;
  activeSatrecForModel = satrec;
  const periodMinutes = Math.ceil((2 * Math.PI) / satrec.no);
  const halfPeriod = Math.floor(periodMinutes / 2);

  for (let i = -halfPeriod; i <= 0; i++) {
    const pos = getSatellitePosition(satrec, new Date(now + i * 60000), frozen);
    if (pos) pastPoints.push(pos);
  }

  for (let i = 0; i <= halfPeriod; i++) {
    const pos = getSatellitePosition(satrec, new Date(now + i * 60000), frozen);
    if (pos) futurePoints.push(pos);
  }

  const pastGeometry = new THREE.BufferGeometry().setFromPoints(pastPoints);
  orbitLine = new THREE.Line(pastGeometry, new THREE.LineBasicMaterial({ color: 0xffff00 }));
  scene.add(orbitLine);

  const futureGeometry = new THREE.BufferGeometry().setFromPoints(futurePoints);
  futureOrbitLine = new THREE.Line(
    futureGeometry,
    new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 0.02, gapSize: 0.02 })
  );
  futureOrbitLine.computeLineDistances();
  scene.add(futureOrbitLine);
}

export function removeTrajectory(scene) {
  if (orbitLine) {
    scene.remove(orbitLine);
    orbitLine.geometry.dispose();
    orbitLine.material.dispose();
    orbitLine = null;
  }
  if (futureOrbitLine) {
    scene.remove(futureOrbitLine);
    futureOrbitLine.geometry.dispose();
    futureOrbitLine.material.dispose();
    futureOrbitLine = null;
  }
}

let dropLine = null;

export function initDropLine(scene) {
  const geom = new THREE.BufferGeometry();
  // two points, updated in place every frame
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  dropLine = new THREE.Line(
    geom,
    new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 })
  );
  dropLine.frustumCulled = false;
  scene.add(dropLine);
  return dropLine;
}

export function showDropLine() {
  if (dropLine) dropLine.visible = true;
}

export function hideDropLine() {
  if (dropLine) dropLine.visible = false;
}

export function updateDropLine(position) {
  if (!dropLine) return;
  const groundPos = position.clone().normalize();
  const arr = dropLine.geometry.attributes.position.array;
  arr[0] = position.x;
  arr[1] = position.y;
  arr[2] = position.z;
  arr[3] = groundPos.x;
  arr[4] = groundPos.y;
  arr[5] = groundPos.z;
  dropLine.geometry.attributes.position.needsUpdate = true;
}

export function telemetryAt(satrec, date) {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position) return null;
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
