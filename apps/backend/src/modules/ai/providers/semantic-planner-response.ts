/**
 * Provider-neutral semantic planner response parsing.
 * Used by Gemini and OpenAI-compatible chat providers.
 */

/** Marks semantic-planner JSON requests; must not share learner answer-block parsing. */
export const SEMANTIC_PLANNER_OPERATION = 'classifySemanticUnderstanding';

export const isLearnerAnswerBlocksPayload = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.blocks);
};

export const isAdminReviewDirectPayload = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.summary === 'string' &&
    typeof candidate.attentionLevel === 'string' &&
    !('route' in candidate)
  );
};

export const shouldRejectAsNonSemanticPayload = (value: unknown): boolean =>
  isLearnerAnswerBlocksPayload(value) || isAdminReviewDirectPayload(value);

/**
 * Semantic planner JSON extraction: direct object text or bounded fenced JSON only.
 * Rejects prose wrappers that are not safely fenced.
 */
export const parseSemanticPlannerResponseText = (content: string): unknown => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new SyntaxError('Semantic planner response was empty.');
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  throw new SyntaxError(
    'Semantic planner response was not a direct JSON object or fenced JSON block.',
  );
};
