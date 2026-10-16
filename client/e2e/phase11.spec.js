import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  setupE2eDatabase,
  startBackendServer,
  stopBackendServer
} from './server-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../../docs/screenshots');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await setupE2eDatabase();
  await startBackendServer();
});

test.afterAll(async () => {
  stopBackendServer();
});

test('1. Login page displays logo, institution name, address, and has no mobile overflow', async ({ page }) => {
  await page.goto('/login');

  // Verify document title
  await expect(page).toHaveTitle('SIMPS | RIT');

  // Verify logo image element is visible and loaded with non-zero natural dimensions
  const logo = page.locator('img[alt="Ramco Institute of Technology Emblem"]');
  await expect(logo).toBeVisible();

  const isImageLoaded = await logo.evaluate((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  expect(isImageLoaded).toBe(true);

  // Verify institution name and address
  await expect(page.getByRole('heading', { name: 'Ramco Institute of Technology' })).toBeVisible();
  await expect(page.locator('text=North Venganallur Village')).toBeVisible();

  // Verify disclaimer notice in footer
  await expect(page.locator('text=Student mini project. Not an official system of Ramco Institute of Technology.')).toBeVisible();

  // Test responsive viewport (phone width: 375x667) for horizontal overflow
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalScroll).toBe(false);

  // Reset viewport and save screenshot
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: path.join(screenshotsDir, 'login.png'), fullPage: true });
});

test('2. Register page displays branding, logo, and has no mobile overflow', async ({ page }) => {
  await page.goto('/register');

  // Verify document title
  await expect(page).toHaveTitle('SIMPS | RIT');

  // Verify logo image loaded
  const logo = page.locator('img[alt="Ramco Institute of Technology Emblem"]');
  await expect(logo).toBeVisible();

  const isImageLoaded = await logo.evaluate((img) => img.complete && img.naturalWidth > 0);
  expect(isImageLoaded).toBe(true);

  // Verify institution name
  await expect(page.getByRole('heading', { name: 'Ramco Institute of Technology' })).toBeVisible();

  // Verify disclaimer notice
  await expect(page.locator('text=Student mini project. Not an official system of Ramco Institute of Technology.')).toBeVisible();

  // Test responsive viewport (phone width) for horizontal overflow
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);

  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalScroll).toBe(false);

  // Reset viewport and save screenshot
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: path.join(screenshotsDir, 'register.png'), fullPage: true });
});

test('3. Authenticated dashboard displays sidebar brand block and saves screenshot', async ({ page }) => {
  await page.goto('/login');

  // Login as System Admin
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard');

  // Verify document title
  await expect(page).toHaveTitle('SIMPS | RIT');

  // Verify sidebar brand block
  const sidebar = page.locator('aside.sidebar-wrapper');
  await expect(sidebar).toBeVisible();

  const sidebarLogo = sidebar.locator('img[alt="Ramco Institute of Technology Emblem"]');
  await expect(sidebarLogo).toBeVisible();

  const isSidebarLogoLoaded = await sidebarLogo.evaluate((img) => img.complete && img.naturalWidth > 0);
  expect(isSidebarLogoLoaded).toBe(true);

  await expect(sidebar.locator('text=SIMPS')).toBeVisible();
  await expect(sidebar.locator('text=RIT Central Store')).toBeVisible();

  // Capture dashboard screenshot
  await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png'), fullPage: true });
});
