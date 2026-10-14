import { DepartmentService } from '../services/departmentService.js';

export class DepartmentController {
  static async listPublic(_req, res, next) {
    try {
      const result = await DepartmentService.listPublic();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await DepartmentService.listDepartments(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await DepartmentService.createDepartment(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await DepartmentService.updateDepartment(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async assignHod(req, res, next) {
    try {
      const result = await DepartmentService.assignHod(req.params.id, req.body.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
