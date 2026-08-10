import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema } from '../validation/auth.schema.js';
import type { AuthController } from '../controllers/auth.controller.js';

export function authRouter(authController: AuthController): Router {
  const router = Router();
  router.post('/login', validate(loginSchema), authController.login);
  router.get('/me', requireAuth, authController.me);
  return router;
}