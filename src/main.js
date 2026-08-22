import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite } from './satellites.js';
import { createDashboard } from './ui.js';

const canvas = document.getElementById('scene');
const { scene, camera, controls, onTick } = createScene(canvas);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

createStarfield(scene);
createEarth(scene);

let cameraLock = 'earth';
const dashboard = createDashboard();
dashboard.onLockSelect((lock) => {
  cameraLock = lock;
});

trackSatellite({ scene, onTick, noradId: 25544 }).then((sat) => {
  dashboard.setName(sat.name);

  let prevPos = null;
  let lastUpdate = 0;

  onTick(() => {
    const t = sat.telemetryAt(new Date());
    if (!t) return;
    sat.object.position.copy(t.position);

    if (cameraLock === 'satellite') {
      const pos = sat.object.position;
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

    const now = performance.now();
    if (now - lastUpdate >= 200) {
      lastUpdate = now;
      dashboard.update(t);
    }
  });

  console.log(`Tracking ${sat.name} (period: ${sat.periodMin.toFixed(1)} min)`);
});
