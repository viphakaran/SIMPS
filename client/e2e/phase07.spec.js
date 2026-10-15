import { test, expect } from '@playwright/test';
import {
  setupE2eDatabase,
  startBackendServer,
  stopBackendServer
} from './server-controller.js';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await setupE2eDatabase();
  await startBackendServer();
});

test.afterAll(async () => {
  stopBackendServer();
});

test('1. Admin creates department, HoD user, assigns HoD, and approves a self-registered requester', async ({ page }) => {
  // Step A: Self-register a Requester first
  await page.goto('/register');
  await expect(page.locator('#reg-name')).toBeVisible();
  await page.fill('#reg-name', 'Selvi Student');
  await page.fill('#reg-email', 'selvi.student@ritrjpm.ac.in');
  await page.selectOption('#reg-dept', { label: 'Computer Science and Engineering' });
  await page.fill('#reg-phone', '9876543211');
  await page.fill('#reg-password', 'Student123!');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=Registration Submitted')).toBeVisible();

  // Step B: Admin Login
  await page.goto('/login');
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Step C: Create new Department
  await page.goto('/departments');
  await expect(page.locator('h1')).toContainText('Departments');
  await page.click('button:has-text("Add Department")');
  await page.fill('input[placeholder="e.g. Mechanical Engineering"]', 'Mechanical Engineering');
  await page.click('button[type="submit"][form="create-dept-form"]');

  // Verify Department appears in the table
  await expect(page.locator('table').locator('text=Mechanical Engineering')).toBeVisible();

  // Step C2: Create Category (Admin master)
  await page.goto('/categories');
  await expect(page.locator('h1')).toContainText('Categories');
  await page.click('button:has-text("Add Category")');
  await page.fill('input[placeholder="e.g. Lab Consumables"]', 'Electronics & Sensors');
  await page.click('button[type="submit"][form="category-form"]');
  await expect(page.locator('table').locator('text=Electronics & Sensors')).toBeVisible();

  // Step D: Create HoD user for Mechanical Engineering
  await page.goto('/users');
  await expect(page.locator('h1')).toContainText('User Administration');
  await page.click('button:has-text("Add User")');

  await page.fill('#create-user-form input[placeholder="e.g. Dr. A. Kumar"]', 'Dr. Murugan HoD');
  await page.fill('#create-user-form input[placeholder="name@ritrjpm.ac.in"]', 'murugan.hod@ritrjpm.ac.in');
  await page.fill('#create-user-form input[type="password"]', 'MuruganPass123!');
  // Select Role HOD
  await page.selectOption('#create-user-form select', 'HOD');
  // Select Department Mechanical Engineering
  const deptSelect = page.locator('#create-user-form select').nth(1);
  await deptSelect.selectOption({ label: 'Mechanical Engineering' });
  await page.click('button[type="submit"][form="create-user-form"]');

  // Verify HoD user created in table
  await expect(page.locator('table').locator('text=Dr. Murugan HoD')).toBeVisible();

  // Step E: Assign HoD to Mechanical Engineering Department
  await page.goto('/departments');
  const mechRow = page.locator('tr:has-text("Mechanical Engineering")');
  await mechRow.locator('button:has-text("HoD")').click();
  await expect(page.locator('#assign-hod-form select')).toBeVisible();
  await page.selectOption('#assign-hod-form select', { label: 'Dr. Murugan HoD (murugan.hod@ritrjpm.ac.in)' });
  await page.click('button[type="submit"][form="assign-hod-form"]');

  // Verify HoD badge appears in row
  await expect(mechRow.locator('text=Dr. Murugan HoD')).toBeVisible();

  // Step F: Approve self-registered requester
  await page.goto('/users');
  await page.click('button:has-text("Pending Approvals")');
  await expect(page.locator('table').locator('text=Selvi Student')).toBeVisible();
  await page.click('button:has-text("Approve")');
  await expect(page.locator('text=Approve Account')).toBeVisible();
  await page.click('button:has-text("Approve User")');

  // Verify Selvi Student is no longer pending
  await expect(page.locator('text=No pending approvals')).toBeVisible();

  // Logout Admin
  await page.click('#user-menu-btn');
  await page.click('text=Logout');
  await expect(page).toHaveURL(/.*login/);
});

test('2. Store Manager creates item with opening stock, issues stock below minimum, checks notification and ledger', async ({ page }) => {
  // Step A: Login as Store Manager
  await page.goto('/login');
  await page.fill('#login-email', 'store@ritrjpm.ac.in');
  await page.fill('#login-password', 'Store123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Step B: Create Item with Opening Stock
  await page.goto('/items');
  await page.click('button:has-text("Add Item")');
  await page.fill('#item-sku', 'ELEC-ARD-001');
  await page.fill('#item-name', 'Arduino Uno R3 Board');
  // Select Category
  await page.selectOption('#create-item-form select', { label: 'Electronics & Sensors' });
  // Min level 10, unit cost 450, opening stock 15
  await page.fill('#item-min-level', '10');
  await page.fill('#item-unit-cost', '450');
  await page.fill('#item-opening-stock', '15');
  await page.click('button[type="submit"][form="create-item-form"]');

  // Verify item in catalog
  const itemRow = page.locator('tr:has-text("Arduino Uno R3 Board")');
  await expect(itemRow).toBeVisible();
  await expect(itemRow.locator('text=15')).toBeVisible();
  await expect(itemRow.locator('text=In Stock')).toBeVisible();

  // Step D: Issue Stock Below Minimum (Issue 8 out of 15 -> stock becomes 7 < 10)
  await itemRow.locator('button:has-text("Issue")').click();
  await expect(page.locator('#issue-stock-form')).toBeVisible();
  await page.selectOption('#issue-stock-form select', { label: 'Computer Science and Engineering' });
  await page.fill('#issue-stock-form input[type="number"]', '8');
  await page.fill('#issue-stock-form input[placeholder*="practicals"]', 'Microcontroller Lab setup');
  await page.click('button[type="submit"][form="issue-stock-form"]');

  // Verify stock updated to 7 and status changed to Low Stock
  await expect(itemRow.locator('text=7')).toBeVisible();
  await expect(itemRow.locator('text=Low Stock')).toBeVisible();

  // Step E: Verify Exactly ONE Low-Stock Notification in Inbox
  await page.goto('/notifications');
  await expect(page.locator('h1')).toContainText('Notifications');
  const lowStockNotifs = page.locator('.list-group-item:has-text("Arduino Uno R3 Board")');
  await expect(lowStockNotifs).toHaveCount(1);
  await expect(lowStockNotifs.first()).toContainText('Low Stock');

  // Step F: Movement history ledger shows Opening, Issue and Balance
  await page.goto('/items');
  await page.click('text=Arduino Uno R3 Board');
  await expect(page).toHaveURL(/.*items\/\d+/);

  // Check movement ledger rows
  const ledgerTable = page.locator('table');
  await expect(ledgerTable).toBeVisible();
  // Row for issue: -8, balance 7
  await expect(page.locator('tr:has-text("-8")')).toBeVisible();
  await expect(page.locator('tr:has-text("-8")')).toContainText('7');
  // Row for opening: +15, balance 15
  await expect(page.locator('tr:has-text("+15")')).toBeVisible();
  await expect(page.locator('tr:has-text("+15")')).toContainText('15');
});

test('3. Empty database screens show helpful empty states with actions', async ({ page }) => {
  // Login as Admin
  await page.goto('/login');
  await page.fill('#login-email', 'admin@ritrjpm.ac.in');
  await page.fill('#login-password', 'Admin123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);

  // Suppliers directory with 0 suppliers shows empty state and action button
  await page.goto('/suppliers');
  await expect(page.locator('text=No suppliers found')).toBeVisible();
  await expect(page.locator('button:has-text("Add Supplier")')).toBeVisible();
});
