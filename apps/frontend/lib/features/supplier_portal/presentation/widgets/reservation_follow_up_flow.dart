import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../supplier_reservation_ui_helpers.dart';
import '../theme/supplier_theme_extension.dart';
import 'accept_incoming_request_dialog.dart';
import 'supplier_feedback.dart';

Future<String?> _promptReason(
  BuildContext context, {
  required String title,
}) async {
  final l = context.l10n;
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AppDialogShell(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 500,
        decoration: InputDecoration(
          labelText: l.supplierRescheduleReasonLabel,
          hintText: l.supplierRescheduleReasonHint,
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isEmpty) return;
            Navigator.of(context).pop(value);
          },
          child: Text(l.actionContinue),
        ),
      ),
    ),
  );
  controller.dispose();
  return result;
}

Future<void> handleRequestReschedulePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  required String materialTitle,
  required String learnerName,
}) async {
  final l = context.l10n;
  final reason = await _promptReason(
    context,
    title: l.supplierReschedulePickup,
  );
  if (reason == null || !context.mounted) return;

  final pickupWindow = await AcceptIncomingRequestDialog.show(
    context,
    request: SupplierIncomingRequest(
      id: reservationId,
      materialTitle: materialTitle,
      learnerName: learnerName,
      quantityRequested: 1,
      unit: 'piece',
      status: SupplierIncomingRequestStatus.accepted,
      requestedAt: DateTime.now(),
    ),
    dialogTitle: l.supplierReschedulePickup,
    submitLabel: l.supplierSendRequest,
  );
  if (pickupWindow == null || !context.mounted) return;

  try {
    await rescheduleIncomingRequest(
      ref,
      requestId: reservationId,
      pickupWindow: pickupWindow,
      reason: reason,
      messageToLearner: pickupWindow.note,
      note: pickupWindow.note,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierRescheduleRequestSent);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? localizedApiErrorMessage(error, context.l10n)
          : context.s.pickupCompleteFailed,
    );
  }
}

Future<void> handleSubmitNoDriverPickupWindow(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  required String materialTitle,
  required String learnerName,
}) async {
  final l = context.l10n;
  final pickupWindow = await AcceptIncomingRequestDialog.show(
    context,
    request: SupplierIncomingRequest(
      id: reservationId,
      materialTitle: materialTitle,
      learnerName: learnerName,
      quantityRequested: 1,
      unit: 'piece',
      status: SupplierIncomingRequestStatus.awaitingSupplierConfirmation,
      requestedAt: DateTime.now(),
    ),
    dialogTitle: l.supplierChooseNewPickupWindow,
    submitLabel: l.supplierSubmitPickupWindow,
  );
  if (pickupWindow == null || !context.mounted) return;

  try {
    await submitNoDriverPickupWindow(
      ref,
      requestId: reservationId,
      pickupWindow: pickupWindow,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierPickupWindowSubmittedWaiting);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? localizedApiErrorMessage(error, context.l10n)
          : context.s.pickupCompleteFailed,
    );
  }
}

Future<void> handleAcceptLearnerReschedule(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  try {
    await acceptLearnerReschedule(ref, requestId: reservationId);
    if (!context.mounted) return;
    showSupplierInfoSnackBar(
      context,
      context.l10n.supplierNewPickupTimeAccepted,
    );
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? localizedApiErrorMessage(error, context.l10n)
          : context.s.pickupCompleteFailed,
    );
  }
}

Future<void> handleCloseOverduePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.l10n;
  final noteController = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l.cancelReservation),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l.supplierThisWillCancelTheReservationAnd),
          const SizedBox(height: 12),
          TextField(
            controller: noteController,
            maxLength: 1000,
            decoration: InputDecoration(labelText: l.supplierReasonOptional),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(context.s.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(l.cancelReservation),
        ),
      ],
    ),
  );
  noteController.dispose();

  if (confirmed != true || !context.mounted) return;

  try {
    await cancelIncomingRequest(
      ref,
      requestId: reservationId,
      reason: noteController.text.trim().isEmpty
          ? null
          : noteController.text.trim(),
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierReservationClosed);
  } catch (_) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, context.s.pickupCompleteFailed);
  }
}

Future<void> handleReportToAdminAndClose(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.l10n;
  final ui = SupplierReservationUiHelpers.of(context);
  var selectedReason = 'LEARNER_DID_NOT_ARRIVE';
  final noteController = TextEditingController();

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(l.supplierReportToAdminTitle),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l.supplierReportToAdminMessage),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                decoration: InputDecoration(
                  labelText: l.supplierRescheduleReasonLabel,
                ),
                items: ui.noShowReasonOptions().entries
                    .map(
                      (entry) => DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => selectedReason = value);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLength: 1000,
                minLines: 3,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: l.supplierDeliveryNote,
                  hintText: l.supplierDescribeWhatHappened,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(context.s.cancel),
          ),
          FilledButton(
            onPressed: () {
              if (noteController.text.trim().isEmpty) return;
              Navigator.of(context).pop(true);
            },
            child: Text(l.supplierReportAndClose),
          ),
        ],
      ),
    ),
  );
  noteController.dispose();

  if (confirmed != true || !context.mounted) return;

  try {
    await reportNoShowForRequest(
      ref,
      requestId: reservationId,
      reasonCode: selectedReason,
      note: noteController.text.trim(),
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierReportedToAdmin);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  }
}

@Deprecated('Use handleRequestReschedulePickup')
Future<void> handleReschedulePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  required String materialTitle,
  required String learnerName,
}) => handleRequestReschedulePickup(
  context,
  ref,
  reservationId: reservationId,
  materialTitle: materialTitle,
  learnerName: learnerName,
);
