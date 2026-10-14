import { SupplierService } from '../services/supplierService.js';

export class SupplierController {
  static async list(req, res, next) {
    try {
      const result = await SupplierService.listSuppliers(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const result = await SupplierService.getSupplierById(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await SupplierService.createSupplier(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await SupplierService.updateSupplier(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
