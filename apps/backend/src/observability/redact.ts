import type { SafeLogValue } from './log-types.js';

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|cookies|set-cookie|access[_-]?token|refresh[_-]?token|reset[_-]?token|invitation[_-]?token|password|currentpassword|newpassword|confirmpassword|passwordhash|smtp[_-]?pass|api[_-]?key|secret|token|latitude|longitude|addressline|address|email|phone|displayname)/i;

const REDACTED = '[redacted]';

export const PINO_REDACT_PATHS = [
  'authorization',
  'headers.authorization',
  'headers.cookie',
  'headers.set-cookie',
  'cookie',
  'cookies',
  'accessToken',
  'refreshToken',
  'resetToken',
  'invitationToken',
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'passwordHash',
  'smtpPass',
  'apiKey',
  'secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'err.config.headers.authorization',
  'body.password',
  'body.currentPassword',
  'body.newPassword',
  'body.confirmPassword',
  'body.token',
  'body.refreshToken',
  'body.accessToken',
];

const ALLOWED_LOG_KEYS = new Set([
  'operation',
  'errorCode',
  'statusCode',
  'durationMs',
  'poolTotal',
  'poolIdle',
  'poolWaiting',
  'poolMax',
  'stage',
  'route',
  'responseSize',
  'event',
  'deliveryId',
  'reservationId',
  'materialId',
  'userId',
  'activeRole',
  'requestId',
  'method',
  'path',
  'service',
  'environment',
  'level',
  'time',
  'msg',
  'message',
  'name',
  'code',
  'model',
  'constraint',
  'target',
  'prismaCode',
  'cause',
  'err',
  'provider',
  'emailType',
  'recipientDomain',
  'expiresAt',
  'sendStatus',
  'reason',
  'field',
  'resetLink',
  'inviteLink',
  'mockDevLink',
  'learnerHomeScope',
  'timingsMs',
  'slowestStep',
  'slowestStepMs',
  'candidatePoolCap',
  'candidatePoolSize',
  'fallbackReason',
  'error',
  'recommendationMlMaterialShadowDiagnostics',
  'recommendationMlShadow',
  'domain',
  'status',
  'candidateCount',
  'artifactVersion',
  'featureSchemaVersion',
  'confidenceLevel',
  'confidenceSource',
  'uniqueRecentMaterialCount',
  'uniqueRecentViewCount',
  'activeRecentLikeCount',
  'strongActionCount',
  'burstWindowHours',
  'burstUniqueMaterialCount',
  'burstUniqueViewCount',
  'burstActiveLikeCount',
  'burstStrongActionCount',
  'burstDominantCategoryShare',
  'burstDominantConceptShare',
  'fullHistoryDominantCategoryShare',
  'fullHistoryDominantConceptShare',
  'dominantCategoryShare',
  'dominantConceptShare',
  'newestEvidenceAgeHours',
  'qualifiedRecentCandidateCount',
  'recentSlotsAllowedTop5',
  'recentSlotsUsedTop5',
  'recentSlotsAllowedTop10',
  'recentSlotsUsedTop10',
  'longTermTop5RecentDomainCount',
  'recentChannelTop5RecentDomainCount',
  'fusedTop5RecentDomainCount',
  'top5OverlapWithDeterministic',
  'top10OverlapWithDeterministic',
  'recentEvidenceRejectedCounts',
  'unmappedCategory',
  'unmappedConcept',
  'stale',
  'reversed',
  'duplicateOrCapped',
  'outsideCandidateUniverse',
  'belowCandidateQualityThreshold',
  'scorerDurationMs',
  'fusionDurationMs',
  'rankMovement',
  'candidateKeyHash',
  'longTermRank',
  'recentRank',
  'fusedRank',
  'recentScore',
  'qualificationStatus',
  'mappedCategoryMatch',
  'mappedConceptMatch',
  'mode',
  'servedItemCount',
  'totalRecommendationDurationMs',
  'port',
  'pid',
  'required',
  'enabled',
  'operational',
  'materialItems',
  'projectItems',
  'materialModel',
  'projectModel',
  'materialState',
  'projectState',
  'pollIntervalMs',
  'batchSize',
  'maxAttempts',
  'leaseMs',
  'geminiKeyConfigured',
  'openaiKeyConfigured',
  'devMockFallbackEnabled',
  'envPath',
  'invitationsEnvPath',
  'explicitProvider',
  'appPublicBaseUrlConfigured',
  'smtpConfigured',
  'overrideCount',
  'warningCount',
  'diagnosticsSummary',
  'processId',
  'upstreamStatus',
  'upstreamErrorCode',
  'upstreamErrorType',
  'upstreamMessageLength',
  'configuredModel',
  'resolvedProviderModel',
  'requestEndpoint',
  'upstreamResponseBodyLength',
  'responseId',
  'choiceCount',
  'finishReason',
  'messageKeys',
  'messageContentType',
  'messageContentLength',
  'messageContentEmpty',
  'messageContentStartsWithJsonObject',
  'messageHasReasoning',
  'messageHasReasoningDetails',
  'usageCompletionCount',
  'providerErrorMetadata',
  'authoringStage',
  'authoringOperation',
  'expectedAuthoringStage',
  'responseFailure',
  'providerSchemaIssues',
  'expected',
  'received',
  'repairAttempt',
  'repairSucceeded',
  'requiredStepCount',
  'returnedStepCount',
  'qualityIssueCode',
  'qualityIssueCodes',
  'consistencyIssueCodes',
  'failingStepIndexes',
  'failingComponentRefs',
  'canonicalComponentIds',
  'componentMismatchSource',
  'repairedStepCount',
]);

const isSensitiveKey = (key: string): boolean => SENSITIVE_KEY_PATTERN.test(key);

export const redactString = (value: string): string => {
  if (value.length > 2048) {
    return `${value.slice(0, 2048)}…[truncated]`;
  }

  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]');
};

export const redactErrorMessage = (error: unknown): string => {
  try {
    const raw = error instanceof Error
      ? error.message
      : String(error ?? 'unknown_error');

    return redactString(raw)
      .replace(/(?:[A-Za-z]:\\|\/)[^\r\n]*/g, '[path]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
      .replace(/\b[0-9a-f]{24,}\b/gi, '[id]')
      .slice(0, 240) || 'unknown_error';
  } catch {
    return 'unknown_error';
  }
};

export const redactUnknownValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): SafeLogValue => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= 4) {
    return '[max-depth]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redactUnknownValue(entry, depth + 1, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);

    const output: Record<string, SafeLogValue> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        output[key] = REDACTED;
        continue;
      }

      if (!ALLOWED_LOG_KEYS.has(key) && depth > 0) {
        output[key] = '[filtered]';
        continue;
      }

      if (key === 'mockDevLink' && typeof entry === 'string') {
        output[key] = entry.length > 2048 ? `${entry.slice(0, 2048)}…[truncated]` : entry;
        continue;
      }

      output[key] = redactUnknownValue(entry, depth + 1, seen);
    }

    return output;
  }

  return String(value);
};

export const pickAllowlistedLogContext = (
  context: Record<string, unknown>,
): Record<string, SafeLogValue> => {
  const output: Record<string, SafeLogValue> = {};

  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_LOG_KEYS.has(key) || isSensitiveKey(key)) {
      continue;
    }

    if (key === 'mockDevLink' && typeof value === 'string') {
      output[key] = value.length > 2048 ? `${value.slice(0, 2048)}…[truncated]` : value;
      continue;
    }

    output[key] = redactUnknownValue(value);
  }

  return output;
};
