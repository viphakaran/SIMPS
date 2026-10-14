import { OrderService } from '../services/orderService.js';

export class OrderController {
  static async listOrders(req, res, next) {
    try {
      const result = await OrderService.listOrders(req.user, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getOrderById(req, res, next) {
    try {
      const result = await OrderService.getOrderById(Number(req.params.id), req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateOrderStatus(req, res, next) {
    try {
      const result = await OrderService.updateOrderStatus(
        Number(req.params.id),
        req.user,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async receiveOrder(req, res, next) {
    try {
      const result = await OrderService.receiveOrder(Number(req.params.id), req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
