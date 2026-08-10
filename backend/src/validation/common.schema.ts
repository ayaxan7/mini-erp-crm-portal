import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive('ID must be a positive integer'),
});

export type IdParams = z.infer<typeof idParamsSchema>;