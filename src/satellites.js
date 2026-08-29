import * as THREE from 'three';
import { propagate, gstime, eciToGeodetic } from 'satellite.js';
import { geodeticToVec3 } from './coords.js';
import { loadModel } from './models.js';

const loadedModels = {};
const fallbackGeometry = new THREE.SphereGeometry(0.015, 16, 16);
const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });

export function initModels(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const registry = {
    25544: { path: '/models/iss.glb', size: 0.06 },
    20580: { path: '/models/hst.glb', size: 0.035 },
    28424: { path: '/models/aqua.glb', size: 0.035 },
    48274: { path: null, size: 0.035 },
    25994: { path: '/models/terra.glb', size: 0.035 },
  };

  Object.entries(registry).forEach(([id, config]) => {
    if (!config.path) {
      const mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
      mesh.visible = false;
      group.add(mesh);
      loadedModels[id] = mesh;
      return;
    }
    loadModel(id).then((model) => {
      if (!model) return;
      model.visible = false;
      group.add(model);
      loadedModels[id] = model;
    });
  });

  return group;
}

export function showModel(noradId) {
  Object.values(loadedModels).forEach((m) => (m.visible = false));
  const m = loadedModels[noradId];
  if (m) m.visible = true;
}

export function hideAllModels() {
  Object.values(loadedModels).forEach((m) => (m.visible = false));
}

const FRIENDLY_NAMES = {
  25544: 'ISS (ZARYA) — INTERNATIONAL SPACE STATION',
  20580: 'HST — HUBBLE SPACE TELESCOPE',
  48274: 'CSS (TIANHE) — TIANGONG SPACE STATION',
  28424: 'AQUA',
  25994: 'TERRA',
};

export function getFriendlyName(noradId) {
  return FRIENDLY_NAMES[noradId] || null;
}

function getSatellitePosition(satrec, date, fixedGmst = null) {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || isNaN(pv.position.x)) return null;

  const gmst = fixedGmst !== null ? fixedGmst : gstime(date);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const x = pv.position.x * cosG + pv.position.y * sinG;
  const y = -pv.position.x * sinG + pv.position.y * cosG;
  const z = pv.position.z;

  const R = 6371;
  return new THREE.Vector3(x / R, z / R, -y / R);
}

let orbitLine = null;
let futureOrbitLine = null;

export function drawTrajectory(scene, satrec) {
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
  const frozenGmst = gstime(new Date(now));
  const periodMinutes = Math.ceil((2 * Math.PI) / satrec.no);
  const halfPeriod = Math.floor(periodMinutes / 2);

  for (let i = -halfPeriod; i <= 0; i++) {
    const pos = getSatellitePosition(satrec, new Date(now + i * 60000), frozenGmst);
    if (pos) pastPoints.push(pos);
  }

  for (let i = 0; i <= halfPeriod; i++) {
    const pos = getSatellitePosition(satrec, new Date(now + i * 60000), frozenGmst);
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
