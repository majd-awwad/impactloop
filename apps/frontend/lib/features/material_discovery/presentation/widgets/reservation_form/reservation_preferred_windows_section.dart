import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../preferred_window_input.dart';
import 'reservation_form_theme.dart';

class ReservationPreferredWindowsSection extends StatefulWidget {
  const ReservationPreferredWindowsSection({
    super.key,
    required this.windows,
    required this.enabled,
    required this.isPickup,
    required this.onChanged,
    this.initiallyExpanded = false,
  });

  final List<PreferredWindowDraft> windows;
  final bool enabled;
  final bool isPickup;
  final ValueChanged<List<PreferredWindowDraft>> onChanged;
  final bool initiallyExpanded;

  @override
  State<ReservationPreferredWindowsSection> createState() =>
      _ReservationPreferredWindowsSectionState();
}

class _ReservationPreferredWindowsSectionState
    extends State<ReservationPreferredWindowsSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded || _hasFilledWindow(widget.windows);
  }

  @override
  void didUpdateWidget(covariant ReservationPreferredWindowsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_expanded && _hasFilledWindow(widget.windows)) {
      _expanded = true;
    }
  }

  bool _hasFilledWindow(List<PreferredWindowDraft> windows) {
    return windows.any((window) => !window.isBlank);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final title = widget.isPickup
        ? l10n.reservationPreferredPickupTimeOptional
        : l10n.reservationPreferredDeliveryTimeOptional;

    return Container(
      decoration: ReservationFormTheme.surfaceCard(palette),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: AppRadius.mdAll,
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.sm,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.schedule_outlined,
                    size: ReservationFormTheme.sectionIconSize,
                    color: palette.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Text(
                    l10n.fieldOptional,
                    style: ReservationFormTheme.helperStyle(
                      context,
                      palette,
                    ).copyWith(fontSize: 11),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: palette.textMuted,
                    size: 22,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            Divider(height: 1, color: palette.borderSubtle),
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: PreferredWindowInput(
                key: ValueKey(
                  widget.isPickup
                      ? 'reservation-pickup-windows'
                      : 'reservation-delivery-windows',
                ),
                windows: widget.windows,
                enabled: widget.enabled,
                label: '',
                addAnotherLabel: l10n.reservationAddAnotherWindow,
                onChanged: widget.onChanged,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
