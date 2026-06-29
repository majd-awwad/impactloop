import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../deliveries/application/delivery_request_controller.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/data/models/request_delivery_request.dart';
import '../../application/my_reservations_provider.dart';
import '../../application/reservation_cancel_controller.dart';
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
                padding: appMobileAwareScrollPadding(context),
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
    final deliveriesAsync = ref.watch(learnerDeliveriesProvider);
    final deliveriesByReservationId = deliveriesAsync.maybeWhen(
      data: _latestDeliveryByReservationId,
      orElse: () => const <String, LearnerDelivery>{},
    );
    final deliveryStateUnavailable = deliveriesAsync.hasError;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _PageHeader(),
        const SizedBox(height: AppSpacing.lg),
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
                onAction: () => context.go('/materials'),
              );
            }

            return Column(
              children: reservations
                  .map(
                    (reservation) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _ReservationCard(
                        reservation: reservation,
                        delivery: deliveriesByReservationId[reservation.id],
                        deliveryStateUnavailable: deliveryStateUnavailable,
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
  const _ReservationCard({
    required this.reservation,
    required this.delivery,
    required this.deliveryStateUnavailable,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final bool deliveryStateUnavailable;

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
          final details = _ReservationDetails(
            reservation: reservation,
            delivery: delivery,
            deliveryStateUnavailable: deliveryStateUnavailable,
          );

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

class _ReservationDetails extends ConsumerWidget {
  const _ReservationDetails({
    required this.reservation,
    required this.delivery,
    required this.deliveryStateUnavailable,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final bool deliveryStateUnavailable;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final pickupText = _pickupText(reservation);
    final secondaryText = _secondaryText(reservation);
    final requestState = ref.watch(deliveryRequestControllerProvider);
    final cancelState = ref.watch(reservationCancelControllerProvider);
    final cancellingId = ref.watch(cancellingReservationIdProvider);
    final activeDelivery = delivery?.isActive == true ? delivery : null;
    final isCancelling = cancellingId == reservation.id;

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
            if (delivery != null)
              MaterialStatusBadge(
                label: _deliveryStatusLabel(delivery!.status),
                tone: _deliveryStatusTone(delivery!.status),
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
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Requested: ${_formatQuantity(reservation.quantityRequested)} ${reservation.material.unit}',
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textPrimary),
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
        if (reservation.shouldShowSelfPickupAddress(hasDeliveryRecord: delivery != null)) ...[
          const SizedBox(height: AppSpacing.md),
          _PickupAddressSection(location: reservation.pickupLocationFull!),
        ],
        if (reservation.isAccepted) ...[
          const SizedBox(height: AppSpacing.md),
          _AcceptedDeliveryPanel(
            reservation: reservation,
            activeDelivery: activeDelivery,
            deliveryStateUnavailable: deliveryStateUnavailable,
            isSubmitting: requestState.isLoading,
            onRequestDelivery: () => _requestDelivery(context, ref),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            if (reservation.isPending)
              TextButton.icon(
                onPressed: isCancelling || cancelState.isLoading
                    ? null
                    : () => _confirmCancel(context, ref),
                icon: isCancelling
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cancel_outlined),
                label: const Text('Cancel request'),
              ),
            TextButton.icon(
              onPressed: () =>
                  context.go('/materials/${reservation.material.id}'),
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('View material'),
            ),
            if (delivery != null)
              TextButton.icon(
                onPressed: () => context.go('/learner/deliveries/${delivery!.id}'),
                icon: const Icon(Icons.local_shipping_outlined),
                label: const Text('View delivery'),
              ),
          ],
        ),
      ],
    );
  }

  Future<void> _requestDelivery(BuildContext context, WidgetRef ref) async {
    final request = await showDialog<RequestDeliveryRequest>(
      context: context,
      builder: (context) => _RequestDeliveryDialog(reservation: reservation),
    );

    if (request == null || !context.mounted) {
      return;
    }

    try {
      final delivery = await ref
          .read(deliveryRequestControllerProvider.notifier)
          .requestDelivery(reservationId: reservation.id, request: request);

      ref.invalidate(myReservationsProvider);
      ref.invalidate(learnerDeliveriesProvider);
      ref.invalidate(learnerDeliveryProvider(delivery.id));

      if (!context.mounted) {
        return;
      }

      showInfoSnackBar(context, 'Delivery requested. Waiting for a driver.');
    } on ApiException catch (error) {
      ref.invalidate(myReservationsProvider);
      ref.invalidate(learnerDeliveriesProvider);

      if (!context.mounted) {
        return;
      }

      final message = error.statusCode == 409
          ? 'Delivery is no longer available for this reservation. Refreshed your reservations.'
          : error.displayMessage;
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!context.mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    }
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel reservation?'),
        content: const Text(
          'This will release the requested quantity back to the listing.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep request'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) {
      return;
    }

    ref
        .read(cancellingReservationIdProvider.notifier)
        .setCancelling(reservation.id);

    try {
      await ref
          .read(reservationCancelControllerProvider.notifier)
          .cancel(reservation.id);
      ref.invalidate(myReservationsProvider);
      ref.invalidate(learnerDeliveriesProvider);
      ref.invalidate(homeSuggestedMaterialsProvider);

      if (!context.mounted) {
        return;
      }

      showInfoSnackBar(context, 'Reservation cancelled.');
    } on ApiException catch (error) {
      if (!context.mounted) {
        return;
      }

      showInfoSnackBar(context, error.displayMessage);
    } catch (error) {
      if (!context.mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    } finally {
      ref.read(cancellingReservationIdProvider.notifier).setCancelling(null);
    }
  }
}

class _PickupAddressSection extends StatelessWidget {
  const _PickupAddressSection({required this.location});

  final LearnerReservationPickupLocation location;

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
          Row(
            children: [
              Icon(Icons.place_outlined, color: palette.mint),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Pickup address',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            location.formattedAddress,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _AcceptedDeliveryPanel extends StatelessWidget {
  const _AcceptedDeliveryPanel({
    required this.reservation,
    required this.activeDelivery,
    required this.deliveryStateUnavailable,
    required this.isSubmitting,
    required this.onRequestDelivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? activeDelivery;
  final bool deliveryStateUnavailable;
  final bool isSubmitting;
  final VoidCallback onRequestDelivery;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    if (activeDelivery != null) {
      return _InlineInfoPanel(
        icon: Icons.local_shipping_outlined,
        title: _deliveryStatusLabel(activeDelivery!.status),
        body: _deliveryStatusDescription(activeDelivery!),
        action: TextButton.icon(
          onPressed: () =>
              context.go('/learner/deliveries/${activeDelivery!.id}'),
          icon: const Icon(Icons.route_outlined),
          label: const Text('Open delivery status'),
        ),
      );
    }

    if (!reservation.material.deliveryAllowed) {
      return const _InlineInfoPanel(
        icon: Icons.storefront_outlined,
        title: 'Pickup only',
        body:
            'This material is not enabled for internal delivery. Use the pickup window and supplier note above.',
      );
    }

    if (deliveryStateUnavailable) {
      return const _InlineInfoPanel(
        icon: Icons.sync_problem_outlined,
        title: 'Delivery status unavailable',
        body:
            'Refresh delivery status before requesting delivery for this reservation.',
      );
    }

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
          Row(
            children: [
              Icon(Icons.local_shipping_outlined, color: palette.mint),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Internal delivery available',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Share a clear dropoff address and the internal team will assign a driver.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: isSubmitting ? null : onRequestDelivery,
            icon: isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_location_alt_outlined),
            label: Text(isSubmitting ? 'Requesting...' : 'Request delivery'),
          ),
        ],
      ),
    );
  }
}

class _InlineInfoPanel extends StatelessWidget {
  const _InlineInfoPanel({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

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
          Row(
            children: [
              Icon(icon, color: palette.mint),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.sm),
            action!,
          ],
        ],
      ),
    );
  }
}

class _RequestDeliveryDialog extends StatefulWidget {
  const _RequestDeliveryDialog({required this.reservation});

  final LearnerReservation reservation;

  @override
  State<_RequestDeliveryDialog> createState() => _RequestDeliveryDialogState();
}

class _RequestDeliveryDialogState extends State<_RequestDeliveryDialog> {
  final _formKey = GlobalKey<FormState>();
  final _countryController = TextEditingController(text: 'Palestine');
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _addressController = TextEditingController();
  final _noteController = TextEditingController();

  @override
  void dispose() {
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Request delivery'),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.reservation.material.title,
                  style: AppTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _countryController,
                  label: 'Country',
                  textInputAction: TextInputAction.next,
                  validator: _required,
                ),
                const AppFieldGap(),
                AppTextField(
                  controller: _cityController,
                  label: 'City',
                  hint: 'Ramallah',
                  textInputAction: TextInputAction.next,
                  validator: _required,
                ),
                const AppFieldGap(),
                AppTextField(
                  controller: _areaController,
                  label: 'Area',
                  hint: 'Neighborhood, campus, or landmark',
                  textInputAction: TextInputAction.next,
                ),
                const AppFieldGap(),
                AppTextArea(
                  controller: _addressController,
                  label: 'Dropoff details',
                  hint: 'Street, building, floor, entrance, or meeting point',
                  validator: _required,
                  minLines: 3,
                  maxLines: 4,
                ),
                const AppFieldGap(),
                AppTextArea(
                  controller: _noteController,
                  label: 'Note for delivery team',
                  hint: 'Optional contact or access instructions',
                  minLines: 2,
                  maxLines: 3,
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.local_shipping_outlined),
          label: const Text('Submit request'),
        ),
      ],
    );
  }

  void _submit() {
    if (_formKey.currentState?.validate() != true) {
      return;
    }

    Navigator.of(context).pop(
      RequestDeliveryRequest(
        dropoffLocation: DeliveryLocationInput(
          country: _countryController.text.trim(),
          city: _cityController.text.trim(),
          area: _areaController.text.trim(),
          addressLine: _addressController.text.trim(),
        ),
        learnerNote: _noteController.text.trim(),
      ),
    );
  }

  String? _required(String? value) {
    return value == null || value.trim().isEmpty ? 'Required' : null;
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

String _deliveryStatusLabel(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
      return 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
      return 'Driver assigned';
    case 'ARRIVED_PICKUP':
      return 'Driver at pickup';
    case 'PICKED_UP':
      return 'Picked up';
    case 'ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED_DROPOFF':
      return 'Arrived at dropoff';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Delivery cancelled';
    case 'FAILED_PICKUP':
      return 'Pickup failed';
    case 'FAILED_DELIVERY':
      return 'Delivery failed';
    default:
      return status;
  }
}

MaterialStatusBadgeTone _deliveryStatusTone(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED_PICKUP':
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
      return MaterialStatusBadgeTone.reserved;
    case 'DELIVERED':
      return MaterialStatusBadgeTone.reused;
    case 'CANCELLED':
    case 'FAILED_PICKUP':
    case 'FAILED_DELIVERY':
    default:
      return MaterialStatusBadgeTone.draft;
  }
}

String _deliveryStatusDescription(LearnerDelivery delivery) {
  switch (delivery.status) {
    case 'WAITING_FOR_DRIVER':
      return 'Your request is queued for an internal driver.';
    case 'DRIVER_ASSIGNED':
      return 'An internal driver has accepted this delivery.';
    case 'ARRIVED_PICKUP':
      return 'The driver is at the supplier pickup location.';
    case 'PICKED_UP':
      return 'The driver picked up the material.';
    case 'ON_THE_WAY':
      return 'The material is on the way to your dropoff location.';
    case 'ARRIVED_DROPOFF':
      return 'The driver has arrived at your dropoff location.';
    case 'DELIVERED':
      return 'Delivery is complete.';
    case 'CANCELLED':
      return 'This delivery was cancelled.';
    case 'FAILED_PICKUP':
      return delivery.failureReason?.trim().isNotEmpty == true
          ? delivery.failureReason!
          : 'The pickup could not be completed.';
    case 'FAILED_DELIVERY':
      return delivery.failureReason?.trim().isNotEmpty == true
          ? delivery.failureReason!
          : 'The delivery could not be completed.';
    default:
      return 'Delivery status updated.';
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

String _formatQuantity(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toString();
}
