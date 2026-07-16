import './config/env.js';
import { app } from './app.js';
import {
  env,
  getResolvedEmailProvider,
  logAiPlatformDiagnostics,
  logAiPriceSuggestionStartupConfig,
  logEmailInvitationStartupConfig,
} from './config/env.js';
import { verifySmtpInvitationTransport } from './modules/invitations/email/smtp-email-invitation-provider.js';

logAiPriceSuggestionStartupConfig();
logAiPlatformDiagnostics();
logEmailInvitationStartupConfig();

if (getResolvedEmailProvider() === 'smtp') {
  void verifySmtpInvitationTransport().then((result) => {
    if (result.ok) {
      console.log('[Email invitation config] SMTP connection verify: ok');
      return;
    }

    console.log(
      `[Email invitation config] SMTP connection verify failed: ${result.error ?? 'unknown error'}`,
    );
  });
}

app.listen(env.port, () => {
  console.log(`ImpactLoop API listening on port ${env.port}`);
});
