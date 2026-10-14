import { CategoryService } from '../services/categoryService.js';

export class CategoryController {
  static async list(req, res, next) {
    try {
      const result = await CategoryService.listCategories(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await CategoryService.createCategory(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await CategoryService.updateCategory(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
