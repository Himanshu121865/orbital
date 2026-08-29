import * as THREE from 'three';
import { propagate, gstime, eciToGeodetic } from 'satellite.js';
import { geodeticToVec3 } from './coords.js';

const SAMPLE_INTERVAL_SEC = 30;

function samplePath(satrec, startOffsetMin, endOffsetMin) {
  const points = [];
  const now = Date.now();
  for (let t = startOffsetMin * 60; t <= endOffsetMin * 60; t += SAMPLE_INTERVAL_SEC) {
    const date = new Date(now + t * 1000);
    const pv = propagate(satrec, date);
    if (!pv || !pv.position) continue;
    const gd = eciToGeodetic(pv.position, gstime(date));
    points.push(geodeticToVec3(gd.longitude, gd.latitude, gd.height));
  }
  return points;
}

function makeLine(points, color, dashed) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.05,
        gapSize: 0.03,
        transparent: true,
        opacity: 0.85,
      })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

export function createOrbitLines(satrec) {
  const group = new THREE.Group();
  const periodMin = (2 * Math.PI) / satrec.no;
  const halfPeriod = periodMin / 2;

  group.add(makeLine(samplePath(satrec, -halfPeriod, 0), 0xffd54f, false));
  group.add(makeLine(samplePath(satrec, 0, halfPeriod), 0x4fc3f7, true));

  return { group, periodMin };
}
