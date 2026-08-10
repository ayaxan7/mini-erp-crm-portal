import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { stockMovementListQuerySchema } from '../validation/challan.schema.js';
import type { StockController } from '../controllers/stock.controller.js';
import type { AuthMiddleware } from './types.js';

export function stockRouter(stockController: StockController, auth: AuthMiddleware): Router {
  const { requireAuth } = auth;
  const router = Router();
  router.use(requireAuth);
  router.get('/movements', validate(stockMovementListQuerySchema, 'query'), stockController.list);
  return router;
}