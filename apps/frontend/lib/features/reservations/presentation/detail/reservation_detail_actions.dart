import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/widgets/request_delivery_dialog.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../application/learner_reservation_cache.dart';
import '../../application/reservation_cancel_controller.dart';
import '../../application/reservation_timing_policy.dart';
import '../../data/models/learner_reservation.dart';
import '../../data/reservations_repository.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';

const cancelDialogMaxWidth = 440.0;

Future<void> confirmCancelReservation(
  BuildContext context,
  WidgetRef ref,
  LearnerReservation reservation,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => CancelReservationDialog(
      reservation: reservation,
      onKeep: () => Navigator.of(dialogContext).pop(false),
      onCancel: () => Navigator.of(dialogContext).pop(true),
    ),
  );

  if (confirmed != true || !context.mounted) return;

  ref.read(cancellingReservationIdProvider.notifier).setCancelling(reservation.id);

  try {
    await ref
        .read(reservationCancelControllerProvider.notifier)
        .cancel(reservation.id);
    invalidateLearnerReservationCaches(ref, reservationId: reservation.id);
    ref.invalidate(learnerDeliveriesProvider);
    ref.invalidate(homeSuggestedMaterialsProvider);

    if (!context.mounted) return;
    showInfoSnackBar(context, context.l10n.reservationCancelledFeedback);
  } on ApiException catch (error) {
    if (!context.mounted) return;
    showInfoSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  } catch (_) {
    if (!context.mounted) return;
    showErrorSnackBar(context, context.l10n.somethingWentWrong);
  } finally {
    ref.read(cancellingReservationIdProvider.notifier).setCancelling(null);
  }
}

class CancelReservationDialog extends StatefulWidget {
  const CancelReservationDialog({
    super.key,
    required this.reservation,
    required this.onKeep,
    required this.onCancel,
  });

  final LearnerReservation reservation;
  final VoidCallback onKeep;
  final VoidCallback onCancel;

  @override
  State<CancelReservationDialog> createState() => _CancelReservationDialogState();
}

class _CancelReservationDialogState extends State<CancelReservationDialog> {
  var _isSubmitting = false;

  void _handleCancel() {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    widget.onCancel();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final screenSize = MediaQuery.sizeOf(context);
    final isNarrow = screenSize.width < 480;
    final dialogWidth =
        isNarrow ? screenSize.width * 0.92 : cancelDialogMaxWidth;

    final keepButton = OutlinedButton(
      onPressed: _isSubmitting ? null : widget.onKeep,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral)
          .copyWith(
            minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
            padding: const WidgetStatePropertyAll(
              EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.lg),
            ),
          ),
      child: Text(context.l10n.keepRequest),
    );

    final cancelButton = FilledButton(
      onPressed: _isSubmitting ? null : _handleCancel,
      style: AppStatusButtonStyle.filled(
        context,
        AppStatusTone.danger,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
        ),
      ).copyWith(minimumSize: const WidgetStatePropertyAll(Size(0, 44))),
      child: _isSubmitting
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.textOnPrimary,
              ),
            )
          : Text(context.l10n.cancelRequest),
    );

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isNarrow ? screenSize.width * 0.04 : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      backgroundColor: palette.panelSurface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      child: SizedBox(
        width: dialogWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.xs,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      context.l10n.cancelReservationQuestion,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _isSubmitting ? null : widget.onKeep,
                    tooltip: context.l10n.close,
                    visualDensity: VisualDensity.compact,
                    constraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: 36,
                    ),
                    icon: Icon(Icons.close_rounded, color: palette.textMuted),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: palette.borderSubtle),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    context.l10n.cancelReleasesQuantity,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: palette.inputSurface,
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.reservation.material.title,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          context.l10n.requestedQuantityLabel(
                            _formatRequestedQuantity(widget.reservation),
                          ),
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: palette.borderSubtle),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: isNarrow
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        cancelButton,
                        const SizedBox(height: AppSpacing.xs),
                        keepButton,
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        keepButton,
                        const SizedBox(width: AppSpacing.md),
                        SizedBox(height: 44, child: cancelButton),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatRequestedQuantity(LearnerReservation reservation) {
    final quantity = reservation.quantityRequested;
    final formatted = quantity == quantity.roundToDouble()
        ? quantity.toStringAsFixed(0)
        : quantity.toString();
    return '$formatted ${reservation.material.unit}';
  }
}

class LearnerRequestRescheduleButton extends ConsumerStatefulWidget {
  const LearnerRequestRescheduleButton({super.key, required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<LearnerRequestRescheduleButton> createState() =>
      _LearnerRequestRescheduleButtonState();
}

class _LearnerRequestRescheduleButtonState
    extends ConsumerState<LearnerRequestRescheduleButton> {
  bool _submitting = false;

  Future<void> _submit() async {
    final reasonController = TextEditingController();
    final noteController = TextEditingController();
    DateTime? start;
    DateTime? end;
    String? reason;
    String? note;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> pickStart() async {
              final date = await showDatePicker(
                context: context,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 60)),
                initialDate:
                    start ?? DateTime.now().add(const Duration(days: 1)),
              );
              if (date == null || !context.mounted) return;
              final time = await showTimePicker(
                context: context,
                initialTime: const TimeOfDay(hour: 10, minute: 0),
              );
              if (time == null) return;
              setDialogState(() {
                start = DateTime(
                  date.year,
                  date.month,
                  date.day,
                  time.hour,
                  time.minute,
                );
              });
            }

            Future<void> pickEnd() async {
              final date = await showDatePicker(
                context: context,
                firstDate: start ?? DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 60)),
                initialDate:
                    end ?? start ?? DateTime.now().add(const Duration(days: 1)),
              );
              if (date == null || !context.mounted) return;
              final time = await showTimePicker(
                context: context,
                initialTime: const TimeOfDay(hour: 11, minute: 0),
              );
              if (time == null) return;
              setDialogState(() {
                end = DateTime(
                  date.year,
                  date.month,
                  date.day,
                  time.hour,
                  time.minute,
                );
              });
            }

            return AppDialogShell(
              title: Text(context.l10n.requestReschedule),
              onClose: () => Navigator.of(dialogContext).pop(false),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: reasonController,
                    maxLength: 500,
                    decoration: InputDecoration(
                      labelText: context.l10n.reasonRequired,
                    ),
                  ),
                  TextField(
                    controller: noteController,
                    maxLength: 1000,
                    decoration: InputDecoration(
                      labelText: context.l10n.noteOptional,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  OutlinedButton(
                    onPressed: pickStart,
                    child: Text(
                      start == null
                          ? context.l10n.pickProposedStart
                          : context.l10n.proposedStart(
                              LocalizedFormatters(
                                context.l10n,
                              ).dateTime(start!),
                            ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  OutlinedButton(
                    onPressed: pickEnd,
                    child: Text(
                      end == null
                          ? context.l10n.pickProposedEnd
                          : context.l10n.proposedEnd(
                              LocalizedFormatters(context.l10n).dateTime(end!),
                            ),
                    ),
                  ),
                ],
              ),
              footer: AppDialogFooter.form(
                primaryAction: FilledButton(
                  onPressed: () {
                    if (reasonController.text.trim().isEmpty ||
                        start == null ||
                        end == null) {
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        SnackBar(
                          content: Text(
                            context.l10n.rescheduleReasonWindowRequired,
                          ),
                        ),
                      );
                      return;
                    }

                    if (!end!.isAfter(start!)) {
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        SnackBar(content: Text(context.l10n.endAfterStart)),
                      );
                      return;
                    }

                    if (end!.isBefore(
                      DateTime.now().add(minRemainingPickupWindow),
                    )) {
                      ScaffoldMessenger.of(dialogContext).showSnackBar(
                        SnackBar(
                          content: Text(context.l10n.pickupWindowTooClose),
                        ),
                      );
                      return;
                    }

                    reason = reasonController.text.trim();
                    final rawNote = noteController.text.trim();
                    note = rawNote.isEmpty ? null : rawNote;
                    Navigator.of(dialogContext).pop(true);
                  },
                  style: AppStatusButtonStyle.filled(
                    dialogContext,
                    AppStatusTone.warning,
                  ),
                  child: Text(context.l10n.sendRequest),
                ),
              ),
            );
          },
        );
      },
    );

    reasonController.dispose();
    noteController.dispose();

    if (confirmed != true ||
        start == null ||
        end == null ||
        reason == null ||
        !mounted) {
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(reservationsRepositoryProvider).requestPickupReschedule(
            reservationId: widget.reservation.id,
            pickupWindowStart: start!,
            pickupWindowEnd: end!,
            reason: reason!,
            note: note,
          );
      invalidateLearnerReservationCaches(
        ref,
        reservationId: widget.reservation.id,
      );
      if (!mounted) return;
      showInfoSnackBar(context, context.l10n.rescheduleSent);
    } on ApiException catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
    } catch (_) {
      if (!mounted) return;
      showErrorSnackBar(context, context.l10n.somethingWentWrong);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: _submitting ? null : _submit,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.warning),
      child: _submitting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(context.l10n.requestReschedule),
    );
  }
}

const learnerSupplierReportReasons = <String>[
  'SUPPLIER_UNAVAILABLE',
  'SUPPLIER_MATERIAL_NOT_READY',
  'WRONG_PICKUP_INFO',
  'OTHER',
];

String supplierReportReasonLabel(BuildContext context, String reason) {
  return switch (reason) {
    'SUPPLIER_UNAVAILABLE' => context.l10n.supplierUnavailable,
    'SUPPLIER_MATERIAL_NOT_READY' => context.l10n.materialNotReady,
    'WRONG_PICKUP_INFO' => context.l10n.wrongPickupInformation,
    _ => context.l10n.other,
  };
}

class LearnerReportSupplierButton extends ConsumerStatefulWidget {
  const LearnerReportSupplierButton({super.key, required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<LearnerReportSupplierButton> createState() =>
      _LearnerReportSupplierButtonState();
}

class _LearnerReportSupplierButtonState
    extends ConsumerState<LearnerReportSupplierButton> {
  bool _submitting = false;

  Future<void> _submit() async {
    var selectedReason = 'SUPPLIER_UNAVAILABLE';
    final noteController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AppDialogShell(
          title: Text(context.l10n.reportSupplierIssue),
          onClose: () => Navigator.of(context).pop(false),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(context.l10n.reportSupplierDescription),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                decoration: InputDecoration(labelText: context.l10n.reason),
                items: learnerSupplierReportReasons
                    .map(
                      (reason) => DropdownMenuItem(
                        value: reason,
                        child: Text(supplierReportReasonLabel(context, reason)),
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
                  labelText: context.l10n.noteOptional,
                  hintText: context.l10n.describeWhatHappened,
                ),
              ),
            ],
          ),
          footer: AppDialogFooter.form(
            primaryAction: FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
              child: Text(context.l10n.submitReport),
            ),
          ),
        ),
      ),
    );
    final note = noteController.text.trim();
    noteController.dispose();

    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      await ref.read(reservationsRepositoryProvider).reportSupplierIssue(
            reservationId: widget.reservation.id,
            reason: selectedReason,
            note: note.isEmpty ? null : note,
          );
      invalidateLearnerReservationCaches(
        ref,
        reservationId: widget.reservation.id,
      );
      if (!mounted) return;
      showInfoSnackBar(context, context.l10n.supplierIssueReportedAdmin);
    } on ApiException catch (error) {
      if (!mounted) return;
      showInfoSnackBar(context, localizedApiErrorMessage(error, context.l10n));
    } catch (_) {
      if (!mounted) return;
      showErrorSnackBar(context, context.l10n.somethingWentWrong);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: _submitting ? null : _submit,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
      child: _submitting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(context.l10n.reportSupplierIssue),
    );
  }
}

class LearnerReportNoDriverButton extends ConsumerStatefulWidget {
  const LearnerReportNoDriverButton({super.key, required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<LearnerReportNoDriverButton> createState() =>
      _LearnerReportNoDriverButtonState();
}

class _LearnerReportNoDriverButtonState
    extends ConsumerState<LearnerReportNoDriverButton> {
  bool _submitting = false;

  Future<void> _submit() async {
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(context.l10n.reportNoDriverAvailable),
        onClose: () => Navigator.of(context).pop(false),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(context.l10n.reportNoDriverDescription),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              maxLength: 1000,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(labelText: context.l10n.noteRequired),
            ),
          ],
        ),
        footer: AppDialogFooter.form(
          primaryAction: FilledButton(
            onPressed: () {
              if (noteController.text.trim().isEmpty) return;
              Navigator.of(context).pop(true);
            },
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: Text(context.l10n.submitReport),
          ),
        ),
      ),
    );
    final note = noteController.text.trim();
    noteController.dispose();

    if (confirmed != true || note.isEmpty || !mounted) return;

    setState(() => _submitting = true);
    try {
      await ref.read(reservationsRepositoryProvider).reportNoDriverAvailable(
            reservationId: widget.reservation.id,
            note: note,
          );
      invalidateLearnerReservationCaches(
        ref,
        reservationId: widget.reservation.id,
      );
      if (!mounted) return;
      showInfoSnackBar(context, context.l10n.noDriverReportedAdmin);
    } on ApiException catch (error) {
      if (!mounted) return;
      showInfoSnackBar(context, localizedApiErrorMessage(error, context.l10n));
    } catch (_) {
      if (!mounted) return;
      showErrorSnackBar(context, context.l10n.somethingWentWrong);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: _submitting ? null : _submit,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
      child: _submitting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(context.l10n.reportNoDriverAvailable),
    );
  }
}

class ReservationDetailActionButton extends StatelessWidget {
  const ReservationDetailActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.tone = AppStatusTone.neutral,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final statusStyle = AppStatusStyle.of(context, tone);

    if (tone == AppStatusTone.danger) {
      return TextButton(
        onPressed: onPressed,
        style: AppStatusButtonStyle.text(context, tone).copyWith(
          textStyle: const WidgetStatePropertyAll(
            TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ),
        child: loading
            ? SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: statusStyle.foreground,
                ),
              )
            : Text(label),
      );
    }

    return OutlinedButton(
      onPressed: onPressed,
      style: AppStatusButtonStyle.outlined(context, tone).copyWith(
        padding: const WidgetStatePropertyAll(
          EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
        ),
      ),
      child: loading
          ? SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: statusStyle.foreground,
              ),
            )
          : Text(label),
    );
  }
}

ReservationDetailActionButton? resolveDeliveryActionButton({
  required BuildContext context,
  required LearnerReservation reservation,
  required LearnerDelivery? delivery,
  required void Function(String deliveryId) onNavigate,
}) {
  final l10n = context.l10n;
  final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
  if (deliveryId == null) return null;

  return ReservationDetailActionButton(
    label: delivery?.canTrack == true ? l10n.trackDelivery : l10n.viewDelivery,
    onPressed: () => onNavigate(deliveryId),
    tone: AppStatusTone.info,
  );
}

void showRequestDeliveryForReservation(
  BuildContext context,
  WidgetRef ref,
  LearnerReservation reservation,
) {
  showRequestDeliveryDialog(
    context: context,
    ref: ref,
    reservation: reservation,
  );
}

void navigateToMaterial(BuildContext context, String materialId) {
  context.push('/materials/$materialId');
}
