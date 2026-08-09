abstract final class CommonApiErrorCodes {
  static const notFound = 'NOT_FOUND';
  static const validationError = 'VALIDATION_ERROR';
  static const conflict = 'CONFLICT';
  static const forbidden = 'FORBIDDEN';
  static const unauthenticated = 'UNAUTHENTICATED';
  static const internalError = 'INTERNAL_ERROR';
  static const rateLimited = 'RATE_LIMITED';

  static const byName = <String, String>{
    'notFound': notFound,
    'validationError': validationError,
    'conflict': conflict,
    'forbidden': forbidden,
    'unauthenticated': unauthenticated,
    'internalError': internalError,
    'rateLimited': rateLimited,
  };

  static const values = <String>{
    notFound,
    validationError,
    conflict,
    forbidden,
    unauthenticated,
    internalError,
    rateLimited,
  };

  static bool contains(String? value) => values.contains(value);
}
