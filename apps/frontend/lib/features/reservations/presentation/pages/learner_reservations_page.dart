import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../application/my_reservations_provider.dart';
import '../../application/reservation_cancel_controller.dart';
import '../../data/reservations_repository.dart';
import '../../data/models/learner_reservation.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../learner_reservation_ui_helpers.dart';
import '../widgets/learner_awaiting_confirmation_panel.dart';
import '../widgets/learner_reservation_messages_panel.dart';

const _learnerReservationsMaxWidth = 920.0;
const _cancelDialogMaxWidth = 440.0;
const _desktopReservationActionsWidth = 140.0;
const _desktopCardPadding = 18.0;
const _reservationMediaSizeDesktop = 96.0;
const _reservationMediaSizeMobile = 72.0;
const _desktopCardMinHeight = 132.0;

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
        const _PageHeader(),
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
                onAction: () => context.go('/materials'),
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
                onAction: () => context.go('/materials'),
              );
            }

            return Column(
              children: filtered
                  .map(
                    (reservation) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _ReservationCard(
                        reservation: reservation,
                        delivery: deliveriesByReservationId[reservation.id],
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
          style: (compact
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
  const _StatusFilterChips({
    required this.selected,
    required this.onSelected,
  });

  final LearnerReservationStatusFilter selected;
  final ValueChanged<LearnerReservationStatusFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: LearnerReservationStatusFilter.values.map((filter) {
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
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

class _ReservationCard extends ConsumerWidget {
  const _ReservationCard({
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final statusStyle = LearnerReservationStatusStyle.forStatus(
      context,
      reservation.status,
    );
    final compact = MediaQuery.sizeOf(context).width < 720;
    final userId = ref.watch(authControllerProvider).user?.id ?? '';

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.textPrimary.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              color: statusStyle.accentColor,
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsetsDirectional.all(
                  compact ? AppSpacing.md : _desktopCardPadding,
                ),
                child: compact
                    ? _ReservationCardMobileLayout(
                        reservation: reservation,
                        delivery: delivery,
                        statusStyle: statusStyle,
                        currentUserId: userId,
                      )
                    : _ReservationCardDesktopLayout(
                        reservation: reservation,
                        delivery: delivery,
                        statusStyle: statusStyle,
                        currentUserId: userId,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationCardDesktopLayout extends StatelessWidget {
  const _ReservationCardDesktopLayout({
    required this.reservation,
    required this.delivery,
    required this.statusStyle,
    required this.currentUserId,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationStatusStyle statusStyle;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    final showPickupInfo = shouldShowAcceptedPickupInfo(reservation);

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: _desktopCardMinHeight),
      child: Row(
        crossAxisAlignment:
            showPickupInfo ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          _ReservationMediaTile(
            reservation: reservation,
            isMobile: false,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: _ReservationCardSummary(
              reservation: reservation,
              delivery: delivery,
              statusStyle: statusStyle,
              currentUserId: currentUserId,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          _ReservationCardActions(
            reservation: reservation,
            delivery: delivery,
            desktopColumn: true,
            alignTop: showPickupInfo,
          ),
        ],
      ),
    );
  }
}

class _ReservationCardMobileLayout extends StatelessWidget {
  const _ReservationCardMobileLayout({
    required this.reservation,
    required this.delivery,
    required this.statusStyle,
    required this.currentUserId,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationStatusStyle statusStyle;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ReservationStatusRow(
          reservation: reservation,
          delivery: delivery,
          statusStyle: statusStyle,
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ReservationMediaTile(
              reservation: reservation,
              isMobile: true,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _ReservationCardSummaryLines(
                reservation: reservation,
                delivery: delivery,
                currentUserId: currentUserId,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        _ReservationCardActions(
          reservation: reservation,
          delivery: delivery,
        ),
      ],
    );
  }
}

class _ReservationMediaTile extends StatefulWidget {
  const _ReservationMediaTile({
    required this.reservation,
    required this.isMobile,
  });

  final LearnerReservation reservation;
  final bool isMobile;

  @override
  State<_ReservationMediaTile> createState() => _ReservationMediaTileState();
}

class _ReservationMediaTileState extends State<_ReservationMediaTile> {
  bool _imageFailed = false;

  @override
  void didUpdateWidget(covariant _ReservationMediaTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reservation.material.imageUrl !=
        widget.reservation.material.imageUrl) {
      _imageFailed = false;
    }
  }

  bool get _hasImage {
    final url = widget.reservation.material.imageUrl?.trim();
    return url != null && url.isNotEmpty && !_imageFailed;
  }

  double get _size =>
      widget.isMobile ? _reservationMediaSizeMobile : _reservationMediaSizeDesktop;

  Widget _placeholderTile(AppThemeColors colors) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.successSoft.withValues(alpha: 0.55),
        borderRadius: AppRadius.mdAll,
      ),
      child: Icon(
        Icons.inventory_2_outlined,
        size: widget.isMobile ? 28 : 32,
        color: colors.success.withValues(alpha: 0.55),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return SizedBox(
      width: _size,
      height: _size,
      child: ClipRRect(
        borderRadius: AppRadius.mdAll,
        child: _hasImage
            ? Image.network(
                widget.reservation.material.imageUrl!.trim(),
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && !_imageFailed) {
                      setState(() => _imageFailed = true);
                    }
                  });
                  return _placeholderTile(colors);
                },
              )
            : _placeholderTile(colors),
      ),
    );
  }
}

class _ReservationStatusChip extends StatelessWidget {
  const _ReservationStatusChip({
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 10,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: foreground,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _ReservationStatusRow extends StatelessWidget {
  const _ReservationStatusRow({
    required this.reservation,
    required this.delivery,
    required this.statusStyle,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationStatusStyle statusStyle;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final deliveryStyle = delivery == null
        ? null
        : _deliveryStatusStyle(context, delivery!.status);

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _ReservationStatusChip(
          label: learnerDeliveryPrimaryStatusLabel(
                reservationStatus: reservation.status,
                fulfillmentMethod: reservation.fulfillmentMethod,
                deliveryStatus: delivery?.status,
              ) ??
              reservationStatusLabel(
                reservation.status,
                fulfillmentMethod: reservation.fulfillmentMethod,
                deliveryStatus: delivery?.status,
                pickupWindowEnd: reservation.pickupWindowEnd,
              ),
          background: statusStyle.chipBackground,
          foreground: statusStyle.chipForeground,
          border: statusStyle.chipBorder,
        ),
        if (learnerDeliverySecondaryStatusLabel(
              reservationStatus: reservation.status,
              fulfillmentMethod: reservation.fulfillmentMethod,
              deliveryStatus: delivery?.status,
            )
            case final secondaryLabel?)
          _ReservationStatusChip(
            label: secondaryLabel,
            background: deliveryStyle?.background ?? statusStyle.chipBackground,
            foreground: deliveryStyle?.foreground ?? statusStyle.chipForeground,
            border: deliveryStyle?.border ?? statusStyle.chipBorder,
          )
        else if (deliveryStyle != null)
          _ReservationStatusChip(
            label: deliveryStatusLabel(delivery!.status),
            background: deliveryStyle.background,
            foreground: deliveryStyle.foreground,
            border: deliveryStyle.border,
          ),
        Text(
          formatReservationDate(reservation.createdAt),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}

class _DeliveryStatusChipStyle {
  const _DeliveryStatusChipStyle({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}

_DeliveryStatusChipStyle _deliveryStatusStyle(BuildContext context, String status) {
  final colors = AppThemeColors.of(context);

  switch (status) {
    case 'DELIVERED':
      return _DeliveryStatusChipStyle(
        background: colors.successSoft,
        foreground: colors.success,
        border: colors.success.withValues(alpha: 0.35),
      );
    case 'CANCELLED':
    case 'FAILED_PICKUP':
    case 'FAILED_DELIVERY':
      return _DeliveryStatusChipStyle(
        background: colors.dangerSoft,
        foreground: colors.danger,
        border: colors.danger.withValues(alpha: 0.35),
      );
    default:
      return _DeliveryStatusChipStyle(
        background: colors.warningSoft,
        foreground: colors.warningText,
        border: colors.warningBorder,
      );
  }
}

class _AcceptedPickupInfoBlock extends StatelessWidget {
  const _AcceptedPickupInfoBlock({
    required this.reservation,
    required this.hasDeliveryRecord,
  });

  final LearnerReservation reservation;
  final bool hasDeliveryRecord;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pickupWindow = formatPickupWindow(reservation);
    final pickupAddress = formatPickupAddress(reservation);
    final deliveryAvailability = formatDeliveryAvailability(
      reservation,
      hasDeliveryRecord: hasDeliveryRecord,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: AppRadius.smAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pickupWindow != null)
            _AcceptedPickupInfoRow(
              icon: Icons.schedule_outlined,
              label: pickupWindow,
            ),
          if (pickupAddress != null) ...[
            if (pickupWindow != null) const SizedBox(height: AppSpacing.xs),
            _AcceptedPickupInfoRow(
              icon: Icons.location_on_outlined,
              label: 'Pickup address: $pickupAddress',
            ),
          ],
          if (pickupWindow != null || pickupAddress != null)
            const SizedBox(height: AppSpacing.xs),
          _AcceptedPickupInfoRow(
            icon: Icons.local_shipping_outlined,
            label: deliveryAvailability,
          ),
          if (reservation.shouldShowSelfPickupCode) ...[
            const SizedBox(height: AppSpacing.sm),
            HandoverConfirmationCodePanel(
              code: reservation.selfPickupCode!,
              instructions:
                  'Give this code to the supplier when you receive the material.',
            ),
          ],
          if (reservation.shouldShowLearnerDeliveryCode) ...[
            const SizedBox(height: AppSpacing.sm),
            HandoverConfirmationCodePanel(
              code: reservation.activeDelivery!.learnerDeliveryCode!,
              instructions:
                  'Give this code to the driver when you receive the material.',
            ),
          ],
        ],
      ),
    );
  }
}

class _AcceptedPickupInfoRow extends StatelessWidget {
  const _AcceptedPickupInfoRow({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _OverdueWarningBanner extends StatelessWidget {
  const _OverdueWarningBanner();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: colors.warningBorder),
      ),
      child: Text(
        'Pickup window passed. Please contact the supplier or wait for follow-up.',
        style: AppTextStyles.label(context).copyWith(
          color: colors.warningText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ReservationCardSummary extends StatelessWidget {
  const _ReservationCardSummary({
    required this.reservation,
    required this.delivery,
    required this.statusStyle,
    required this.currentUserId,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationStatusStyle statusStyle;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ReservationStatusRow(
          reservation: reservation,
          delivery: delivery,
          statusStyle: statusStyle,
        ),
        const SizedBox(height: AppSpacing.sm),
        _ReservationCardSummaryLines(
          reservation: reservation,
          delivery: delivery,
          currentUserId: currentUserId,
        ),
      ],
    );
  }
}

class _ReservationCardSummaryLines extends StatelessWidget {
  const _ReservationCardSummaryLines({
    required this.reservation,
    required this.delivery,
    required this.currentUserId,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final statusMessage = reservationStatusMessage(reservation);
    final showPickupInfo = shouldShowAcceptedPickupInfo(reservation);
    final showFollowUpMessages =
        reservation.isAccepted &&
        (reservation.canSendMessage || reservation.latestMessage != null);
    final showAwaitingConfirmation = reservation.isAwaitingConfirmation;
    final compact = MediaQuery.sizeOf(context).width < 720;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          reservation.material.title,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: compact ? 16 : 17,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '${reservation.material.materialType} · ${reservation.material.locationLabel}',
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted, fontWeight: FontWeight.w400),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          formatSupplierQuantityLine(reservation),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w400),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Fulfillment: ${formatFulfillmentMethodLabel(reservation)}',
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w400),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (formatPreferredWindowsSummary(reservation) case final preferredWindows?) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            preferredWindows,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w400),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (formatDeliveryAddressSummary(reservation) case final deliveryAddress?) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            deliveryAddress,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w400),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (formatSafeDropoffSummary(reservation) case final safeDropoff?) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            safeDropoff,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted, fontWeight: FontWeight.w400),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (statusMessage != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            statusMessage,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w400),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (showAwaitingConfirmation) ...[
          const SizedBox(height: 12),
          LearnerAwaitingConfirmationPanel(reservation: reservation),
        ],
        if (showPickupInfo) ...[
          if (reservation.isOverdue) ...[
            const SizedBox(height: 12),
            const _OverdueWarningBanner(),
          ],
          const SizedBox(height: 12),
          _AcceptedPickupInfoBlock(
            reservation: reservation,
            hasDeliveryRecord: delivery != null,
          ),
        ],
        if (showFollowUpMessages && currentUserId.isNotEmpty) ...[
          const SizedBox(height: 12),
          LearnerReservationMessagesPanel(
            reservationId: reservation.id,
            canSendMessage: reservation.canSendMessage,
            currentUserId: currentUserId,
          ),
        ],
        if (reservation.canLearnerReschedule) ...[
          const SizedBox(height: 12),
          _LearnerRequestRescheduleButton(reservation: reservation),
        ],
        if (reservation.canLearnerReportSupplier) ...[
          const SizedBox(height: 12),
          _LearnerReportSupplierButton(reservation: reservation),
        ],
        if (reservation.canReportNoDriverAvailable) ...[
          const SizedBox(height: 12),
          _LearnerReportNoDriverButton(reservation: reservation),
        ],
        if (reservation.isAwaitingSupplierConfirmation &&
            reservation.pendingRescheduleReason?.trim().isNotEmpty == true) ...[
          const SizedBox(height: 12),
          Text(
            'Your reschedule request: ${reservation.pendingRescheduleReason!.trim()}',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}

class _ReservationCardActions extends ConsumerWidget {
  const _ReservationCardActions({
    required this.reservation,
    required this.delivery,
    this.desktopColumn = false,
    this.alignTop = false,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final bool desktopColumn;
  final bool alignTop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cancelState = ref.watch(reservationCancelControllerProvider);
    final cancellingId = ref.watch(cancellingReservationIdProvider);
    final isCancelling = cancellingId == reservation.id;

    final viewMaterial = _ReservationActionButton(
      label: 'View material',
      onPressed: () => context.go('/materials/${reservation.material.id}'),
      desktopRail: desktopColumn,
    );

    final viewDelivery = _resolveDeliveryAction(
      reservation: reservation,
      delivery: delivery,
      desktopColumn: desktopColumn,
      onNavigate: (deliveryId) => context.go('/learner/deliveries/$deliveryId'),
    );

    final cancelRequest = reservation.isPending
        ? _ReservationActionButton(
            label: 'Cancel request',
            onPressed: isCancelling || cancelState.isLoading
                ? null
                : () => _confirmCancel(context, ref),
            desktopRail: desktopColumn,
            loading: isCancelling,
            danger: true,
          )
        : null;

    if (desktopColumn) {
      final rail = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          viewMaterial,
          if (viewDelivery != null) ...[
            const SizedBox(height: AppSpacing.xs),
            viewDelivery,
          ],
          if (cancelRequest != null) ...[
            const SizedBox(height: AppSpacing.xs),
            cancelRequest,
          ],
        ],
      );

      return SizedBox(
        width: _desktopReservationActionsWidth,
        child: alignTop
            ? rail
            : Align(alignment: Alignment.center, child: rail),
      );
    }

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        viewMaterial,
        ?viewDelivery,
        ?cancelRequest,
      ],
    );
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => _CancelReservationDialog(
        reservation: reservation,
        onKeep: () => Navigator.of(dialogContext).pop(false),
        onCancel: () => Navigator.of(dialogContext).pop(true),
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

_ReservationActionButton? _resolveDeliveryAction({
  required LearnerReservation reservation,
  required LearnerDelivery? delivery,
  required bool desktopColumn,
  required ValueChanged<String> onNavigate,
}) {
  final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
  if (deliveryId == null) {
    return null;
  }

  return _ReservationActionButton(
    label: 'View delivery',
    onPressed: () => onNavigate(deliveryId),
    desktopRail: desktopColumn,
  );
}

class _ReservationActionButton extends StatelessWidget {
  const _ReservationActionButton({
    required this.label,
    required this.onPressed,
    this.desktopRail = false,
    this.loading = false,
    this.danger = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool desktopRail;
  final bool loading;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (desktopRail) {
      if (danger) {
        return SizedBox(
          height: 34,
          child: TextButton(
            onPressed: onPressed,
            style: TextButton.styleFrom(
              foregroundColor: colors.danger,
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            child: loading
                ? SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.danger,
                    ),
                  )
                : Text(label),
          ),
        );
      }

      return SizedBox(
        height: 36,
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.success,
            side: BorderSide(color: colors.success.withValues(alpha: 0.45)),
            padding: const EdgeInsetsDirectional.symmetric(horizontal: 8),
            textStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          child: Text(label),
        ),
      );
    }

    if (danger) {
      return OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.danger,
          side: BorderSide(color: colors.danger.withValues(alpha: 0.4)),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
        ),
        child: loading
            ? SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.danger,
                ),
              )
            : Text(label),
      );
    }

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.success,
        side: BorderSide(color: colors.success.withValues(alpha: 0.45)),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      child: Text(label),
    );
  }
}

class _CancelReservationDialog extends StatefulWidget {
  const _CancelReservationDialog({
    required this.reservation,
    required this.onKeep,
    required this.onCancel,
  });

  final LearnerReservation reservation;
  final VoidCallback onKeep;
  final VoidCallback onCancel;

  @override
  State<_CancelReservationDialog> createState() =>
      _CancelReservationDialogState();
}

class _CancelReservationDialogState extends State<_CancelReservationDialog> {
  var _isSubmitting = false;

  void _handleCancel() {
    if (_isSubmitting) {
      return;
    }
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
        isNarrow ? screenSize.width * 0.92 : _cancelDialogMaxWidth;

    final keepButton = OutlinedButton(
      onPressed: _isSubmitting ? null : widget.onKeep,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
        ),
        side: BorderSide(color: palette.borderStrong),
        foregroundColor: palette.textSecondary,
      ),
      child: const Text('Keep request'),
    );

    final cancelButton = FilledButton(
      onPressed: _isSubmitting ? null : _handleCancel,
      style: FilledButton.styleFrom(
        backgroundColor: colors.danger,
        foregroundColor: colors.textOnPrimary,
        minimumSize: const Size(0, 44),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
        ),
      ),
      child: _isSubmitting
          ? SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.textOnPrimary,
              ),
            )
          : const Text('Cancel request'),
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
                      'Cancel reservation?',
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _isSubmitting ? null : widget.onKeep,
                    tooltip: 'Close',
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
                    'This will release the requested quantity back to the listing.',
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
                          'Requested: ${formatRequestedQuantity(widget.reservation)}',
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

class _LearnerRequestRescheduleButton extends ConsumerStatefulWidget {
  const _LearnerRequestRescheduleButton({required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<_LearnerRequestRescheduleButton> createState() =>
      _LearnerRequestRescheduleButtonState();
}

class _LearnerRequestRescheduleButtonState
    extends ConsumerState<_LearnerRequestRescheduleButton> {
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
                initialDate: start ?? DateTime.now().add(const Duration(days: 1)),
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
                initialDate: end ?? start ?? DateTime.now().add(const Duration(days: 1)),
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

            return AlertDialog(
              title: const Text('Request reschedule'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: reasonController,
                      maxLength: 500,
                      decoration: const InputDecoration(
                        labelText: 'Reason (required)',
                      ),
                    ),
                    TextField(
                      controller: noteController,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        labelText: 'Note (optional)',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton(
                      onPressed: pickStart,
                      child: Text(
                        start == null
                            ? 'Pick proposed start'
                            : 'Start: ${start!.toLocal()}',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    OutlinedButton(
                      onPressed: pickEnd,
                      child: Text(
                        end == null
                            ? 'Pick proposed end'
                            : 'End: ${end!.toLocal()}',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (reasonController.text.trim().isEmpty ||
                        start == null ||
                        end == null ||
                        !end!.isAfter(start!)) {
                      return;
                    }
                    reason = reasonController.text.trim();
                    final rawNote = noteController.text.trim();
                    note = rawNote.isEmpty ? null : rawNote;
                    Navigator.of(dialogContext).pop(true);
                  },
                  child: const Text('Send request'),
                ),
              ],
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
      ref.invalidate(myReservationsProvider);
      if (!mounted) return;
      showInfoSnackBar(context, 'Reschedule request sent to supplier.');
    } on ApiException catch (error) {
      if (!mounted) return;
      showInfoSnackBar(context, error.displayMessage);
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton(
        onPressed: _submitting ? null : _submit,
        child: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Request reschedule'),
      ),
    );
  }
}

const _learnerSupplierReportReasons = <String, String>{
  'SUPPLIER_UNAVAILABLE': 'Supplier unavailable',
  'SUPPLIER_MATERIAL_NOT_READY': 'Material not ready',
  'WRONG_PICKUP_INFO': 'Wrong pickup information',
  'OTHER': 'Other',
};

class _LearnerReportSupplierButton extends ConsumerStatefulWidget {
  const _LearnerReportSupplierButton({required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<_LearnerReportSupplierButton> createState() =>
      _LearnerReportSupplierButtonState();
}

class _LearnerReportSupplierButtonState
    extends ConsumerState<_LearnerReportSupplierButton> {
  bool _submitting = false;

  Future<void> _submit() async {
    var selectedReason = 'SUPPLIER_UNAVAILABLE';
    final noteController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Report supplier issue'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Report a supplier issue for admin review. The reservation will be closed pending review.',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedReason,
                  decoration: const InputDecoration(labelText: 'Reason'),
                  items: _learnerSupplierReportReasons.entries
                      .map(
                        (entry) => DropdownMenuItem(
                          value: entry.key,
                          child: Text(entry.value),
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
                  decoration: const InputDecoration(
                    labelText: 'Note (optional)',
                    hintText: 'Describe what happened',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Submit report'),
            ),
          ],
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
      ref.invalidate(myReservationsProvider);
      if (!mounted) return;
      showInfoSnackBar(context, 'Supplier issue reported to admin.');
    } on ApiException catch (error) {
      if (!mounted) return;
      showInfoSnackBar(context, error.displayMessage);
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton(
        onPressed: _submitting ? null : _submit,
        child: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Report supplier issue'),
      ),
    );
  }
}

class _LearnerReportNoDriverButton extends ConsumerStatefulWidget {
  const _LearnerReportNoDriverButton({required this.reservation});

  final LearnerReservation reservation;

  @override
  ConsumerState<_LearnerReportNoDriverButton> createState() =>
      _LearnerReportNoDriverButtonState();
}

class _LearnerReportNoDriverButtonState
    extends ConsumerState<_LearnerReportNoDriverButton> {
  bool _submitting = false;

  Future<void> _submit() async {
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Report no driver available'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'No driver accepted this delivery. Submit a report for admin review.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              maxLength: 1000,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Note (required)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (noteController.text.trim().isEmpty) return;
              Navigator.of(context).pop(true);
            },
            child: const Text('Submit report'),
          ),
        ],
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
      ref.invalidate(myReservationsProvider);
      if (!mounted) return;
      showInfoSnackBar(context, 'No-driver case reported to admin.');
    } on ApiException catch (error) {
      if (!mounted) return;
      showInfoSnackBar(context, error.displayMessage);
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton(
        onPressed: _submitting ? null : _submit,
        child: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Report no driver available'),
      ),
    );
  }
}
