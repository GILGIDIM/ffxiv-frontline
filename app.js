// Map rotation data — order matches the in-game cycle
const MAPS = [
  { name: 'The Borderland Ruins', mode: 'Secure',         accent: '--secure',  image: 'images/secure.png'  },
  { name: 'Seal Rock',            mode: 'Seize',          accent: '--seize',   image: 'images/seize.png'   },
  { name: 'The Fields of Glory',  mode: 'Shatter',        accent: '--shatter', image: 'images/shatter.png' },
  { name: 'Onsal Hakair',         mode: 'Danshig Naadam', accent: '--danshig', image: 'images/danshig.png' },
  { name: 'Worqor Chirteh',       mode: 'Triumph',        accent: '--triumph', image: 'images/triumph.png' },
];

// Reference: 2025-07-18T15:00:00Z is the start of a Secure (index 0) rotation window.
// Each window is exactly 24 hours, advancing the index by 1 (mod 5).
const REFERENCE_MS = Date.UTC(2025, 6, 18, 15, 0, 0); // July 18 2025 15:00 UTC
const ROTATION_OFFSET_KEY = 'ffxiv_rotation_offset';
const DATA_VERSION = '2';

// Clear stale offsets from a previous reference-date era
if (localStorage.getItem('ffxiv_data_version') !== DATA_VERSION) {
  localStorage.removeItem(ROTATION_OFFSET_KEY);
  localStorage.setItem('ffxiv_data_version', DATA_VERSION);
}

// Daily reset time: 15:00 UTC
const RESET_HOUR_UTC = 15;

// ─── Rotation calculation ────────────────────────────────────────────────────

function getUserOffset() {
  return parseInt(localStorage.getItem(ROTATION_OFFSET_KEY) || '0', 10);
}

function getWindowIndex(date) {
  // How many full 24-hour periods have elapsed since the reference reset?
  const elapsed = date.getTime() - REFERENCE_MS;
  const days = Math.floor(elapsed / 86_400_000);
  const raw = ((days % MAPS.length) + MAPS.length) % MAPS.length;
  return (raw + getUserOffset() + MAPS.length) % MAPS.length;
}

function getNextReset(from) {
  const reset = new Date(from);
  reset.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  if (from.getTime() >= reset.getTime()) {
    reset.setUTCDate(reset.getUTCDate() + 1);
  }
  return reset;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatLocalTime(date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function setAccent(el, map) {
  el.style.setProperty('--card-accent', `var(${map.accent})`);
}

function setItemAccent(el, map) {
  el.style.setProperty('--item-accent', `var(${map.accent})`);
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderRotationList(currentIdx) {
  const list = document.getElementById('rotation-list');
  list.innerHTML = '';

  MAPS.forEach((map, i) => {
    const isCurrent = i === currentIdx;
    const nextIdx = (currentIdx + 1) % MAPS.length;
    const isNext = i === nextIdx;

    const li = document.createElement('li');
    li.className = 'rotation-item' +
      (isCurrent ? ' is-current' : '') +
      (isNext    ? ' is-next'    : '');
    setItemAccent(li, map);

    let badge = '';
    if (isCurrent) badge = '<span class="rotation-badge badge-current">Now</span>';
    else if (isNext) badge = '<span class="rotation-badge badge-next">Next</span>';

    li.innerHTML = `
      <span class="rotation-num">${i + 1}</span>
      <div class="rotation-info">
        <span class="rotation-mode">${map.mode}</span>
        <span class="rotation-name">${map.name}</span>
      </div>
      ${badge}
    `;
    list.appendChild(li);
  });
}

function renderCards(currentIdx, nextReset) {
  const current = MAPS[currentIdx];

  // Set --card-accent on the wrapper so both hero and timer inherit it
  const card = document.getElementById('current-map-card');
  setAccent(card, current);

  document.getElementById('current-map-img').src = current.image;
  document.getElementById('current-name').textContent = current.name;
  document.getElementById('current-mode').textContent = `(${current.mode})`;
  document.getElementById('reset-time').textContent =
    `Resets at ${formatLocalTime(nextReset)}`;
}

// ─── Tick loop ───────────────────────────────────────────────────────────────

let lastMapIndex = -1;

function tick() {
  const now = new Date();
  const mapIndex = getWindowIndex(now);
  const nextReset = getNextReset(now);
  const remaining = nextReset.getTime() - now.getTime();

  // Re-render map cards and rotation only when the map changes
  if (mapIndex !== lastMapIndex) {
    lastMapIndex = mapIndex;
    renderCards(mapIndex, nextReset);
    renderRotationList(mapIndex);
  }

  document.getElementById('countdown').textContent = formatCountdown(remaining);
}

// ─── Timezone note ───────────────────────────────────────────────────────────

function renderTimezoneNote() {
  const now = new Date();
  const resetToday = new Date(now);
  resetToday.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localStr = resetToday.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  document.getElementById('tz-note').textContent = `(${localStr} your time)`;
}

// ─── Calibration modal ───────────────────────────────────────────────────────

function buildCalibrateOptions() {
  const container = document.getElementById('calibrate-options');
  container.innerHTML = '';
  MAPS.forEach((map, i) => {
    const div = document.createElement('div');
    div.className = 'calibrate-option';
    const id = `cal-${i}`;
    div.innerHTML = `
      <input type="radio" name="cal-map" id="${id}" value="${i}">
      <label for="${id}">
        <div class="cal-mode" style="color:var(${map.accent})">${map.mode}</div>
        <div class="cal-name">${map.name}</div>
      </label>
    `;
    container.appendChild(div);
  });

  // Pre-select the current displayed map
  const currentIdx = getWindowIndex(new Date());
  const radio = container.querySelector(`input[value="${currentIdx}"]`);
  if (radio) radio.checked = true;
}

function openModal() {
  buildCalibrateOptions();
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function saveCalibration() {
  const selected = document.querySelector('input[name="cal-map"]:checked');
  if (!selected) { closeModal(); return; }

  const chosenIdx = parseInt(selected.value, 10);

  // Compute raw index WITHOUT any stored offset so we don't compound existing corrections
  const elapsed = new Date().getTime() - REFERENCE_MS;
  const days = Math.floor(elapsed / 86_400_000);
  const rawIdx = ((days % MAPS.length) + MAPS.length) % MAPS.length;

  // Determine offset so that (rawIdx + offset) % 5 === chosenIdx
  const offset = ((chosenIdx - rawIdx) % MAPS.length + MAPS.length) % MAPS.length;
  localStorage.setItem(ROTATION_OFFSET_KEY, String(offset));

  lastMapIndex = -1;
  tick();
  closeModal();
}

// ─── Init ────────────────────────────────────────────────────────────────────

document.getElementById('calibrate-btn').addEventListener('click', openModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click', saveCalibration);
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

renderTimezoneNote();
tick();
setInterval(tick, 1000);
