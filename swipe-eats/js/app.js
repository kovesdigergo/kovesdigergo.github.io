// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'swipe-eats-rooms';
const SWIPE_THRESHOLD = 80;
const SESSION_RESTAURANTS = 'swipe-eats-restaurants';
const SESSION_GPS = 'swipe-eats-gps';

// ─── Storage helpers ──────────────────────────────────────────────────────────
function getRooms() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
function getRoom(code) { return getRooms()[code] || null; }
function saveRoom(room) {
  const rooms = getRooms();
  rooms[room.code] = room;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getActiveRestaurants() {
  try {
    const raw = sessionStorage.getItem(SESSION_RESTAURANTS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return RESTAURANTS;
}

function isGpsMode() {
  return sessionStorage.getItem(SESSION_GPS) === '1';
}

function priceLabel(level) {
  return ['', 'Olcsó €', 'Közepes €€', 'Drágább €€€', 'Fine dining'][level] || '';
}

// ─── Firebase (optional) ─────────────────────────────────────────────────────
let db = null;

async function initFirebase() {
  if (!window.FIREBASE_CONFIG) return false;
  try {
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    return true;
  } catch { return false; }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = Object.assign(document.createElement('script'), { src, onload: resolve, onerror: reject });
    document.head.appendChild(s);
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍽️</text></svg>' }); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initHome() {
  // Auto-fill from ?join= URL param
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode) {
    document.getElementById('roomCodeInput').value = joinCode.toUpperCase();
    setTimeout(() => document.getElementById('roomCodeInput').focus(), 300);
  }

  // Friend count selector
  let friendCount = 3;
  const countEl = document.getElementById('friendCount');
  document.getElementById('decreaseFriends').addEventListener('click', () => {
    if (friendCount > 2) { friendCount--; countEl.textContent = friendCount; }
  });
  document.getElementById('increaseFriends').addEventListener('click', () => {
    if (friendCount < 8) { friendCount++; countEl.textContent = friendCount; }
  });

  // Create room – GPS-first
  document.getElementById('createRoom').addEventListener('click', async () => {
    document.getElementById('createRoom').disabled = true;
    showLoading(true, '📍 GPS lekérés...');

    const { list, gps } = await loadRestaurants(msg => showLoading(true, msg));

    sessionStorage.setItem(SESSION_RESTAURANTS, JSON.stringify(list));
    sessionStorage.setItem(SESSION_GPS, gps ? '1' : '0');

    const code = generateCode();
    saveRoom({ code, totalFriends: friendCount, currentFriend: 0, votes: {} });

    showLoading(false);
    showShareBox(code, gps);
  });

  // Join room
  document.getElementById('joinRoom').addEventListener('click', () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) { showError('Kérlek adj meg egy 4 karakteres kódot!'); return; }
    const room = getRoom(code);
    if (!room) { showError('A kód nem létezik ezen az eszközön. Hozz létre új szobát!'); return; }
    window.location.href = `swipe.html?room=${code}`;
  });

  document.getElementById('roomCodeInput').addEventListener('input', function () {
    this.value = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  });
  document.getElementById('roomCodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinRoom').click();
  });

  // Share box events (set up after box is shown)
  document.getElementById('copyShareBtn').addEventListener('click', async () => {
    const url = document.getElementById('shareUrl').href;
    try {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('copyShareBtn');
      const orig = btn.textContent;
      btn.textContent = '✓ Másolva!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    } catch { /* clipboard not available */ }
  });

  document.getElementById('goToSwipe').addEventListener('click', () => {
    const code = document.getElementById('sharedCode').textContent;
    if (code) window.location.href = `swipe.html?room=${code}`;
  });

  // Notification prompt
  document.getElementById('enableNotif')?.addEventListener('click', async () => {
    const granted = await requestNotifPermission();
    const btn = document.getElementById('enableNotif');
    btn.textContent = granted ? '✓ Engedélyezve' : '✗ Letiltva';
    btn.disabled = true;
  });

  // Hide notification prompt if already decided
  if (Notification.permission !== 'default') {
    document.getElementById('notifPrompt')?.style.setProperty('display', 'none');
  }

  // Show Firebase status
  if (window.FIREBASE_CONFIG) {
    document.getElementById('firebaseStatus')?.classList.add('active');
  }
}

function showLoading(visible, msg) {
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
  if (msg) document.getElementById('loadingText').textContent = msg;
}

function showShareBox(code, gps) {
  const box = document.getElementById('shareBox');
  const url = `${location.origin}${location.pathname.replace('index.html', '')}index.html?join=${code}`;
  document.getElementById('sharedCode').textContent = code;
  const link = document.getElementById('shareUrl');
  link.href = url;
  link.textContent = url.replace(/^https?:\/\//, '');
  if (gps) document.getElementById('gpsUsedBadge')?.style.setProperty('display', 'flex');
  box.style.display = 'block';
  requestAnimationFrame(() => box.classList.add('visible'));
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWIPE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initSwipe() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = 'index.html'; return; }

  let room = getRoom(roomCode);
  if (!room) { window.location.href = 'index.html'; return; }

  const restaurants = getActiveRestaurants();
  let currentIndex = 0;
  let animating = false;

  document.getElementById('roomCodeDisplay').textContent = roomCode;

  // GPS badge
  if (isGpsMode()) document.getElementById('gpsBadge')?.style.setProperty('display', 'flex');

  updateFriendBadge();
  renderCards();
  updateProgress();

  function updateFriendBadge() {
    document.getElementById('friendBadge').textContent = `${room.currentFriend + 1}. barát`;
  }

  function updateProgress() {
    document.getElementById('progressText').textContent = `${currentIndex} / ${restaurants.length}`;
    const pct = restaurants.length ? currentIndex / restaurants.length * 100 : 0;
    document.getElementById('progressBar').style.width = `${pct}%`;
  }

  // ── Card rendering ───────────────────────────────────────────────────────────
  function renderCards() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    const slice = restaurants.slice(currentIndex, currentIndex + 3);
    if (slice.length === 0) { finishCurrentFriend(); return; }

    for (let i = slice.length - 1; i >= 0; i--) {
      container.appendChild(buildCard(slice[i], i));
    }
    setupDrag(container.lastElementChild, slice[0]);
  }

  function buildCard(r, si) {
    const transforms = ['scale(1) translateY(0)', 'scale(0.95) translateY(14px)', 'scale(0.90) translateY(28px)'];
    const zIndexes = [10, 5, 1];
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.style.cssText = `z-index:${zIndexes[si]};transform:${transforms[si]};`;
    card.innerHTML = `
      <div class="stamp stamp-like">IGEN ♥</div>
      <div class="stamp stamp-nope">NEM ✕</div>
      <div class="card-image" style="background:${r.gradient}">
        <span class="card-emoji">${r.emoji}</span>
      </div>
      <div class="card-info">
        <h3 class="card-name">${r.name}</h3>
        <div class="card-meta">
          <span class="rating-badge">⭐ ${r.rating}</span>
          <span class="meta-text">${r.cuisine}</span>
          <span class="meta-text">📍 ${r.distance}</span>
        </div>
        <div class="card-tags">${r.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <span class="price-label">${priceLabel(r.priceLevel)}</span>
      </div>`;
    return card;
  }

  // ── Pointer drag ─────────────────────────────────────────────────────────────
  function setupDrag(card, restaurant) {
    let startX = 0, dragging = false;

    card.addEventListener('pointerdown', e => {
      if (animating) return;
      dragging = true;
      startX = e.clientX;
      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
      document.getElementById('swipeHint').style.opacity = '0';
    });

    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.07}deg)`;
      const ratio = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
      const ls = card.querySelector('.stamp-like');
      const ns = card.querySelector('.stamp-nope');
      if (dx > 15) { ls.style.opacity = ratio; ns.style.opacity = 0; }
      else if (dx < -15) { ns.style.opacity = ratio; ls.style.opacity = 0; }
      else { ls.style.opacity = 0; ns.style.opacity = 0; }
    });

    card.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if (dx > SWIPE_THRESHOLD) doSwipe(card, 'right', restaurant);
      else if (dx < -SWIPE_THRESHOLD) doSwipe(card, 'left', restaurant);
      else {
        card.style.transition = 'transform 0.45s cubic-bezier(0.175,0.885,0.32,1.275)';
        card.style.transform = 'translateX(0) rotate(0deg)';
        card.querySelector('.stamp-like').style.opacity = 0;
        card.querySelector('.stamp-nope').style.opacity = 0;
      }
    });

    card.addEventListener('pointercancel', () => {
      dragging = false;
      card.style.transition = 'transform 0.3s ease';
      card.style.transform = 'translateX(0) rotate(0deg)';
    });

    card.addEventListener('dragstart', e => e.preventDefault());
  }

  // ── Swipe animation + vote recording ─────────────────────────────────────────
  function doSwipe(card, direction, restaurant) {
    if (animating) return;
    animating = true;

    room = getRoom(roomCode);
    const key = String(room.currentFriend);
    if (!room.votes[key]) room.votes[key] = {};
    room.votes[key][restaurant.id] = direction === 'right';
    saveRoom(room);

    const container = document.getElementById('cardsContainer');
    const cards = [...container.querySelectorAll('.restaurant-card')];

    if (cards.length > 1) {
      cards[cards.length - 2].style.transition = 'transform 0.35s ease';
      cards[cards.length - 2].style.transform = 'scale(1) translateY(0)';
      cards[cards.length - 2].style.zIndex = '10';
    }
    if (cards.length > 2) {
      cards[cards.length - 3].style.transition = 'transform 0.35s ease';
      cards[cards.length - 3].style.transform = 'scale(0.95) translateY(14px)';
      cards[cards.length - 3].style.zIndex = '5';
    }

    const xOut = direction === 'right' ? window.innerWidth + 150 : -(window.innerWidth + 150);
    card.style.transition = 'transform 0.38s ease';
    card.style.transform = `translateX(${xOut}px) rotate(${direction === 'right' ? 28 : -28}deg)`;

    // Button flash
    const btn = direction === 'right' ? document.getElementById('likeBtn') : document.getElementById('nopeBtn');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 300);

    setTimeout(() => { currentIndex++; animating = false; renderCards(); updateProgress(); }, 380);
  }

  // ── Buttons ──────────────────────────────────────────────────────────────────
  document.getElementById('likeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < restaurants.length) doSwipe(top, 'right', restaurants[currentIndex]);
  });
  document.getElementById('nopeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < restaurants.length) doSwipe(top, 'left', restaurants[currentIndex]);
  });

  // ── Friend transition ─────────────────────────────────────────────────────────
  function finishCurrentFriend() {
    room = getRoom(roomCode);
    if (room.currentFriend + 1 >= room.totalFriends) {
      setTimeout(() => window.location.href = `match.html?room=${roomCode}`, 300);
    } else {
      room.currentFriend++;
      saveRoom(room);
      showPassOverlay(room.currentFriend);
    }
  }

  function showPassOverlay(nextIdx) {
    const overlay = document.getElementById('friendOverlay');
    document.getElementById('nextFriendText').textContent = `A ${nextIdx + 1}. barát következik`;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  document.getElementById('nextFriendBtn').addEventListener('click', () => {
    const overlay = document.getElementById('friendOverlay');
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
    room = getRoom(roomCode);
    currentIndex = 0;
    updateFriendBadge();
    renderCards();
    updateProgress();
    document.getElementById('swipeHint').style.opacity = '1';
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initMatch() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) { window.location.href = 'index.html'; return; }

  const room = getRoom(roomCode);
  if (!room) { window.location.href = 'index.html'; return; }

  const restaurants = getActiveRestaurants();
  const { totalFriends, votes } = room;

  const scores = {};
  restaurants.forEach(r => {
    let likes = 0;
    for (let i = 0; i < totalFriends; i++) {
      if (votes[String(i)] && votes[String(i)][r.id] === true) likes++;
    }
    scores[r.id] = likes;
  });

  const fullMatches = restaurants.filter(r => scores[r.id] === totalFriends);
  const partials = restaurants
    .filter(r => scores[r.id] > 0 && scores[r.id] < totalFriends)
    .sort((a, b) => scores[b.id] - scores[a.id])
    .slice(0, 6);

  const container = document.getElementById('matchPage');

  if (fullMatches.length > 0) {
    renderMatchScreen(container, fullMatches, roomCode);
    startConfetti();
    scheduleNotif(fullMatches[0].name);
  } else {
    renderNoMatchScreen(container, partials, scores, totalFriends, roomCode);
  }
}

function mapsLink(r) {
  if (r.lat && r.lon) return `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ', Budapest')}`;
}

function renderMatchScreen(container, matches, roomCode) {
  container.innerHTML = `
    <div class="match-header">
      <div class="match-icon">🎉</div>
      <h1 class="match-title">MATCH!</h1>
      <p class="match-subtitle">Mindenki ezeket szerette</p>
    </div>
    <div class="match-list">
      ${matches.map((r, i) => `
        <div class="match-card" style="animation-delay:${0.1 + i * 0.12}s">
          <div class="match-card-img" style="background:${r.gradient}">${r.emoji}</div>
          <div class="match-card-body">
            <div class="match-card-name">${r.name}</div>
            <div class="match-card-meta">⭐ ${r.rating} · ${r.cuisine} · 📍 ${r.distance}</div>
            <div class="card-tags">${r.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}</div>
          </div>
          <a class="btn-maps" href="${mapsLink(r)}" target="_blank" rel="noopener">📍</a>
        </div>`).join('')}
    </div>
    <div class="match-actions">
      <button class="btn btn-primary" onclick="retryRoom('${roomCode}')">🔄 Újra</button>
      <button class="btn btn-secondary" onclick="window.location.href='index.html'">🏠 Főoldal</button>
    </div>`;
}

function renderNoMatchScreen(container, partials, scores, totalFriends, roomCode) {
  container.innerHTML = `
    <div class="no-match-header">
      <div class="match-icon">😕</div>
      <h1 class="no-match-title">Nincs teljes match</h1>
      <p class="match-subtitle">Majdnem! Íme a legtöbb szavazatot kapott helyek:</p>
    </div>
    <div class="partial-section">
      ${partials.length ? '' : '<p style="text-align:center;color:var(--text-muted);padding:20px">Senki sem like-olt semmit.</p>'}
      ${partials.map(r => `
        <div class="vote-row">
          <div class="vote-emoji" style="background:${r.gradient}">${r.emoji}</div>
          <div class="vote-info">
            <div class="vote-name">${r.name}</div>
            <div class="vote-bar-bg"><div class="vote-bar-fill" style="width:${Math.round(scores[r.id] / totalFriends * 100)}%"></div></div>
          </div>
          <a class="btn-maps-sm" href="${mapsLink(r)}" target="_blank" rel="noopener" title="Navigálás">📍</a>
          <div class="vote-count">${scores[r.id]}/${totalFriends}</div>
        </div>`).join('')}
    </div>
    <div class="match-actions">
      <button class="btn btn-primary" onclick="retryRoom('${roomCode}')">🔄 Próbáljuk újra</button>
      <button class="btn btn-secondary" onclick="window.location.href='index.html'">🏠 Főoldal</button>
    </div>`;
}

function retryRoom(code) {
  const room = getRoom(code);
  if (room) { room.votes = {}; room.currentFriend = 0; saveRoom(room); }
  window.location.href = `swipe.html?room=${code}`;
}

async function scheduleNotif(restaurantName) {
  await requestNotifPermission();
  setTimeout(() => showNotification('🎉 MATCH!', `Menjetek a ${restaurantName}-ba!`), 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════════════════════════
function startConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ff6b6b', '#ffa94d', '#4ecdc4', '#4ade80', '#ffd700', '#ff85a1', '#a78bfa'];
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360, rotSpd: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3 + 2, vx: (Math.random() - 0.5) * 1.5,
  }));

  let frame = 0;
  (function draw() {
    if (frame++ > 240) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.rot += p.rotSpd;
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    requestAnimationFrame(draw);
  })();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('swipe.html')) initSwipe();
  else if (path.endsWith('match.html')) initMatch();
  else initHome();
});
