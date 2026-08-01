import 'package:flutter/material.dart';

import '../../../../../app/theme/app_color_tokens.dart';

/// Semantic accent colors for Supplier Overview dashboard only.
abstract final class SupplierDashboardColors {
  static const Color pending = AppColorTokens.supplierDashboardPending;
  static const Color accepted = AppColorTokens.supplierDashboardAccepted;
  static const Color completed = AppColorTokens.supplierDashboardCompleted;
  static const Color reused = AppColorTokens.supplierDashboardReused;
  static const Color available = AppColorTokens.supplierDashboardAvailable;
  static const Color reserved = AppColorTokens.supplierDashboardReserved;
  static const Color unavailable = AppColorTokens.supplierDashboardUnavailable;
  static const Color neutral = AppColorTokens.supplierDashboardNeutral;
  static const Color views = AppColorTokens.supplierDashboardAccepted;
  static const Color likes = Color(0xFFF472B6);
  static const Color followers = Color(0xFF3B82F6);
  static const Color totalMaterials = Color(0xFF14B8A6);
}

class SupplierDashboardChartSegment {
  const SupplierDashboardChartSegment({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;
}
