import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'accept_incoming_request_dialog.dart';
import 'supplier_feedback.dart';

Future<void> handleReschedulePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  required String materialTitle,
  required String learnerName,
}) async {
  final pickupWindow = await AcceptIncomingRequestDialog.show(
    context,
    materialTitle: materialTitle,
    learnerName: learnerName,
    dialogTitle: context.s.reschedulePickupTitle,
    submitLabel: context.s.reschedulePickupAction,
  );
  if (pickupWindow == null || !context.mounted) return;

  try {
    await rescheduleIncomingRequest(
      ref,
      requestId: reservationId,
      pickupWindow: pickupWindow,
      messageToLearner: pickupWindow.note,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, context.s.reschedulePickupAction);
  } catch (_) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, context.s.pickupCompleteFailed);
  }
}

Future<void> handleCancelReservation(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.s;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l.cancelReservationTitle),
      content: Text(l.cancelReservationMessage),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l.cancelReservationAction),
        ),
      ],
    ),
  );

  if (confirmed != true || !context.mounted) return;

  try {
    await cancelIncomingRequest(ref, requestId: reservationId);
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.cancelReservationAction);
  } catch (_) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, l.pickupCompleteFailed);
  }
}

Future<void> handleReportNoShow(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.s;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l.reportNoShowTitle),
      content: Text(l.reportNoShowMessage),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l.reportNoShowAction),
        ),
      ],
    ),
  );

  if (confirmed != true || !context.mounted) return;

  try {
    await reportNoShowForRequest(
      ref,
      requestId: reservationId,
      reasonCode: 'LEARNER_DID_NOT_ARRIVE',
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.reportNoShowAction);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error.toString().contains('409')
          ? l.noShowReportSubmitted
          : l.pickupCompleteFailed,
    );
  }
}
