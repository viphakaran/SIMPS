import { UserService } from '../services/userService.js';

export class UserController {
  static async list(req, res, next) {
    try {
      const result = await UserService.listUsers(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await UserService.createUser(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const result = await UserService.updateUser(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async approve(req, res, next) {
    try {
      const result = await UserService.approveUser(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async disable(req, res, next) {
    try {
      const result = await UserService.disableUser(req.params.id, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async enable(req, res, next) {
    try {
      const result = await UserService.enableUser(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
