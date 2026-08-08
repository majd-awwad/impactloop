export const buildLearnerMaterialRequestOpenBusinessKey = (
  learnerId: string,
  categoryId: string,
  normalizedRequestedItemName: string,
) => `open:${learnerId}:${categoryId}:${normalizedRequestedItemName}`;

export const clearLearnerMaterialRequestOpenBusinessKey = {
  openBusinessKey: null,
} as const;
