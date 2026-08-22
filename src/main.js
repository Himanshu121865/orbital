import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';
import { trackSatellite } from './satellites.js';
import { createDashboard } from './ui.js';

const canvas = document.getElementById('scene');
const { scene, onTick } = createScene(canvas);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

createStarfield(scene);
createEarth(scene);

const dashboard = createDashboard();

trackSatellite({ scene, onTick, noradId: 25544 }).then((sat) => {
  dashboard.setName(sat.name);

  let lastUpdate = 0;
  onTick(() => {
    const now = performance.now();
    if (now - lastUpdate < 200) return;
    lastUpdate = now;
    const t = sat.telemetryAt(new Date());
    if (t) dashboard.update(t);
  });

  console.log(`Tracking ${sat.name} (period: ${sat.periodMin.toFixed(1)} min)`);
});
