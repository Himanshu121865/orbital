const CACHE_KEY = 'orbital.bulk.v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const FALLBACK_URL = '/fallback-active.tle';

const FALLBACK_TLES = {
  25544: {
    name: 'ISS (ZARYA)',
    line1:
      '1 25544U 98067A   26232.75924728  .00009536  00000+0  17761-3 0  9996',
    line2:
      '2 25544  51.6330 340.5034 0007690  67.3286 292.8515 15.49535659581764',
  },
};

let pendingFetch = null;
let lastFetchFailedAt = 0;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number' || typeof parsed.text !== 'string')
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(ts) {
  return Date.now() - ts < CACHE_TTL_MS;
}

function isStale(ts) {
  return Date.now() - ts < STALE_TTL_MS;
}

function writeCache(text) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), text }));
  } catch (err) {
    // usually means we blew through the storage quota, drop the old entry and retry
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), text }));
    } catch {}
    console.warn('TLE cache write failed:', err?.message);
  }
}

async function fetchFallbackStatic() {
  try {
    const res = await fetch(FALLBACK_URL, { cache: 'force-cache' });
    if (!res.ok) return null;
    const text = await res.text();
    if (text && text.includes('1 ') && text.includes('2 ')) return text;
  } catch {}
  return null;
}

async function fetchAndCache() {
  const urls = ['/api/celestrak', 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=TLE'];
  let lastError = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (
        !text ||
        text.includes('<!DOCTYPE') ||
        text.includes('<html') ||
        text.includes('Error')
      ) {
        throw new Error('Invalid CelesTrak response (HTML/error)');
      }
      if (!text.includes('\n1 ') && !text.trim().startsWith('1 ')) {
        throw new Error('Invalid TLE format');
      }
      writeCache(text);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`TLE fetch failed for ${url}:`, err.message);
    }
  }
  throw lastError || new Error('All TLE fetch attempts failed');
}

export async function fetchAllActive() {
  if (pendingFetch) return pendingFetch;

  const cached = readCache();

  if (cached && isFresh(cached.ts)) {
    return cached.text;
  }

  if (cached && isStale(cached.ts)) {
    if (Date.now() - lastFetchFailedAt > RETRY_DELAY_MS && !pendingFetch) {
      pendingFetch = fetchAndCache()
        .catch((err) => {
          lastFetchFailedAt = Date.now();
          console.warn('Background TLE refresh failed, keeping stale cache:', err.message);
        })
        .finally(() => {
          pendingFetch = null;
        });
    }
    return cached.text;
  }

  const doFetch = async () => {
    try {
      const text = await fetchAndCache();
      return text;
    } catch (err) {
      lastFetchFailedAt = Date.now();
      if (cached) {
        console.warn('Fetch failed, using expired cache as fallback:', err.message);
        return cached.text;
      }
      const fallback = await fetchFallbackStatic();
      if (fallback) {
        console.warn('Using bundled fallback TLE');
        return fallback;
      }
      throw err;
    }
  };

  pendingFetch = doFetch();
  try {
    const result = await pendingFetch;
    return result;
  } finally {
    pendingFetch = null;
  }
}

export async function fetchTLE(noradId) {
  try {
    const res = await fetch(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`CelesTrak returned ${res.status}`);
    const text = (await res.text()).trim();
    const lines = text.split('\n');
    if (lines.length < 3) throw new Error('CelesTrak returned no data');
    return {
      name: lines[0].trim(),
      line1: lines[1].trim(),
      line2: lines[2].trim(),
    };
  } catch (err) {
    const fallback = FALLBACK_TLES[noradId];
    if (!fallback) throw err;
    console.warn(`TLE fetch failed (${err.message}), using offline fallback`);
    return fallback;
  }
}
