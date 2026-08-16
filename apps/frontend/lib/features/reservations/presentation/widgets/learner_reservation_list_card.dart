import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../application/learner_reservation_cache.dart';
import '../../application/reservation_cancel_controller.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_payment_presentation.dart';
import '../learner_reservation_ui_helpers.dart';

const _desktopThumbSize = 104.0;
const _mobileThumbSize = 88.0;
const _desktopActionsWidth = 168.0;
const _desktopMinHeightHistorical = 136.0;
const _desktopMinHeight = 176.0;

class LearnerReservationListCard extends ConsumerWidget {
  const LearnerReservationListCard({
    super.key,
    required this.reservation,
    required this.delivery,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final presentation = buildReservationCardPresentation(
      reservation,
      l10n: l10n,
      delivery: delivery,
    );

    final showAccent = presentation.showActionAccent;
    final style = AppStatusStyle.of(context, presentation.accentTone);
    final accentColor = showAccent
        ? style.foreground.withValues(alpha: 0.55)
        : null;

    return Container(
      key: Key('reservation-list-card-${reservation.id}'),
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
      child: Stack(
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 900;
              return Padding(
                padding: EdgeInsetsDirectional.all(compact ? AppSpacing.md : 20),
                child: compact
                    ? _MobileLayout(
                        reservation: reservation,
                        delivery: delivery,
                        presentation: presentation,
                      )
                    : _DesktopLayout(
                        reservation: reservation,
                        delivery: delivery,
                        presentation: presentation,
                      ),
              );
            },
          ),
          if (showAccent && accentColor != null)
            PositionedDirectional(
              start: 0,
              top: 0,
              bottom: 0,
              width: 4,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: const BorderRadiusDirectional.only(
                    topStart: Radius.circular(14),
                    bottomStart: Radius.circular(14),
                  ),
                ),
                child: const SizedBox.expand(),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Desktop layout — three zones in one Row
// ---------------------------------------------------------------------------

class _DesktopLayout extends StatelessWidget {
  const _DesktopLayout({
    required this.reservation,
    required this.delivery,
    required this.presentation,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationCardPresentation presentation;

  @override
  Widget build(BuildContext context) {
    final minH = presentation.isHistoricalCompact
        ? _desktopMinHeightHistorical
        : _desktopMinHeight;

    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minH),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Zone A
            Expanded(
              flex: 3,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Thumbnail(reservation: reservation, size: _desktopThumbSize),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _ZoneAContent(
                      reservation: reservation,
                      presentation: presentation,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),

            // Zone B
            Expanded(
              flex: 3,
              child: _ZoneBContent(
                reservation: reservation,
                delivery: delivery,
                presentation: presentation,
              ),
            ),
            const SizedBox(width: AppSpacing.md),

            // Zone C
            SizedBox(
              width: _desktopActionsWidth,
              child: _ActionZone(
                reservation: reservation,
                delivery: delivery,
                presentation: presentation,
                compact: false,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Zone A: title, supplier, date, chips
class _ZoneAContent extends StatelessWidget {
  const _ZoneAContent({
    required this.reservation,
    required this.presentation,
  });

  final LearnerReservation reservation;
  final LearnerReservationCardPresentation presentation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          reservation.material.title,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 17,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          reservation.supplier.displayName,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
            fontWeight: FontWeight.w400,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          formatReservationDate(reservation.createdAt, l10n: l10n),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            _InfoChip(
              icon: Icons.inventory_2_outlined,
              label: formatQuantityLabel(reservation, l10n: l10n),
            ),
            _InfoChip(
              icon: reservation.isDeliveryFulfillment
                  ? Icons.local_shipping_outlined
                  : Icons.storefront_outlined,
              label: formatFulfillmentMethodLabel(reservation, l10n: l10n),
            ),
          ],
        ),
      ],
    );
  }
}

// Zone B: status chips, money section, next-step panel
class _ZoneBContent extends StatelessWidget {
  const _ZoneBContent({
    required this.reservation,
    required this.delivery,
    required this.presentation,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationCardPresentation presentation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final moneyPresentation = buildReservationMoneyPresentation(
      reservation,
      l10n: l10n,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            AppStatusBadge(
              label: presentation.reservationStatusLabel,
              tone: presentation.reservationTone,
            ),
            if (presentation.paymentStatusLabel != null)
              AppStatusBadge(
                label: presentation.paymentStatusLabel!,
                tone: presentation.paymentTone!,
              ),
          ],
        ),
        if (moneyPresentation != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _MoneySection(presentation: moneyPresentation),
        ],
        const SizedBox(height: AppSpacing.sm),
        _NextStepPanel(
          reservation: reservation,
          delivery: delivery,
          cardPresentation: presentation,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Mobile layout
// ---------------------------------------------------------------------------

class _MobileLayout extends StatelessWidget {
  const _MobileLayout({
    required this.reservation,
    required this.delivery,
    required this.presentation,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationCardPresentation presentation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final isCompact = presentation.isHistoricalCompact;
    final moneyPresentation = buildReservationMoneyPresentation(
      reservation,
      l10n: l10n,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Thumbnail + title + reservation chip
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Thumbnail(reservation: reservation, size: _mobileThumbSize),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reservation.material.title,
                    style: AppTextStyles.body(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  AppStatusBadge(
                    label: presentation.reservationStatusLabel,
                    tone: presentation.reservationTone,
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),

        // 2. Supplier
        Text(
          reservation.supplier.displayName,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
            fontWeight: FontWeight.w400,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),

        // 3. Date
        Text(
          formatReservationDate(reservation.createdAt, l10n: l10n),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),

        // 4. Qty + fulfillment chips
        if (!isCompact) ...[
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              _InfoChip(
                icon: Icons.inventory_2_outlined,
                label: formatQuantityLabel(reservation, l10n: l10n),
              ),
              _InfoChip(
                icon: reservation.isDeliveryFulfillment
                    ? Icons.local_shipping_outlined
                    : Icons.storefront_outlined,
                label: formatFulfillmentMethodLabel(reservation, l10n: l10n),
              ),
            ],
          ),
        ],

        // 5. Payment chip
        if (presentation.paymentStatusLabel != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: AppStatusBadge(
              label: presentation.paymentStatusLabel!,
              tone: presentation.paymentTone!,
            ),
          ),
        ],

        // 6. Money section
        if (moneyPresentation != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _MoneySection(presentation: moneyPresentation),
        ],

        // 7. Next-step panel
        if (!isCompact || presentation.nextStepMessage.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          if (isCompact)
            Text(
              presentation.nextStepMessage,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            )
          else
            _NextStepPanel(
              reservation: reservation,
              delivery: delivery,
              cardPresentation: presentation,
            ),
        ],

        // 8. Primary CTA
        const SizedBox(height: AppSpacing.sm),
        _ActionZone(
          reservation: reservation,
          delivery: delivery,
          presentation: presentation,
          compact: true,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Money section — soft tinted container
// ---------------------------------------------------------------------------

class _MoneySection extends StatelessWidget {
  const _MoneySection({required this.presentation});

  final LearnerReservationMoneyPresentation presentation;

  Color _tintBackground(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return switch (presentation.tone) {
      LearnerReservationMoneyTone.success => colors.successSoft,
      LearnerReservationMoneyTone.warning => colors.warningSoft,
      LearnerReservationMoneyTone.danger =>
        colors.dangerSoft.withValues(alpha: 0.5),
      LearnerReservationMoneyTone.neutral => colors.surfaceMuted,
    };
  }

  Color _tintForeground(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return switch (presentation.tone) {
      LearnerReservationMoneyTone.success => colors.success,
      LearnerReservationMoneyTone.warning => colors.warning,
      LearnerReservationMoneyTone.danger => colors.danger,
      LearnerReservationMoneyTone.neutral => colors.textSecondary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final fg = _tintForeground(context);

    return Container(
      key: const Key('reservation-money-section'),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm + 2,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: _tintBackground(context),
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  presentation.title,
                  style: AppTextStyles.label(context).copyWith(
                    color: fg,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (presentation.amountLine != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  presentation.amountLine!,
                  style: AppTextStyles.label(context).copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ],
            ],
          ),
          if (presentation.supportingLine != null) ...[
            const SizedBox(height: 2),
            Text(
              presentation.supportingLine!,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontWeight: FontWeight.w400,
                fontSize: 12,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Next-step soft panel — internal, not a full-card banner
// ---------------------------------------------------------------------------

class _NextStepPanel extends StatelessWidget {
  const _NextStepPanel({
    required this.reservation,
    required this.delivery,
    required this.cardPresentation,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationCardPresentation cardPresentation;

  IconData _iconForTone(AppStatusTone tone) {
    return switch (tone) {
      AppStatusTone.danger => Icons.credit_card_rounded,
      AppStatusTone.warning => Icons.hourglass_top_rounded,
      AppStatusTone.info => Icons.local_shipping_outlined,
      AppStatusTone.success => Icons.check_circle_outline_rounded,
      _ => Icons.info_outline_rounded,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final style = AppStatusStyle.of(context, cardPresentation.nextStepTone);

    final title = reservationNextStepTitle(
      reservation,
      l10n: l10n,
      delivery: delivery,
    );
    final supporting = reservationNextStepSupporting(
      reservation,
      l10n: l10n,
      delivery: delivery,
    );

    return Container(
      key: const Key('reservation-next-step-panel'),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(top: 1),
            child: Icon(
              _iconForTone(cardPresentation.nextStepTone),
              size: 18,
              color: style.foreground,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTextStyles.label(context).copyWith(
                    color: style.foreground,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (supporting != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    supporting,
                    style: AppTextStyles.label(context).copyWith(
                      color: style.foreground.withValues(alpha: 0.75),
                      fontWeight: FontWeight.w400,
                      fontSize: 12,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Info chip (quantity / fulfillment)
// ---------------------------------------------------------------------------

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: palette.textMuted),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 160),
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w400,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            softWrap: false,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Thumbnail with image fallback
// ---------------------------------------------------------------------------

class _Thumbnail extends StatefulWidget {
  const _Thumbnail({required this.reservation, required this.size});

  final LearnerReservation reservation;
  final double size;

  @override
  State<_Thumbnail> createState() => _ThumbnailState();
}

class _ThumbnailState extends State<_Thumbnail> {
  bool _imageFailed = false;

  @override
  void didUpdateWidget(covariant _Thumbnail oldWidget) {
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

  Widget _placeholder(AppThemeColors colors) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.successSoft.withValues(alpha: 0.55),
        borderRadius: AppRadius.mdAll,
      ),
      child: Icon(
        Icons.inventory_2_outlined,
        size: widget.size < 100 ? 28 : 32,
        color: colors.success.withValues(alpha: 0.55),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return SizedBox(
      width: widget.size,
      height: widget.size,
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
                  return _placeholder(colors);
                },
              )
            : _placeholder(colors),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Action zone
// ---------------------------------------------------------------------------

class _ActionZone extends ConsumerWidget {
  const _ActionZone({
    required this.reservation,
    required this.delivery,
    required this.presentation,
    required this.compact,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final LearnerReservationCardPresentation presentation;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    final primaryLabel = primaryActionLabel(
      presentation.primaryAction,
      l10n: l10n,
    );
    final primaryIcon = primaryActionIcon(presentation.primaryAction);

    final showPrimary =
        presentation.primaryAction != LearnerReservationPrimaryAction.none &&
            _canExecutePrimaryAction();

    final showDetails = presentation.showSecondaryDetails;
    final showCancel = reservation.isPending;
    final isHistorical = presentation.isHistoricalCompact;

    final isViewDetailsOnly =
        isHistorical &&
        presentation.primaryAction ==
            LearnerReservationPrimaryAction.viewDetails;

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (isViewDetailsOnly)
            SizedBox(
              key: const Key('reservation-view-details'),
              height: 44,
              child: OutlinedButton.icon(
                onPressed: () => _navigateToDetails(context),
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                label: Text(l10n.viewDetails),
                style: OutlinedButton.styleFrom(
                  textStyle: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            )
          else ...[
            if (showPrimary)
              Semantics(
                button: true,
                label: primaryLabel,
                child: SizedBox(
                  key: const Key('reservation-primary-action'),
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: () => _handlePrimary(context),
                    icon: Icon(primaryIcon, size: 18),
                    label: Text(primaryLabel),
                    style: FilledButton.styleFrom(
                      textStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            if (showDetails) ...[
              const SizedBox(height: AppSpacing.xs),
              SizedBox(
                key: const Key('reservation-view-details'),
                height: 44,
                child: OutlinedButton(
                  onPressed: () => _navigateToDetails(context),
                  style: OutlinedButton.styleFrom(
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: Text(l10n.viewDetails),
                ),
              ),
            ],
          ],
          if (showCancel) ...[
            const SizedBox(height: AppSpacing.xs),
            _CancelButton(reservation: reservation),
          ],
        ],
      );
    }

    // Desktop action zone
    if (isViewDetailsOnly) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            key: const Key('reservation-view-details'),
            height: 44,
            child: OutlinedButton.icon(
              onPressed: () => _navigateToDetails(context),
              icon: const Icon(Icons.arrow_forward_rounded, size: 16),
              label: Text(l10n.viewDetails, overflow: TextOverflow.ellipsis),
              style: OutlinedButton.styleFrom(
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showPrimary)
          Semantics(
            button: true,
            label: primaryLabel,
            child: SizedBox(
              key: const Key('reservation-primary-action'),
              height: 44,
              child: FilledButton.icon(
                onPressed: () => _handlePrimary(context),
                icon: Icon(primaryIcon, size: 16),
                label: Text(primaryLabel, overflow: TextOverflow.ellipsis),
                style: FilledButton.styleFrom(
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.sm,
                  ),
                ),
              ),
            ),
          ),
        if (showDetails) ...[
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            key: const Key('reservation-view-details'),
            height: 44,
            child: OutlinedButton(
              onPressed: () => _navigateToDetails(context),
              style: OutlinedButton.styleFrom(
                textStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                ),
              ),
              child: Text(l10n.viewDetails),
            ),
          ),
        ],
        if (showCancel) ...[
          const SizedBox(height: AppSpacing.xs),
          _CancelButton(reservation: reservation),
        ],
      ],
    );
  }

  bool _canExecutePrimaryAction() {
    switch (presentation.primaryAction) {
      case LearnerReservationPrimaryAction.payNow:
      case LearnerReservationPrimaryAction.completePayment:
        return reservation.paymentSummary?.checkoutableOrderId != null;
      case LearnerReservationPrimaryAction.viewPickupCode:
      case LearnerReservationPrimaryAction.trackDelivery:
      case LearnerReservationPrimaryAction.viewDetails:
      case LearnerReservationPrimaryAction.none:
        return true;
    }
  }

  void _handlePrimary(BuildContext context) {
    switch (presentation.primaryAction) {
      case LearnerReservationPrimaryAction.payNow:
      case LearnerReservationPrimaryAction.completePayment:
        context.push(
          learnerReservationDetailRoute(
            reservation.id,
            focus: 'payment',
            checkoutableOrderId: reservation.paymentSummary?.checkoutableOrderId,
          ),
        );
        return;
      case LearnerReservationPrimaryAction.viewPickupCode:
        context.push(learnerReservationDetailRoute(reservation.id));
        return;
      case LearnerReservationPrimaryAction.trackDelivery:
        final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
        if (deliveryId != null) {
          final canTrack = delivery?.canTrack == true;
          if (canTrack) {
            context.push('/learner/deliveries/$deliveryId/track');
          } else {
            context.push('/learner/deliveries/$deliveryId');
          }
        } else {
          context.push(learnerReservationDetailRoute(reservation.id));
        }
        return;
      case LearnerReservationPrimaryAction.viewDetails:
      case LearnerReservationPrimaryAction.none:
        context.push(learnerReservationDetailRoute(reservation.id));
        return;
    }
  }

  void _navigateToDetails(BuildContext context) {
    context.push(learnerReservationDetailRoute(reservation.id));
  }
}

// ---------------------------------------------------------------------------
// Cancel button — compact TextButton for pending reservations
// ---------------------------------------------------------------------------

class _CancelButton extends ConsumerWidget {
  const _CancelButton({required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cancelState = ref.watch(reservationCancelControllerProvider);
    final cancellingId = ref.watch(cancellingReservationIdProvider);
    final isCancelling = cancellingId == reservation.id;
    final colors = AppThemeColors.of(context);

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: SizedBox(
        height: 28,
        child: TextButton(
          onPressed: isCancelling || cancelState.isLoading
              ? null
              : () => _confirmCancel(context, ref),
          style: AppStatusButtonStyle.text(context, AppStatusTone.danger)
              .copyWith(
                padding: const WidgetStatePropertyAll(
                  EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
                ),
                minimumSize: const WidgetStatePropertyAll(Size.zero),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                textStyle: const WidgetStatePropertyAll(
                  TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ),
          child: isCancelling
              ? SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colors.danger,
                  ),
                )
              : Text(context.l10n.cancelRequest),
        ),
      ),
    );
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => _CancelDialog(
        reservation: reservation,
        onKeep: () => Navigator.of(dialogContext).pop(false),
        onCancel: () => Navigator.of(dialogContext).pop(true),
      ),
    );

    if (confirmed != true || !context.mounted) return;

    ref
        .read(cancellingReservationIdProvider.notifier)
        .setCancelling(reservation.id);

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
}

// ---------------------------------------------------------------------------
// Cancel dialog
// ---------------------------------------------------------------------------

class _CancelDialog extends StatefulWidget {
  const _CancelDialog({
    required this.reservation,
    required this.onKeep,
    required this.onCancel,
  });

  final LearnerReservation reservation;
  final VoidCallback onKeep;
  final VoidCallback onCancel;

  @override
  State<_CancelDialog> createState() => _CancelDialogState();
}

class _CancelDialogState extends State<_CancelDialog> {
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
    final dialogWidth = isNarrow ? screenSize.width * 0.92 : 440.0;

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
                    style: AppTextStyles.body(context)
                        .copyWith(color: palette.textSecondary),
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
                            formatRequestedQuantity(widget.reservation),
                          ),
                          style: AppTextStyles.label(context)
                              .copyWith(color: palette.textMuted),
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
