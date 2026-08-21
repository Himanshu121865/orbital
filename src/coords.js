import * as THREE from 'three';
import { EARTH_RADIUS_KM } from './earth.js';

export function geodeticToVec3(longitudeRad, latitudeRad, heightKm) {
  const r = (EARTH_RADIUS_KM + heightKm) / EARTH_RADIUS_KM;
  return new THREE.Vector3(
    r * Math.cos(latitudeRad) * Math.cos(longitudeRad),
    r * Math.sin(latitudeRad),
    -r * Math.cos(latitudeRad) * Math.sin(longitudeRad)
  );
}
