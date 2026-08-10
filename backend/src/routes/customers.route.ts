import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../validation/common.schema.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createFollowupSchema,
  customerListQuerySchema,
} from '../validation/customer.schema.js';
import type { CustomerController } from '../controllers/customer.controller.js';
import type { AuthMiddleware } from './types.js';

export function customerRouter(customerController: CustomerController, auth: AuthMiddleware): Router {
  const { requireAuth, requireRole } = auth;
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(customerListQuerySchema, 'query'), customerController.list);
  router.post('/', requireRole('ADMIN', 'SALES'), validate(createCustomerSchema), customerController.create);
  router.get('/:id', validate(idParamsSchema, 'params'), customerController.get);
  router.patch('/:id', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), validate(updateCustomerSchema), customerController.update);
  router.get('/:id/followups', validate(idParamsSchema, 'params'), customerController.listFollowups);
  router.post('/:id/followups', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), validate(createFollowupSchema), customerController.addFollowup);

  return router;
}