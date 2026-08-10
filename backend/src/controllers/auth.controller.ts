import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination } from '../types/index.js';
import type { AuthService } from '../services/auth.service.js';
import type { UpdateRoleInput, UserListQuery } from '../validation/user.schema.js';
import type { IdParams } from '../validation/common.schema.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  me = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: req.user });
  });

  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as UserListQuery;
    const pagination = parsePagination(req.query);
    const data = await this.authService.list({ ...pagination, search: query.search });
    res.json({ success: true, data });
  });

  updateRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validatedParams as IdParams;
    const input = req.validatedBody as UpdateRoleInput;
    const data = await this.authService.setRole(id, input.role, id === req.user!.id);
    res.json({
      success: true,
      data: { id: data.id, name: data.name, email: data.email, role: data.role },
    });
  });
}