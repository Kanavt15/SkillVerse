import { z } from 'zod';
export const secondFactorCodeSchema = z
  .string()
  .trim()
  .min(6, 'Enter the 6-digit code from your app')
  .max(16)
  .regex(/^[A-Za-z0-9\s-]+$/, 'Enter the 6-digit code from your app, or a recovery code');
