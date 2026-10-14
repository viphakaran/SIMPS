import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { query } from '../config/db.js';
import { parsePagination } from '../utils/pagination.js';
import { NotFoundError } from '../utils/errors.js';

let transporter = null;
if (env.SMTP_HOST && env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

export class NotificationService {
  /**
   * Broadcast or direct notify users with in-app notifications and optional email.
   * Email failure never throws to the caller.
   */
  static async notify({ userIds = [], roles = [], type, message, link = null, isDemo = 0 }) {
    let recipients = [];

    if (roles && roles.length > 0) {
      const placeholders = roles.map(() => '?').join(', ');
      recipients = await query(
        `SELECT id, email, is_demo FROM users WHERE role IN (${placeholders}) AND status = 'ACTIVE'`,
        roles
      );
    } else if (userIds && userIds.length > 0) {
      const idList = Array.isArray(userIds) ? userIds : [userIds];
      const placeholders = idList.map(() => '?').join(', ');
      recipients = await query(
        `SELECT id, email, is_demo FROM users WHERE id IN (${placeholders}) AND status = 'ACTIVE'`,
        idList
      );
    }

    if (recipients.length === 0) {
      return [];
    }

    const createdNotifications = [];

    for (const recipient of recipients) {
      let emailed = 0;

      if (transporter && recipient.email) {
        try {
          await transporter.sendMail({
            from: env.MAIL_FROM || 'noreply@ritrjpm.ac.in',
            to: recipient.email,
            subject: `[SIMPS] ${type.replace(/_/g, ' ')}`,
            text: message,
            html: `<p>${message}</p>${link ? `<p><a href="${link}">View in SIMPS</a></p>` : ''}`
          });
          emailed = 1;
        } catch (err) {
          console.error(`[email] Failed to send email to ${recipient.email}:`, err.message);
          emailed = 0;
        }
      } else {
        if (env.NODE_ENV !== 'test') {
          console.log(`[email] email skipped: ${type} to ${recipient.email || recipient.id}`);
        }
      }

      const rowIsDemo = isDemo || recipient.is_demo ? 1 : 0;

      const result = await query(
        `INSERT INTO notifications (user_id, type, message, link, is_read, emailed, is_demo)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [recipient.id, type, message, link, emailed, rowIsDemo]
      );

      createdNotifications.push({
        id: result.insertId,
        userId: recipient.id,
        type,
        message,
        link,
        isRead: false,
        emailed: Boolean(emailed),
        isDemo: Boolean(rowIsDemo)
      });
    }

    return createdNotifications;
  }

  static async listUserNotifications(userId, queryParams = {}) {
    const { page, pageSize, limit, offset } = parsePagination(queryParams);
    const { unread } = queryParams;

    const conditions = ['user_id = ?'];
    const params = [userId];

    if (unread === 'true' || unread === '1') {
      conditions.push('is_read = 0');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM notifications ${whereClause}`,
      params
    );
    const total = countRows ? countRows.total : 0;

    const [unreadCountRows] = await query(
      'SELECT COUNT(*) AS unreadTotal FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    const unreadCount = unreadCountRows ? unreadCountRows.unreadTotal : 0;

    const rows = await query(
      `SELECT id, type, message, link, is_read, emailed, is_demo, created_at
       FROM notifications
       ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const data = rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      link: r.link,
      isRead: Boolean(r.is_read),
      emailed: Boolean(r.emailed),
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at
    }));

    return {
      data,
      page,
      pageSize,
      total: Number(total),
      unreadCount: Number(unreadCount)
    };
  }

  static async markOneRead(notificationId, userId) {
    const rows = await query('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [
      notificationId,
      userId
    ]);
    if (rows.length === 0) {
      throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
    return { success: true };
  }

  static async markAllRead(userId) {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [
      userId
    ]);
    return { success: true };
  }
}
