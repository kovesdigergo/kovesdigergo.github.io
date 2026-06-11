// ─── UID helpers ──────────────────────────────────────────────────────────────
function getOrCreateUid() {
  let uid = sessionStorage.getItem('swipe-eats-uid');
  if (!uid) {
    uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    sessionStorage.setItem('swipe-eats-uid', uid);
  }
  return uid;
}

// Tally votes from participants map → { restaurantId: likeCount }
function tallyVotes(restaurants, votesMap) {
  const votesList = Object.values(votesMap || {});
  const scores = {};
  restaurants.forEach(r => {
    scores[r.id] = votesList.filter(v => v && v[r.id] === true).length;
  });
  return scores;
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────
function getFirebaseDB() {
  try {
    if (typeof firebase === 'undefined') return null;
    if (!firebase.apps?.length) return null;
    return firebase.database();
  } catch { return null; }
}

function isFirebaseReady() { return getFirebaseDB() !== null; }

const ROOMS_PATH = 'swipe-eats/rooms';

// Create a new multi-device room in Firebase
async function createMultiRoom(restaurants, totalFriends, uid) {
  const db = getFirebaseDB();
  if (!db) throw new Error('firebase-not-configured');
  const code = _genCode();
  await db.ref(`${ROOMS_PATH}/${code}`).set({
    restaurants,
    totalFriends,
    status: 'voting',
    createdAt: Date.now(),
    participants: {
      [uid]: { joined: Date.now(), progress: 0, total: restaurants.length, done: false, votes: {} }
    },
  });
  return code;
}

// Join an existing multi-device room
async function joinMultiRoom(code, uid) {
  const db = getFirebaseDB();
  if (!db) throw new Error('firebase-not-configured');
  const snap = await db.ref(`${ROOMS_PATH}/${code}`).once('value');
  const room = snap.val();
  if (!room) throw new Error('room-not-found');
  await db.ref(`${ROOMS_PATH}/${code}/participants/${uid}`).set({
    joined: Date.now(), progress: 0, total: room.restaurants?.length || 15, done: false, votes: {}
  });
  return room;
}

// Read current room state once
async function readMultiRoom(code) {
  const db = getFirebaseDB();
  if (!db) throw new Error('firebase-not-configured');
  const snap = await db.ref(`${ROOMS_PATH}/${code}`).once('value');
  return snap.val();
}

// Write a single vote (atomic update)
function submitVote(code, uid, restaurantId, liked) {
  const db = getFirebaseDB();
  if (!db) return Promise.resolve();
  const updates = {};
  updates[`${ROOMS_PATH}/${code}/participants/${uid}/votes/${restaurantId}`] = liked;
  // increment progress – use a transaction so concurrent writes don't clobber each other
  const progRef = db.ref(`${ROOMS_PATH}/${code}/participants/${uid}/progress`);
  return Promise.all([
    db.ref().update(updates),
    progRef.transaction(cur => (cur || 0) + 1),
  ]).catch(() => {/* silently ignore vote sync failures */});
}

// Mark participant as done
function markDoneFB(code, uid, total) {
  const db = getFirebaseDB();
  if (!db) return Promise.resolve();
  return db.ref(`${ROOMS_PATH}/${code}/participants/${uid}`).update({ done: true, progress: total })
    .catch(() => {});
}

// Watch room in real-time; returns { stop() }
function watchRoom(code, onData) {
  const db = getFirebaseDB();
  if (!db) return { stop: () => {} };
  const ref = db.ref(`${ROOMS_PATH}/${code}`);
  ref.on('value', snap => {
    const data = snap.val();
    if (data) onData(data);
  });
  return { stop: () => ref.off('value') };
}

// Delete room data after match is shown (cleanup)
function cleanupRoom(code) {
  const db = getFirebaseDB();
  if (!db) return;
  db.ref(`${ROOMS_PATH}/${code}`).remove().catch(() => {});
}

function _genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
