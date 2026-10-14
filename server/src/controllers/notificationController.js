import { NotificationService } from '../services/notificationService.js';

export class NotificationController {
  static async list(req, res, next) {
    try {
      const result = await NotificationService.listUserNotifications(req.user.id, req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req, res, next) {
    try {
      const result = await NotificationService.markOneRead(req.params.id, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      const result = await NotificationService.markAllRead(req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
