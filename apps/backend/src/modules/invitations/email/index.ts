import { getResolvedEmailProvider } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';

import type { EmailInvitationProvider } from './email-invitation-provider.js';
import { MockEmailInvitationProvider } from './mock-email-invitation-provider.js';
import { SmtpEmailInvitationProvider } from './smtp-email-invitation-provider.js';

let provider: EmailInvitationProvider | null = null;

export const getEmailInvitationProviderName = (): 'mock' | 'smtp' =>
  getResolvedEmailProvider();

export const getEmailInvitationProvider = (): EmailInvitationProvider => {
  if (provider) {
    return provider;
  }

  if (getResolvedEmailProvider() === 'smtp') {
    provider = new SmtpEmailInvitationProvider();
    logger.debug(
      {
        operation: 'email.provider_selected',
        provider: 'smtp',
      },
      'SmtpEmailInvitationProvider selected',
    );
  } else {
    provider = new MockEmailInvitationProvider();
    logger.debug(
      {
        operation: 'email.provider_selected',
        provider: 'mock',
      },
      'MockEmailInvitationProvider selected',
    );
  }

  return provider;
};

export const resetEmailInvitationProviderForTests = (): void => {
  provider = null;
};

export const setEmailInvitationProviderForTests = (
  testProvider: EmailInvitationProvider,
): void => {
  provider = testProvider;
};
