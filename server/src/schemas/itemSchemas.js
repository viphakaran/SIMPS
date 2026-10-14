import { z } from 'zod';

export const createItemSchema = z.object({
  sku: z.string().trim().min(2, 'SKU must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  unit: z.string().trim().default('nos'),
  minLevel: z.coerce.number().int().min(0, 'Min level cannot be negative').default(0),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative').default(0),
  openingStock: z.coerce.number().int().min(0, 'Opening stock cannot be negative').default(0)
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(2).optional(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  unit: z.string().trim().optional(),
  minLevel: z.coerce.number().int().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional()
});

export const issueStockSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantity must be greater than 0'),
  departmentId: z.coerce.number().int().positive('Valid department ID is required'),
  reason: z.string().trim().optional()
});

export const adjustStockSchema = z.object({
  delta: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, 'Delta cannot be zero'),
  reason: z.string().trim().min(2, 'Reason is required for adjustment')
});
