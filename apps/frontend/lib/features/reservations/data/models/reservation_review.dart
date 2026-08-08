class ReservationReview {
  const ReservationReview({
    required this.id,
    required this.targetType,
    required this.rating,
    this.comment,
    required this.createdAt,
  });

  final String id;
  final String targetType;
  final int rating;
  final String? comment;
  final DateTime createdAt;

  factory ReservationReview.fromJson(Map<String, dynamic> json) {
    return ReservationReview(
      id: json['id'] as String? ?? '',
      targetType: json['targetType'] as String? ?? '',
      rating: json['rating'] as int? ?? 0,
      comment: json['comment'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class ReservationReviewTargetState {
  const ReservationReviewTargetState({
    required this.canReview,
    required this.label,
    this.review,
  });

  final bool canReview;
  final String label;
  final ReservationReview? review;

  factory ReservationReviewTargetState.fromJson(Map<String, dynamic> json) {
    return ReservationReviewTargetState(
      canReview: json['canReview'] == true,
      label: json['label'] as String? ?? '',
      review: json['review'] is Map
          ? ReservationReview.fromJson(
              Map<String, dynamic>.from(json['review'] as Map),
            )
          : null,
    );
  }
}

class ReservationReviewsState {
  const ReservationReviewsState({
    required this.supplier,
    this.driver,
  });

  final ReservationReviewTargetState supplier;
  final ReservationReviewTargetState? driver;

  factory ReservationReviewsState.fromJson(Map<String, dynamic> json) {
    return ReservationReviewsState(
      supplier: ReservationReviewTargetState.fromJson(
        Map<String, dynamic>.from(
          json['supplier'] as Map? ?? const <String, dynamic>{},
        ),
      ),
      driver: json['driver'] is Map
          ? ReservationReviewTargetState.fromJson(
              Map<String, dynamic>.from(json['driver'] as Map),
            )
          : null,
    );
  }

  bool get hasReviewableTarget =>
      supplier.canReview || (driver?.canReview ?? false);
}
