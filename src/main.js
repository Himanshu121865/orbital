import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import {
  initModels,
  showModel,
  hideAllModels,
  getFriendlyName,
  drawTrajectory,
  removeTrajectory,
  initDropLine,
  showDropLine,
  hideDropLine,
  updateDropLine,
  telemetryAt,
  getSatellitePosition,
  getActiveInertialPosition,
  updateActiveModelPosition,
} from './satellites.js';
import { gstime } from 'satellite.js';
import { createDashboard, createLoader } from './ui.js';
import { computeSunDirection, createSunSprite } from './sun.js';
import { createMapOverlay } from './map.js';
import { createConstellation } from './constellation.js';

const canvas = document.getElementById('scene');
const {
  scene,
  camera,
  orbitControls,
  trackballControls,
  setSatelliteLock,
  setControlsTarget,
  setControlsEnabled,
  setAdaptiveMinDistance,
  onTick,
} = createScene(canvas);

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
// faint blue bounce from the planet so the night side isn't pitch black
const earthShine = new THREE.HemisphereLight(0x000000, 0x002244, 1.5);
scene.add(earthShine);
const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
scene.add(sunLight);

createStarfield(scene);
const { material: earthMaterial } = createEarth(scene, manager);
const sunSprite = createSunSprite(scene);

initModels(scene, manager);
initDropLine(scene);
hideDropLine();

const UP = new THREE.Vector3(0, 1, 0);
const NUDGE = new THREE.Vector3(0, 0.1, 0);

const transition = {
  active: false,
  elapsed: 0,
  duration: 1.25,
  startPos: new THREE.Vector3(),
  endPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endTarget: new THREE.Vector3(),
  currentTarget: new THREE.Vector3(0, 0, 0),
  startUp: new THREE.Vector3(0, 1, 0),
  endUp: new THREE.Vector3(0, 1, 0),
};

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

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
let activeTarget = null;

dashboard.onLockSelect((lock) => {
  cameraLock = lock;
  if (lock === 'satellite') {
    if (activeTarget) startTransition();
  } else {
    setSatelliteLock(false);
  }
});

dashboard.onFilterChange((filter) => {
  if (constellation) constellation.setFilter(filter);
});

dashboard.onSearchSelect((sat) => {
  changeActiveTarget(sat);
});

function changeActiveTarget(satObject) {
  if (!satObject) {
    activeTarget = null;
    removeTrajectory(scene);
    hideDropLine();
    hideAllModels();
    dashboard.setName('NONE');
    mapOverlay.hide();
    startTransition();
    return;
  }

  activeTarget = satObject;
  if (constellation) constellation.setActiveTarget(satObject);

  const displayName = getFriendlyName(satObject.noradId) || satObject.name;
  dashboard.setName(displayName);
  const frozen = gstime(new Date());
  drawTrajectory(scene, satObject.satrec, frozen);
  showDropLine();
  showModel(satObject.noradId);
  const initialPos = getSatellitePosition(satObject.satrec, new Date(), frozen);
  if (initialPos) {
    updateActiveModelPosition(new Date());
    updateDropLine(initialPos);
  }
  mapOverlay.show();
  mapOverlay.setSatrec(satObject.satrec);

  cameraLock = 'satellite';
  dashboard.setLockButton('satellite');
  startTransition();
}

function startTransition() {
  if (!activeTarget) {
    transition.startPos.copy(camera.position);
    transition.startTarget.copy(transition.currentTarget);
    transition.startUp.copy(camera.up);
    transition.endPos.set(0, 1.2, 3);
    transition.endTarget.set(0, 0, 0);
    transition.endUp.set(0, 1, 0);
    transition.elapsed = 0;
    transition.active = true;
    setControlsEnabled(false, false);
    setAdaptiveMinDistance('earth');
    return;
  }

  const satPos = getActiveInertialPosition(new Date()) || telemetryAt(activeTarget.satrec, new Date())?.position;
  if (!satPos) return;
  const t = telemetryAt(activeTarget.satrec, new Date());
  const altKm = t ? t.altitudeKm : 400;
  const offset = THREE.MathUtils.clamp(0.45 + altKm / 12000, 0.4, 0.85);
  const earthToSat = satPos.clone().normalize();

  transition.startPos.copy(camera.position);
  transition.startTarget.copy(transition.currentTarget);
  transition.startUp.copy(camera.up);
  transition.endPos.copy(satPos).add(earthToSat.multiplyScalar(offset));
  transition.endTarget.copy(satPos);
  transition.endUp.copy(transition.startUp).lerp(UP, 0.4).normalize();
  transition.elapsed = 0;
  transition.active = true;
  setControlsEnabled(false, false);
  setAdaptiveMinDistance('satellite');
}

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.1;
const mouse = new THREE.Vector2();
let pointerDownPos = null;
canvas.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('click', (event) => {
  if (!constellation) return;
  // ignore clicks that were actually drags (orbiting the camera)
  if (pointerDownPos) {
    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    if (Math.hypot(dx, dy) > 5) return;
  }
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(constellation.mesh);
  if (intersects.length > 0) {
    const id = intersects[0].instanceId;
    const sat = constellation.constellation[id];
    if (sat) changeActiveTarget(sat);
  }
});

let lastUpdate = 0;
let lastMapUpdate = 0;
const sunTemp = new THREE.Vector3();
const sDirTmp = new THREE.Vector3();
const eDirTmp = new THREE.Vector3();

onTick((dt) => {
  const now = performance.now();
  const date = new Date();

  const sunDir = computeSunDirection(date);
  sunTemp.copy(sunDir).multiplyScalar(5);
  sunLight.position.copy(sunTemp);
  sunTemp.copy(sunDir).multiplyScalar(50);
  sunSprite.position.copy(sunTemp);
  if (earthMaterial.userData.shader) {
    const viewSunDir = sunDir.clone().transformDirection(camera.matrixWorldInverse);
    earthMaterial.userData.shader.uniforms.sunDir.value.copy(viewSunDir);
  }

  if (transition.active) {
    if (activeTarget) {
      const livePos = getActiveInertialPosition(date);
      if (livePos) {
        transition.endTarget.copy(livePos);
        const liveT = telemetryAt(activeTarget.satrec, date);
        const liveAlt = liveT ? liveT.altitudeKm : 400;
        const liveOffset = THREE.MathUtils.clamp(0.45 + liveAlt / 12000, 0.4, 0.85);
        // keep chasing the sat while it moves during the flight over
        transition.endPos.copy(livePos).add(livePos.clone().normalize().multiplyScalar(liveOffset));
      }
    }

    transition.elapsed += dt;
    let t = Math.min(transition.elapsed / transition.duration, 1);
    const eased = easeInOutCubic(t);

    transition.currentTarget.lerpVectors(transition.startTarget, transition.endTarget, eased);

    sDirTmp.copy(transition.startPos).normalize();
    eDirTmp.copy(transition.endPos).normalize();
    // antipodal directions make the slerp flip, nudge slightly off-axis
    if (sDirTmp.dot(eDirTmp) < -0.99) {
      sDirTmp.add(NUDGE).normalize();
    }

    let dir;
    const angle = sDirTmp.angleTo(eDirTmp);
    if (angle < 0.001) {
      dir = eDirTmp.clone();
    } else {
      const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sDirTmp);
      const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), eDirTmp);
      const q = new THREE.Quaternion().slerpQuaternions(q0, q1, eased);
      dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    }

    const sRad = transition.startPos.length();
    const eRad = transition.endPos.length();
    let radius = THREE.MathUtils.lerp(sRad, eRad, eased);
    const arcBump = Math.sin(Math.PI * eased) * Math.max(0, (1 - sDirTmp.dot(eDirTmp)) * 0.6);
    radius += arcBump;

    camera.position.copy(dir.multiplyScalar(radius));
    camera.up.lerpVectors(transition.startUp, transition.endUp, eased).normalize();
    camera.lookAt(transition.currentTarget);
    setControlsTarget(transition.currentTarget);
    if (activeTarget) {
      updateActiveModelPosition(date);
      const curPos = getActiveInertialPosition(date);
      if (curPos) updateDropLine(curPos);
    }

    if (t >= 1) {
      transition.active = false;
      transition.currentTarget.copy(transition.endTarget);
      camera.position.copy(transition.endPos);
      camera.up.copy(transition.endUp);
      camera.lookAt(transition.currentTarget);
      setControlsTarget(transition.currentTarget);
      if (!activeTarget) {
        setControlsEnabled(false, false);
        setSatelliteLock(false);
      } else if (cameraLock === 'satellite') {
        setSatelliteLock(true);
      } else {
        setControlsEnabled(false, false);
        setSatelliteLock(false);
      }
      orbitControls.update();
      trackballControls.update();
    }
  } else if (cameraLock === 'satellite' && activeTarget) {
    const inertialPos = getActiveInertialPosition(date);
    if (inertialPos) {
      const delta = inertialPos.clone().sub(transition.currentTarget);
      transition.currentTarget.add(delta);
      camera.position.add(delta);
      setControlsTarget(transition.currentTarget);
      updateDropLine(inertialPos);
      updateActiveModelPosition(date);
    }
  }

  if (activeTarget && now - lastUpdate >= 200) {
    lastUpdate = now;
    const t = telemetryAt(activeTarget.satrec, date);
    if (t) dashboard.update(t);
  }

  if (activeTarget && now - lastMapUpdate >= 2000) {
    lastMapUpdate = now;
    mapOverlay.redraw();
  }
});
