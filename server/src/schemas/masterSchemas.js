import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one digit');

export const ROLES = [
  'ADMIN',
  'PRINCIPAL',
  'HOD',
  'REQUESTER',
  'PROCUREMENT_OFFICER',
  'STORE_MANAGER',
  'SUPPLIER'
];

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: passwordSchema,
  phone: z.string().trim().optional().nullable(),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Invalid user role' }) }),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  supplierId: z.coerce.number().int().positive().optional().nullable()
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(ROLES).optional(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  supplierId: z.coerce.number().int().positive().optional().nullable()
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name must be at least 2 characters')
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional()
});

export const assignHodSchema = z.object({
  userId: z.coerce.number().int().positive('Valid userId is required')
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters')
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters')
});

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  categoryId: z.coerce.number().int().positive().optional().nullable()
});

export const updateSupplierSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional()
});
