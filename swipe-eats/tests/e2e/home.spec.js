// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Home – mode selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swipe-eats/index.html');
  });

  test('shows mode selection screen on load', async ({ page }) => {
    await expect(page.locator('#screen-mode')).toBeVisible();
    await expect(page.locator('#modeSingle')).toBeVisible();
    await expect(page.locator('#modeMulti')).toBeVisible();
    await expect(page.locator('#screen-settings')).not.toBeVisible();
  });

  test('single-phone mode navigates to settings', async ({ page }) => {
    await page.click('#modeSingle');
    await expect(page.locator('#screen-settings')).toBeVisible();
    await expect(page.locator('#screen-mode')).not.toBeVisible();
  });

  test('multi-device mode shows firebase setup when not configured', async ({ page }) => {
    await page.click('#modeMulti');
    // Firebase is not configured in test env → shows setup instructions screen
    await expect(page.locator('#screen-firebase-setup')).toBeVisible();
  });

  test('settings shows friend count row after mode selection', async ({ page }) => {
    await page.click('#modeSingle');
    await expect(page.locator('#friendsRow')).toBeVisible();
  });

  test('back button returns to mode screen', async ({ page }) => {
    await page.click('#modeSingle');
    await page.click('[data-back="screen-mode"]');
    await expect(page.locator('#screen-mode')).toBeVisible();
  });
});

test.describe('Settings – sliders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swipe-eats/index.html');
    await page.click('#modeSingle');
  });

  test('count slider shows default value 15', async ({ page }) => {
    await expect(page.locator('#countVal')).toHaveText('15');
  });

  test('radius slider shows default value 2 km', async ({ page }) => {
    await expect(page.locator('#radiusVal')).toHaveText('2 km');
  });

  test('count minus button decreases value', async ({ page }) => {
    await page.click('#countMinus');
    await expect(page.locator('#countVal')).toHaveText('14');
  });

  test('count plus button increases value', async ({ page }) => {
    await page.click('#countPlus');
    await expect(page.locator('#countVal')).toHaveText('16');
  });

  test('radius minus button decreases value', async ({ page }) => {
    await page.click('#radiusMinus');
    await expect(page.locator('#radiusVal')).toHaveText('1 km');
  });

  test('radius plus button increases value', async ({ page }) => {
    await page.click('#radiusPlus');
    await expect(page.locator('#radiusVal')).toHaveText('3 km');
  });

  test('count slider cannot go below 5', async ({ page }) => {
    for (let i = 0; i < 20; i++) await page.click('#countMinus');
    await expect(page.locator('#countVal')).toHaveText('5');
  });

  test('count slider cannot exceed 50', async ({ page }) => {
    for (let i = 0; i < 50; i++) await page.click('#countPlus');
    await expect(page.locator('#countVal')).toHaveText('50');
  });

  test('friend count increases and decreases', async ({ page }) => {
    await expect(page.locator('#friendCount')).toHaveText('3');
    await page.click('#increaseFriends');
    await expect(page.locator('#friendCount')).toHaveText('4');
    await page.click('#decreaseFriends');
    await page.click('#decreaseFriends');
    await expect(page.locator('#friendCount')).toHaveText('2');
  });

  test('friend count cannot go below 2', async ({ page }) => {
    for (let i = 0; i < 5; i++) await page.click('#decreaseFriends');
    await expect(page.locator('#friendCount')).toHaveText('2');
  });
});

test.describe('Join flow – ?room= URL', () => {
  test('shows firebase setup when opened with room param but firebase not configured', async ({ page }) => {
    await page.goto('/swipe-eats/index.html?room=FAKE12');
    // Firebase not configured in test env → shows setup screen
    await expect(page.locator('#screen-firebase-setup')).toBeVisible();
    await expect(page.locator('#screen-mode')).not.toBeVisible();
  });
});
