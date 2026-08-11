import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(255),
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const REQUESTABLE_ROLES = ['SALES', 'WAREHOUSE', 'ACCOUNTS'] as const;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || null : null),
    z.string().max(max, `Must be at most ${max} characters`).nullable(),
  );

export const requestAccessSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email address').max(255),
  role: z.enum(REQUESTABLE_ROLES),
  message: optionalText(1000),
});

export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

export const accessRequestListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export type AccessRequestListQuery = z.infer<typeof accessRequestListQuerySchema>;

export const approveAccessRequestSchema = z.object({
  initialPassword: optionalText(64),
});

export type ApproveAccessInput = z.infer<typeof approveAccessRequestSchema>;

export const rejectAccessRequestSchema = z.object({
  reason: optionalText(500),
});

export type RejectAccessInput = z.infer<typeof rejectAccessRequestSchema>;
