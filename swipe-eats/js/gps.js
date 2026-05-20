// ─── GPS + Overpass API helper ────────────────────────────────────────────────

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no-gps')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}

async function fetchNearbyRestaurants(lat, lon, radiusM = 1500) {
  const q = `[out:json][timeout:12];node["amenity"="restaurant"](around:${radiusM},${lat},${lon});out 20;`;
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const base of mirrors) {
    try {
      const resp = await Promise.race([
        fetch(`${base}?data=${encodeURIComponent(q)}`),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
      ]);
      const data = await resp.json();
      const named = (data.elements || []).filter(el => el.tags && el.tags.name);
      if (named.length >= 4) {
        return named.slice(0, 15).map(el => osmToRestaurant(el, lat, lon));
      }
    } catch { /* try next mirror */ }
  }
  throw new Error('no-results');
}

function osmToRestaurant(el, userLat, userLon) {
  const cuisine = el.tags.cuisine || '';
  const { emoji, tags, gradient } = cuisineInfo(cuisine);
  const km = haversineKm(userLat, userLon, el.lat, el.lon);
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const street = [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' ');
  return {
    id: `osm_${el.id}`,
    name: el.tags.name,
    cuisine: formatCuisine(cuisine) || 'Étterem',
    rating: (3.5 + Math.random() * 1.4).toFixed(1),
    priceLevel: Math.floor(Math.random() * 3) + 1,
    distance: dist,
    address: street || 'Budapest',
    tags,
    emoji,
    gradient,
    lat: el.lat,
    lon: el.lon,
  };
}

function cuisineInfo(cuisine) {
  const c = (cuisine || '').toLowerCase();
  const rules = [
    [['pizza', 'italian'],    '🍕', ['Olasz', 'Pizza', 'Pasta'],         'linear-gradient(135deg,#e63946,#a8201a)'],
    [['sushi', 'japanese'],   '🍣', ['Japán', 'Sushi', 'Ramen'],         'linear-gradient(135deg,#2d6a4f,#1b4332)'],
    [['burger', 'american'],  '🍔', ['Burger', 'Grill', 'Craft sör'],    'linear-gradient(135deg,#1d3557,#457b9d)'],
    [['chinese'],             '🥡', ['Kínai', 'Wok', 'Dim sum'],         'linear-gradient(135deg,#c0392b,#8e0000)'],
    [['thai'],                '🍜', ['Thai', 'Fűszeres', 'Wok'],         'linear-gradient(135deg,#ff6b35,#ffd166)'],
    [['mexican'],             '🌮', ['Mexikói', 'Taco', 'Burrito'],      'linear-gradient(135deg,#fb8500,#ffb703)'],
    [['indian'],              '🍛', ['Indiai', 'Curry', 'Fűszeres'],     'linear-gradient(135deg,#f4a261,#e9c46a)'],
    [['kebab', 'turkish'],    '🌯', ['Kebab', 'Török', 'Gyors'],         'linear-gradient(135deg,#e63946,#6b2737)'],
    [['greek'],               '🥙', ['Görög', 'Mediterrán', 'Gyros'],   'linear-gradient(135deg,#1d3557,#06d6a0)'],
    [['hungarian'],           '🥘', ['Magyar', 'Gulyás', 'Hagyományos'], 'linear-gradient(135deg,#e9c46a,#f4a261)'],
    [['french'],              '🥐', ['Francia', 'Fine dining', 'Bor'],   'linear-gradient(135deg,#1a1a2e,#4a4a6a)'],
    [['vietnamese'],          '🥢', ['Vietnami', 'Pho', 'Friss'],        'linear-gradient(135deg,#52b788,#2d6a4f)'],
    [['coffee', 'cafe'],      '☕', ['Kávézó', 'Brunch', 'Reggeli'],     'linear-gradient(135deg,#d4a017,#8B5A00)'],
  ];
  for (const [keys, emoji, tags, gradient] of rules) {
    if (keys.some(k => c.includes(k))) return { emoji, tags, gradient };
  }
  return { emoji: '🍽️', tags: ['Étterem', 'Közeli'], gradient: 'linear-gradient(135deg,#6b6b8a,#3d3d5a)' };
}

function formatCuisine(cuisine) {
  if (!cuisine) return null;
  const map = { pizza: 'Pizza & Olasz', italian: 'Olasz', sushi: 'Japán', japanese: 'Japán', burger: 'Burger', american: 'Amerikai', chinese: 'Kínai', thai: 'Thai', mexican: 'Mexikói', indian: 'Indiai', kebab: 'Kebab', turkish: 'Török', greek: 'Görög', hungarian: 'Magyar', french: 'Francia', vietnamese: 'Vietnami' };
  for (const [k, v] of Object.entries(map)) {
    if (cuisine.toLowerCase().includes(k)) return v;
  }
  return cuisine.split(';')[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Attempt GPS fetch; falls back to mock data silently
async function loadRestaurants(onStatus) {
  try {
    onStatus('📍 GPS helyzet lekérése...');
    const { lat, lon } = await getLocation();
    onStatus('🔍 Közeli éttermek keresése...');
    const results = await fetchNearbyRestaurants(lat, lon);
    onStatus('✅ Kész!');
    return { list: results, gps: true };
  } catch {
    onStatus('📋 Demo éttermek betöltése...');
    await new Promise(r => setTimeout(r, 400));
    return { list: RESTAURANTS, gps: false };
  }
}
