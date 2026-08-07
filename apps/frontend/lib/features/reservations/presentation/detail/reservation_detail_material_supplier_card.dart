import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/learner_reservation.dart';
import '../learner_reservation_ui_helpers.dart';
import 'reservation_detail_semantic.dart';

class ReservationDetailMaterialSupplierCard extends StatelessWidget {
  const ReservationDetailMaterialSupplierCard({
    super.key,
    required this.reservation,
    this.compact = false,
    this.showImage = false,
    this.onContactSupplier,
  });

  final LearnerReservation reservation;
  final bool compact;
  final bool showImage;
  final VoidCallback? onContactSupplier;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final canContact =
        onContactSupplier != null && reservation.canSendMessage;

    return ReservationDetailSurfaceCard(
      semantic: ReservationDetailSemantic.neutral,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showImage) ...[
            ClipRRect(
              borderRadius: AppRadius.mdAll,
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: _MaterialImage(reservation: reservation),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            reservation.material.title,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 16 : 18,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            reservation.material.materialType,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
          if (reservation.material.locationLabel.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              reservation.material.locationLabel,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              CircleAvatar(
                radius: compact ? 14 : 16,
                backgroundColor: palette.inputSurface,
                child: Icon(
                  Icons.storefront_outlined,
                  size: compact ? 14 : 16,
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.supplierLabel,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      reservation.supplier.displayName,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () =>
                  context.push('/materials/${reservation.material.id}'),
              child: Text(l10n.viewMaterial),
            ),
          ),
          if (canContact) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onContactSupplier,
                icon: const Icon(Icons.chat_bubble_outline, size: 16),
                label: Text(l10n.contactSupplier),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MaterialImage extends StatefulWidget {
  const _MaterialImage({required this.reservation});

  final LearnerReservation reservation;

  @override
  State<_MaterialImage> createState() => _MaterialImageState();
}

class _MaterialImageState extends State<_MaterialImage> {
  bool _failed = false;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final url = widget.reservation.material.imageUrl?.trim();
    if (url == null || url.isEmpty || _failed) {
      return ColoredBox(
        color: palette.inputSurface,
        child: Center(
          child: Icon(
            Icons.inventory_2_outlined,
            size: 48,
            color: palette.textMuted,
          ),
        ),
      );
    }

    return Image.network(
      url,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && !_failed) setState(() => _failed = true);
        });
        return ColoredBox(
          color: palette.inputSurface,
          child: Center(
            child: Icon(Icons.broken_image_outlined, color: palette.textMuted),
          ),
        );
      },
    );
  }
}

class ReservationDetailCompactStats extends StatelessWidget {
  const ReservationDetailCompactStats({super.key, required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = context.l10n;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        _StatChip(
          icon: Icons.tag_outlined,
          label: formatQuantityLabel(reservation, l10n: l10n),
          color: colors.info,
        ),
        _StatChip(
          icon: Icons.local_shipping_outlined,
          label: formatFulfillmentMethodLabel(reservation, l10n: l10n),
          color: colors.accentBlue,
        ),
        if (reservation.material.locationLabel.trim().isNotEmpty)
          _StatChip(
            icon: Icons.place_outlined,
            label: reservation.material.locationLabel,
            color: colors.accentMint,
          ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
