import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

/// RTL-safe pickup → drop-off route summary for driver delivery cards.
class DriverRouteBlock extends StatelessWidget {
  const DriverRouteBlock({
    super.key,
    required this.pickupSummary,
    required this.dropoffSummary,
    this.compact = false,
    this.forceVertical = false,
    this.pickupLabel,
    this.dropoffLabel,
  });

  final String pickupSummary;
  final String dropoffSummary;
  final bool compact;
  final bool forceVertical;
  final String? pickupLabel;
  final String? dropoffLabel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final palette = MaterialsUiPalette.of(context);
    final fromLabel = pickupLabel ?? l10n.driverRoutePickupLabel;
    final toLabel = dropoffLabel ?? l10n.driverRouteDropoffLabel;
    final arrowSize = compact ? 16.0 : 20.0;
    final endpointSpacing = compact ? AppSpacing.xs : AppSpacing.sm;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final arrowIcon = rtl
        ? Icons.arrow_back_rounded
        : Icons.arrow_forward_rounded;

    final pickup = _RouteEndpoint(
      icon: Icons.store_outlined,
      label: fromLabel,
      summary: pickupSummary,
      compact: compact,
      palette: palette,
    );
    final dropoff = _RouteEndpoint(
      icon: Icons.location_on_outlined,
      label: toLabel,
      summary: dropoffSummary,
      compact: compact,
      palette: palette,
    );
    final arrow = Icon(
      arrowIcon,
      size: arrowSize,
      color: palette.mint,
      semanticLabel: l10n.driverRouteArrowSemantic,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final stackVertically = forceVertical || constraints.maxWidth < 360;

        if (stackVertically) {
          final iconSize = compact ? 16.0 : 18.0;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              pickup,
              Padding(
                padding: EdgeInsetsDirectional.only(
                  top: compact ? 2 : endpointSpacing,
                  bottom: compact ? 2 : endpointSpacing,
                ),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: SizedBox(
                    width: iconSize,
                    child: Icon(
                      Icons.arrow_downward_rounded,
                      size: arrowSize,
                      color: palette.mint,
                      semanticLabel: l10n.driverRouteArrowSemantic,
                    ),
                  ),
                ),
              ),
              dropoff,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: pickup),
            Padding(
              padding: EdgeInsetsDirectional.only(
                start: endpointSpacing,
                end: endpointSpacing,
                top: compact ? 2 : 4,
              ),
              child: arrow,
            ),
            Expanded(child: dropoff),
          ],
        );
      },
    );
  }
}

class _RouteEndpoint extends StatelessWidget {
  const _RouteEndpoint({
    required this.icon,
    required this.label,
    required this.summary,
    required this.compact,
    required this.palette,
  });

  final IconData icon;
  final String label;
  final String summary;
  final bool compact;
  final MaterialsUiPalette palette;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 16.0 : 18.0;
    final labelStyle = compact
        ? AppTextStyles.label(
            context,
          ).copyWith(color: palette.textMuted, fontSize: 11)
        : AppTextStyles.label(context).copyWith(color: palette.textMuted);
    final summaryStyle = compact
        ? AppTextStyles.body(context).copyWith(fontSize: 13)
        : AppTextStyles.body(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: iconSize, color: palette.mint),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: labelStyle,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        BidiText(
          summary,
          maxLines: compact ? 2 : 3,
          overflow: TextOverflow.ellipsis,
          style: summaryStyle.copyWith(color: palette.textPrimary),
        ),
      ],
    );
  }
}
