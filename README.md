# Orbital

Orbital is a real-time 3D satellite tracking website built using vanilla JavaScript and Three.js. It tracks over 16,000 live space objects around earth using real-time data from CelesTrak.

## Overview of Features

* **Smooth Performance:** This website uses `THREE.InstancedMesh` to render 16,000+ objects smoothly without crashing the browser.

* **Accuracy:** Calculates exact satellite positions, velocities, and altitudes using `satellite.js` and TLE data. The calculations and the tracking data have been verified with other trusted sources like the official NASA satellite tracker.

* **Ground Tracking:** Includes an interactive 2D map that displays an object's past and future orbit tracks.

* **Space Object Search:** You can instantly search and filter through 16,000+ active satellites.

* **Filtering:** You can filter specific satellite groups instantly, including but not limited to categories like Starlink, OneWeb, GPS, Weather, and Space Stations.

* **API Caching:** This website stores the satellite data for 6 hours in the browser's local cache (`localStorage`) to mitigate API failures and rate limits.

* **Responsive UI:** A dark-themed UI that is optimized for both desktop and mobile devices.

## Tech Stack

* **Graphics:** Three.js (WebGL)
* **Physics/Math:** satellite.js (SGP4/SDP4 propagation)
* **3D Asset Loading:** `GLTFLoader` with `DRACOLoader` compression
* **Data Source:** [CelesTrak API](https://celestrak.org/)
* **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript (No frameworks)

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173

Earth textures from [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).
