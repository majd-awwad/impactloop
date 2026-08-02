import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../material_discovery/presentation/widgets/preferred_window_input.dart';
import '../../application/learner_reservation_cache.dart';
import '../../application/reservation_confirmation_controller.dart';
import '../../data/models/learner_reservation.dart';
import '../../data/models/reservation_preferred_window.dart';
import '../learner_reservation_ui_helpers.dart';

class LearnerAwaitingConfirmationPanel extends ConsumerStatefulWidget {
  const LearnerAwaitingConfirmationPanel({
    super.key,
    required this.reservation,
  });

  final LearnerReservation reservation;

  @override
  ConsumerState<LearnerAwaitingConfirmationPanel> createState() =>
      _LearnerAwaitingConfirmationPanelState();
}

class _LearnerAwaitingConfirmationPanelState
    extends ConsumerState<LearnerAwaitingConfirmationPanel> {
  PreferredWindowDraft _deliveryWindow = PreferredWindowDraft();
  String? _errorMessage;

  LearnerReservation get reservation => widget.reservation;

  bool get _isSubmitting {
    final confirmingId = ref.watch(confirmingReservationIdProvider);
    final state = ref.watch(reservationConfirmationControllerProvider);
    return confirmingId == reservation.id && state.isLoading;
  }

  Future<void> _refreshAfterSuccess(String successMessage) async {
    invalidateLearnerReservationCaches(ref, reservationId: reservation.id);
    ref.invalidate(homeSuggestedMaterialsProvider);

    if (!mounted) {
      return;
    }

    showInfoSnackBar(context, successMessage);
  }

  Future<void> _runConfirmation(
    Future<LearnerReservation> Function() action, {
    required String successMessage,
  }) async {
    ref
        .read(confirmingReservationIdProvider.notifier)
        .setConfirming(reservation.id);

    setState(() => _errorMessage = null);

    try {
      await action();
      await _refreshAfterSuccess(successMessage);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(
        () => _errorMessage = localizedApiErrorMessage(error, context.l10n),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _errorMessage = context.l10n.somethingWentWrong);
    } finally {
      ref.read(confirmingReservationIdProvider.notifier).setConfirming(null);
    }
  }

  Future<void> _acceptProposedPickup() {
    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .acceptProposedPickup(reservation.id),
      successMessage: context.l10n.pickupTimeAccepted,
    );
  }

  Future<void> _submitDeliveryWindow() {
    final now = DateTime.now();
    final start = _deliveryWindow.start;
    final end = _deliveryWindow.end;
    final validationError = start == null || end == null
        ? context.l10n.rescheduleReasonWindowRequired
        : !end.isAfter(start)
        ? context.l10n.endAfterStart
        : !start.isAfter(now) || !end.isAfter(now)
        ? context.l10n.invalidPickupWindow
        : null;
    if (validationError != null) {
      setState(() => _errorMessage = validationError);
      return Future<void>.value();
    }

    final validStart = start!;
    final validEnd = end!;

    final earliestDelivery = reservation.earliestDeliveryStart;
    if (earliestDelivery != null && !validEnd.isAfter(earliestDelivery)) {
      setState(() => _errorMessage = context.l10n.deliveryWindowAfterEarliest);
      return Future<void>.value();
    }

    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .submitDeliveryWindow(
            reservationId: reservation.id,
            start: validStart,
            end: validEnd,
          ),
      successMessage: context.l10n.deliveryWindowSubmitted,
    );
  }

  Future<void> _cancelReservation() {
    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .cancelAwaitingConfirmation(reservation.id),
      successMessage: context.l10n.reservationCancelledFeedback,
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.actionRequired,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (reservation.isPickupFulfillment) ...[
            if (formatAwaitingPickupPreferredSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final preferred?) ...[
              Text(
                preferred,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingPickupProposedSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final proposed?) ...[
              Text(
                proposed,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton(
                  onPressed: _isSubmitting ? null : _acceptProposedPickup,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.success,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(context.l10n.acceptProposedTime),
                ),
                OutlinedButton(
                  onPressed: _isSubmitting ? null : _cancelReservation,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.danger,
                  ),
                  child: Text(context.l10n.cancelReservation),
                ),
              ],
            ),
          ] else ...[
            if (formatAwaitingDeliverySupplierPickupSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final supplierPickup?) ...[
              Text(
                supplierPickup,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryEarliestSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final earliest?) ...[
              Text(
                earliest,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryPreferredSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final preferred?) ...[
              Text(
                preferred,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryProposedSummary(
                  reservation,
                  l10n: context.l10n,
                )
                case final proposedDelivery?) ...[
              Text(
                proposedDelivery,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatSchedulingConflictReason(reservation, l10n: context.l10n)
                case final conflict?) ...[
              Text(
                conflict,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            PreferredWindowInput(
              windows: [_deliveryWindow],
              enabled: !_isSubmitting,
              label: context.l10n.newDeliveryWindow,
              allowMultipleWindows: false,
              onChanged: (windows) {
                setState(() {
                  _errorMessage = null;
                  if (windows.isNotEmpty) {
                    _deliveryWindow = windows.first;
                  }
                });
              },
            ),
            if (_deliveryWindow.start != null &&
                _deliveryWindow.end != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                context.l10n.selectedDeliveryWindow(
                  formatPreferredWindowRange(
                    ReservationPreferredWindow(
                      start: _deliveryWindow.start!,
                      end: _deliveryWindow.end!,
                    ),
                    l10n: context.l10n,
                  ),
                ),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton(
                  onPressed: _isSubmitting ? null : _submitDeliveryWindow,
                  style: AppStatusButtonStyle.filled(
                    context,
                    AppStatusTone.primary,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(context.l10n.submitNewDeliveryWindow),
                ),
                OutlinedButton(
                  onPressed: _isSubmitting ? null : _cancelReservation,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.danger,
                  ),
                  child: Text(context.l10n.cancelReservation),
                ),
              ],
            ),
          ],
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _errorMessage!,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: colors.danger),
            ),
          ],
        ],
      ),
    );
  }
}
