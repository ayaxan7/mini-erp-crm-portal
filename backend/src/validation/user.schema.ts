import { z } from 'zod';

export const ROLE_VALUES = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] as const;

export const updateRoleSchema = z.object({
  role: z.enum(ROLE_VALUES, { errorMap: () => ({ message: 'Invalid role' }) }),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(150).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;