import { runWithRecommendationEventOrigin } from '../modules/recommendation-events/recommendation-event-origin.js';
import { runWithRecommendationToggleRequestContext } from '../modules/recommendation-events/recommendation-events.service.js';

let toggleOperationSequence = 0;

export const nextRecommendationToggleOperationId = (scope: string): string => {
  toggleOperationSequence += 1;
  return `test-${scope}-${toggleOperationSequence}-${Date.now()}`;
};

export const runWithTestRecommendationToggleContext = <T>(
  scope: string,
  operation: () => T,
): T => {
  const key = nextRecommendationToggleOperationId(scope);
  return runWithRecommendationEventOrigin('TEST', () =>
    runWithRecommendationToggleRequestContext(
      { headers: { 'idempotency-key': key } },
      operation,
    ),
  );
};
