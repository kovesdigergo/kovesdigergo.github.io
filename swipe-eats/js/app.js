// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY    = 'swipe-eats-rooms';
const SWIPE_THRESHOLD = 80;
const SESSION_RESTAURANTS = 'swipe-eats-restaurants';
const SESSION_GPS    = 'swipe-eats-gps';
const SESSION_MODE   = 'swipe-eats-mode';   // 'single' | 'multi'

// ─── localStorage helpers (single-device mode) ────────────────────────────────
function getRooms() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
function getRoom(code) { return getRooms()[code] || null; }
function saveRoom(room) {
  const r = getRooms(); r[room.code] = room;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Session helpers ──────────────────────────────────────────────────────────
function getActiveRestaurants() {
  try {
    const raw = sessionStorage.getItem(SESSION_RESTAURANTS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return RESTAURANTS;
}
function isGpsMode()   { return sessionStorage.getItem(SESSION_GPS)  === '1'; }
function getMode()     { return sessionStorage.getItem(SESSION_MODE) || 'single'; }

function priceLabel(level) {
  return ['', '€ Olcsó', '€€ Közepes', '€€€ Drágább', '€€€€ Fine dining'][level] || '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE  (index.html – multi-screen SPA)
// ═══════════════════════════════════════════════════════════════════════════════
function initHome() {
  const params = new URLSearchParams(window.location.search);

  // ── Multi-device JOIN flow: someone opened a shared ?blob= link ──────────────
  const blobId = params.get('blob');
  if (blobId) {
    showScreen('screen-join');
    document.getElementById('joinBlobId').value = blobId;
    document.getElementById('joinBtn').addEventListener('click', async () => {
      const uid = getOrCreateUid();
      setLoading(true, '⏳ Csatlakozás...');
      try {
        const data = await updateBlob(blobId, d => {
          d.participants = d.participants || {};
          d.participants[uid] = { joined: Date.now(), progress: 0, total: d.restaurants?.length || 15, done: false, votes: {} };
          return d;
        });
        sessionStorage.setItem(SESSION_RESTAURANTS, JSON.stringify(data.restaurants || []));
        sessionStorage.setItem(SESSION_MODE, 'multi');
        setLoading(false);
        window.location.href = `swipe.html?blob=${blobId}&mode=multi`;
      } catch {
        setLoading(false);
        showError('Nem sikerült csatlakozni. Kérj új linket!');
      }
    });
    return;
  }

  // ── Normal home: mode selection ───────────────────────────────────────────────
  showScreen('screen-mode');

  document.getElementById('modeSingle').addEventListener('click', () => {
    sessionStorage.setItem(SESSION_MODE, 'single');
    document.getElementById('friendsRow').style.display = 'flex';
    showScreen('screen-settings');
  });

  document.getElementById('modeMulti').addEventListener('click', () => {
    sessionStorage.setItem(SESSION_MODE, 'multi');
    document.getElementById('friendsRow').style.display = 'flex';
    showScreen('screen-settings');
  });

  // ── Sliders ───────────────────────────────────────────────────────────────────
  setupSlider('countSlider', 'countVal', v => v, '');
  setupSlider('radiusSlider', 'radiusVal', v => v, ' km');

  // ── Friend count (single mode) ────────────────────────────────────────────────
  let friendCount = 3;
  document.getElementById('decreaseFriends').addEventListener('click', () => {
    if (friendCount > 2) { friendCount--; document.getElementById('friendCount').textContent = friendCount; }
  });
  document.getElementById('increaseFriends').addEventListener('click', () => {
    if (friendCount < 8) { friendCount++; document.getElementById('friendCount').textContent = friendCount; }
  });

  // ── Create room ───────────────────────────────────────────────────────────────
  document.getElementById('createRoom').addEventListener('click', async () => {
    const count  = parseInt(document.getElementById('countSlider').value, 10);
    const radius = parseInt(document.getElementById('radiusSlider').value, 10);
    const mode   = getMode();

    document.getElementById('createRoom').disabled = true;
    setLoading(true, '📍 GPS lekérés...');

    const { list, gps } = await loadRestaurants(msg => setLoading(true, msg), count, radius);
    sessionStorage.setItem(SESSION_RESTAURANTS, JSON.stringify(list));
    sessionStorage.setItem(SESSION_GPS, gps ? '1' : '0');

    setLoading(false);

    if (mode === 'multi') {
      // Create jsonblob
      setLoading(true, '☁️ Szoba létrehozása...');
      try {
        const uid = getOrCreateUid();
        const blob = {
          totalFriends: friendCount,
          restaurants: list,
          status: 'voting',
          participants: {
            [uid]: { joined: Date.now(), progress: 0, total: list.length, done: false, votes: {} }
          },
        };
        const newBlobId = await createBlob(blob);
        setLoading(false);
        showMultiShareScreen(newBlobId, gps);
      } catch {
        setLoading(false);
        showError('Nem sikerült a szobát létrehozni. Próbáld újra!');
        document.getElementById('createRoom').disabled = false;
      }
    } else {
      // localStorage room
      const code = generateCode();
      saveRoom({ code, totalFriends: friendCount, currentFriend: 0, votes: {} });
      showSingleShareScreen(code, gps);
    }
  });

  // ── Single mode: share screen events ─────────────────────────────────────────
  document.getElementById('goToSwipeSingle').addEventListener('click', () => {
    const code = document.getElementById('singleCode').textContent;
    window.location.href = `swipe.html?room=${code}&mode=single`;
  });
  document.getElementById('copySingleBtn').addEventListener('click', () => {
    // single mode: just copy the code (no real link needed)
    const code = document.getElementById('singleCode').textContent;
    navigator.clipboard?.writeText(code);
    flashBtn('copySingleBtn', '✓ Másolva!');
  });

  // ── Multi mode: share screen events ──────────────────────────────────────────
  document.getElementById('goToSwipeMulti').addEventListener('click', () => {
    const bId = document.getElementById('multiShareBlobId').value;
    const uid = getOrCreateUid();
    window.location.href = `swipe.html?blob=${bId}&mode=multi&uid=${uid}`;
  });
  document.getElementById('copyMultiBtn').addEventListener('click', async () => {
    const url = document.getElementById('multiShareUrl').href;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    flashBtn('copyMultiBtn', '✓ Másolva!');
  });

  // ── Notification opt-in ───────────────────────────────────────────────────────
  if (Notification.permission !== 'default') {
    document.getElementById('notifPrompt')?.style.setProperty('display', 'none');
  }
  document.getElementById('enableNotif')?.addEventListener('click', async () => {
    const ok = await Notification.requestPermission();
    const btn = document.getElementById('enableNotif');
    btn.textContent = ok === 'granted' ? '✓ Engedélyezve' : '✗ Letiltva';
    btn.disabled = true;
  });

  // ── Back buttons ──────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back));
  });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.style.flexDirection = 'column'; }
}

function setupSlider(sliderId, valId, transform, suffix) {
  const sl = document.getElementById(sliderId);
  const vl = document.getElementById(valId);
  if (!sl || !vl) return;
  const update = () => {
    vl.textContent = transform(sl.value) + suffix;
    const pct = (sl.value - sl.min) / (sl.max - sl.min) * 100;
    sl.style.setProperty('--pct', pct + '%');
  };
  sl.addEventListener('input', update);
  update();
}

function setLoading(visible, msg) {
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
  if (msg) document.getElementById('loadingText').textContent = msg;
}

function showSingleShareScreen(code, gps) {
  document.getElementById('singleCode').textContent = code;
  if (gps) document.getElementById('singleGpsBadge')?.style.setProperty('display', 'flex');
  showScreen('screen-share-single');
}

function showMultiShareScreen(blobId, gps) {
  const url = `${location.origin}${location.pathname}?blob=${blobId}`;
  document.getElementById('multiShareBlobId').value = blobId;
  const link = document.getElementById('multiShareUrl');
  link.href = url;
  link.textContent = url.replace(/^https?:\/\//, '');
  if (gps) document.getElementById('multiGpsBadge')?.style.setProperty('display', 'flex');
  showScreen('screen-share-multi');
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function flashBtn(id, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWIPE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initSwipe() {
  const params  = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const blobId  = params.get('blob');
  const mode    = params.get('mode') || 'single';

  if (!roomCode && !blobId) { window.location.href = 'index.html'; return; }

  const restaurants = getActiveRestaurants();
  let currentIndex  = 0;
  let animating     = false;
  const uid         = getOrCreateUid();

  // ── Header setup ──────────────────────────────────────────────────────────────
  if (mode === 'multi') {
    document.getElementById('roomCodeDisplay').textContent = '🌐 Multi';
    document.getElementById('friendBadge').textContent = 'Saját telefon';
  } else {
    const room = getRoom(roomCode);
    if (!room) { window.location.href = 'index.html'; return; }
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    document.getElementById('friendBadge').textContent = `${room.currentFriend + 1}. barát`;
  }

  if (isGpsMode()) document.getElementById('gpsBadge')?.style.setProperty('display', 'flex');

  renderCards();
  updateProgress();

  function updateProgress() {
    document.getElementById('progressText').textContent = `${currentIndex} / ${restaurants.length}`;
    const pct = restaurants.length ? currentIndex / restaurants.length * 100 : 0;
    document.getElementById('progressBar').style.width = `${pct}%`;
  }

  // ── Card rendering ─────────────────────────────────────────────────────────────
  function renderCards() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';
    const slice = restaurants.slice(currentIndex, currentIndex + 3);
    if (slice.length === 0) { finishSwiping(); return; }
    for (let i = slice.length - 1; i >= 0; i--) container.appendChild(buildCard(slice[i], i));
    setupDrag(container.lastElementChild, slice[0]);
  }

  function buildCard(r, si) {
    const transforms = ['scale(1) translateY(0)', 'scale(0.95) translateY(14px)', 'scale(0.90) translateY(28px)'];
    const zIndexes   = [10, 5, 1];
    const card = document.createElement('div');
    card.className = 'restaurant-card';
    card.style.cssText = `z-index:${zIndexes[si]};transform:${transforms[si]};`;

    card.innerHTML = `
      <div class="stamp stamp-like">IGEN ♥</div>
      <div class="stamp stamp-nope">NEM ✕</div>
      <div class="card-image"></div>
      <div class="card-info">
        <h3 class="card-name">${r.name}</h3>
        <div class="card-meta">
          <span class="rating-badge">⭐ ${r.rating}</span>
          <span class="meta-text">${r.cuisine}</span>
          <span class="meta-text">📍 ${r.distance}</span>
        </div>
        <div class="card-tags">${r.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}</div>
        ${r.description ? `<p class="card-desc">${r.description}</p>` : ''}
        <span class="price-label">${priceLabel(r.priceLevel)}</span>
      </div>`;

    // Apply photo (with gradient fallback)
    applyCardPhoto(card.querySelector('.card-image'), r.photo || null, r.gradient, r.emoji);
    return card;
  }

  // ── Drag ───────────────────────────────────────────────────────────────────────
  function setupDrag(card, restaurant) {
    let startX = 0, dragging = false;
    card.addEventListener('pointerdown', e => {
      if (animating) return;
      dragging = true; startX = e.clientX;
      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
      document.getElementById('swipeHint').style.opacity = '0';
    });
    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.07}deg)`;
      const ratio = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
      const ls = card.querySelector('.stamp-like'), ns = card.querySelector('.stamp-nope');
      if (dx > 15) { ls.style.opacity = ratio; ns.style.opacity = 0; }
      else if (dx < -15) { ns.style.opacity = ratio; ls.style.opacity = 0; }
      else { ls.style.opacity = 0; ns.style.opacity = 0; }
    });
    card.addEventListener('pointerup', e => {
      if (!dragging) return; dragging = false;
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

  // ── Swipe out ──────────────────────────────────────────────────────────────────
  function doSwipe(card, direction, restaurant) {
    if (animating) return;
    animating = true;

    const liked = direction === 'right';

    if (mode === 'multi' && blobId) {
      // Write vote to blob (fire-and-forget)
      updateBlob(blobId, d => {
        const p = d.participants?.[uid];
        if (p) { p.votes = p.votes || {}; p.votes[restaurant.id] = liked; p.progress = currentIndex + 1; }
        return d;
      }).catch(() => {/* silently ignore */});
    } else {
      // localStorage
      const room = getRoom(roomCode);
      const key = String(room.currentFriend);
      if (!room.votes[key]) room.votes[key] = {};
      room.votes[key][restaurant.id] = liked;
      saveRoom(room);
    }

    // Promote back cards visually
    const container = document.getElementById('cardsContainer');
    const cards = [...container.querySelectorAll('.restaurant-card')];
    if (cards.length > 1) { cards[cards.length - 2].style.transition = 'transform 0.35s ease'; cards[cards.length - 2].style.transform = 'scale(1) translateY(0)'; cards[cards.length - 2].style.zIndex = '10'; }
    if (cards.length > 2) { cards[cards.length - 3].style.transition = 'transform 0.35s ease'; cards[cards.length - 3].style.transform = 'scale(0.95) translateY(14px)'; cards[cards.length - 3].style.zIndex = '5'; }

    const xOut = direction === 'right' ? window.innerWidth + 150 : -(window.innerWidth + 150);
    card.style.transition = 'transform 0.38s ease';
    card.style.transform = `translateX(${xOut}px) rotate(${direction === 'right' ? 28 : -28}deg)`;

    const btn = direction === 'right' ? document.getElementById('likeBtn') : document.getElementById('nopeBtn');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 300);

    setTimeout(() => { currentIndex++; animating = false; renderCards(); updateProgress(); }, 380);
  }

  document.getElementById('likeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < restaurants.length) doSwipe(top, 'right', restaurants[currentIndex]);
  });
  document.getElementById('nopeBtn').addEventListener('click', () => {
    const top = document.querySelector('#cardsContainer .restaurant-card:last-child');
    if (top && currentIndex < restaurants.length) doSwipe(top, 'left', restaurants[currentIndex]);
  });

  // ── Done swiping ───────────────────────────────────────────────────────────────
  function finishSwiping() {
    if (mode === 'multi' && blobId) {
      // Mark done in blob then go to waiting screen
      updateBlob(blobId, d => {
        const p = d.participants?.[uid];
        if (p) { p.done = true; p.progress = restaurants.length; }
        return d;
      }).finally(() => {
        window.location.href = `waiting.html?blob=${blobId}`;
      });
    } else {
      // Single device: pass phone or go to match
      const room = getRoom(roomCode);
      if (room.currentFriend + 1 >= room.totalFriends) {
        setTimeout(() => window.location.href = `match.html?room=${roomCode}`, 300);
      } else {
        room.currentFriend++;
        saveRoom(room);
        showPassOverlay(room.currentFriend);
      }
    }
  }

  function showPassOverlay(nextIdx) {
    const overlay = document.getElementById('friendOverlay');
    document.getElementById('nextFriendText').textContent = `A ${nextIdx + 1}. barát következik`;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  document.getElementById('nextFriendBtn')?.addEventListener('click', () => {
    const overlay = document.getElementById('friendOverlay');
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
    const room = getRoom(roomCode);
    currentIndex = 0;
    document.getElementById('friendBadge').textContent = `${room.currentFriend + 1}. barát`;
    renderCards(); updateProgress();
    document.getElementById('swipeHint').style.opacity = '1';
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAITING PAGE  (multi-device only)
// ═══════════════════════════════════════════════════════════════════════════════
function initWaiting() {
  const params = new URLSearchParams(window.location.search);
  const blobId = params.get('blob');
  if (!blobId) { window.location.href = 'index.html'; return; }

  let redirected = false;

  function render(data) {
    const participants = Object.entries(data.participants || {});
    const total = data.totalFriends || participants.length || 1;
    const doneCount = participants.filter(([, p]) => p.done).length;

    document.getElementById('waitCount').textContent = `${doneCount} / ${total} barát végzett`;

    document.getElementById('waitList').innerHTML = participants.map(([, p], i) => {
      const pct = p.total > 0 ? Math.round(p.progress / p.total * 100) : 0;
      return `<div class="wait-row">
        <div class="wait-avatar">${i + 1}</div>
        <div class="wait-info">
          <div class="wait-name">${i + 1}. barát</div>
          <div class="wait-bar-bg"><div class="wait-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="wait-status ${p.done ? 'done' : ''}">${p.done ? '✓' : `${p.progress}/${p.total}`}</div>
      </div>`;
    }).join('');

    if (doneCount >= total && total > 0 && !redirected) {
      redirected = true;
      poller.stop();
      document.getElementById('waitCount').textContent = '🎉 Mindenki végzett!';
      setTimeout(() => { window.location.href = `match.html?blob=${blobId}`; }, 1200);
    }
  }

  // Initial load
  readBlob(blobId).then(render).catch(() => {});

  const poller = pollBlob(blobId, 2500, render);

  // Force-start button (shows after 30s)
  setTimeout(() => {
    const btn = document.getElementById('forceStart');
    if (btn) btn.style.display = 'block';
  }, 30000);
  document.getElementById('forceStart')?.addEventListener('click', () => {
    poller.stop();
    window.location.href = `match.html?blob=${blobId}`;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function initMatch() {
  const params   = new URLSearchParams(window.location.search);
  const blobId   = params.get('blob');
  const roomCode = params.get('room');
  const container = document.getElementById('matchPage');

  if (blobId) {
    readBlob(blobId).then(data => {
      const restaurants = data.restaurants || getActiveRestaurants();
      const votesMap = {};
      Object.entries(data.participants || {}).forEach(([uid, p]) => { votesMap[uid] = p.votes || {}; });
      const scores = tallyVotes(restaurants, votesMap);
      renderMatchPage(container, restaurants, scores, Object.keys(votesMap).length, null, blobId);
    }).catch(() => window.location.href = 'index.html');
  } else if (roomCode) {
    const room = getRoom(roomCode);
    if (!room) { window.location.href = 'index.html'; return; }
    const restaurants = getActiveRestaurants();
    const scores = tallyVotes(restaurants, room.votes);
    renderMatchPage(container, restaurants, scores, room.totalFriends, roomCode, null);
  } else {
    window.location.href = 'index.html';
  }
}

function renderMatchPage(container, restaurants, scores, totalFriends, roomCode, blobId) {
  const fullMatches = restaurants.filter(r => scores[r.id] >= totalFriends);
  const partials    = restaurants.filter(r => scores[r.id] > 0 && scores[r.id] < totalFriends)
    .sort((a, b) => scores[b.id] - scores[a.id]).slice(0, 6);

  const retryHref = roomCode ? `javascript:retryRoom('${roomCode}')` : 'index.html';

  if (fullMatches.length > 0) {
    container.innerHTML = `
      <div class="match-header">
        <div class="match-icon">🎉</div>
        <h1 class="match-title">MATCH!</h1>
        <p class="match-subtitle">Mindenki ezeket szerette</p>
      </div>
      <div class="match-list">
        ${fullMatches.map((r, i) => matchCard(r, i)).join('')}
      </div>
      <div class="match-actions">
        <a class="btn btn-primary" href="${retryHref}">🔄 Újra</a>
        <button class="btn btn-secondary" onclick="window.location.href='index.html'">🏠 Főoldal</button>
      </div>`;
    startConfetti();
    scheduleNotif(fullMatches[0].name);
  } else {
    container.innerHTML = `
      <div class="no-match-header">
        <div class="match-icon">😕</div>
        <h1 class="no-match-title">Nincs teljes match</h1>
        <p class="match-subtitle">Majdnem! Legtöbb szavazatot kapott:</p>
      </div>
      <div class="partial-section">
        ${partials.map(r => voteRow(r, scores[r.id], totalFriends)).join('')}
      </div>
      <div class="match-actions">
        <a class="btn btn-primary" href="${retryHref}">🔄 Próbáljuk újra</a>
        <button class="btn btn-secondary" onclick="window.location.href='index.html'">🏠 Főoldal</button>
      </div>`;
  }

  // Animate vote bars after render
  requestAnimationFrame(() => {
    document.querySelectorAll('.vote-bar-fill[data-pct]').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  });
}

function matchCard(r, i) {
  return `
    <div class="match-card" style="animation-delay:${0.1 + i * 0.12}s">
      <div class="match-card-img" style="background:${r.gradient}"
           data-photo="${r.photo || ''}" data-emoji="${r.emoji}">
        <span class="match-card-emoji">${r.emoji}</span>
      </div>
      <div class="match-card-body">
        <div class="match-card-name">${r.name}</div>
        <div class="match-card-meta">⭐ ${r.rating} · ${r.cuisine} · 📍 ${r.distance}</div>
        ${r.description ? `<p class="match-card-desc">${r.description}</p>` : ''}
        <div class="card-tags">${r.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
      <a class="btn-maps" href="${mapsLink(r)}" target="_blank" rel="noopener">📍</a>
    </div>`;
}

function voteRow(r, count, total) {
  const pct = Math.round(count / total * 100);
  return `
    <div class="vote-row">
      <div class="vote-emoji" style="background:${r.gradient}">${r.emoji}</div>
      <div class="vote-info">
        <div class="vote-name">${r.name}</div>
        <div class="vote-bar-bg"><div class="vote-bar-fill" style="width:0%" data-pct="${pct}"></div></div>
      </div>
      <a class="btn-maps-sm" href="${mapsLink(r)}" target="_blank" rel="noopener" title="Navigálás">📍</a>
      <div class="vote-count">${count}/${total}</div>
    </div>`;
}

function mapsLink(r) {
  if (r.lat && r.lon) return `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ', Budapest')}`;
}

function retryRoom(code) {
  const room = getRoom(code);
  if (room) { room.votes = {}; room.currentFriend = 0; saveRoom(room); }
  window.location.href = `swipe.html?room=${code}&mode=single`;
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function scheduleNotif(name) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') {
    setTimeout(() => {
      try { new Notification('🎉 MATCH!', { body: `Menjetek a ${name}-ba!` }); } catch { /* ignore */ }
    }, 600);
  }
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function startConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ['#FF4A1C', '#FF8B00', '#FFB800', '#22C55E', '#ffd700', '#ff85a1'];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360, rotSpd: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3 + 2, vx: (Math.random() - 0.5) * 1.5,
  }));
  let frame = 0;
  (function draw() {
    if (frame++ > 260) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.vy; p.x += p.vx; p.rot += p.rotSpd;
      ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    requestAnimationFrame(draw);
  })();
}

// ─── Router ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const p = window.location.pathname;
  if (p.endsWith('swipe.html'))   initSwipe();
  else if (p.endsWith('match.html'))   initMatch();
  else if (p.endsWith('waiting.html')) initWaiting();
  else initHome();
});
