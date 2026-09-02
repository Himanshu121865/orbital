import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

function toJulianDate(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400;
  const yr = m <= 2 ? y - 1 : y;
  const mo = m <= 2 ? m + 12 : m;
  const A = Math.floor(yr / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (yr + 4716)) +
    Math.floor(30.6001 * (mo + 1)) +
    d +
    B -
    1524.5
  );
}

export function computeSunDirection(date) {
  const JD = toJulianDate(date);
  const D = JD - 2451545.0;

  const gDeg = ((357.528 + 0.9856003 * D) % 360);
  const g = gDeg * DEG2RAD;
  const L = (280.460 + 0.9856474 * D) % 360;
  const lambdaDeg = L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  const lambda = lambdaDeg * DEG2RAD;
  const epsilon = (23.439 - 0.0000004 * D) * DEG2RAD;

  const alpha = Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda)
  );
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  let GMST = (18.697374558 + 24.06570982441908 * D) % 24;
  if (GMST < 0) GMST += 24;
  const theta = GMST * 15 * DEG2RAD;

  const sunLon = alpha - theta;
  const sunLat = delta;

  return new THREE.Vector3(
    Math.cos(sunLat) * Math.cos(sunLon),
    Math.sin(sunLat),
    -Math.cos(sunLat) * Math.sin(sunLon)
  ).normalize();
}

export function createSunSprite(scene) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 248, 220, 0.9)');
  gradient.addColorStop(0.4, 'rgba(255, 220, 100, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 8, 1);
  sprite.renderOrder = 1;
  scene.add(sprite);

  return sprite;
}
