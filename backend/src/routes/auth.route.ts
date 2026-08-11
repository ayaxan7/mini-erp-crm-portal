import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idParamsSchema } from '../validation/common.schema.js';
import {
  accessRequestListQuerySchema,
  approveAccessRequestSchema,
  loginSchema,
  rejectAccessRequestSchema,
  requestAccessSchema,
} from '../validation/auth.schema.js';
import type { AuthController } from '../controllers/auth.controller.js';
import type { AccessRequestController } from '../controllers/access-request.controller.js';

export function authRouter(
  authController: AuthController,
  accessRequestController: AccessRequestController,
): Router {
  const router = Router();
  router.post('/login', validate(loginSchema), authController.login);
  router.get('/me', requireAuth, authController.me);
  router.post('/request-access', validate(requestAccessSchema), accessRequestController.requestAccess);
  router.get(
    '/access-requests',
    requireAuth,
    requireRole('ADMIN'),
    validate(accessRequestListQuerySchema, 'query'),
    accessRequestController.list,
  );
  router.patch(
    '/access-requests/:id/approve',
    requireAuth,
    requireRole('ADMIN'),
    validate(idParamsSchema, 'params'),
    validate(approveAccessRequestSchema),
    accessRequestController.approve,
  );
  router.patch(
    '/access-requests/:id/reject',
    requireAuth,
    requireRole('ADMIN'),
    validate(idParamsSchema, 'params'),
    validate(rejectAccessRequestSchema),
    accessRequestController.reject,
  );
  return router;
}
