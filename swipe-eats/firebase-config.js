// ─── Firebase beállítás (multi-device módhoz szükséges) ──────────────────────
//
//  5 perces ingyenes beállítás:
//  1. Nyisd meg: https://console.firebase.google.com
//  2. "Add project" → adj nevet (pl. swipe-eats) → Continue → Continue
//  3. Bal menü: Build → Realtime Database → "Create database"
//     → Válaszd: "Start in test mode" → Next → Enable
//  4. Bal menü: Project Overview ⚙️ → Project settings → Your apps
//     → kattints a </> (Web) ikonra → adj nevet → Register app
//  5. Másold ki a firebaseConfig objektumot és illeszd be lentebb
//
//  Az ingyenes Spark csomag bőven elég (1 GB tárhely, 100 egyidejű kapcsolat)
//
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = null;  // ← Cseréld le az alábbira, és töröld a null-t

/*
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "swipe-eats-xxxxx.firebaseapp.com",
  databaseURL:       "https://swipe-eats-xxxxx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "swipe-eats-xxxxx",
  storageBucket:     "swipe-eats-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef123456"
};
*/

if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    console.warn('Firebase init failed:', e.message);
  }
}
