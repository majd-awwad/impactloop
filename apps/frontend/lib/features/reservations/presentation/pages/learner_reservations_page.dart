import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../application/my_reservations_provider.dart';
import '../widgets/learner_reservation_card.dart';
import '../learner_reservation_ui_helpers.dart';

const _learnerReservationsMaxWidth = 920.0;
const _reservationRefreshInterval = Duration(seconds: 10);

class LearnerReservationsPage extends ConsumerWidget {
  const LearnerReservationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final authState = ref.watch(authControllerProvider);
    final isLearner = authState.user?.hasRole('LEARNER') == true;

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
                padding: appMobileAwareScrollPadding(context),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _learnerReservationsMaxWidth,
                    ),
                    child: !isLearner
                        ? const _StatePanel(
                            icon: Icons.lock_outline,
                            title: 'Learner account required',
                            subtitle:
                                'Use a learner account to view material reservations.',
                          )
                        : const _ReservationsContent(),
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

class _ReservationsContent extends ConsumerStatefulWidget {
  const _ReservationsContent();

  @override
  ConsumerState<_ReservationsContent> createState() =>
      _ReservationsContentState();
}

class _ReservationsContentState extends ConsumerState<_ReservationsContent> {
  LearnerReservationStatusFilter _selectedFilter =
      LearnerReservationStatusFilter.all;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    Future.microtask(_refreshReservations);
    _refreshTimer = Timer.periodic(
      _reservationRefreshInterval,
      (_) => _refreshReservations(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _refreshReservations() {
    if (!mounted) {
      return;
    }

    ref.invalidate(myReservationsProvider);
    ref.invalidate(learnerDeliveriesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final reservationsAsync = ref.watch(myReservationsProvider);
    final deliveriesAsync = ref.watch(learnerDeliveriesProvider);
    final deliveriesByReservationId = deliveriesAsync.maybeWhen(
      data: _latestDeliveryByReservationId,
      orElse: () => const <String, LearnerDelivery>{},
    );
    final deliveryStateUnavailable = deliveriesAsync.hasError;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Expanded(child: _PageHeader()),
            TextButton.icon(
              onPressed: _refreshReservations,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Refresh'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        reservationsAsync.maybeWhen(
          data: (reservations) {
            if (reservations.isEmpty) {
              return const SizedBox.shrink();
            }

            return _StatusFilterChips(
              selected: _selectedFilter,
              onSelected: (filter) => setState(() => _selectedFilter = filter),
            );
          },
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: AppSpacing.md),
        if (deliveryStateUnavailable) ...[
          _DeliveryLoadWarning(
            onRetry: () => ref.invalidate(learnerDeliveriesProvider),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        reservationsAsync.when(
          loading: () => const _StatePanel(
            icon: Icons.hourglass_empty_rounded,
            title: 'Loading reservations',
            subtitle: 'Checking your latest reservation activity.',
          ),
          error: (_, _) => _StatePanel(
            icon: Icons.cloud_off_outlined,
            title: 'Could not load reservations',
            subtitle: 'Please try again.',
            actionLabel: 'Try again',
            onAction: () => ref.invalidate(myReservationsProvider),
          ),
          data: (reservations) {
            if (reservations.isEmpty) {
              return _StatePanel(
                icon: Icons.assignment_turned_in_outlined,
                title: 'No reservations yet',
                subtitle:
                    'Reserve an available material and supplier updates will appear here.',
                actionLabel: 'Browse materials',
                onAction: () => context.push('/materials'),
              );
            }

            final filtered = reservations
                .where(
                  (reservation) => reservationMatchesStatusFilter(
                    reservation,
                    _selectedFilter,
                  ),
                )
                .toList(growable: false);

            if (filtered.isEmpty) {
              return _StatePanel(
                icon: Icons.filter_list_off_outlined,
                title: 'No matching reservations',
                subtitle:
                    'Try another filter or browse materials to start a new request.',
                actionLabel: 'Browse materials',
                onAction: () => context.push('/materials'),
              );
            }

            return Column(
              children: filtered
                  .map(
                    (reservation) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => context.push(
                            '/learner/reservations/${reservation.id}',
                          ),
                          borderRadius: AppRadius.lgAll,
                          child: LearnerReservationCard(
                            reservation: reservation,
                            delivery: deliveriesByReservationId[reservation.id],
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
      ],
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final compact = MediaQuery.sizeOf(context).width < 720;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'My Reservations',
          style:
              (compact
                      ? AppTextStyles.title(context)
                      : AppTextStyles.display(context))
                  .copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Track requests, pickup windows, and delivery updates.',
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      ],
    );
  }
}

class _StatusFilterChips extends StatelessWidget {
  const _StatusFilterChips({required this.selected, required this.onSelected});

  final LearnerReservationStatusFilter selected;
  final ValueChanged<LearnerReservationStatusFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: LearnerReservationStatusFilter.values
            .map((filter) {
              final isSelected = filter == selected;

              return Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => onSelected(filter),
                    borderRadius: AppRadius.pillAll,
                    child: Ink(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? colors.primarySoft
                            : palette.panelSurface,
                        borderRadius: AppRadius.pillAll,
                        border: Border.all(
                          color: isSelected
                              ? colors.primary.withValues(alpha: 0.35)
                              : palette.borderSubtle,
                        ),
                      ),
                      child: Text(
                        filter.label,
                        style: AppTextStyles.label(context).copyWith(
                          color: isSelected
                              ? colors.primary
                              : palette.textSecondary,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
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
        borderRadius: AppRadius.lgAll,
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

class _DeliveryLoadWarning extends StatelessWidget {
  const _DeliveryLoadWarning({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Row(
        children: [
          Icon(Icons.sync_problem_outlined, color: palette.textMuted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Delivery status could not be loaded. Refresh before requesting delivery.',
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

Map<String, LearnerDelivery> _latestDeliveryByReservationId(
  List<LearnerDelivery> deliveries,
) {
  final result = <String, LearnerDelivery>{};

  for (final delivery in deliveries) {
    final current = result[delivery.reservationId];
    if (current == null || delivery.requestedAt.isAfter(current.requestedAt)) {
      result[delivery.reservationId] = delivery;
    }
  }

  return result;
}
