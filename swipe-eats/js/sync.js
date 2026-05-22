// jsonblob.com – free, no-auth, CORS-enabled JSON storage
// Used for multi-device real-time sync (2.5s polling)
const BLOB_API = 'https://jsonblob.com/api/jsonBlob';

async function createBlob(data) {
  const res = await fetch(BLOB_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createBlob ${res.status}`);
  const loc = res.headers.get('Location') || '';
  const id = loc.split('/').pop();
  if (!id) throw new Error('no blob ID in Location header');
  return id;
}

async function readBlob(blobId) {
  const res = await fetch(`${BLOB_API}/${blobId}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`readBlob ${res.status}`);
  return res.json();
}

// Read → apply updaterFn → write back; retries on conflict
async function updateBlob(blobId, updaterFn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const current = await readBlob(blobId);
      const updated = updaterFn(current);
      const res = await fetch(`${BLOB_API}/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) return updated;
      throw new Error(`PUT ${res.status}`);
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
    }
  }
}

// Poll every intervalMs; returns a { stop() } handle
function pollBlob(blobId, intervalMs, onData) {
  let active = true;
  let timer = null;

  async function tick() {
    if (!active) return;
    try {
      const data = await readBlob(blobId);
      if (active) onData(data);
    } catch { /* silently skip failed reads */ }
    if (active) timer = setTimeout(tick, intervalMs);
  }

  timer = setTimeout(tick, intervalMs);
  return {
    stop() {
      active = false;
      if (timer) clearTimeout(timer);
    },
  };
}

// ── UID helpers ───────────────────────────────────────────────────────────────
function getOrCreateUid() {
  let uid = sessionStorage.getItem('swipe-eats-uid');
  if (!uid) {
    uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('swipe-eats-uid', uid);
  }
  return uid;
}

// Tally votes from blob participants (multi mode) or localStorage (single mode)
function tallyVotes(restaurants, votesMap) {
  const votesList = Object.values(votesMap || {});
  const scores = {};
  restaurants.forEach(r => {
    scores[r.id] = votesList.filter(v => v && v[r.id] === true).length;
  });
  return scores;
}
