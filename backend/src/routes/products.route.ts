import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { idParamsSchema } from '../validation/common.schema.js';
import { createProductSchema, updateProductSchema, productListQuerySchema, stockMovementSchema } from '../validation/product.schema.js';
import { stockMovementListQuerySchema } from '../validation/challan.schema.js';
import type { ProductController } from '../controllers/product.controller.js';

export function productRouter(productController: ProductController): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate(productListQuerySchema, 'query'), productController.list);
  router.post('/', requireRole('ADMIN', 'WAREHOUSE'), validate(createProductSchema), productController.create);
  router.get('/:id', validate(idParamsSchema, 'params'), productController.get);
  router.get('/:id/image-url', validate(idParamsSchema, 'params'), productController.imageUrl);
  router.get('/:id/movements', validate(idParamsSchema, 'params'), validate(stockMovementListQuerySchema, 'query'), productController.movements);
  router.post('/:id/image', requireRole('ADMIN', 'WAREHOUSE'), validate(idParamsSchema, 'params'), imageUpload.single('image'), productController.uploadImage);
  router.patch('/:id', requireRole('ADMIN', 'WAREHOUSE'), validate(idParamsSchema, 'params'), validate(updateProductSchema), productController.update);
  router.post('/:id/stock', requireRole('ADMIN', 'WAREHOUSE'), validate(idParamsSchema, 'params'), validate(stockMovementSchema), productController.addStock);

  return router;
}