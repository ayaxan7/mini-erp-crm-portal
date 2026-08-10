import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().max(200).nullable(),
);

export const productFields = {
  name: z.string().trim().min(1, 'Product name is required').max(200),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50)
    .transform((value) => value.toUpperCase()),
  category: z.preprocess((value) => (value === '' || value === undefined ? 'General' : value), z.string().trim().max(100)),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative').max(1_000_000_000),
  currentStock: z.coerce.number().int('Stock must be a whole number').min(0).optional(),
  minStock: z.coerce.number().int('Minimum stock must be a whole number').min(0).optional(),
  location: optionalText,
};

export const createProductSchema = z.object(productFields);
export const updateProductSchema = z.object(productFields).partial();

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(150).optional(),
  category: z.string().trim().max(100).optional(),
  lowStock: z.coerce.boolean().optional(),
});

export const stockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().int('Quantity must be a whole number').positive('Quantity must be greater than zero'),
  reason: z.string().trim().min(1, 'Reason is required').max(255),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;