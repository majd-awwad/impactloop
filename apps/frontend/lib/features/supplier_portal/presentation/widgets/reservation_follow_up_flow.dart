import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'accept_incoming_request_dialog.dart';
import 'supplier_feedback.dart';

const _reportReasons = <String, String>{
  'LEARNER_DID_NOT_ARRIVE': 'Learner did not arrive',
  'REPEATED_DELAY': 'Repeated delay',
  'WRONG_INFORMATION': 'Wrong information',
  'SAFETY_OR_TRUST_CONCERN': 'Safety or trust concern',
  'OTHER': 'Other',
};

Future<String?> _promptReason(BuildContext context, {required String title}) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 500,
        decoration: const InputDecoration(
          labelText: 'Reason',
          hintText: 'Why are you requesting a new time?',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(context.s.cancel),
        ),
        FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isEmpty) return;
            Navigator.of(context).pop(value);
          },
          child: const Text('Continue'),
        ),
      ],
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
  final reason = await _promptReason(
    context,
    title: 'Request reschedule',
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
    dialogTitle: 'Request reschedule',
    submitLabel: 'Send request',
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
    showSupplierInfoSnackBar(context, 'Reschedule request sent to learner.');
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? error.displayMessage
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
    dialogTitle: 'Choose new pickup window',
    submitLabel: 'Submit pickup window',
  );
  if (pickupWindow == null || !context.mounted) return;

  try {
    await submitNoDriverPickupWindow(
      ref,
      requestId: reservationId,
      pickupWindow: pickupWindow,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(
      context,
      'Pickup window submitted. Waiting for driver again.',
    );
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? error.displayMessage
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
    showSupplierInfoSnackBar(context, 'New pickup time accepted.');
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(
      context,
      error is ApiException
          ? error.displayMessage
          : context.s.pickupCompleteFailed,
    );
  }
}

Future<void> handleCloseOverduePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final noteController = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Close reservation'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Close this pickup reservation? The held quantity will be released.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: noteController,
            maxLength: 1000,
            decoration: const InputDecoration(
              labelText: 'Note (optional)',
            ),
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
          child: const Text('Close reservation'),
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
    showSupplierInfoSnackBar(context, 'Reservation closed.');
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
  var selectedReason = 'LEARNER_DID_NOT_ARRIVE';
  final noteController = TextEditingController();

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Report to admin'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit a report for admin review. The reservation will be closed.',
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: selectedReason,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: _reportReasons.entries
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
                decoration: const InputDecoration(
                  labelText: 'Note',
                  hintText: 'Describe what happened',
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
            child: const Text('Report and close'),
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
    showSupplierInfoSnackBar(context, 'Reported to admin.');
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, error.toString());
  }
}

@Deprecated('Use handleRequestReschedulePickup')
Future<void> handleReschedulePickup(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
  required String materialTitle,
  required String learnerName,
}) =>
    handleRequestReschedulePickup(
      context,
      ref,
      reservationId: reservationId,
      materialTitle: materialTitle,
      learnerName: learnerName,
    );

