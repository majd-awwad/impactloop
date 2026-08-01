export const E2E_FIXTURE_MARKER = 'AI_PHASE2_E2E';

export const isE2eFixtureIsolationEnabled = (): boolean =>
  process.env.AI_E2E_FIXTURE_ACTIVE === 'true';

export const isE2eFixtureTitle = (title: string | null | undefined): boolean =>
  Boolean(title?.startsWith(E2E_FIXTURE_MARKER));

export const shouldHideE2eFixtureTitle = (
  title: string | null | undefined,
): boolean => !isE2eFixtureIsolationEnabled() && isE2eFixtureTitle(title);
