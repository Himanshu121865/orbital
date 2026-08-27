function formatLat(deg) {
  return `${Math.abs(deg).toFixed(4)}° ${deg >= 0 ? 'N' : 'S'}`;
}

function formatLon(deg) {
  return `${Math.abs(deg).toFixed(4)}° ${deg >= 0 ? 'E' : 'W'}`;
}

export function createDashboard(constellation) {
  const panel = document.createElement('aside');
  panel.id = 'dashboard';
  panel.innerHTML = `
    <div class="panel-header">
      <h2 id="dash-name">ORBITAL</h2>
    </div>
    <div class="input-group">
      <label>TARGET LOCK</label>
      <input type="text" id="sat-search" autocomplete="off" placeholder="SEARCH SATELLITE...">
      <div id="custom-dropdown" class="custom-dropdown hidden"></div>
    </div>
    <div class="input-group">
      <label>FILTER</label>
      <select id="sat-filter">
        <option value="ALL">ALL SATELLITES</option>
        <option value="STARLINK">STARLINK</option>
        <option value="ONEWEB">ONEWEB</option>
        <option value="COMMS">COMMERCIAL COMMS</option>
        <option value="GPS">NAVIGATION (GPS/GLONASS)</option>
        <option value="WEATHER">EARTH OBS & WEATHER</option>
        <option value="STATIONS">SPACE STATIONS</option>
        <option value="OTHER">OTHER</option>
      </select>
    </div>
    <div class="insights-bar">
      <span class="label">ACTIVE TRACKS</span>
      <span id="insight-count" class="val">${constellation ? constellation.length : 0}</span>
    </div>
    <div class="divider"></div>
    <div class="telemetry-section">
      <div class="telemetry-title">TARGET: <span id="sat-name" class="active-name">NONE</span></div>
      <div class="telemetry-grid">
        <div class="stat-card"><span class="label">LATITUDE</span><span id="dash-lat" class="val">—</span></div>
        <div class="stat-card"><span class="label">LONGITUDE</span><span id="dash-lon" class="val">—</span></div>
        <div class="stat-card"><span class="label">ALTITUDE</span><span id="dash-alt" class="val">—</span></div>
        <div class="stat-card"><span class="label">VELOCITY</span><span id="dash-vel" class="val">—</span></div>
      </div>
    </div>
    <button id="cam-toggle" class="cmd-btn">CAMERA LOCK: EARTH</button>
  `;
  document.body.appendChild(panel);

  const els = Object.fromEntries(
    ['name', 'lat', 'lon', 'alt', 'vel'].map((key) => [
      key,
      panel.querySelector(`#dash-${key}`),
    ])
  );

  const searchInput = panel.querySelector('#sat-search');
  const dropdown = panel.querySelector('#custom-dropdown');
  const filterSelect = panel.querySelector('#sat-filter');
  const insightCount = panel.querySelector('#insight-count');
  const camToggle = panel.querySelector('#cam-toggle');

  let activeFilter = 'ALL';
  let searchCallback = null;
  let filterCallback = null;

  if (constellation) {
    searchInput.addEventListener('input', () => {
      populateDropdown(searchInput.value);
    });
    searchInput.addEventListener('focus', () => {
      populateDropdown(searchInput.value);
    });
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function populateDropdown(term) {
    dropdown.innerHTML = '';
    const upper = term.trim().toUpperCase();
    let added = 0;

    for (let i = 0; i < constellation.length; i++) {
      const sat = constellation[i];
      if (
        (activeFilter === 'ALL' || sat.category === activeFilter) &&
        sat.name.toUpperCase().includes(upper)
      ) {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = sat.name;
        item.addEventListener('click', () => {
          searchInput.value = sat.name;
          dropdown.classList.add('hidden');
          if (searchCallback) searchCallback(sat);
        });
        dropdown.appendChild(item);
        added++;
      }
      if (added >= 200) break;
    }

    dropdown.classList.toggle('hidden', added === 0);
  }

  filterSelect.addEventListener('change', () => {
    activeFilter = filterSelect.value;
    if (filterCallback) filterCallback(activeFilter);
    const count = constellation
      ? activeFilter === 'ALL'
        ? constellation.length
        : constellation.filter((s) => s.category === activeFilter).length
      : 0;
    insightCount.textContent = count;
    searchInput.value = '';
    dropdown.classList.add('hidden');
  });

  camToggle.addEventListener('click', () => {
    const isLocked = camToggle.dataset.lock === 'satellite';
    camToggle.dataset.lock = isLocked ? 'earth' : 'satellite';
    camToggle.textContent = isLocked
      ? 'CAMERA LOCK: EARTH'
      : 'CAMERA LOCK: SATELLITE';
    if (lockCallback) lockCallback(isLocked ? 'earth' : 'satellite');
  });

  let lockCallback = null;

  function setName(name) {
    els.name.textContent = name;
  }

  function update(t) {
    els.lat.textContent = formatLat(t.latitudeDeg);
    els.lon.textContent = formatLon(t.longitudeDeg);
    els.alt.textContent = `${t.altitudeKm.toFixed(2)} km`;
    els.vel.textContent = `${t.speedKmS.toFixed(2)} km/s`;
  }

  return {
    panel,
    setName,
    update,
    onSearchSelect(cb) {
      searchCallback = cb;
    },
    onFilterChange(cb) {
      filterCallback = cb;
    },
    onLockSelect(cb) {
      lockCallback = cb;
    },
  };
}

export function createLoader() {
  const overlay = document.createElement('div');
  overlay.id = 'loading';
  overlay.innerHTML =
    '<div class="spinner"></div><p id="loading-text">Fetching orbital data…</p>';
  document.body.appendChild(overlay);

  return {
    setText(text) {
      overlay.querySelector('#loading-text').textContent = text;
    },
    hide() {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 500);
    },
  };
}
