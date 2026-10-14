import { ItemService } from '../services/itemService.js';
import { StockService } from '../services/stockService.js';

export class ItemController {
  static async list(req, res, next) {
    try {
      const result = await ItemService.listItems(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const result = await ItemService.getItemById(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await ItemService.createItem(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await ItemService.updateItem(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async issue(req, res, next) {
    try {
      const result = await ItemService.issueStock(req.params.id, req.body, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async adjust(req, res, next) {
    try {
      const result = await ItemService.adjustStock(req.params.id, req.body, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getItemMovements(req, res, next) {
    try {
      const result = await StockService.listMovements({
        ...req.query,
        itemId: req.params.id
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getAllMovements(req, res, next) {
    try {
      const result = await StockService.listMovements(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
