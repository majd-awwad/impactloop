class DriverDeliveryFailureRequest {
  const DriverDeliveryFailureRequest({
    required this.reason,
    required this.learnerContactAttempted,
    this.note,
    this.retryWindowStart,
    this.retryWindowEnd,
  });

  final String reason;
  final bool learnerContactAttempted;
  final String? note;
  final DateTime? retryWindowStart;
  final DateTime? retryWindowEnd;

  Map<String, dynamic> toJson() => {
    'reason': reason,
    'learnerContactAttempted': learnerContactAttempted,
    if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
    if (retryWindowStart != null)
      'retryWindowStart': retryWindowStart!.toUtc().toIso8601String(),
    if (retryWindowEnd != null)
      'retryWindowEnd': retryWindowEnd!.toUtc().toIso8601String(),
  };
}

class DriverDeliveryWindowRequest {
  const DriverDeliveryWindowRequest({
    required this.start,
    required this.end,
    this.note,
  });

  final DateTime start;
  final DateTime end;
  final String? note;

  Map<String, dynamic> toJson() => {
    'start': start.toUtc().toIso8601String(),
    'end': end.toUtc().toIso8601String(),
    if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
  };
}
