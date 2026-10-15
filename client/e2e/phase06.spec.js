import { test, expect } from '@playwright/test';
import {
  setupE2eDatabase,
  startBackendServer,
  stopBackendServer
} from './server-controller.js';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Prepare clean e2e database and start backend on port 5001
  await setupE2eDatabase();
  await startBackendServer();
});

test.afterAll(async () => {
  stopBackendServer();
});

test('1. Registration succeeds and the account shows the pending message', async ({ page }) => {
  await page.goto('/register');

  // Verify form elements are loaded
  await expect(page.locator('#reg-name')).toBeVisible();
  await expect(page.locator('#reg-dept option')).toHaveCount(1);

  // Fill in registration fields
  await page.fill('#reg-name', 'Dr. Ramesh Faculty');
  await page.fill('#reg-email', 'ramesh.faculty@ritrjpm.ac.in');
  await page.selectOption('#reg-dept', { label: 'Computer Science and Engineering' });
  await page.fill('#reg-phone', '9876543210');
  await page.fill('#reg-password', 'Password123!');

  // Submit registration form
  await page.click('button[type="submit"]');

  // Verify pending approval confirmation screen is displayed
  await expect(page.locator('text=Registration Submitted')).toBeVisible();
  await expect(page.locator('text=PENDING')).toBeVisible();
  await expect(page.locator('text=Back to Sign In')).toBeVisible();
});

test('2. Admin login, logout and login again', async ({ page }) => {
  await page.goto('/login');

  // Admin Login
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');

  // Verify navigation to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('text=System Admin').first()).toBeVisible();

  // Admin Logout
  await page.click('header .dropdown button');
  await page.click('text=Logout');
  await expect(page).toHaveURL(/.*login/);

  // Admin Login Again
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('text=System Admin').first()).toBeVisible();

  // Clean up logout
  await page.click('header .dropdown button');
  await page.click('text=Logout');
  await expect(page).toHaveURL(/.*login/);
});

test('3. Wrong password shows an inline error', async ({ page }) => {
  await page.goto('/login');

  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'WrongPassword999');
  await page.click('button[type="submit"]');

  // Verify error alert is displayed
  const errorAlert = page.locator('.alert.alert-danger');
  await expect(errorAlert).toBeVisible();
  await expect(errorAlert).toContainText('Invalid email or password');
});

test('4. Role-filtered navigation for at least two different roles', async ({ page }) => {
  // Role 1: ADMIN
  await page.goto('/login');
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Admin must see Admin-specific links
  const sidebar = page.locator('.sidebar-wrapper');
  await expect(sidebar.locator('text=Users')).toBeVisible();
  await expect(sidebar.locator('text=Departments')).toBeVisible();
  await expect(sidebar.locator('text=Categories')).toBeVisible();
  await expect(sidebar.locator('text=Inventory')).toBeVisible();

  // Logout Admin
  await page.click('header .dropdown button');
  await page.click('text=Logout');
  await expect(page).toHaveURL(/.*login/);

  // Role 2: STORE_MANAGER
  await page.fill('#login-email', 'store@ritrjpm.ac.in');
  await page.fill('#login-password', 'Store123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Store Manager sees inventory & reorder, but NOT admin master links
  await expect(sidebar.locator('text=Reorder Suggestions')).toBeVisible();
  await expect(sidebar.locator('text=Inventory')).toBeVisible();
  await expect(sidebar.locator('text=Users')).toHaveCount(0);
  await expect(sidebar.locator('text=Departments')).toHaveCount(0);
  await expect(sidebar.locator('text=Categories')).toHaveCount(0);

  // Logout Store Manager
  await page.click('header .dropdown button');
  await page.click('text=Logout');
  await expect(page).toHaveURL(/.*login/);
});

test('5. A forbidden route shows /403', async ({ page }) => {
  // Login as STORE_MANAGER
  await page.goto('/login');
  await page.fill('#login-email', 'store@ritrjpm.ac.in');
  await page.fill('#login-password', 'Store123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Direct URL navigation to forbidden admin-only route (/users)
  await page.goto('/users');

  // Verify redirected to /403 with Access Denied message
  await expect(page).toHaveURL(/.*403/);
  await expect(page.locator('text=403 — Access Denied')).toBeVisible();
  await expect(page.locator('text=You do not have the required permissions')).toBeVisible();
});

test('6. With the server stopped, a data page shows the error state with Retry and no fake data', async ({ page }) => {
  // Stop backend server to simulate server failure
  stopBackendServer();

  // Navigate to data page (/register loads /api/departments/public)
  await page.goto('/register');

  // Expect ErrorState with Retry button
  const errorBox = page.locator('.alert.alert-danger');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText('Unable to load departments');

  const retryButton = errorBox.locator('button:has-text("Retry")');
  await expect(retryButton).toBeVisible();

  // Verify no fake department data is loaded
  const deptSelect = page.locator('#reg-dept');
  await expect(deptSelect).toHaveCount(0); // select is not rendered when loading failed

  // Restart backend server
  await startBackendServer();

  // Click Retry
  await retryButton.click();

  // Expect successful reload and real department option available
  await expect(page.locator('#reg-dept')).toBeVisible();
  await expect(page.locator('#reg-dept option')).toHaveText(['Computer Science and Engineering']);
});
