import { z } from 'zod';

import { MOCK_CHECKOUT_ACTIONS } from './payments.constants.js';

/**
 * PAY-01A: returnUrl/cancelUrl removed until an origin allowlist is wired.
 * Do not accept arbitrary open-redirect destinations.
 */
export const paymentCheckoutSchema = z.object({}).strict();

export type PaymentCheckoutInput = z.infer<typeof paymentCheckoutSchema>;

export const paymentCancelAttemptSchema = z.object({
  attemptId: z.string().min(1),
});

export type PaymentCancelAttemptInput = z.infer<
  typeof paymentCancelAttemptSchema
>;

export const mockCheckoutActSchema = z.object({
  action: z.enum(MOCK_CHECKOUT_ACTIONS),
  token: z.string().min(1).optional(),
});

export type MockCheckoutActInput = z.infer<typeof mockCheckoutActSchema>;
