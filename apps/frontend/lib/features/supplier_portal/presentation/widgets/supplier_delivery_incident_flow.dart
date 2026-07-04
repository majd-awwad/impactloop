import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_feedback.dart';

Future<String?> _promptIncidentNote(
  BuildContext context, {
  required String title,
  required String hint,
}) async {
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 1000,
        minLines: 3,
        maxLines: 5,
        decoration: InputDecoration(
          labelText: 'Note (required)',
          hintText: hint,
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
          child: const Text('Submit report'),
        ),
      ],
    ),
  );
  controller.dispose();
  return result;
}

Future<void> handleReportNoDriverAvailable(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final note = await _promptIncidentNote(
    context,
    title: 'Report no driver available',
    hint: 'Describe why no driver accepted this delivery',
  );
  if (note == null || !context.mounted) return;

  try {
    await reportNoDriverAvailableForRequest(
      ref,
      requestId: reservationId,
      note: note,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, 'No-driver case reported to admin.');
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, error.toString());
  }
}

Future<void> handleReportDriverNoShow(
  BuildContext context,
  WidgetRef ref, {
  required String deliveryId,
}) async {
  final note = await _promptIncidentNote(
    context,
    title: 'Report driver no-show',
    hint: 'Describe what happened at supplier pickup',
  );
  if (note == null || !context.mounted) return;

  try {
    await markDriverNoShowForDelivery(
      ref,
      deliveryId: deliveryId,
      note: note,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, 'Driver no-show reported to admin.');
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, error.toString());
  }
}
