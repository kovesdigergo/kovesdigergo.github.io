// @ts-check
const { test, expect } = require('@playwright/test');

// Inject a single-mode room into localStorage and navigate to swipe.html
async function goToSwipeSingle(page, { totalFriends = 2, currentFriend = 0 } = {}) {
  const restaurants = [
    { id: 'r1', name: 'Test Bistro', cuisine: 'Magyar', rating: 4.5, priceLevel: 2, distance: '0.5 km',
      address: 'Test utca 1', tags: ['Magyar'], emoji: '🥘', gradient: 'linear-gradient(135deg,#922b21,#7b241c)',
      description: 'Teszt leírás.', photo: null },
    { id: 'r2', name: 'Sushi Place', cuisine: 'Japán', rating: 4.7, priceLevel: 3, distance: '1.0 km',
      address: 'Test utca 2', tags: ['Sushi'], emoji: '🍣', gradient: 'linear-gradient(135deg,#1a5276,#154360)',
      description: 'Sushi leírás.', photo: null },
  ];
  const code = 'ABCD';
  const room = { code, totalFriends, currentFriend, votes: {} };

  await page.goto('/swipe-eats/swipe.html');
  await page.evaluate(({ key, room, rests, restKey, modeKey }) => {
    const rooms = {};
    rooms[room.code] = room;
    localStorage.setItem(key, JSON.stringify(rooms));
    sessionStorage.setItem(restKey, JSON.stringify(rests));
    sessionStorage.setItem(modeKey, 'single');
  }, {
    key: 'swipe-eats-rooms',
    room,
    rests: restaurants,
    restKey: 'swipe-eats-restaurants',
    modeKey: 'swipe-eats-mode',
  });

  await page.goto(`/swipe-eats/swipe.html?room=${code}&mode=single`);
  await page.waitForLoadState('domcontentloaded');
  return { code, restaurants };
}

test.describe('Swipe page – redirect guard', () => {
  test('redirects to index if no room/blob param', async ({ page }) => {
    await page.goto('/swipe-eats/swipe.html');
    await page.waitForURL('**/index.html');
    await expect(page).toHaveURL(/index\.html/);
  });
});

test.describe('Swipe page – single mode', () => {
  test('room code is NOT visible to user', async ({ page }) => {
    await goToSwipeSingle(page);
    const codeEl = page.locator('#roomCodeDisplay');
    // Either hidden or empty — must not show the actual room code text
    const isVisible = await codeEl.isVisible().catch(() => false);
    if (isVisible) {
      const text = await codeEl.textContent();
      expect(text?.trim()).not.toMatch(/^[A-Z0-9]{4}$/);
    }
  });

  test('cards are rendered', async ({ page }) => {
    await goToSwipeSingle(page);
    const cards = page.locator('#cardsContainer .restaurant-card');
    await expect(cards.first()).toBeVisible();
  });

  test('card shows restaurant name', async ({ page }) => {
    await goToSwipeSingle(page);
    const name = page.locator('.card-name').first();
    await expect(name).toBeVisible();
    const text = await name.textContent();
    expect(['Test Bistro', 'Sushi Place']).toContain(text?.trim());
  });

  test('friend badge shows current friend number', async ({ page }) => {
    await goToSwipeSingle(page);
    const badge = page.locator('#friendBadge');
    await expect(badge).toContainText('1. barát');
  });

  test('progress text shows 0 / n on start', async ({ page }) => {
    const { restaurants } = await goToSwipeSingle(page);
    const prog = page.locator('#progressText');
    await expect(prog).toHaveText(`0 / ${restaurants.length}`);
  });

  test('like button swipes card right', async ({ page }) => {
    await goToSwipeSingle(page);
    const prog = page.locator('#progressText');
    await page.click('#likeBtn');
    await expect(prog).toHaveText(/^1 \//);
  });

  test('nope button swipes card left', async ({ page }) => {
    await goToSwipeSingle(page);
    const prog = page.locator('#progressText');
    await page.click('#nopeBtn');
    await expect(prog).toHaveText(/^1 \//);
  });

  test('pass overlay appears when first friend finishes with 2 friends', async ({ page }) => {
    await goToSwipeSingle(page, { totalFriends: 2, currentFriend: 0 });
    // Swipe through all 2 restaurants
    await page.click('#likeBtn');
    await page.click('#likeBtn');
    // Pass overlay should appear
    const overlay = page.locator('#friendOverlay');
    await expect(overlay).toBeVisible({ timeout: 2000 });
  });

  test('overlay shows next friend number', async ({ page }) => {
    await goToSwipeSingle(page, { totalFriends: 2, currentFriend: 0 });
    await page.click('#likeBtn');
    await page.click('#likeBtn');
    await expect(page.locator('#nextFriendText')).toContainText('2. barát');
  });

  test('next friend button hides overlay and resets progress', async ({ page }) => {
    await goToSwipeSingle(page, { totalFriends: 2, currentFriend: 0 });
    await page.click('#likeBtn');
    await page.click('#likeBtn');
    await page.locator('#friendOverlay').waitFor({ state: 'visible' });
    await page.click('#nextFriendBtn');
    await expect(page.locator('#friendOverlay')).not.toBeVisible();
    await expect(page.locator('#progressText')).toHaveText(/^0 \//);
  });
});

test.describe('Swipe page – XSS safety', () => {
  test('malicious restaurant name is escaped in card HTML', async ({ page }) => {
    const xssName = '<img src=x onerror=alert(1)>';
    await page.goto('/swipe-eats/swipe.html');
    const code = 'WXYZ';
    await page.evaluate(({ key, code, rests, restKey, modeKey }) => {
      localStorage.setItem(key, JSON.stringify({ [code]: { code, totalFriends: 1, currentFriend: 0, votes: {} } }));
      sessionStorage.setItem(restKey, JSON.stringify(rests));
      sessionStorage.setItem(modeKey, 'single');
    }, {
      key: 'swipe-eats-rooms',
      code,
      rests: [{ id: 'x1', name: xssName, cuisine: 'Test', rating: 4.0, priceLevel: 1,
                 distance: '1 km', address: 'X', tags: [], emoji: '🍴',
                 gradient: 'linear-gradient(135deg,#000,#111)', description: '', photo: null }],
      restKey: 'swipe-eats-restaurants',
      modeKey: 'swipe-eats-mode',
    });
    await page.goto(`/swipe-eats/swipe.html?room=${code}&mode=single`);
    await page.waitForLoadState('domcontentloaded');

    // The img tag must NOT exist as a real DOM element inside .card-name
    const imgCount = await page.locator('.card-name img').count();
    expect(imgCount).toBe(0);

    // The text content should include the raw characters (escaped)
    const nameText = await page.locator('.card-name').first().textContent();
    expect(nameText).toContain('<img');
  });
});
