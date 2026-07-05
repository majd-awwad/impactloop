import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../data/models/driver_delivery.dart';

class DriverJobsPage extends ConsumerWidget {
  const DriverJobsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeAsync = ref.watch(activeDriverDeliveriesProvider);
    final availableAsync = ref.watch(availableDriverDeliveriesProvider);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _JobsHeader(),
              const SizedBox(height: AppSpacing.lg),
              activeAsync.when(
                loading: () => const _StatePanel(
                  icon: Icons.route_outlined,
                  title: 'Checking active delivery',
                  subtitle: 'Loading your assigned delivery.',
                ),
                error: (_, _) => _StatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Could not load active delivery',
                  subtitle: 'Refresh before accepting a new job.',
                  actionLabel: 'Retry',
                  onAction: () =>
                      ref.invalidate(activeDriverDeliveriesProvider),
                ),
                data: (deliveries) {
                  final activeDelivery = deliveries.isEmpty
                      ? null
                      : deliveries.first;
                  return _ActiveDeliveryPanel(delivery: activeDelivery);
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              activeAsync.maybeWhen(
                data: (activeDeliveries) => availableAsync.when(
                  loading: () => const _StatePanel(
                    icon: Icons.inventory_2_outlined,
                    title: 'Loading available jobs',
                    subtitle: 'Looking for waiting delivery requests.',
                  ),
                  error: (_, _) => _StatePanel(
                    icon: Icons.cloud_off_outlined,
                    title: 'Could not load jobs',
                    subtitle: 'Please try again.',
                    actionLabel: 'Retry',
                    onAction: () =>
                        ref.invalidate(availableDriverDeliveriesProvider),
                  ),
                  data: (deliveries) => _AvailableJobsList(
                    deliveries: deliveries,
                    hasActiveDelivery: activeDeliveries.isNotEmpty,
                  ),
                ),
                orElse: () => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _JobsHeader extends StatelessWidget {
  const _JobsHeader();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Driver jobs',
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Accept internal delivery jobs and move assigned deliveries through the required status order.',
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _ActiveDeliveryPanel extends StatelessWidget {
  const _ActiveDeliveryPanel({required this.delivery});

  final DriverDelivery? delivery;

  @override
  Widget build(BuildContext context) {
    if (delivery == null) {
      return const _StatePanel(
        icon: Icons.check_circle_outline,
        title: 'No active delivery',
        subtitle: 'You can accept one available job when you are available.',
      );
    }

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Active delivery',
                  style: AppTextStyles.title(context),
                ),
              ),
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery!.status),
                tone: deliveryStatusTone(delivery!.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(delivery!.material.title, style: AppTextStyles.label(context)),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${delivery!.pickupLocation.exactSummary} - ${delivery!.dropoffLocation.exactSummary}',
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: () => context.push('/driver/deliveries/${delivery!.id}'),
            icon: const Icon(Icons.route_outlined),
            label: const Text('Open active delivery'),
          ),
        ],
      ),
    );
  }
}

class _AvailableJobsList extends StatelessWidget {
  const _AvailableJobsList({
    required this.deliveries,
    required this.hasActiveDelivery,
  });

  final List<DriverDelivery> deliveries;
  final bool hasActiveDelivery;

  @override
  Widget build(BuildContext context) {
    if (deliveries.isEmpty) {
      return const _StatePanel(
        icon: Icons.local_shipping_outlined,
        title: 'No available jobs',
        subtitle: 'Waiting delivery requests will appear here.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Available jobs', style: AppTextStyles.title(context)),
        if (hasActiveDelivery) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Finish your active delivery before accepting another job.',
            style: AppTextStyles.body(context),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        for (final delivery in deliveries) ...[
          _AvailableJobCard(
            delivery: delivery,
            acceptDisabled: hasActiveDelivery,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _AvailableJobCard extends ConsumerWidget {
  const _AvailableJobCard({
    required this.delivery,
    required this.acceptDisabled,
  });

  final DriverDelivery delivery;
  final bool acceptDisabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final actionState = ref.watch(driverDeliveryActionControllerProvider);
    final isSubmitting = actionState.isLoading;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      delivery.material.title,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${delivery.material.quantityLabel} - Supplier: ${delivery.supplier.displayName}',
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery.status),
                tone: deliveryStatusTone(delivery.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoGrid(
            items: [
              _InfoItem('Pickup area', delivery.pickupLocation.safeSummary),
              _InfoItem('Dropoff area', delivery.dropoffLocation.safeSummary),
              _InfoItem('Pickup window', _pickupWindowText(delivery)),
              _InfoItem('Requested', _formatDateTime(delivery.requestedAt)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: FilledButton.icon(
              onPressed: acceptDisabled || isSubmitting
                  ? null
                  : () => _acceptDelivery(context, ref),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.assignment_turned_in_outlined),
              label: Text(isSubmitting ? 'Accepting...' : 'Accept job'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _acceptDelivery(BuildContext context, WidgetRef ref) async {
    try {
      final assigned = await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .acceptDelivery(delivery.id);

      if (!context.mounted) {
        return;
      }

      showInfoSnackBar(context, 'Delivery accepted.');
      context.push('/driver/deliveries/${assigned.id}');
    } on ApiException catch (error) {
      ref.invalidate(availableDriverDeliveriesProvider);
      ref.invalidate(activeDriverDeliveriesProvider);

      if (!context.mounted) {
        return;
      }

      final message = error.statusCode == 409
          ? _driverConflictMessage(error.message)
          : error.displayMessage;
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!context.mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    }
  }
}

String _driverConflictMessage(String message) {
  final lower = message.toLowerCase();
  if (lower.contains('active delivery')) {
    return 'You already have an active delivery.';
  }
  if (lower.contains('not available') || lower.contains('must be available')) {
    return message;
  }

  return 'This delivery is no longer available.';
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

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
      child: child,
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

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: palette.mint),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.items});

  final List<_InfoItem> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 720 ? 2 : 1;
        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final item in items)
              SizedBox(
                width: columns == 1
                    ? constraints.maxWidth
                    : (constraints.maxWidth - AppSpacing.md) / 2,
                child: _InfoTile(item: item),
              ),
          ],
        );
      },
    );
  }
}

class _InfoItem {
  const _InfoItem(this.label, this.value);

  final String label;
  final String value;
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.item});

  final _InfoItem item;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
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
            item.label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.value,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
      ),
    );
  }
}

String _pickupWindowText(DriverDelivery delivery) {
  final start = delivery.pickupWindowStart;
  final end = delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return 'Not set';
  }

  if (start != null && end != null) {
    return '${_formatDateTime(start)} - ${_formatDateTime(end)}';
  }

  return _formatDateTime(start ?? end!);
}

String _formatDateTime(DateTime dateTime) {
  final local = dateTime.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}-$month-$day $hour:$minute';
}
