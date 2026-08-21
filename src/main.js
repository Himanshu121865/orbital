import './styles.css';
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createEarth, createStarfield } from './earth.js';

const canvas = document.getElementById('scene');
const { scene } = createScene(canvas);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
sunLight.position.set(5, 2, 3);
scene.add(sunLight);

createStarfield(scene);
createEarth(scene);
