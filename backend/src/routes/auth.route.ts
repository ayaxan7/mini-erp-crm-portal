import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../validation/common.schema.js';
import { updateRoleSchema, userListQuerySchema } from '../validation/user.schema.js';
import type { AuthController } from '../controllers/auth.controller.js';
import type { AuthMiddleware } from './types.js';

export function authRouter(authController: AuthController, auth: AuthMiddleware): Router {
  const { requireAuth, requireRole } = auth;
  const router = Router();

  router.get('/me', requireAuth, authController.me);

  router.get('/users', requireAuth, requireRole('ADMIN'), validate(userListQuerySchema, 'query'), authController.listUsers);
  router.patch(
    '/users/:id/role',
    requireAuth,
    requireRole('ADMIN'),
    validate(idParamsSchema, 'params'),
    validate(updateRoleSchema),
    authController.updateRole,
  );

  return router;
}