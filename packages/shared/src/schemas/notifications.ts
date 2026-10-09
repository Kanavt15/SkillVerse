/** Authenticated notification inbox and preference contracts. */
import { z } from 'zod';
export const notificationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  unreadOnly: z.enum(['true', 'false']).default('false'),
});
export const notificationPreferenceSchema = z.strictObject({ discussions: z.boolean() });
export const notificationViewSchema = z.object({
  id: z.string(),
  kind: z.enum(['question', 'reply', 'answer', 'moderation']),
  title: z.string(),
  message: z.string(),
  href: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export const notificationInboxSchema = z.object({
  items: z.array(notificationViewSchema),
  total: z.number().int(),
  unreadCount: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
  preferences: notificationPreferenceSchema,
});
export const notificationCountSchema = z.object({ unreadCount: z.number().int() });
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationView = z.infer<typeof notificationViewSchema>;
export type NotificationInbox = z.infer<typeof notificationInboxSchema>;
