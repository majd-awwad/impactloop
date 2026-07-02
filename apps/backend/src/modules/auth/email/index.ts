import { getResolvedEmailProvider } from '../../../config/env.js';

import type { AuthEmailProvider } from './auth-email-provider.js';
import { MockAuthEmailProvider } from './mock-auth-email-provider.js';
import { SmtpAuthEmailProvider } from './smtp-auth-email-provider.js';

let overrideProvider: AuthEmailProvider | null = null;
let smtpProvider: SmtpAuthEmailProvider | null = null;
const mockProvider = new MockAuthEmailProvider();

export const getAuthEmailProvider = (): AuthEmailProvider => {
  if (overrideProvider) {
    return overrideProvider;
  }

  if (getResolvedEmailProvider() === 'smtp') {
    smtpProvider ??= new SmtpAuthEmailProvider();
    return smtpProvider;
  }

  return mockProvider;
};

export const setAuthEmailProviderForTests = (
  provider: AuthEmailProvider,
): void => {
  overrideProvider = provider;
};

export const resetAuthEmailProviderForTests = (): void => {
  overrideProvider = null;
};
