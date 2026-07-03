import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
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
      SupplierIncomingRequestStatus.awaitingConfirmation => _accepted,
      SupplierIncomingRequestStatus.declined => _declined,
      SupplierIncomingRequestStatus.completed => _completed,
      SupplierIncomingRequestStatus.cancelled => _declined,
    };
  }

  static IncomingRequestStatusStyle forTab(SupplierIncomingRequestTab tab) {
    return switch (tab) {
      SupplierIncomingRequestTab.all => _pending,
      SupplierIncomingRequestTab.pending => _pending,
      SupplierIncomingRequestTab.needsLearner => _accepted,
      SupplierIncomingRequestTab.accepted => _accepted,
      SupplierIncomingRequestTab.declined => _declined,
      SupplierIncomingRequestTab.completed => _completed,
      SupplierIncomingRequestTab.cancelled => _declined,
    };
  }

  static const _pending = IncomingRequestStatusStyle(
    background: AppColorTokens.supplierIncomingPendingBackground,
    border: AppColorTokens.supplierIncomingPendingBorder,
    foreground: AppColorTokens.supplierDashboardPending,
    selectedBackground: AppColorTokens.supplierIncomingPendingSelectedBackground,
    selectedBorder: AppColorTokens.supplierIncomingPendingSelectedBorder,
  );

  static const _accepted = IncomingRequestStatusStyle(
    background: AppColorTokens.supplierIncomingAcceptedBackground,
    border: AppColorTokens.supplierIncomingAcceptedBorder,
    foreground: AppColorTokens.supplierIncomingAcceptedForeground,
    selectedBackground: AppColorTokens.supplierIncomingAcceptedSelectedBackground,
    selectedBorder: AppColorTokens.supplierIncomingAcceptedSelectedBorder,
  );

  static const _declined = IncomingRequestStatusStyle(
    background: AppColorTokens.supplierIncomingDeclinedBackground,
    border: AppColorTokens.supplierIncomingDeclinedBorder,
    foreground: AppColorTokens.supplierDashboardUnavailable,
    selectedBackground: AppColorTokens.supplierIncomingDeclinedSelectedBackground,
    selectedBorder: AppColorTokens.supplierIncomingDeclinedSelectedBorder,
  );

  static const _completed = IncomingRequestStatusStyle(
    background: AppColorTokens.supplierIncomingCompletedBackground,
    border: AppColorTokens.supplierIncomingCompletedBorder,
    foreground: AppColorTokens.supplierDashboardReserved,
    selectedBackground: AppColorTokens.supplierIncomingCompletedSelectedBackground,
    selectedBorder: AppColorTokens.supplierIncomingCompletedSelectedBorder,
  );
}
