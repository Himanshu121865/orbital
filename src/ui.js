function formatLat(deg) {
  return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? 'N' : 'S'}`;
}

function formatLon(deg) {
  return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? 'E' : 'W'}`;
}

export function createDashboard() {
  const panel = document.createElement('aside');
  panel.id = 'dashboard';
  panel.innerHTML = `
    <h2 id="dash-name">Loading…</h2>
    <div class="row"><span class="label">Latitude</span><span id="dash-lat">—</span></div>
    <div class="row"><span class="label">Longitude</span><span id="dash-lon">—</span></div>
    <div class="row"><span class="label">Altitude</span><span id="dash-alt">—</span></div>
    <div class="row"><span class="label">Velocity</span><span id="dash-vel">—</span></div>
  `;
  document.body.appendChild(panel);

  const els = Object.fromEntries(
    ['name', 'lat', 'lon', 'alt', 'vel'].map((key) => [
      key,
      panel.querySelector(`#dash-${key}`),
    ])
  );

  function setName(name) {
    els.name.textContent = name;
  }

  function update(t) {
    els.lat.textContent = formatLat(t.latitudeDeg);
    els.lon.textContent = formatLon(t.longitudeDeg);
    els.alt.textContent = `${t.altitudeKm.toFixed(1)} km`;
    els.vel.textContent = `${t.speedKmS.toFixed(2)} km/s`;
  }

  return { panel, setName, update };
}
