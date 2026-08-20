export const readLocalDemoKey = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).localDemoKey;
  return typeof value === 'string' && value.trim() ? value : null;
};

export const hasDemoAuditScenario = (
  rows: Array<{ metadata: unknown }>,
  key: string,
): boolean => rows.some((row) => readLocalDemoKey(row.metadata) === key);

export const countDemoAuditScenarios = (
  rows: Array<{ metadata: unknown }>,
  key: string,
): number => rows.filter((row) => readLocalDemoKey(row.metadata) === key).length;
