import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_payment_presentation.dart';
import '../learner_reservation_ui_helpers.dart';

class ReservationDetailHeader extends StatelessWidget {
  const ReservationDetailHeader({
    super.key,
    required this.reservation,
    required this.delivery,
    this.statusMessage,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final String? statusMessage;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final statusStyle = LearnerReservationStatusStyle.forStatus(
      context,
      reservation.status,
      incidentReviewStatus: reservation.incidentReviewStatus,
    );
    final chipLabels = learnerReservationStatusChipLabels(
      reservation,
      linkedDeliveryStatus: delivery?.status,
      l10n: context.l10n,
    );
    final deliveryTone = chipLabels.secondary != null && delivery != null
        ? deliveryStatusAppTone(delivery!.status)
        : chipLabels.secondary != null &&
              reservation.activeDelivery?.status != null
        ? deliveryStatusAppTone(reservation.activeDelivery!.status)
        : null;
    final summary = reservation.paymentSummary;
    final paymentLabel =
        summary == null ? null : paymentStatusLabel(summary, l10n: context.l10n);
    final paymentTone =
        summary == null ? null : paymentSummaryTone(summary);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            AppStatusBadge(label: chipLabels.primary, tone: statusStyle.tone),
            if (chipLabels.secondary case final secondaryLabel?)
              AppStatusBadge(
                label: secondaryLabel,
                tone: deliveryTone ?? statusStyle.tone,
              ),
            if (paymentLabel != null && paymentTone != null)
              AppStatusBadge(label: paymentLabel, tone: paymentTone),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          LocalizedFormatters(context.l10n).date(reservation.createdAt),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted, fontWeight: FontWeight.w500),
        ),
        if (statusMessage != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            statusMessage!,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ],
    );
  }
}

class ReservationDetailHeroImage extends StatefulWidget {
  const ReservationDetailHeroImage({
    super.key,
    required this.reservation,
    this.compact = false,
  });

  final LearnerReservation reservation;
  final bool compact;

  @override
  State<ReservationDetailHeroImage> createState() =>
      _ReservationDetailHeroImageState();
}

class _ReservationDetailHeroImageState extends State<ReservationDetailHeroImage> {
  bool _imageFailed = false;

  @override
  void didUpdateWidget(covariant ReservationDetailHeroImage oldWidget) {
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

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final height = widget.compact ? 160.0 : 220.0;

    return ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: SizedBox(
        width: double.infinity,
        height: height,
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
                  return _placeholder(palette);
                },
              )
            : _placeholder(palette),
      ),
    );
  }

  Widget _placeholder(MaterialsUiPalette palette) {
    return ColoredBox(
      color: palette.inputSurface,
      child: Center(
        child: Icon(
          Icons.inventory_2_outlined,
          size: widget.compact ? 40 : 52,
          color: palette.textMuted,
        ),
      ),
    );
  }
}
