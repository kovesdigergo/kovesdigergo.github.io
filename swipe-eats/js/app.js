// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'swipe-eats-rooms';
const SWIPE_THRESHOLD = 80;

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

// ─── Price helper ─────────────────────────────────────────────────────────────
function priceLabel(level) {
  const labels = ['', 'Olcsó', 'Közepes', 'Drágább', 'Fine dining'];
  return labels[level] || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initHome() {
  let friendCount = 3;
  const countEl = document.getElementById('friendCount');

  document.getElementById('decreaseFriends').addEventListener('click', () => {
    if (friendCount > 2) { friendCount--; countEl.textContent = friendCount; }
  });

  document.getElementById('increaseFriends').addEventListener('click', () => {
    if (friendCount < 8) { friendCount++; countEl.textContent = friendCount; }
  });

  document.getElementById('createRoom').addEventListener('click', () => {
    const code = generateCode();
    saveRoom({ code, totalFriends: friendCount, currentFriend: 0, votes: {} });
    window.location.href = `swipe.html?room=${code}`;
  });

  document.getElementById('joinRoom').addEventListener('click', () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) { showError('Kérlek adj meg egy 4 karakteres kódot!'); return; }
    if (!getRoom(code)) { showError('Nem található ilyen szoba. Kérj új kódot!'); return; }
    window.location.href = `swipe.html?room=${code}`;
  });

  document.getElementById('roomCodeInput').addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });

  document.getElementById('roomCodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('joinRoom').click();
  });
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
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

  let currentIndex = 0;
  let animating = false;

  document.getElementById('roomCodeDisplay').textContent = roomCode;
  updateFriendBadge();
  renderCards();
  updateProgress();

  function updateFriendBadge() {
    document.getElementById('friendBadge').textContent = `${room.currentFriend + 1}. barát`;
  }

  function updateProgress() {
    document.getElementById('progressText').textContent = `${currentIndex} / ${RESTAURANTS.length}`;
  }

  // ── Card rendering ───────────────────────────────────────────────────────────
  function renderCards() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';

    const slice = RESTAURANTS.slice(currentIndex, currentIndex + 3);

    if (slice.length === 0) {
      finishCurrentFriend();
      return;
    }

    // Append from back to front so last child = top card
    for (let i = slice.length - 1; i >= 0; i--) {
      const card = buildCard(slice[i], i);
      container.appendChild(card);
    }

    // Only top card is draggable
    setupDrag(container.lastElementChild, slice[0]);
  }

  function buildCard(restaurant, stackIndex) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';

    const transforms = [
      'scale(1) translateY(0)',
      'scale(0.95) translateY(14px)',
      'scale(0.90) translateY(28px)',
    ];
    const zIndexes = [10, 5, 1];

    card.style.zIndex = zIndexes[stackIndex];
    card.style.transform = transforms[stackIndex];

    card.innerHTML = `
      <div class="stamp stamp-like">IGEN ♥</div>
      <div class="stamp stamp-nope">NEM ✕</div>
      <div class="card-image" style="background:${restaurant.gradient}">
        <span class="card-emoji">${restaurant.emoji}</span>
      </div>
      <div class="card-info">
        <h3 class="card-name">${restaurant.name}</h3>
        <div class="card-meta">
          <span class="rating-badge">⭐ ${restaurant.rating}</span>
          <span class="meta-text">${restaurant.cuisine}</span>
          <span class="meta-text">📍 ${restaurant.distance}</span>
        </div>
        <div class="card-tags">
          ${restaurant.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        <span class="price-label">${priceLabel(restaurant.priceLevel)}</span>
      </div>`;

    return card;
  }

  // ── Drag mechanics ───────────────────────────────────────────────────────────
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

      const likeStamp = card.querySelector('.stamp-like');
      const nopeStamp = card.querySelector('.stamp-nope');
      const ratio = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);

      if (dx > 15) {
        likeStamp.style.opacity = ratio;
        nopeStamp.style.opacity = 0;
      } else if (dx < -15) {
        nopeStamp.style.opacity = ratio;
        likeStamp.style.opacity = 0;
      } else {
        likeStamp.style.opacity = 0;
        nopeStamp.style.opacity = 0;
      }
    });

    card.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;

      if (dx > SWIPE_THRESHOLD) {
        doSwipe(card, 'right', restaurant);
      } else if (dx < -SWIPE_THRESHOLD) {
        doSwipe(card, 'left', restaurant);
      } else {
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

  // ── Swipe out ────────────────────────────────────────────────────────────────
  function doSwipe(card, direction, restaurant) {
    if (animating) return;
    animating = true;

    // Record vote
    room = getRoom(roomCode);
    const key = String(room.currentFriend);
    if (!room.votes[key]) room.votes[key] = {};
    room.votes[key][restaurant.id] = direction === 'right';
    saveRoom(room);

    // Promote back cards
    const container = document.getElementById('cardsContainer');
    const cards = container.querySelectorAll('.restaurant-card');
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

    // Fly the swiped card off screen
    const xOut = direction === 'right' ? window.innerWidth + 150 : -(window.innerWidth + 150);
    card.style.transition = 'transform 0.38s ease';
    card.style.transform = `translateX(${xOut}px) rotate(${direction === 'right' ? 28 : -28}deg)`;

    setTimeout(() => {
      currentIndex++;
      animating = false;
      renderCards();
      updateProgress();
    }, 380);
  }

  // ── Button controls ──────────────────────────────────────────────────────────
  document.getElementById('likeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < RESTAURANTS.length) doSwipe(top, 'right', RESTAURANTS[currentIndex]);
  });

  document.getElementById('nopeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < RESTAURANTS.length) doSwipe(top, 'left', RESTAURANTS[currentIndex]);
  });

  // ── Friend transition ────────────────────────────────────────────────────────
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

  function showPassOverlay(nextIndex) {
    const overlay = document.getElementById('friendOverlay');
    document.getElementById('nextFriendText').textContent = `A ${nextIndex + 1}. barát következik`;
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

  const { totalFriends, votes } = room;

  // Tally scores
  const scores = {};
  RESTAURANTS.forEach(r => {
    let likes = 0;
    for (let i = 0; i < totalFriends; i++) {
      if (votes[String(i)] && votes[String(i)][r.id] === true) likes++;
    }
    scores[r.id] = likes;
  });

  const fullMatches = RESTAURANTS.filter(r => scores[r.id] === totalFriends);
  const partials = RESTAURANTS
    .filter(r => scores[r.id] > 0 && scores[r.id] < totalFriends)
    .sort((a, b) => scores[b.id] - scores[a.id])
    .slice(0, 5);

  const container = document.getElementById('matchPage');

  if (fullMatches.length > 0) {
    renderMatchScreen(container, fullMatches, roomCode);
    startConfetti();
  } else {
    renderNoMatchScreen(container, partials, scores, totalFriends, roomCode);
  }
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
        <div class="match-card" style="animation-delay:${0.1 + i * 0.1}s">
          <div class="match-card-img" style="background:${r.gradient}">${r.emoji}</div>
          <div class="match-card-body">
            <div class="match-card-name">${r.name}</div>
            <div class="match-card-meta">⭐ ${r.rating} · ${r.cuisine} · 📍 ${r.distance}</div>
            <div class="card-tags">
              ${r.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
            </div>
          </div>
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
      <p class="match-subtitle">Senki sem szerette ugyanazt – de közel voltatok!</p>
    </div>
    <div class="partial-section">
      <p class="section-label">Legtöbb szavazatot kapta</p>
      ${partials.map(r => `
        <div class="vote-row">
          <div class="vote-emoji" style="background:${r.gradient}">${r.emoji}</div>
          <div class="vote-info">
            <div class="vote-name">${r.name}</div>
            <div class="vote-bar-bg">
              <div class="vote-bar-fill" style="width:${Math.round(scores[r.id] / totalFriends * 100)}%"></div>
            </div>
          </div>
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
  if (room) {
    room.votes = {};
    room.currentFriend = 0;
    saveRoom(room);
  }
  window.location.href = `swipe.html?room=${code}`;
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
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3 + 2,
    vx: (Math.random() - 0.5) * 1.5,
  }));

  let frame = 0;
  function draw() {
    if (frame++ > 220) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  draw();
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
