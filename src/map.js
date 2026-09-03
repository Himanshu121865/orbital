import { propagate, gstime, eciToGeodetic } from 'satellite.js';

let canvas, ctx, container;
let expanded = false;
let currentSatrec = null;
let earthImage = null;
let earthReady = false;

const SAMPLE_SEC = 30;

function ensureEarthImage() {
  if (earthImage) return;
  earthImage = new Image();
  earthImage.src = '/textures/earth_daymap.jpg';
  earthImage.onload = () => {
    earthReady = true;
    if (currentSatrec) redraw();
    else if (canvas) {
      const { w, h } = syncSize();
      if (w && h) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(earthImage, 0, 0, w, h);
        ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
      }
    }
  };
  earthImage.onerror = () => {
    earthReady = false;
  };
}

function project(lonDeg, latDeg, w, h) {
  return [
    ((lonDeg + 180) / 360) * w,
    ((90 - latDeg) / 180) * h,
  ];
}

function sampleTrack(satrec, startMin, endMin) {
  const points = [];
  const now = Date.now();
  for (let t = startMin * 60; t <= endMin * 60; t += SAMPLE_SEC) {
    const date = new Date(now + t * 1000);
    const pv = propagate(satrec, date);
    if (!pv || !pv.position) continue;
    const gd = eciToGeodetic(pv.position, gstime(date));
    points.push({
      lon: (gd.longitude * 180) / Math.PI,
      lat: (gd.latitude * 180) / Math.PI,
    });
  }
  return points;
}

function drawLine(ctx, points, color, dashed, w, h) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dashed ? [5, 3] : []);

  let prevX = null;
  let started = false;
  for (const p of points) {
    const [x, y] = project(p.lon, p.lat, w, h);
    if (prevX !== null && Math.abs(x - prevX) > w / 2) {
      ctx.stroke();
      ctx.beginPath();
      started = false;
    }
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
    prevX = x;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(120, 180, 255, 0.07)';
  ctx.lineWidth = 0.5;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function syncSize() {
  const rect = container.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor((rect.width / 2) * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = (rect.width / 2) + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.width / 2, dpr };
}

function redraw() {
  if (!canvas) return;
  const { w, h } = syncSize();

  ctx.clearRect(0, 0, w, h);
  if (earthReady) {
    ctx.drawImage(earthImage, 0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.92)';
    ctx.fillRect(0, 0, w, h);
  }

  drawGrid(ctx, w, h);

  if (!currentSatrec) return;

  const periodMin = (2 * Math.PI) / currentSatrec.no;
  const half = periodMin / 2;

  drawLine(ctx, sampleTrack(currentSatrec, -half, 0), '#ffd54f', false, w, h);
  drawLine(ctx, sampleTrack(currentSatrec, 0, half), '#4fc3f7', true, w, h);

  const now = new Date();
  const pv = propagate(currentSatrec, now);
  if (pv && pv.position) {
    const gd = eciToGeodetic(pv.position, gstime(now));
    const [x, y] = project(
      (gd.longitude * 180) / Math.PI,
      (gd.latitude * 180) / Math.PI,
      w,
      h
    );
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
  }
}

function toggleExpand() {
  expanded = !expanded;
  const btn = container.querySelector('#map-expand');
  btn.textContent = expanded ? '×' : '⤢';

  if (expanded) {
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.width = '90vw';
    container.style.maxWidth = '1200px';
    container.style.maxHeight = '85vh';
    container.style.aspectRatio = '2 / 1';
    container.style.height = 'auto';
    container.style.bottom = 'auto';
    container.style.right = 'auto';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    canvas.style.objectFit = 'contain';
    canvas.style.minHeight = '0';
  } else {
    const isMobile = window.matchMedia('(max-width:768px)').matches;
    container.style.position = 'fixed';
    container.style.top = 'auto';
    container.style.bottom = isMobile ? '10px' : '20px';
    container.style.right = '20px';
    container.style.left = 'auto';
    container.style.transform = 'none';
    container.style.width = isMobile ? 'calc(100% - 40px)' : '320px';
    container.style.maxWidth = isMobile ? 'none' : '320px';
    container.style.maxHeight = 'none';
    container.style.aspectRatio = 'auto';
    container.style.height = 'auto';
    container.style.zIndex = '100';
    container.style.display = 'block';
    canvas.style.objectFit = 'fill';
    canvas.style.minHeight = 'auto';
  }
  void container.offsetHeight;
  syncSize();
  redraw();
}

export function createMapOverlay() {
  container = document.createElement('div');
  container.id = 'map-container';
  container.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'map-header';
  const title = document.createElement('span');
  title.textContent = 'GROUND TRACK 2D';
  header.appendChild(title);

  const btn = document.createElement('button');
  btn.id = 'map-expand';
  btn.textContent = '⤢';
  btn.addEventListener('click', toggleExpand);
  header.appendChild(btn);

  container.appendChild(header);

  canvas = document.createElement('canvas');
  container.appendChild(canvas);

  document.body.appendChild(container);
  ctx = canvas.getContext('2d');

  ensureEarthImage();

  return { setSatrec, redraw, show, hide };
}

function setSatrec(satrec) {
  currentSatrec = satrec;
  redraw();
}

function show() {
  container.style.display = expanded ? 'flex' : 'block';
  syncSize();
  redraw();
}

function hide() {
  container.style.display = 'none';
}
