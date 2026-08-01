import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/driver_delivery.dart';
import '../../data/models/update_driver_delivery_status_request.dart';

const partialPickupUnpickedReasonCodes = [
  'MATERIAL_NOT_READY',
  'MATERIAL_MISSING',
  'WRONG_ITEM',
  'QUANTITY_MISMATCH',
  'DAMAGED_ITEM',
  'SUPPLIER_REFUSED_HANDOVER',
  'OTHER',
];

class PartialPickupSelection {
  const PartialPickupSelection({
    required this.pickedReservationIds,
    required this.unpicked,
  });

  final List<String> pickedReservationIds;
  final List<UpdateDriverDeliveryUnpickedItem> unpicked;
}

Future<PartialPickupSelection?> showPartialPickupSelectionDialog({
  required BuildContext context,
  required DriverDelivery delivery,
}) async {
  final l10n = AppLocalizations.of(context);
  final labels = DriverUiLabels(l10n);
  final items = delivery.items;
  final selected = <String>{for (final item in items) item.reservationId};
  final reasons = <String, String>{};
  final notes = <String, TextEditingController>{};
  for (final item in items) {
    notes[item.reservationId] = TextEditingController();
  }

  try {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final pickedCount = selected.length;
            final pendingCount = items.length - pickedCount;
            final pendingMissingReason = items.any(
              (item) =>
                  !selected.contains(item.reservationId) &&
                  (reasons[item.reservationId] == null ||
                      reasons[item.reservationId]!.isEmpty),
            );

            return AppDialogShell(
              title: Text(l10n.driverPartialPickupTitle),
              content: SizedBox(
                width: 480,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.driverPartialPickupBody,
                        style: AppTextStyles.body(context),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        l10n.driverPartialPickupPickedSection,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      for (final item in items)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: selected.contains(item.reservationId),
                          title: Text(labels.materialTitle(item.title)),
                          subtitle: Text(item.quantityLabel),
                          onChanged: (value) {
                            setState(() {
                              if (value == true) {
                                selected.add(item.reservationId);
                                reasons.remove(item.reservationId);
                              } else {
                                selected.remove(item.reservationId);
                              }
                            });
                          },
                        ),
                      if (pendingCount > 0) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          l10n.driverPartialPickupPendingSection,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (final item in items)
                          if (!selected.contains(item.reservationId)) ...[
                            Text(
                              labels.materialTitle(item.title),
                              style: AppTextStyles.body(context),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            DropdownButtonFormField<String>(
                              initialValue: reasons[item.reservationId],
                              decoration: InputDecoration(
                                labelText: l10n.driverReason,
                              ),
                              items: partialPickupUnpickedReasonCodes
                                  .map(
                                    (code) => DropdownMenuItem(
                                      value: code,
                                      child: Text(
                                        labels.partialPickupUnpickedReason(
                                          code,
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                if (value == null) return;
                                setState(() {
                                  reasons[item.reservationId] = value;
                                });
                              },
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            TextField(
                              controller: notes[item.reservationId],
                              maxLength: 1000,
                              minLines: 1,
                              maxLines: 3,
                              decoration: InputDecoration(
                                labelText: l10n.driverOptionalNote,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                          ],
                      ],
                      Text(
                        l10n.driverPartialPickupSummary(
                          pickedCount,
                          pendingCount,
                        ),
                        style: AppTextStyles.body(context),
                      ),
                      if (pickedCount == 0 || pendingMissingReason) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          pickedCount == 0
                              ? l10n.driverReportPickupFailed
                              : l10n.driverPartialPickupReasonRequired,
                          style: AppTextStyles.body(context).copyWith(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              footer: AppDialogFooter.form(
                primaryAction: FilledButton(
                  onPressed: pickedCount == 0 || pendingMissingReason
                      ? null
                      : () => Navigator.of(context).pop(true),
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.primary,
                  ),
                  child: Text(l10n.driverPartialPickupContinue),
                ),
              ),
            );
          },
        );
      },
    );

    if (confirmed != true) {
      return null;
    }

    final pickedReservationIds = items
        .where((item) => selected.contains(item.reservationId))
        .map((item) => item.reservationId)
        .toList();
    final unpicked = items
        .where((item) => !selected.contains(item.reservationId))
        .map(
          (item) => UpdateDriverDeliveryUnpickedItem(
            reservationId: item.reservationId,
            reason: reasons[item.reservationId]!,
            note: notes[item.reservationId]?.text,
          ),
        )
        .toList();

    return PartialPickupSelection(
      pickedReservationIds: pickedReservationIds,
      unpicked: unpicked,
    );
  } finally {
    for (final controller in notes.values) {
      controller.dispose();
    }
  }
}
