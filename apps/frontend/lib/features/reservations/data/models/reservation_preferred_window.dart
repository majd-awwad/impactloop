class ReservationPreferredWindow {
  const ReservationPreferredWindow({
    required this.start,
    required this.end,
  });

  final DateTime start;
  final DateTime end;

  factory ReservationPreferredWindow.fromJson(Map<String, dynamic> json) {
    return ReservationPreferredWindow(
      start: DateTime.parse(json['start'] as String),
      end: DateTime.parse(json['end'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'start': start.toUtc().toIso8601String(),
      'end': end.toUtc().toIso8601String(),
    };
  }
}
