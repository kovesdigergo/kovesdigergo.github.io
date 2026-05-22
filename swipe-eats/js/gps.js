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

async function fetchNearbyRestaurants(lat, lon, radiusM = 2000, maxCount = 15) {
  const q = `[out:json][timeout:12];node["amenity"="restaurant"](around:${radiusM},${lat},${lon});out ${maxCount + 10};`;
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const base of mirrors) {
    try {
      const resp = await Promise.race([
        fetch(`${base}?data=${encodeURIComponent(q)}`),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 11000)),
      ]);
      const data = await resp.json();
      const named = (data.elements || []).filter(el => el.tags && el.tags.name);
      if (named.length >= 3) {
        return named.slice(0, maxCount).map((el, i) => osmToRestaurant(el, lat, lon, i));
      }
    } catch { /* try next mirror */ }
  }
  throw new Error('no-results');
}

function osmToRestaurant(el, userLat, userLon, seed) {
  const cuisine = el.tags.cuisine || '';
  const { emoji, tags, gradient, description } = cuisineInfo(cuisine);
  const km = haversineKm(userLat, userLon, el.lat, el.lon);
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const street = [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' ');
  const osmSeed = parseInt(String(el.id).slice(-4), 10) || seed;
  return {
    id: `osm_${el.id}`,
    name: el.tags.name,
    cuisine: formatCuisine(cuisine) || 'Étterem',
    rating: (3.5 + (osmSeed % 15) * 0.1).toFixed(1),
    priceLevel: (osmSeed % 3) + 1,
    distance: dist,
    address: street || 'Budapest',
    tags,
    emoji,
    gradient,
    description,
    photo: getPhotoUrl(cuisine, osmSeed),
    lat: el.lat,
    lon: el.lon,
  };
}

function cuisineInfo(cuisine) {
  const c = (cuisine || '').toLowerCase();
  const rules = [
    [['pizza', 'italian'],    '🍕', ['Olasz', 'Pizza', 'Pasta'],          'linear-gradient(135deg,#c0392b,#922b21)', 'Friss pizzák és olasz ételek tűzben sütve.'],
    [['sushi', 'japanese'],   '🍣', ['Japán', 'Sushi', 'Ramen'],           'linear-gradient(135deg,#1a5276,#154360)', 'Friss alapanyagokból készített sushi, sashimi és ramen.'],
    [['burger', 'american'],  '🍔', ['Burger', 'Grill', 'Craft sör'],      'linear-gradient(135deg,#1a5276,#2e86c1)', 'Kézzel formált burgerek és grillezve sült ételek.'],
    [['chinese'],             '🥡', ['Kínai', 'Wok', 'Dim sum'],           'linear-gradient(135deg,#922b21,#7b241c)', 'Wokban készített kínai fogások és dim sum.'],
    [['thai'],                '🍜', ['Thai', 'Wok', 'Fűszeres'],           'linear-gradient(135deg,#b7950b,#9a7d0a)', 'Fűszeres thai ételek friss wokban elkészítve.'],
    [['mexican'],             '🌮', ['Mexikói', 'Taco', 'Burrito'],        'linear-gradient(135deg,#b9770e,#9a7d0a)', 'Autentikus taco, burrito és guacamole.'],
    [['indian'],              '🍛', ['Indiai', 'Curry', 'Fűszeres'],       'linear-gradient(135deg,#ca6f1e,#a04000)', 'Aromás curry-k és tandoori ételek.'],
    [['kebab', 'turkish'],    '🌯', ['Kebab', 'Török', 'Gyors'],           'linear-gradient(135deg,#922b21,#1a5276)', 'Friss kebab és török grillételek.'],
    [['greek', 'mediterran'], '🥙', ['Görög', 'Mediterrán', 'Gyros'],     'linear-gradient(135deg,#1a5276,#148f77)', 'Gyros, souvlaki és mediterrán saláták.'],
    [['hungarian'],           '🥘', ['Magyar', 'Gulyás', 'Hagyományos'], 'linear-gradient(135deg,#c0392b,#b7950b)', 'Hagyományos magyar konyha, gulyás és töltött káposzta.'],
    [['french'],              '🥐', ['Francia', 'Fine dining', 'Bor'],    'linear-gradient(135deg,#1a252f,#2c3e50)', 'Klasszikus francia fogások és pékáru.'],
    [['vietnamese'],          '🥢', ['Vietnami', 'Pho', 'Friss'],         'linear-gradient(135deg,#145a32,#1e8449)', 'Friss pho leves és vietnami street food.'],
    [['coffee', 'cafe'],      '☕', ['Kávézó', 'Brunch', 'Reggeli'],      'linear-gradient(135deg,#6e2f1a,#5d4037)', 'Különleges kávék, sütemények és brunch.'],
  ];
  for (const [keys, emoji, tags, gradient, description] of rules) {
    if (keys.some(k => c.includes(k))) return { emoji, tags, gradient, description };
  }
  return { emoji: '🍽️', tags: ['Étterem', 'Közeli'], gradient: 'linear-gradient(135deg,#4a235a,#2c3e50)', description: 'Változatos ételkínálat a közelben.' };
}

function formatCuisine(cuisine) {
  if (!cuisine) return null;
  const map = { pizza: 'Pizza & Olasz', italian: 'Olasz', sushi: 'Japán', japanese: 'Japán', burger: 'Burger', american: 'Amerikai', chinese: 'Kínai', thai: 'Thai', mexican: 'Mexikói', indian: 'Indiai', kebab: 'Kebab', turkish: 'Török', greek: 'Görög', hungarian: 'Magyar', french: 'Francia', vietnamese: 'Vietnami', coffee: 'Kávézó', cafe: 'Kávézó' };
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

async function loadRestaurants(onStatus, count = 15, radiusKm = 2) {
  try {
    onStatus('📍 GPS helyzet lekérése...');
    const { lat, lon } = await getLocation();
    onStatus('🔍 Közeli éttermek keresése...');
    const results = await fetchNearbyRestaurants(lat, lon, radiusKm * 1000, count);
    onStatus('✅ Kész!');
    return { list: results, gps: true };
  } catch {
    onStatus('📋 Demo éttermek betöltése...');
    await new Promise(r => setTimeout(r, 400));
    return { list: RESTAURANTS.slice(0, count), gps: false };
  }
}
