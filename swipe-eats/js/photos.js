// Cuisine → curated Unsplash photo IDs (6 per type, onerror fallback to gradient)
const CUISINE_PHOTOS = {
  pizza:         ['photo-1565299624946-b28f40a0ae38', 'photo-1513104890138-7c749659a591', 'photo-1574071318508-1cdbab80d002', 'photo-1593560708920-61dd98c46a4e', 'photo-1628840042765-356cda07504e', 'photo-1589816099084-5d4fdae068dd'],
  italian:       ['photo-1567620905732-2d1ec7ab7445', 'photo-1473093295043-cdd812d0e601', 'photo-1540189549336-e6e99c3679fe', 'photo-1598866594240-496eb4f1c5eb', 'photo-1555949258-eb67b1ef0ceb', 'photo-1621996346565-e3dbc646d9a9'],
  sushi:         ['photo-1579871494447-9811cf80d66c', 'photo-1617196034738-26c5f7c977ce', 'photo-1559339352-11d035aa65de', 'photo-1617196034183-421b4040ed20', 'photo-1582450871972-ab5ca641643d', 'photo-1569050467447-ce54b3bbc37d'],
  japanese:      ['photo-1569050467447-ce54b3bbc37d', 'photo-1617196034738-26c5f7c977ce', 'photo-1611143669185-af224c5e3252', 'photo-1559339352-11d035aa65de', 'photo-1579871494447-9811cf80d66c', 'photo-1617196034183-421b4040ed20'],
  burger:        ['photo-1568901346375-23c9450c58cd', 'photo-1586190848861-99aa4a171e90', 'photo-1550547660-d9450f8a745a', 'photo-1561758033-d89a9ad46330', 'photo-1571091718767-18b5b1457add', 'photo-1596956470007-2bf6095e7e16'],
  american:      ['photo-1504754524776-8f4f37790ca0', 'photo-1550547660-d9450f8a745a', 'photo-1476224203421-9ac39bcb3327', 'photo-1568901346375-23c9450c58cd', 'photo-1561758033-d89a9ad46330', 'photo-1571091718767-18b5b1457add'],
  thai:          ['photo-1455619452474-d2be8b1e70cd', 'photo-1562565652-a0d8f0c59eb4', 'photo-1525755662778-989d0ff51b62', 'photo-1432139509613-5c4255815697', 'photo-1467003909585-2f8a72700288', 'photo-1493770348161-369560ae357d'],
  chinese:       ['photo-1563245372-f21724e3856d', 'photo-1525755662778-989d0ff51b62', 'photo-1468581264429-2548ef9eb732', 'photo-1576458088814-b5a6de5e90db', 'photo-1493770348161-369560ae357d', 'photo-1562565652-a0d8f0c59eb4'],
  mexican:       ['photo-1552332386-f8dd00dc2f85', 'photo-1551504734-5da44cf1c40e', 'photo-1565299585323-38d6b0865b47', 'photo-1604467794349-0b74285de7e7', 'photo-1615870216519-2f9fa575a438', 'photo-1626700051175-6818013e1d4f'],
  indian:        ['photo-1565557623262-b51c2513a641', 'photo-1631452180519-c014fe946bc7', 'photo-1567188040759-fb8a883dc6d8', 'photo-1601050690597-df0568f70950', 'photo-1633945274405-b6c8069047b0', 'photo-1574653853027-5382a3d23a15'],
  kebab:         ['photo-1529059997568-3d847b1154f0', 'photo-1599487488170-d11ec9c172f0', 'photo-1544025162-d76538b2a791', 'photo-1530469912745-a215c6b256ea', 'photo-1504093547236-82cf6c0ef3a3', 'photo-1555396273-367ea4eb4db5'],
  turkish:       ['photo-1529059997568-3d847b1154f0', 'photo-1530469912745-a215c6b256ea', 'photo-1599487488170-d11ec9c172f0', 'photo-1544025162-d76538b2a791', 'photo-1527324688151-0e627063f2b1', 'photo-1504093547236-82cf6c0ef3a3'],
  greek:         ['photo-1504754524776-8f4f37790ca0', 'photo-1619683904698-5c4e0f3dd41e', 'photo-1533089860892-a7c6f0a88666', 'photo-1546069901-ba9599a7e63c', 'photo-1484723091739-30990904392a', 'photo-1482049016688-2d3e1b311543'],
  mediterranean: ['photo-1512621776951-a57141f2eefd', 'photo-1504754524776-8f4f37790ca0', 'photo-1546069901-ba9599a7e63c', 'photo-1533089860892-a7c6f0a88666', 'photo-1619683904698-5c4e0f3dd41e', 'photo-1484723091739-30990904392a'],
  hungarian:     ['photo-1547592180-85f173990554', 'photo-1534482421-64566f976cfa', 'photo-1504893524553-b855bce32c67', 'photo-1529042410759-befb1204b468', 'photo-1574653853027-5382a3d23a15', 'photo-1567188040759-fb8a883dc6d8'],
  french:        ['photo-1555507036-ab1f4038808a', 'photo-1414235077428-338989a2e8c0', 'photo-1551218372-a8789b81b253', 'photo-1464093515883-ec948246accb', 'photo-1504674900247-0877df9cc836', 'photo-1533089860892-a7c6f0a88666'],
  vietnamese:    ['photo-1559496417-e7f25cb247f3', 'photo-1582878826629-29b7ad1cdc43', 'photo-1562565652-a0d8f0c59eb4', 'photo-1493770348161-369560ae357d', 'photo-1576458088814-b5a6de5e90db', 'photo-1455619452474-d2be8b1e70cd'],
  coffee:        ['photo-1509042239860-f550ce710b93', 'photo-1495474472287-4d71bcdd2085', 'photo-1442512595331-e89e73853f31', 'photo-1498804103079-a6351b050096', 'photo-1461023058943-07fcbe16d735', 'photo-1517701604599-bb29b565090c'],
  cafe:          ['photo-1495474472287-4d71bcdd2085', 'photo-1509042239860-f550ce710b93', 'photo-1442512595331-e89e73853f31', 'photo-1461023058943-07fcbe16d735', 'photo-1498804103079-a6351b050096', 'photo-1517701604599-bb29b565090c'],
  default:       ['photo-1504674900247-0877df9cc836', 'photo-1414235077428-338989a2e8c0', 'photo-1546069901-ba9599a7e63c', 'photo-1555396273-367ea4eb4db5', 'photo-1504893524553-b855bce32c67', 'photo-1482049016688-2d3e1b311543'],
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
