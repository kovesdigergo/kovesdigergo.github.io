// @ts-check
const { test, expect } = require('@playwright/test');

const RESTAURANTS = [
  { id: 'r1', name: 'Test Bistro', cuisine: 'Magyar', rating: 4.5, priceLevel: 2, distance: '0.5 km',
    address: 'Test utca 1', tags: ['Magyar', 'Gulyás'], emoji: '🥘',
    gradient: 'linear-gradient(135deg,#922b21,#7b241c)', description: 'Teszt leírás.', photo: null },
  { id: 'r2', name: 'Sushi Place', cuisine: 'Japán', rating: 4.7, priceLevel: 3, distance: '1.0 km',
    address: 'Test utca 2', tags: ['Sushi', 'Ramen'], emoji: '🍣',
    gradient: 'linear-gradient(135deg,#1a5276,#154360)', description: 'Sushi leírás.', photo: null },
];

async function goToMatchSingle(page, votes = {}) {
  const code = 'MTCH';
  const room = { code, totalFriends: 2, currentFriend: 2, votes };
  await page.goto('/swipe-eats/match.html');
  await page.evaluate(({ key, code, room, rests, restKey, modeKey }) => {
    localStorage.setItem(key, JSON.stringify({ [code]: room }));
    sessionStorage.setItem(restKey, JSON.stringify(rests));
    sessionStorage.setItem(modeKey, 'single');
  }, {
    key: 'swipe-eats-rooms',
    code,
    room,
    rests: RESTAURANTS,
    restKey: 'swipe-eats-restaurants',
    modeKey: 'swipe-eats-mode',
  });
  await page.goto(`/swipe-eats/match.html?room=${code}`);
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Match page – redirect guard', () => {
  test('redirects to index if no room or blob param', async ({ page }) => {
    await page.goto('/swipe-eats/match.html');
    await page.waitForURL('**/index.html');
    await expect(page).toHaveURL(/index\.html/);
  });
});

test.describe('Match page – full match', () => {
  test('shows MATCH! heading when all friends liked same restaurant', async ({ page }) => {
    // Both friends (key "0" and "1") liked r1
    await goToMatchSingle(page, { '0': { r1: true, r2: false }, '1': { r1: true, r2: false } });
    await expect(page.locator('.match-title')).toContainText('MATCH');
  });

  test('shows matching restaurant name', async ({ page }) => {
    await goToMatchSingle(page, { '0': { r1: true }, '1': { r1: true } });
    await expect(page.locator('.match-card-name')).toContainText('Test Bistro');
  });

  test('match card has maps link', async ({ page }) => {
    await goToMatchSingle(page, { '0': { r1: true }, '1': { r1: true } });
    const mapsLink = page.locator('.btn-maps').first();
    await expect(mapsLink).toBeVisible();
    const href = await mapsLink.getAttribute('href');
    expect(href).toContain('google.com/maps');
  });

  test('retry button is present', async ({ page }) => {
    await goToMatchSingle(page, { '0': { r1: true }, '1': { r1: true } });
    await expect(page.locator('.match-actions .btn-primary')).toBeVisible();
  });
});

test.describe('Match page – no full match', () => {
  test('shows no-match heading when votes differ', async ({ page }) => {
    // Friend 0 liked r1, friend 1 liked r2 – no full match
    await goToMatchSingle(page, { '0': { r1: true, r2: false }, '1': { r1: false, r2: true } });
    await expect(page.locator('.no-match-title')).toBeVisible();
  });

  test('shows partial results with vote rows', async ({ page }) => {
    await goToMatchSingle(page, { '0': { r1: true, r2: false }, '1': { r1: false, r2: true } });
    const rows = page.locator('.vote-row');
    await expect(rows.first()).toBeVisible();
  });
});

test.describe('Match page – XSS safety', () => {
  test('malicious name is escaped in match card', async ({ page }) => {
    const xssRest = {
      id: 'xss1', name: '<script>alert(1)</script>', cuisine: 'Test', rating: 4.0, priceLevel: 1,
      distance: '1 km', address: 'X', tags: [], emoji: '🍴',
      gradient: 'linear-gradient(135deg,#000,#111)', description: '', photo: null,
    };
    const code = 'XSST';
    const room = { code, totalFriends: 1, currentFriend: 1, votes: { '0': { xss1: true } } };
    await page.goto('/swipe-eats/match.html');
    await page.evaluate(({ key, code, room, rests, restKey, modeKey }) => {
      localStorage.setItem(key, JSON.stringify({ [code]: room }));
      sessionStorage.setItem(restKey, JSON.stringify(rests));
      sessionStorage.setItem(modeKey, 'single');
    }, {
      key: 'swipe-eats-rooms', code, room,
      rests: [xssRest],
      restKey: 'swipe-eats-restaurants',
      modeKey: 'swipe-eats-mode',
    });
    await page.goto(`/swipe-eats/match.html?room=${code}`);
    await page.waitForLoadState('domcontentloaded');

    // No script element should be injected
    const scripts = await page.locator('.match-card-name script').count();
    expect(scripts).toBe(0);
  });
});
