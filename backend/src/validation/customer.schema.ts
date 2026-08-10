import { z } from 'zod';
import { idParamsSchema } from './common.schema.js';

export { idParamsSchema };
export type { IdParams } from './common.schema.js';

export const customerTypeSchema = z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']);
export const customerStatusSchema = z.enum(['LEAD', 'ACTIVE', 'INACTIVE']);

const optionalText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().max(500).nullable(),
);

const optionalEmail = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().email('Invalid email address').max(255).nullable(),
);

const optionalDate = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().date('Invalid date').nullable(),
);

export const customerFields = {
  name: z.string().trim().min(1, 'Customer name is required').max(150),
  mobile: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
  email: optionalEmail,
  businessName: optionalText,
  gstNumber: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().regex(/^[0-9A-Za-z]{15}$/, 'GST number must be 15 alphanumeric characters').nullable(),
  ),
  type: customerTypeSchema,
  address: optionalText,
  status: customerStatusSchema,
  followUpDate: optionalDate,
  notes: optionalText,
};

export const createCustomerSchema = z.object(customerFields);
export const updateCustomerSchema = z.object(customerFields).partial();

export const createFollowupSchema = z.object({
  notes: z.string().trim().min(1, 'Follow-up notes cannot be empty').max(1000),
  followUpDate: optionalDate,
});

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(150).optional(),
  type: customerTypeSchema.optional(),
  status: customerStatusSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateFollowupInput = z.infer<typeof createFollowupSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;