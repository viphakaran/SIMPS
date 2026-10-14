import cron from 'node-cron';
import env from './config/env.js';
import { query } from './config/db.js';
import { deriveItemStatus } from './services/itemService.js';
import { NotificationService } from './services/notificationService.js';

let cronJob = null;

/**
 * Run the daily low/out stock digest check.
 */
export async function runDailyStockDigest() {
  const items = await query(
    'SELECT id, sku, name, stock_qty, min_level FROM items WHERE is_active = 1'
  );

  const lowOrOutItems = [];
  for (const item of items) {
    const status = deriveItemStatus(item.stock_qty, item.min_level);
    if (status === 'LOW' || status === 'OUT') {
      lowOrOutItems.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        stockQty: item.stock_qty,
        minLevel: item.min_level,
        status
      });
    }
  }

  // Skipped if none
  if (lowOrOutItems.length === 0) {
    return { notified: false, count: 0 };
  }

  const message = `Daily Inventory Digest: ${lowOrOutItems.length} item(s) are currently low or out of stock.`;

  await NotificationService.notify({
    roles: ['PROCUREMENT_OFFICER'],
    type: 'LOW_STOCK',
    message,
    link: '/items?status=LOW'
  });

  return { notified: true, count: lowOrOutItems.length };
}

/**
 * Initialize scheduler. Disabled when NODE_ENV === 'test'.
 */
export function initScheduler() {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  // 08:00 server time every day ('0 8 * * *')
  cronJob = cron.schedule('0 8 * * *', async () => {
    try {
      await runDailyStockDigest();
    } catch (err) {
      console.error('[Scheduler Error]: Failed to run daily stock digest', err);
    }
  });

  return cronJob;
}

export function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
}
