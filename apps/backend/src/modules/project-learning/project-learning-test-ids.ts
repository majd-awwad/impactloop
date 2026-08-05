import { randomBytes } from 'node:crypto';

/**
 * Worker-safe unique phone for learning-hub tests.
 * Avoids 6-digit collisions under parallel suite runs.
 */
export const uniqueLearningTestPhone = (marker = 'lh'): string => {
  const suffix = randomBytes(5).toString('hex'); // 10 hex chars
  const time = Date.now().toString().slice(-6);
  // +97059 + 6 time + take digits from hex → stays reasonably unique
  const digits = `${time}${parseInt(suffix.slice(0, 8), 16)}`.replace(/\D/g, '');
  return `+97059${digits.slice(0, 9).padStart(9, '0')}`;
};

export const uniqueLearningTestEmail = (marker: string, role: string): string =>
  `${marker}-${role}-${Date.now()}-${randomBytes(4).toString('hex')}@impactloop.test`;
