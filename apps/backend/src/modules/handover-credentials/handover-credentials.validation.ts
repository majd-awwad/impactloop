import { z } from 'zod';

export const handoverCredentialReservationParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type HandoverCredentialReservationParams = z.infer<
  typeof handoverCredentialReservationParamsSchema
>;

export const handoverCredentialTokenBodySchema = z.object({
  handoverToken: z
    .string()
    .trim()
    .min(1, 'Handover token is required.')
    .max(320),
});

export type HandoverCredentialTokenBody = z.infer<
  typeof handoverCredentialTokenBodySchema
>;
