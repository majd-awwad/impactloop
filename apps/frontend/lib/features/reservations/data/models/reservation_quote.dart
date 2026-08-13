class ReservationQuoteGroupCandidate {
  const ReservationQuoteGroupCandidate({
    required this.id,
    required this.existingReservationsCount,
    required this.deliveryFeeAlreadyApplied,
    required this.sharedWindowStart,
    required this.sharedWindowEnd,
  });

  final String id;
  final int existingReservationsCount;
  final bool deliveryFeeAlreadyApplied;
  final DateTime sharedWindowStart;
  final DateTime sharedWindowEnd;

  factory ReservationQuoteGroupCandidate.fromJson(Map<String, dynamic> json) {
    return ReservationQuoteGroupCandidate(
      id: json['id'] as String? ?? '',
      existingReservationsCount:
          (json['existingReservationsCount'] as num?)?.toInt() ?? 0,
      deliveryFeeAlreadyApplied:
          json['deliveryFeeAlreadyApplied'] as bool? ?? false,
      sharedWindowStart:
          DateTime.tryParse(json['sharedWindowStart'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      sharedWindowEnd:
          DateTime.tryParse(json['sharedWindowEnd'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class ReservationQuote {
  const ReservationQuote({
    required this.materialId,
    required this.unitPrice,
    required this.quantity,
    required this.materialSubtotal,
    required this.deliveryFee,
    required this.totalAmount,
    required this.currency,
    this.deliveryZone,
    required this.fulfillmentMethod,
    this.paymentMethod = 'CARD',
    required this.canDeliver,
    required this.groupingAvailable,
    required this.groupingApplied,
    this.deliveryGroupCandidate,
    this.messages = const [],
  });

  final String materialId;
  final double unitPrice;
  final double quantity;
  final double materialSubtotal;
  final double deliveryFee;
  final double totalAmount;
  final String currency;
  final String? deliveryZone;
  final String fulfillmentMethod;
  final String paymentMethod;
  final bool canDeliver;
  final bool groupingAvailable;
  final bool groupingApplied;
  final ReservationQuoteGroupCandidate? deliveryGroupCandidate;
  final List<String> messages;

  factory ReservationQuote.fromJson(Map<String, dynamic> json) {
    final candidateJson = json['deliveryGroupCandidate'];
    final messagesJson = json['messages'];

    return ReservationQuote(
      materialId: json['materialId'] as String? ?? '',
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      materialSubtotal: (json['materialSubtotal'] as num?)?.toDouble() ?? 0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'NIS',
      deliveryZone: json['deliveryZone'] as String?,
      fulfillmentMethod: json['fulfillmentMethod'] as String? ?? 'PICKUP',
      paymentMethod: json['paymentMethod'] as String? ?? 'CARD',
      canDeliver: json['canDeliver'] as bool? ?? false,
      groupingAvailable: json['groupingAvailable'] as bool? ?? false,
      groupingApplied: json['groupingApplied'] as bool? ?? false,
      deliveryGroupCandidate: candidateJson is Map<String, dynamic>
          ? ReservationQuoteGroupCandidate.fromJson(candidateJson)
          : null,
      messages: messagesJson is List
          ? messagesJson.whereType<String>().toList(growable: false)
          : const [],
    );
  }
}

class ReservationQuoteRequest {
  const ReservationQuoteRequest({
    required this.materialId,
    required this.quantity,
    required this.fulfillmentMethod,
    this.paymentMethod = 'CARD',
    this.dropoffCity,
    this.dropoffArea,
    this.learnerPreferredDeliveryWindows = const [],
    this.combineWithDeliveryGroupId,
  });

  final String materialId;
  final double quantity;
  final String fulfillmentMethod;
  final String paymentMethod;
  final String? dropoffCity;
  final String? dropoffArea;
  final List<Map<String, String>> learnerPreferredDeliveryWindows;
  final String? combineWithDeliveryGroupId;

  Map<String, dynamic> toJson() {
    return {
      'materialId': materialId,
      'quantity': quantity,
      'fulfillmentMethod': fulfillmentMethod,
      'paymentMethod': paymentMethod,
      if (dropoffCity != null && dropoffCity!.trim().isNotEmpty)
        'dropoffCity': dropoffCity!.trim(),
      if (dropoffArea != null && dropoffArea!.trim().isNotEmpty)
        'dropoffArea': dropoffArea!.trim(),
      if (fulfillmentMethod == 'DELIVERY' &&
          learnerPreferredDeliveryWindows.isNotEmpty)
        'learnerPreferredDeliveryWindows': learnerPreferredDeliveryWindows,
      if (combineWithDeliveryGroupId != null &&
          combineWithDeliveryGroupId!.trim().isNotEmpty)
        'combineWithDeliveryGroupId': combineWithDeliveryGroupId!.trim(),
    };
  }
}
