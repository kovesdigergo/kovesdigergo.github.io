// Cuisine → curated Unsplash photo IDs (2 per type, onerror fallback to gradient)
const CUISINE_PHOTOS = {
  pizza:      ['photo-1565299624946-b28f40a0ae38', 'photo-1513104890138-7c749659a591'],
  italian:    ['photo-1567620905732-2d1ec7ab7445', 'photo-1473093295043-cdd812d0e601'],
  sushi:      ['photo-1579871494447-9811cf80d66c', 'photo-1617196034738-26c5f7c977ce'],
  japanese:   ['photo-1569050467447-ce54b3bbc37d', 'photo-1617196034738-26c5f7c977ce'],
  burger:     ['photo-1568901346375-23c9450c58cd', 'photo-1586190848861-99aa4a171e90'],
  american:   ['photo-1568901346375-23c9450c58cd', 'photo-1550547660-d9450f8a745a'],
  thai:       ['photo-1455619452474-d2be8b1e70cd', 'photo-1562565652-a0d8f0c59eb4'],
  chinese:    ['photo-1563245372-f21724e3856d', 'photo-1525755662778-989d0ff51b62'],
  mexican:    ['photo-1552332386-f8dd00dc2f85', 'photo-1551504734-5da44cf1c40e'],
  indian:     ['photo-1565557623262-b51c2513a641', 'photo-1631452180519-c014fe946bc7'],
  kebab:      ['photo-1529059997568-3d847b1154f0', 'photo-1599487488170-d11ec9c172f0'],
  turkish:    ['photo-1529059997568-3d847b1154f0', 'photo-1530469912745-a215c6b256ea'],
  greek:      ['photo-1504754524776-8f4f37790ca0', 'photo-1619683904698-5c4e0f3dd41e'],
  mediterranean: ['photo-1512621776951-a57141f2eefd', 'photo-1504754524776-8f4f37790ca0'],
  hungarian:  ['photo-1547592180-85f173990554', 'photo-1534482421-64566f976cfa'],
  french:     ['photo-1555507036-ab1f4038808a', 'photo-1414235077428-338989a2e8c0'],
  vietnamese: ['photo-1559496417-e7f25cb247f3', 'photo-1582878826629-29b7ad1cdc43'],
  coffee:     ['photo-1509042239860-f550ce710b93', 'photo-1495474472287-4d71bcdd2085'],
  cafe:       ['photo-1495474472287-4d71bcdd2085', 'photo-1509042239860-f550ce710b93'],
  default:    ['photo-1504674900247-0877df9cc836', 'photo-1414235077428-338989a2e8c0'],
};

function getPhotoUrl(cuisine, seed) {
  const c = (cuisine || '').toLowerCase();
  let key = 'default';
  for (const k of Object.keys(CUISINE_PHOTOS)) {
    if (c.includes(k)) { key = k; break; }
  }
  const arr = CUISINE_PHOTOS[key];
  const idx = (seed || 0) % arr.length;
  return `https://images.unsplash.com/${arr[idx]}?w=420&h=280&fit=crop&auto=format&q=80`;
}

// Apply photo to a .card-image element; fallback to gradient+emoji on error
function applyCardPhoto(el, photoUrl, gradient, emoji) {
  if (!photoUrl) {
    el.style.background = gradient;
    el.innerHTML = `<span class="card-emoji">${emoji}</span>`;
    return;
  }
  el.style.backgroundColor = gradient.split(',')[0].replace('linear-gradient(135deg', '').replace('(', '').trim();
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url('${photoUrl}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  };
  img.onerror = () => {
    el.style.background = gradient;
    el.innerHTML = `<span class="card-emoji">${emoji}</span>`;
  };
  img.src = photoUrl;
}
