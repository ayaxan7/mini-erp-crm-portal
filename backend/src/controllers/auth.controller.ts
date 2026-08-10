import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../middleware/auth.js';
import type { AuthService } from '../services/auth.service.js';
import type { LoginInput } from '../validation/auth.schema.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const input = req.validatedBody as LoginInput;
    const user = await this.authService.login(input.email.toLowerCase().trim(), input.password);
    const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    res.json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: req.user });
  });
}