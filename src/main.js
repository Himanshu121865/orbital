import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite, untrackSatellite } from './satellites.js';
import { createDashboard, createLoader } from './ui.js';
import { computeSunDirection, createSunSprite } from './sun.js';
import { createMapOverlay } from './map.js';
import { createConstellation } from './constellation.js';

const canvas = document.getElementById('scene');
const { scene, camera, controls, onTick } = createScene(canvas);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
scene.add(sunLight);

createStarfield(scene);
const { material: earthMaterial } = createEarth(scene);
const sunSprite = createSunSprite(scene);

const arc = {
  active: false,
  t: 0,
  duration: 1.8,
  startPos: new THREE.Vector3(),
  endPos: new THREE.Vector3(),
};

const loader = createLoader();

const constellation = await createConstellation(scene, onTick);
const dashboard = createDashboard(
  constellation ? constellation.constellation : null
);
const mapOverlay = createMapOverlay();

let cameraLock = 'earth';
let selectedSat = null;
let selectedTracked = null;

dashboard.onLockSelect((lock) => {
  cameraLock = lock;
  if (lock === 'satellite' && selectedSat) {
    startArcTransition();
  }
});

dashboard.onFilterChange((filter) => {
  if (constellation) constellation.setFilter(filter);
});

dashboard.onSearchSelect((sat) => {
  selectSat(sat);
});

function selectSat(satObject) {
  if (selectedTracked) {
    untrackSatellite(scene, selectedTracked);
    selectedTracked = null;
  }

  selectedSat = satObject;
  if (constellation) constellation.setActiveTarget(satObject);

  trackSatellite({
    scene,
    onTick,
    noradId: satObject.noradId,
    name: satObject.name,
    satrec: satObject.satrec,
  }).then((tracked) => {
    selectedTracked = tracked;
    dashboard.setName(tracked.name);
    mapOverlay.setSatrec(tracked.satrec);

    if (cameraLock === 'satellite') {
      startArcTransition();
    }
  });
}

function startArcTransition() {
  if (!selectedTracked) return;
  arc.startPos.copy(camera.position);
  arc.endPos
    .copy(selectedTracked.object.position)
    .add(
      selectedTracked.object.position
        .clone()
        .normalize()
        .multiplyScalar(0.3)
    );
  arc.t = 0;
  arc.active = true;
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

canvas.addEventListener('click', (event) => {
  if (!constellation) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(constellation.mesh);
  if (intersects.length > 0) {
    const id = intersects[0].instanceId;
    const sat = constellation.constellation[id];
    if (sat) selectSat(sat);
  }
});

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

  if (cameraLock === 'satellite' && selectedTracked && !arc.active) {
    const pos = selectedTracked.object.position;
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

  if (selectedTracked && now - lastUpdate >= 200) {
    lastUpdate = now;
    const t = selectedTracked.telemetryAt(date);
    if (t) dashboard.update(t);
  }

  if (selectedTracked && now - lastMapUpdate >= 2000) {
    lastMapUpdate = now;
    mapOverlay.redraw();
  }
});

loader.hide();
