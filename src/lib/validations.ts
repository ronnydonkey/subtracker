import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const subscriptionSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  categoryId: z.string().uuid().optional(),
  cost: z.number().positive('Cost must be greater than 0'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  billingCycle: z.enum(['monthly', 'quarterly', 'semi-annually', 'annually', 'weekly']),
  startDate: z.date(),
  nextBillingDate: z.date(),
  endDate: z.date().optional(),
  trialEndDate: z.date().optional(),
  status: z.enum(['active', 'cancelled', 'paused', 'trial', 'expired']),
  autoRenew: z.boolean(),
  description: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  cancellationUrl: z.string().url().optional().or(z.literal('')),
  notificationDaysBefore: z.number().min(0).max(30),
});

export const updateSubscriptionSchema = subscriptionSchema.partial();

export const emailImportSchema = z.object({
  from: z.string().email('Invalid sender email'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  date: z.string().datetime().optional(),
});

export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  notificationDaysBefore: z.number().min(0).max(30),
});

export const userPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  notificationDaysBefore: z.number().min(0).max(30),
  currency: z.string().length(3),
  timezone: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type EmailImportInput = z.infer<typeof emailImportSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;