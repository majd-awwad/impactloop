import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === 'true',
    ),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
