import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite } from './satellites.js';
import { createDashboard, createLoader } from './ui.js';
import { computeSunDirection, createSunSprite } from './sun.js';
import { createMapOverlay } from './map.js';

const NORAD_IDS = [25544, 20580, 28424, 25994, 48274];

const canvas = document.getElementById('scene');
const { scene, camera, controls, onTick } = createScene(canvas);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
scene.add(sunLight);

createStarfield(scene);
const { material: earthMaterial } = createEarth(scene);
const sunSprite = createSunSprite(scene);

let cameraLock = 'earth';
let selected = null;
let sats = [];

const arc = { active: false, t: 0, duration: 1.8, startPos: new THREE.Vector3(), endPos: new THREE.Vector3() };

const dashboard = createDashboard();
const loader = createLoader();
const mapOverlay = createMapOverlay();

dashboard.onLockSelect((lock) => {
  cameraLock = lock;
  if (lock === 'satellite' && selected) {
    startArcTransition();
  }
});

dashboard.onSelect((noradId) => {
  selectSat(noradId);
});

function selectSat(noradId) {
  selected = sats.find((s) => s.noradId === noradId);
  sats.forEach((s) => (s.orbitGroup.visible = s === selected));
  dashboard.setName(selected.name);
  mapOverlay.setSatrec(selected.satrec);
  if (cameraLock === 'satellite') {
    startArcTransition();
  }
}

function startArcTransition() {
  if (!selected) return;
  arc.startPos.copy(camera.position);
  arc.endPos.copy(selected.object.position).add(
    selected.object.position.clone().normalize().multiplyScalar(0.3)
  );
  arc.t = 0;
  arc.active = true;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const results = await Promise.allSettled(
  NORAD_IDS.map((id) => trackSatellite({ scene, onTick, noradId: id }))
);

sats = results
  .filter((r) => r.status === 'fulfilled')
  .map((r) => r.value);

if (sats.length === 0) {
  loader.setText('Failed to load satellite data');
} else {
  selected = sats[0];
  sats.forEach((s, i) => (s.orbitGroup.visible = i === 0));
  dashboard.setOptions(sats.map(({ noradId, name }) => ({ noradId, name })));
  dashboard.setName(selected.name);

  let prevPos = null;
  let lastUpdate = 0;
  let lastMapUpdate = 0;

  onTick(() => {
    const now = performance.now();
    const date = new Date();

    const sunDir = computeSunDirection(date);
    sunLight.position.copy(sunDir.clone().multiplyScalar(5));
    sunSprite.position.copy(sunDir.clone().multiplyScalar(50));

    if (earthMaterial.userData.shader) {
      earthMaterial.userData.shader.uniforms.sunDir.value.copy(sunDir);
    }

    if (arc.active) {
      arc.t += 0.016 / arc.duration;
      if (arc.t >= 1) {
        arc.t = 1;
        arc.active = false;
      }
      const t = easeInOutCubic(arc.t);
      camera.position.lerpVectors(arc.startPos, arc.endPos, t);
      controls.target.set(0, 0, 0);
    }

    if (cameraLock === 'satellite' && selected && !arc.active) {
      const pos = selected.object.position;
      if (!prevPos) controls.target.copy(pos);
      else {
        const delta = pos.clone().sub(prevPos);
        controls.target.add(delta);
        camera.position.add(delta);
      }
      prevPos = pos.clone();
    } else {
      prevPos = null;
    }

    if (now - lastUpdate >= 200) {
      lastUpdate = now;
      const t = selected.telemetryAt(date);
      if (t) dashboard.update(t);
    }

    if (now - lastMapUpdate >= 2000) {
      lastMapUpdate = now;
      mapOverlay.redraw();
    }
  });

  loader.hide();
}
