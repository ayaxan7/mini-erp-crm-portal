import { z } from 'zod';

export const challanItemSchema = z.object({
  productId: z.coerce.number().int().positive('Product selection is invalid'),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
});

export const createChallanSchema = z.object({
  customerId: z.coerce.number().int().positive('Customer selection is invalid'),
  status: z.enum(['DRAFT', 'CONFIRMED']).default('DRAFT'),
  remarks: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().max(500).nullable(),
  ),
  items: z.array(challanItemSchema).min(1, 'Add at least one product to the challan'),
});

export const challanListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(150).optional(),
});

export const stockMovementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productId: z.coerce.number().int().positive().optional(),
});

export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type ChallanListQuery = z.infer<typeof challanListQuerySchema>;
export type StockMovementListQuery = z.infer<typeof stockMovementListQuerySchema>;