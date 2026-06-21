import 'package:flutter/material.dart';

/// Semantic accent colors for Supplier Overview dashboard only.
abstract final class SupplierDashboardColors {
  static const Color pending = Color(0xFFFBBF24);
  static const Color accepted = Color(0xFF38BDF8);
  static const Color completed = Color(0xFF34D399);
  static const Color reused = Color(0xFF2DD4BF);
  static const Color available = Color(0xFF5EEAD4);
  static const Color reserved = Color(0xFF60A5FA);
  static const Color unavailable = Color(0xFFF87171);
  static const Color neutral = Color(0xFF94A3B8);
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
