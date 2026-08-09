abstract final class IdempotencyErrorCodes {
  static const keyReused = 'IDEMPOTENCY_KEY_REUSED';
  static const inProgress = 'IDEMPOTENCY_IN_PROGRESS';
  static const previouslyFailed = 'IDEMPOTENCY_PREVIOUSLY_FAILED';

  static const byName = <String, String>{
    'keyReused': keyReused,
    'inProgress': inProgress,
    'previouslyFailed': previouslyFailed,
  };

  static const values = <String>{keyReused, inProgress, previouslyFailed};

  static bool contains(String? value) => values.contains(value);
}
