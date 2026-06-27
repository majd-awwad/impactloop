import 'package:flutter/material.dart';

import '../../../shared/models/localized_text.dart';
import '../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../shared/widgets/materials/material_status_badge.dart';

class DiscoveryMaterial {
  const DiscoveryMaterial({
    required this.id,
    this.status = 'AVAILABLE',
    this.quantity = 1,
    this.availableQuantity = 1,
    this.unit = 'piece',
    required this.title,
    required this.description,
    required this.category,
    required this.conditionLabel,
    required this.conditionTone,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.priceLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.deliveryAvailable,
    required this.isFree,
    required this.supplierName,
    required this.supplierSubtitle,
    required this.heroIconData,
    required this.cardGradient,
    this.imageUrl,
    this.ratingLabel,
  });

  final String id;
  final String status;
  final double quantity;
  final double availableQuantity;
  final String unit;
  final LocalizedText title;
  final LocalizedText description;
  final LocalizedText category;
  final LocalizedText conditionLabel;
  final MaterialConditionBadgeTone conditionTone;
  final LocalizedText statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final LocalizedText quantityLabel;
  final LocalizedText priceLabel;
  final LocalizedText locationLabel;
  final LocalizedText availabilityLabel;
  final bool deliveryAvailable;
  final bool isFree;
  final LocalizedText supplierName;
  final LocalizedText supplierSubtitle;
  final IconData heroIconData;
  final List<int> cardGradient;
  final String? imageUrl;
  final LocalizedText? ratingLabel;
}
