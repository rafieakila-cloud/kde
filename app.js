// KOMPAS DIGITAL EFEKTIF (KDE)
// Arah dari gyroscope / magnetometer, real-time

const dialEl = document.getElementById('dial');
const degEl = document.getElementById('deg');
const cardinalEl = document.getElementById('cardinal');
const coordEl = document.getElementById('coord');
const ticksEl = document.getElementById('ticks');
const btnMenu = document.getElementById('btnMenu');
const aboutModal = document.getElementById('about');
const btnCloseAbout = document.getElementById('btnCloseAbout');
const btnShare = document.getElementById('btnShare');
const qrImage = document.getElementById('qrImage');
const shareLink = document.getElementById('shareLink');

/* ---------- ticks ---------- */
for (let d = 0; d < 360; d += 10) {
  const major = d % 30 === 0;
  const tick = document.createElement('div');
  tick.className = 'tick' + (major ? ' major' : '');
  tick.style.transform = `rotate(${d}deg) translate(0, -6px)`;
  ticksEl.appendChild(tick);
}

/* ---------- helpers ---------- */
function cardinalFor(deg) {
  const DIRS = ['U','TU','T','TG','S','SG','B','BH'];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return DIRS[idx];
}

let heading = 0;
let smoothed = 0;

function smooth(alpha) {
  // exponential smoothing with wrap-around for compass angles
  let diff = alpha - smoothed;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  smoothed = (smoothed + diff * 0.15 + 360) % 360;
  return smoothed;
}

function updateUI(alpha) {
  heading = alpha;
  const h = smooth(alpha);
  dialEl.style.transform = `rotate(${-h}deg)`;
  degEl.textContent = String(Math.round(h)).padStart(3, '0') + '°';
  cardinalEl.textContent = cardinalFor(h);
  if ('geolocation' in navigator) {
    // only update on meaningful change to avoid spamming
    if (!updateUI._h || Math.abs(h - updateUI._h) > 1) {
      navigator.geolocation.getCurrentPosition(pos => {
        coordEl.textContent = `${pos.coords.latitude.toFixed(5)}°, ${pos.coords.longitude.toFixed(5)}°`;
      }, () => { coordEl.textContent = 'koordinat tidak tersedia'; }, { timeout: 4000 });
      updateUI._h = h;
    }
  } else {
    coordEl.textContent = 'koordinat tidak tersedia';
  }
}

function handleOrientation(e) {
  // iOS uses webkitCompassHeading, Android uses absolute alpha
  let headingAlpha = null;
  if (typeof e.webkitCompassHeading === 'number') {
    headingAlpha = e.webkitCompassHeading;
  } else if (typeof e.alpha === 'number') {
    headingAlpha = e.alpha;
  } else { return; }
  updateUI(headingAlpha);
}

function handleAbsolute(e) {
  if (typeof e.alpha === 'number') updateUI(e.alpha);
}

/* drag fallback (mobile + desktop) */
let dragging = false, lastAngle = 0;
function angleFromEvent(e, el) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const x = (e.clientX ?? e.touches?.[0]?.clientX ?? cx) - cx;
  const y = (e.clientY ?? e.touches?.[0]?.clientY ?? cy) - cy;
  return Math.atan2(y, x) * 180 / Math.PI + 90;
}
dialEl.addEventListener('pointerdown', e => { dragging = true; dialEl.setPointerCapture(e.pointerId); lastAngle = angleFromEvent(e, dialEl); });
dialEl.addEventListener('pointermove', e => {
  if (!dragging) return;
  const a = angleFromEvent(e, dialEl);
  let d = a - lastAngle;
  if (d > 180) d -= 360; if (d < -180) d += 360;
  smoothed = (smoothed + d + 360) % 360;
  lastAngle = a;
  updateUI(smoothed);
});
['pointerup','pointercancel','pointerleave'].forEach(type => dialEl.addEventListener(type, () => { dragging = false; }));

/* ---------- permission (iOS 13+) ---------- */
async function requestAndBind() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const status = await DeviceOrientationEvent.requestPermission();
      if (status !== 'granted') { coordEl.textContent = 'aksesisi sensorkompas ditolak'; return; }
    } catch { coordEl.textContent = 'izin kompas tidak tersedia'; return; }
  }
  window.addEventListener('deviceorientation', handleOrientation, true);
  window.addEventListener('deviceorientationabsolute', handleAbsolute, true);
  coordEl.textContent = 'menunggu sensor…';
}

/* ---------- about / share ---------- */
function shareUrl() { return window.location.href.split('#')[0]; }
function openAbout() {
  const url = shareUrl();
  shareLink.textContent = url;
  shareLink.href = url;
  qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
  aboutModal.classList.remove('hidden');
}
function closeAbout() { aboutModal.classList.add('hidden'); }

btnMenu.addEventListener('click', openAbout);
btnShare.addEventListener('click', openAbout);
btnCloseAbout.addEventListener('click', closeAbout);
aboutModal.addEventListener('click', e => { if (e.target === aboutModal) closeAbout(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAbout(); });

/* ---------- install prompt ---------- */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
/* keep menu open silently with no prompt button for now */

requestAndBind();
