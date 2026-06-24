import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/my_reservations_provider.dart';
import '../../data/models/learner_reservation.dart';

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
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1120),
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

class _ReservationsContent extends ConsumerWidget {
  const _ReservationsContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reservationsAsync = ref.watch(myReservationsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _PageHeader(),
        const SizedBox(height: AppSpacing.lg),
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
                onAction: () => context.go('/materials'),
              );
            }

            return Column(
              children: reservations
                  .map(
                    (reservation) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _ReservationCard(reservation: reservation),
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

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Reservations',
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Track supplier responses and pickup windows for materials you requested.',
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 720;
          final media = _MaterialPreview(reservation: reservation);
          final details = _ReservationDetails(reservation: reservation);

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                media,
                const SizedBox(height: AppSpacing.md),
                details,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 176, child: media),
              const SizedBox(width: AppSpacing.lg),
              Expanded(child: details),
            ],
          );
        },
      ),
    );
  }
}

class _MaterialPreview extends StatelessWidget {
  const _MaterialPreview({required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final imageUrl = reservation.material.imageUrl;

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: ClipRRect(
        borderRadius: AppRadius.mdAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: palette.cardSurfaceAlt),
          child: imageUrl == null
              ? Icon(
                  Icons.inventory_2_outlined,
                  color: palette.mint,
                  size: 40,
                )
              : Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => Icon(
                    Icons.inventory_2_outlined,
                    color: palette.mint,
                    size: 40,
                  ),
                ),
        ),
      ),
    );
  }
}

class _ReservationDetails extends StatelessWidget {
  const _ReservationDetails({required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pickupText = _pickupText(reservation);
    final secondaryText = _secondaryText(reservation);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            MaterialStatusBadge(
              label: _statusLabel(reservation.status),
              tone: _statusTone(reservation.status),
            ),
            Text(
              _formatDate(reservation.createdAt),
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          reservation.material.title,
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '${reservation.material.materialType} • ${reservation.material.locationLabel}',
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Supplier: ${reservation.supplier.displayName}',
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
        if (pickupText != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            pickupText,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
        if (secondaryText != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            secondaryText,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: () => context.go('/materials/${reservation.material.id}'),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('View material'),
          ),
        ),
      ],
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

String _statusLabel(String status) {
  switch (status) {
    case 'PENDING':
      return 'Pending supplier response';
    case 'ACCEPTED':
      return 'Accepted / Ready for pickup';
    case 'REJECTED':
      return 'Rejected';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status;
  }
}

MaterialStatusBadgeTone _statusTone(String status) {
  switch (status) {
    case 'PENDING':
    case 'ACCEPTED':
      return MaterialStatusBadgeTone.reserved;
    case 'COMPLETED':
      return MaterialStatusBadgeTone.reused;
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    default:
      return MaterialStatusBadgeTone.draft;
  }
}

String? _pickupText(LearnerReservation reservation) {
  if (!reservation.isAccepted || reservation.pickupWindowStart == null) {
    return null;
  }

  final start = _formatDateTime(reservation.pickupWindowStart!);
  final end = reservation.pickupWindowEnd == null
      ? null
      : _formatDateTime(reservation.pickupWindowEnd!);

  return end == null ? 'Pickup starts $start' : 'Pickup window: $start - $end';
}

String? _secondaryText(LearnerReservation reservation) {
  if (reservation.isPending) {
    return 'Reservation request sent. Waiting for supplier response.';
  }

  if (reservation.isAccepted) {
    return reservation.supplierNote?.trim().isNotEmpty == true
        ? reservation.supplierNote
        : 'Reservation accepted. Follow the pickup window from the supplier.';
  }

  if (reservation.isRejected) {
    return reservation.rejectionReason?.trim().isNotEmpty == true
        ? reservation.rejectionReason
        : 'The supplier rejected this reservation request.';
  }

  if (reservation.isCompleted) {
    return 'This reservation is completed.';
  }

  if (reservation.isCancelled) {
    return 'This reservation was cancelled.';
  }

  if (reservation.isExpired) {
    return 'This reservation expired.';
  }

  return null;
}

String _formatDate(DateTime value) {
  return '${value.year}-${_two(value.month)}-${_two(value.day)}';
}

String _formatDateTime(DateTime value) {
  return '${_formatDate(value)} ${_two(value.hour)}:${_two(value.minute)}';
}

String _two(int value) => value.toString().padLeft(2, '0');
