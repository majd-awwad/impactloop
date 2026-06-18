import 'package:flutter/material.dart';

import '../../data/models/supplier_incoming_request.dart';

class IncomingRequestStatusStyle {
  const IncomingRequestStatusStyle({
    required this.background,
    required this.border,
    required this.foreground,
    required this.selectedBackground,
    required this.selectedBorder,
  });

  final Color background;
  final Color border;
  final Color foreground;
  final Color selectedBackground;
  final Color selectedBorder;

  static IncomingRequestStatusStyle forStatus(
    SupplierIncomingRequestStatus status,
  ) {
    return switch (status) {
      SupplierIncomingRequestStatus.pending => _pending,
      SupplierIncomingRequestStatus.accepted => _accepted,
      SupplierIncomingRequestStatus.declined => _declined,
      SupplierIncomingRequestStatus.completed => _completed,
    };
  }

  static IncomingRequestStatusStyle forTab(SupplierIncomingRequestTab tab) {
    return forStatus(tab.status);
  }

  static const _pending = IncomingRequestStatusStyle(
    background: Color(0x24F59E0B),
    border: Color(0x73F59E0B),
    foreground: Color(0xFFFBBF24),
    selectedBackground: Color(0x38F59E0B),
    selectedBorder: Color(0x8CF59E0B),
  );

  static const _accepted = IncomingRequestStatusStyle(
    background: Color(0x2422C55E),
    border: Color(0x7322C55E),
    foreground: Color(0xFF4ADE80),
    selectedBackground: Color(0x3822C55E),
    selectedBorder: Color(0x8C22C55E),
  );

  static const _declined = IncomingRequestStatusStyle(
    background: Color(0x24EF4444),
    border: Color(0x73EF4444),
    foreground: Color(0xFFF87171),
    selectedBackground: Color(0x38EF4444),
    selectedBorder: Color(0x8CEF4444),
  );

  static const _completed = IncomingRequestStatusStyle(
    background: Color(0x243B82F6),
    border: Color(0x733B82F6),
    foreground: Color(0xFF60A5FA),
    selectedBackground: Color(0x383B82F6),
    selectedBorder: Color(0x8C3B82F6),
  );
}
