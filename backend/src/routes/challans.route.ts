import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { idParamsSchema } from '../validation/common.schema.js';
import { createChallanSchema, challanListQuerySchema } from '../validation/challan.schema.js';
import type { ChallanController } from '../controllers/challan.controller.js';

export function challanRouter(challanController: ChallanController): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(challanListQuerySchema, 'query'), challanController.list);
  router.post('/', requireRole('ADMIN', 'SALES'), validate(createChallanSchema), challanController.create);
  router.get('/:id', validate(idParamsSchema, 'params'), challanController.get);
  router.get('/:id/invoice', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), challanController.invoiceHtml);
  router.get('/:id/invoice.pdf', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), challanController.invoicePdf);
  router.patch('/:id/confirm', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), challanController.confirm);
  router.patch('/:id/cancel', requireRole('ADMIN', 'SALES'), validate(idParamsSchema, 'params'), challanController.cancel);

  return router;
}