import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one digit');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address'),
    password: passwordSchema,
    phone: z.string().trim().optional().nullable(),
    departmentId: z.coerce.number().int().positive('Valid department ID is required'),
    role: z.string().optional() // explicitly handled/rejected if someone attempts to pass it
  })
  .refine(
    (data) => !data.role || data.role === 'REQUESTER',
    {
      message: 'Self-registration is only allowed for the REQUESTER role',
      path: ['role']
    }
  );

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema
});
