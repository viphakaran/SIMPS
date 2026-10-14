import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

router.get('/meta', async (_req, res, next) => {
  try {
    const rows = await query('SELECT 1 FROM users WHERE is_demo = 1 LIMIT 1');
    const demoDataPresent = rows.length > 0;
    res.json({ demoDataPresent });
  } catch (err) {
    next(err);
  }
});

export default router;
