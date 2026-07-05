import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
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

      setState(() => _errorMessage = error.displayMessage);
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _errorMessage = 'Something went wrong. Please try again.');
    } finally {
      ref.read(confirmingReservationIdProvider.notifier).setConfirming(null);
    }
  }

  Future<void> _acceptProposedPickup() {
    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .acceptProposedPickup(reservation.id),
      successMessage: 'Pickup time accepted.',
    );
  }

  Future<void> _submitDeliveryWindow() {
    final now = DateTime.now();
    final validationError = _deliveryWindow.validationError(now: now);
    if (validationError != null) {
      setState(() => _errorMessage = validationError);
      return Future<void>.value();
    }

    final start = _deliveryWindow.start!;
    final end = _deliveryWindow.end!;

    final earliestDelivery = reservation.earliestDeliveryStart;
    if (earliestDelivery != null && !end.isAfter(earliestDelivery)) {
      setState(
        () => _errorMessage =
            'Selected window must end after the earliest possible delivery time.',
      );
      return Future<void>.value();
    }

    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .submitDeliveryWindow(
            reservationId: reservation.id,
            start: start,
            end: end,
          ),
      successMessage: 'Delivery window submitted.',
    );
  }

  Future<void> _cancelReservation() {
    return _runConfirmation(
      () => ref
          .read(reservationConfirmationControllerProvider.notifier)
          .cancelAwaitingConfirmation(reservation.id),
      successMessage: 'Reservation cancelled.',
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
            'Action required',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (reservation.isPickupFulfillment) ...[
            if (formatAwaitingPickupPreferredSummary(reservation)
                case final preferred?) ...[
              Text(
                preferred,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingPickupProposedSummary(reservation)
                case final proposed?) ...[
              Text(
                proposed,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton(
                  onPressed: _isSubmitting ? null : _acceptProposedPickup,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Accept proposed time'),
                ),
                OutlinedButton(
                  onPressed: _isSubmitting ? null : _cancelReservation,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.danger,
                    side: BorderSide(
                      color: colors.danger.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Text('Cancel reservation'),
                ),
              ],
            ),
          ] else ...[
            if (formatAwaitingDeliverySupplierPickupSummary(reservation)
                case final supplierPickup?) ...[
              Text(
                supplierPickup,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryEarliestSummary(reservation)
                case final earliest?) ...[
              Text(
                earliest,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryPreferredSummary(reservation)
                case final preferred?) ...[
              Text(
                preferred,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatAwaitingDeliveryProposedSummary(reservation)
                case final proposedDelivery?) ...[
              Text(
                proposedDelivery,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            if (formatSchedulingConflictReason(reservation)
                case final conflict?) ...[
              Text(
                conflict,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            PreferredWindowInput(
              windows: [_deliveryWindow],
              enabled: !_isSubmitting,
              label: 'New delivery window',
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
            if (_deliveryWindow.start != null && _deliveryWindow.end != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                formatPreferredWindowRange(
                  ReservationPreferredWindow(
                    start: _deliveryWindow.start!,
                    end: _deliveryWindow.end!,
                  ),
                  prefix: 'Selected delivery window',
                ),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton(
                  onPressed: _isSubmitting ? null : _submitDeliveryWindow,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Submit new delivery window'),
                ),
                OutlinedButton(
                  onPressed: _isSubmitting ? null : _cancelReservation,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.danger,
                    side: BorderSide(
                      color: colors.danger.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Text('Cancel reservation'),
                ),
              ],
            ),
          ],
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _errorMessage!,
              style: AppTextStyles.label(context).copyWith(
                color: colors.danger,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
