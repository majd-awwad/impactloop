import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../controllers/supplier_requests_providers.dart';
import '../../../../l10n/l10n.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_feedback.dart';
import '../../../../core/errors/api_exception.dart';

Future<String?> _promptIncidentNote(
  BuildContext context, {
  required String title,
  required String hint,
}) async {
  final l = context.l10n;
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AppDialogShell(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLength: 1000,
        minLines: 3,
        maxLines: 5,
        decoration: InputDecoration(
          labelText: l.supplierNoteRequired,
          hintText: hint,
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: () {
            final value = controller.text.trim();
            if (value.isEmpty) return;
            Navigator.of(context).pop(value);
          },
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: Text(l.supplierSubmitReport),
        ),
      ),
    ),
  );
  controller.dispose();
  return result;
}

Future<void> handleMarkDeliveryPickupExpired(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.l10n;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l.supplierMarkPickupExpiredTitle),
      content: Text(l.supplierMarkPickupExpiredMessage),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(context.s.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: Text(l.supplierMarkExpired),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  try {
    await markDeliveryPickupExpiredForRequest(ref, requestId: reservationId);
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierPickupExpiredAdminReview);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  }
}

Future<void> handleReportNoDriverAvailable(
  BuildContext context,
  WidgetRef ref, {
  required String reservationId,
}) async {
  final l = context.l10n;
  final note = await _promptIncidentNote(
    context,
    title: l.supplierReportNoDriverTitle,
    hint: l.supplierReportNoDriverHint,
  );
  if (note == null || !context.mounted) return;

  try {
    await reportNoDriverAvailableForRequest(
      ref,
      requestId: reservationId,
      note: note,
    );
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierNoDriverReported);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  }
}

Future<void> handleReportDriverNoShow(
  BuildContext context,
  WidgetRef ref, {
  required String deliveryId,
}) async {
  final l = context.l10n;
  final note = await _promptIncidentNote(
    context,
    title: l.supplierReportDriverNoShowTitle,
    hint: l.supplierReportDriverNoShowHint,
  );
  if (note == null || !context.mounted) return;

  try {
    await markDriverNoShowForDelivery(ref, deliveryId: deliveryId, note: note);
    if (!context.mounted) return;
    showSupplierInfoSnackBar(context, l.supplierDriverNoShowReported);
  } catch (error) {
    if (!context.mounted) return;
    showSupplierErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  }
}
