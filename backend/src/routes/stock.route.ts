import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { stockMovementListQuerySchema } from '../validation/challan.schema.js';
import type { StockController } from '../controllers/stock.controller.js';

export function stockRouter(stockController: StockController): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/movements', validate(stockMovementListQuerySchema, 'query'), stockController.list);
  return router;
}