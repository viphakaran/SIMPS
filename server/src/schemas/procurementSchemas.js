import { z } from 'zod';

export const createRequestSchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  justification: z.string().trim().optional().nullable(),
  lines: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive('itemId must be a positive integer'),
        quantity: z.coerce.number().int().positive('quantity must be greater than 0')
      })
    )
    .min(1, 'At least one item line is required')
});

export const decisionRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Decision must be APPROVED or REJECTED' })
  }),
  reason: z.string().trim().optional().nullable()
});

export const returnRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required when returning a request')
});

export const createOrdersSchema = z.object({
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expectedDate must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  lines: z
    .array(
      z.object({
        requestItemId: z.coerce.number().int().positive('requestItemId must be a positive integer'),
        supplierId: z.coerce.number().int().positive('supplierId must be a positive integer'),
        unitPrice: z.coerce.number().positive('unitPrice must be greater than 0')
      })
    )
    .min(1, 'At least one order line is required')
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], {
    errorMap: () => ({
      message: 'Status must be one of CONFIRMED, SHIPPED, DELIVERED, CANCELLED'
    })
  })
});
