import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../application/learner_reservation_provider.dart';
import '../widgets/learner_reservation_card.dart';

const _detailMaxWidth = 920.0;
const _refreshInterval = Duration(seconds: 10);

class LearnerReservationDetailPage extends ConsumerWidget {
  const LearnerReservationDetailPage({super.key, required this.reservationId});

  final String reservationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final isLearner =
        ref.watch(authControllerProvider).user?.hasRole('LEARNER') == true;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _detailMaxWidth,
                    ),
                    child: !isLearner
                        ? const _DetailStatePanel(
                            icon: Icons.lock_outline,
                            title: 'Learner account required',
                            subtitle:
                                'Use a learner account to view reservation details.',
                          )
                        : _ReservationDetailContent(
                            reservationId: reservationId,
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationDetailContent extends ConsumerStatefulWidget {
  const _ReservationDetailContent({required this.reservationId});

  final String reservationId;

  @override
  ConsumerState<_ReservationDetailContent> createState() =>
      _ReservationDetailContentState();
}

class _ReservationDetailContentState
    extends ConsumerState<_ReservationDetailContent> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    Future.microtask(_refresh);
    _refreshTimer = Timer.periodic(_refreshInterval, (_) => _refresh());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _refresh() {
    if (!mounted) {
      return;
    }

    ref.invalidate(learnerReservationProvider(widget.reservationId));
    ref.invalidate(learnerDeliveriesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final reservationAsync = ref.watch(
      learnerReservationProvider(widget.reservationId),
    );
    final deliveriesAsync = ref.watch(learnerDeliveriesProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextButton.icon(
                    onPressed: () => context.popOrGo('/learner/reservations'),
                    icon: const Icon(Icons.arrow_back_rounded, size: 18),
                    label: const Text('All reservations'),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Reservation details',
                    style: AppTextStyles.display(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                ],
              ),
            ),
            TextButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Refresh'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        reservationAsync.when(
          loading: () => const _DetailStatePanel(
            icon: Icons.hourglass_empty_rounded,
            title: 'Loading reservation',
            subtitle: 'Checking the latest reservation status.',
          ),
          error: (_, _) => _DetailStatePanel(
            icon: Icons.cloud_off_outlined,
            title: 'Could not load reservation',
            subtitle: 'Please try again.',
            actionLabel: 'Try again',
            onAction: _refresh,
          ),
          data: (reservation) {
            final delivery = deliveriesAsync.maybeWhen(
              data: (deliveries) =>
                  _latestDeliveryForReservation(deliveries, reservation.id),
              orElse: () => null,
            );

            return LearnerReservationCard(
              reservation: reservation,
              delivery: delivery,
            );
          },
        ),
      ],
    );
  }
}

LearnerDelivery? _latestDeliveryForReservation(
  List<LearnerDelivery> deliveries,
  String reservationId,
) {
  LearnerDelivery? latest;

  for (final delivery in deliveries) {
    if (delivery.reservationId != reservationId) {
      continue;
    }

    if (latest == null || delivery.requestedAt.isAfter(latest.requestedAt)) {
      latest = delivery;
    }
  }

  return latest;
}

class _DetailStatePanel extends StatelessWidget {
  const _DetailStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        children: [
          Icon(icon, color: palette.mint, size: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
