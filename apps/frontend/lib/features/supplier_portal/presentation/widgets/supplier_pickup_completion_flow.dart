import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'complete_pickup_dialog.dart';
import 'supplier_feedback.dart';
import 'supplier_pickup_qr_scanner_page.dart';

/// Runs the supplier pickup verification funnel (QR scan or manual code).
///
/// Returns `true` when the reservation was completed successfully.
Future<bool> runSupplierPickupCompletionFlow(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  bool showSuccessSnackBar = true,
}) async {
  var allowScan = true;

  while (context.mounted) {
    final choice = await CompletePickupDialog.show(
      context,
      allowScan: allowScan,
    );
    if (!context.mounted || choice == null) return false;

    if (choice is CompletePickupScanQr) {
      final scanResult = await SupplierPickupQrScannerPage.open(context);
      if (!context.mounted) return false;
      switch (scanResult) {
        case PickupQrScanResult.completed:
          if (showSuccessSnackBar && context.mounted) {
            showSupplierInfoSnackBar(
              context,
              context.l10n.supplierPickupQrHandoverCompletedBody,
            );
          }
          return true;
        case PickupQrScanResult.useManualCode:
          allowScan = false;
          continue;
        case PickupQrScanResult.cancelled:
          return false;
      }
    }

    if (choice is CompletePickupManualCode) {
      await completeIncomingRequest(
        ref,
        requestId: reservationId,
        confirmationCode: choice.code.trim(),
      );
      if (showSuccessSnackBar && context.mounted) {
        showSupplierInfoSnackBar(context, context.s.pickupCompleted);
      }
      return true;
    }

    return false;
  }

  return false;
}

String supplierPickupCompletionErrorMessage(
  BuildContext context,
  Object error,
) {
  if (error is ApiException) {
    return localizedApiErrorMessage(error, context.l10n);
  }
  return context.l10n.supplierCouldNotUpdateRequest;
}
