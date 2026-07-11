const parseBooleanEnv = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const canLogMockEmailLinks = (): boolean =>
  (process.env.NODE_ENV ?? 'development') === 'development' &&
  parseBooleanEnv(process.env.MOCK_EMAIL_LOG_LINKS, false);
