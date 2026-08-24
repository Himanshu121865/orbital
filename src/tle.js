const CACHE_KEY = 'orbital.tle.v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FALLBACK_TLES = {
  25544: {
    name: 'ISS (ZARYA)',
    line1:
      '1 25544U 98067A   26232.75924728  .00009536  00000+0  17761-3 0  9996',
    line2:
      '2 25544  51.6330 340.5034 0007690  67.3286 292.8515 15.49535659581764',
  },
};

function readCache(noradId) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    const entry = cache[noradId];
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.tle;
  } catch {
    return null;
  }
  return null;
}

function writeCache(noradId, tle) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
    cache[noradId] = { fetchedAt: Date.now(), tle };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    return;
  }
}

export async function fetchTLE(noradId) {
  const cached = readCache(noradId);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`
    );
    if (!res.ok) throw new Error(`CelesTrak returned ${res.status}`);
    const text = (await res.text()).trim();
    const lines = text.split('\n');
    if (lines.length < 3) throw new Error('CelesTrak returned no data');
    const tle = {
      name: lines[0].trim(),
      line1: lines[1].trim(),
      line2: lines[2].trim(),
    };
    writeCache(noradId, tle);
    return tle;
  } catch (err) {
    const fallback = FALLBACK_TLES[noradId];
    if (!fallback) throw err;
    console.warn(`TLE fetch failed (${err.message}), using offline fallback`);
    return fallback;
  }
}
