import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite } from './satellites.js';
import { createDashboard, createLoader } from './ui.js';

const NORAD_IDS = [25544, 20580, 28424, 25994, 48274];

const canvas = document.getElementById('scene');
const { scene, camera, controls, onTick } = createScene(canvas);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

createStarfield(scene);
createEarth(scene);

let cameraLock = 'earth';
let selected = null;
let sats = [];

const dashboard = createDashboard();
const loader = createLoader();

dashboard.onLockSelect((lock) => {
  cameraLock = lock;
  if (lock === 'satellite' && selected) {
    controls.target.copy(selected.object.position);
  }
});

dashboard.onSelect((noradId) => {
  selectSat(noradId);
});

function selectSat(noradId) {
  selected = sats.find((s) => s.noradId === noradId);
  sats.forEach((s) => (s.orbitGroup.visible = s === selected));
  dashboard.setName(selected.name);
  if (cameraLock === 'satellite') {
    controls.target.copy(selected.object.position);
  }
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

  onTick(() => {
    const now = performance.now();
    if (now - lastUpdate < 200) return;
    lastUpdate = now;

    const t = selected.telemetryAt(new Date());
    if (!t) return;

    if (cameraLock === 'satellite') {
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

    dashboard.update(t);
  });

  loader.hide();
}
