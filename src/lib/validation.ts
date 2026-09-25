import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(1, "Password is required").max(128, "Password too long"),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s\u0980-\u09FF\u0600-\u06FF.'-]+$/, "Name contains invalid characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

export const shippingSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100, "Name too long"),
  phone: z
    .string()
    .trim()
    .min(6, "Phone is required")
    .max(20, "Phone too long")
    .regex(/^[\d\s+()-]+$/, "Invalid phone number"),
  email: z.string().trim().email("Invalid email").max(255),
  address: z.string().trim().min(5, "Address is required").max(500, "Address too long"),
  city: z.string().trim().min(2, "City is required").max(100),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().min(2).max(100),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50, "Code too long")
    .regex(/^[A-Z0-9_-]+$/i, "Invalid coupon code format"),
});

export const productSchema = z.object({
  title: z.string().trim().min(2, "Title required").max(200),
  price: z.number().positive("Price must be positive").max(9999999),
  description: z.string().trim().max(5000).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  stock_quantity: z.number().int().min(0).max(999999),
});

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export const clientRateLimit = (key: string, maxAttempts: number, windowMs: number): boolean => {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
};

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type ShippingForm = z.infer<typeof shippingSchema>;
