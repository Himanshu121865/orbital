import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite, untrackSatellite } from './satellites.js';
import { createDashboard, createLoader } from './ui.js';
import { computeSunDirection, createSunSprite } from './sun.js';
import { createMapOverlay } from './map.js';
import { createConstellation } from './constellation.js';
import { getFriendlyName } from './models.js';

const canvas = document.getElementById('scene');
const { scene, camera, setSatelliteLock, setControlsTarget, onTick } =
  createScene(canvas);

const loader = createLoader();

const manager = new THREE.LoadingManager();
let assetsLoaded = false;
let dataLoaded = false;

manager.onProgress = (_, loaded, total) => {
  loader.setProgress(loaded, total);
};

manager.onLoad = () => {
  assetsLoaded = true;
  checkLoadStatus();
};

function checkLoadStatus() {
  if (assetsLoaded && !dataLoaded) {
    loader.setMessage('FETCHING TELEMETRY DATA...');
  }
  if (assetsLoaded && dataLoaded) {
    loader.hide();
  }
}

const ambientLight = new THREE.AmbientLight(0x222222);
scene.add(ambientLight);
const earthShine = new THREE.HemisphereLight(0x000000, 0x002244, 1.5);
scene.add(earthShine);
const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
scene.add(sunLight);

createStarfield(scene);
const { material: earthMaterial } = createEarth(scene, manager);
const sunSprite = createSunSprite(scene);

const UP = new THREE.Vector3(0, 1, 0);
const NUDGE = new THREE.Vector3(0, 0.1, 0);

const transition = {
  active: false,
  progress: 0,
  startPos: new THREE.Vector3(),
  endPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endTarget: new THREE.Vector3(),
  currentTarget: new THREE.Vector3(0, 0, 0),
  currentDir: new THREE.Vector3(),
};

const constellation = await createConstellation(scene, onTick);

dataLoaded = true;
if (assetsLoaded) {
  checkLoadStatus();
}

const dashboard = createDashboard(
  constellation ? constellation.constellation : null
);

if (!constellation) {
  dashboard.showOfflineBanner();
}

const mapOverlay = createMapOverlay();

let cameraLock = 'earth';
let selectedSat = null;
let selectedTracked = null;
let trackingGeneration = 0;

dashboard.onLockSelect((lock) => {
  cameraLock = lock;
  if (lock === 'satellite') {
    if (selectedSat) startTransition();
  } else {
    setSatelliteLock(false);
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

  const gen = ++trackingGeneration;

  trackSatellite({
    scene,
    onTick,
    noradId: satObject.noradId,
    name: satObject.name,
    satrec: satObject.satrec,
  }).then((tracked) => {
    if (gen !== trackingGeneration) {
      untrackSatellite(scene, tracked);
      return;
    }
    selectedTracked = tracked;
    const displayName = getFriendlyName(tracked.noradId) || tracked.name;
    dashboard.setName(displayName);
    mapOverlay.setSatrec(tracked.satrec);

    cameraLock = 'satellite';
    dashboard.setLockButton('satellite');
    startTransition();
  });
}

function startTransition() {
  if (!selectedTracked) return;

  transition.startPos.copy(camera.position);
  transition.startTarget.copy(transition.currentTarget);

  const satPos = selectedTracked.object.position;
  const earthToSat = satPos.clone().normalize();
  transition.endPos.copy(satPos).add(earthToSat.multiplyScalar(0.3));
  transition.endTarget.copy(satPos);

  transition.progress = 0;
  transition.active = true;
  transition.currentDir.copy(camera.position).normalize();
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
const tempVec = new THREE.Vector3();

onTick(() => {
  const now = performance.now();
  const date = new Date();

  const sunDir = computeSunDirection(date);
  tempVec.copy(sunDir).multiplyScalar(5);
  sunLight.position.copy(tempVec);
  tempVec.copy(sunDir).multiplyScalar(50);
  sunSprite.position.copy(tempVec);
  if (earthMaterial.userData.shader) {
    earthMaterial.userData.shader.uniforms.sunDir.value.copy(sunDir);
  }

  if (transition.active) {
    transition.progress += 0.025;

    if (transition.progress >= 1.0) {
      transition.progress = 1.0;
      transition.active = false;

      transition.currentTarget.copy(transition.endTarget);
      camera.position.copy(transition.endPos);

      camera.lookAt(transition.currentTarget);
      setControlsTarget(transition.currentTarget);

      if (cameraLock === 'satellite') {
        setSatelliteLock(true);
      }
    } else {
      setSatelliteLock(false);

      const dynamicLerp = 0.05 + Math.pow(transition.progress, 3) * 0.95;

      transition.currentTarget.lerp(transition.endTarget, dynamicLerp);

      const currentDir = camera.position.clone().normalize();
      const targetDir = transition.endPos.clone().normalize();

      if (currentDir.dot(targetDir) < -0.99) {
        currentDir.add(NUDGE).normalize();
      }

      const angleDiff = currentDir.angleTo(targetDir);
      currentDir.lerp(targetDir, dynamicLerp).normalize();

      const baseAlt = transition.endPos.length();
      const zoomBoost = angleDiff * 1.5;
      const targetAlt = baseAlt + zoomBoost;
      const currentAlt = camera.position.length();
      const newAlt = THREE.MathUtils.lerp(currentAlt, targetAlt, dynamicLerp);

      camera.position.copy(currentDir.multiplyScalar(newAlt));

      if (cameraLock !== 'satellite') {
        camera.up.lerp(UP, dynamicLerp);
      }

      camera.lookAt(transition.currentTarget);
    }
  } else if (cameraLock === 'satellite' && selectedTracked) {
    const pos = selectedTracked.object.position;
    if (!prevPos) {
      transition.currentTarget.copy(pos);
      setControlsTarget(pos);
    } else {
      const delta = pos.clone().sub(prevPos);
      transition.currentTarget.add(delta);
      camera.position.add(delta);
      setControlsTarget(transition.currentTarget);
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
