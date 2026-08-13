import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../application/driver_delivery_action_controller.dart';
import 'complete_delivery_dialog.dart';
import 'driver_delivery_qr_scanner_page.dart';

/// Runs the driver delivery verification funnel (QR scan or manual code).
///
/// Returns `true` when the delivery was completed successfully.
Future<bool> runDriverDeliveryCompletionFlow(
  BuildContext context,
  WidgetRef ref, {
  required String deliveryId,
  String? reservationId,
  String? note,
  bool showSuccessSnackBar = true,
}) async {
  var allowScan = true;

  while (context.mounted) {
    final choice = await CompleteDeliveryDialog.show(
      context,
      allowScan: allowScan,
    );
    if (!context.mounted || choice == null) return false;

    if (choice is CompleteDeliveryScanQr) {
      final scanResult = await DriverDeliveryQrScannerPage.open(context);
      if (!context.mounted) return false;
      switch (scanResult) {
        case DeliveryQrScanResult.completed:
          if (showSuccessSnackBar && context.mounted) {
            showInfoSnackBar(
              context,
              context.l10n.driverDeliveryQrHandoverCompletedBody,
            );
          }
          return true;
        case DeliveryQrScanResult.useManualCode:
          allowScan = false;
          continue;
        case DeliveryQrScanResult.cancelled:
          return false;
      }
    }

    if (choice is CompleteDeliveryManualCode) {
      try {
        await ref
            .read(driverDeliveryActionControllerProvider.notifier)
            .updateStatus(
              deliveryId: deliveryId,
              status: 'DELIVERED',
              note: note,
              confirmationCode: choice.code.trim(),
            );
        invalidateDriverDeliverySyncProviders(
          ref,
          deliveryId: deliveryId,
          reservationId: reservationId,
        );
        if (showSuccessSnackBar && context.mounted) {
          showInfoSnackBar(context, context.l10n.driverDeliveryMarkedDelivered);
        }
        return true;
      } on ApiException catch (error) {
        if (!context.mounted) return false;
        showErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
        return false;
      } catch (error) {
        if (!context.mounted) return false;
        showErrorSnackBar(context, error);
        return false;
      }
    }

    return false;
  }

  return false;
}
