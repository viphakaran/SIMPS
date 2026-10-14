import { RequestService } from '../services/requestService.js';
import { OrderService } from '../services/orderService.js';

export class RequestController {
  static async createRequest(req, res, next) {
    try {
      const result = await RequestService.createRequest(req.user, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async listRequests(req, res, next) {
    try {
      const result = await RequestService.listRequests(req.user, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getRequestById(req, res, next) {
    try {
      const result = await RequestService.getRequestById(Number(req.params.id), req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async decideRequest(req, res, next) {
    try {
      const result = await RequestService.decideRequest(
        Number(req.params.id),
        req.user,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async cancelRequest(req, res, next) {
    try {
      const result = await RequestService.cancelRequest(Number(req.params.id), req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async returnRequest(req, res, next) {
    try {
      const result = await RequestService.returnRequest(
        Number(req.params.id),
        req.user,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createOrders(req, res, next) {
    try {
      const result = await OrderService.createOrdersForRequest(
        Number(req.params.id),
        req.user,
        req.body
      );
      res.status(201).json({ orders: result });
    } catch (err) {
      next(err);
    }
  }
}
