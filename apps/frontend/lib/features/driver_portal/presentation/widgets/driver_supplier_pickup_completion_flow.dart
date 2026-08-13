import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../data/models/update_driver_delivery_status_request.dart';
import 'complete_supplier_pickup_dialog.dart';
import 'driver_supplier_pickup_qr_scanner_page.dart';

/// Runs the driver supplier pickup verification funnel (QR scan or manual code).
///
/// Returns `true` when pickup was completed successfully.
Future<bool> runDriverSupplierPickupCompletionFlow(
  BuildContext context,
  WidgetRef ref, {
  required String deliveryId,
  String? reservationId,
  String? note,
  List<String>? pickedReservationIds,
  List<UpdateDriverDeliveryUnpickedItem>? unpicked,
  bool showSuccessSnackBar = true,
}) async {
  var allowScan = true;

  while (context.mounted) {
    final choice = await CompleteSupplierPickupDialog.show(
      context,
      allowScan: allowScan,
    );
    if (!context.mounted || choice == null) return false;

    if (choice is CompleteSupplierPickupScanQr) {
      final scanResult = await DriverSupplierPickupQrScannerPage.open(context);
      if (!context.mounted) return false;
      switch (scanResult) {
        case SupplierPickupQrScanResult.completed:
          if (showSuccessSnackBar && context.mounted) {
            showInfoSnackBar(
              context,
              context.l10n.driverSupplierPickupQrHandoverCompletedBody,
            );
          }
          return true;
        case SupplierPickupQrScanResult.useManualCode:
          allowScan = false;
          continue;
        case SupplierPickupQrScanResult.cancelled:
          return false;
      }
    }

    if (choice is CompleteSupplierPickupManualCode) {
      try {
        await ref
            .read(driverDeliveryActionControllerProvider.notifier)
            .updateStatus(
              deliveryId: deliveryId,
              status: 'PICKED_UP',
              note: note,
              confirmationCode: choice.code.trim(),
              pickedReservationIds: pickedReservationIds,
              unpicked: unpicked,
            );
        invalidateDriverDeliverySyncProviders(
          ref,
          deliveryId: deliveryId,
          reservationId: reservationId,
        );
        invalidateReservationSyncProviders(
          ref,
          reservationId: reservationId,
        );
        if (showSuccessSnackBar && context.mounted) {
          showInfoSnackBar(context, context.l10n.driverStatusPickedUpSuccess);
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
