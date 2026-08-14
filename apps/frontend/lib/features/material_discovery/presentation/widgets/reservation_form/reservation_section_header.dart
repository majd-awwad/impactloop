import 'package:flutter/material.dart';

import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'reservation_form_theme.dart';

class ReservationSectionHeader extends StatelessWidget {
  const ReservationSectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.required = false,
    this.optionalLabel,
  });

  final String title;
  final IconData? icon;
  final bool required;
  final String? optionalLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(
            icon,
            size: ReservationFormTheme.sectionIconSize,
            color: palette.textSecondary,
          ),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: title,
                  style: ReservationFormTheme.sectionTitleStyle(
                    context,
                    palette,
                  ),
                ),
                if (required)
                  TextSpan(
                    text: ' *',
                    style: ReservationFormTheme.sectionTitleStyle(
                      context,
                      palette,
                    ).copyWith(color: materialDanger),
                  ),
              ],
            ),
          ),
        ),
        if (optionalLabel != null)
          Text(
            optionalLabel!,
            style: ReservationFormTheme.helperStyle(
              context,
              palette,
            ).copyWith(fontSize: 11),
          ),
      ],
    );
  }
}

class ReservationFieldLabel extends StatelessWidget {
  const ReservationFieldLabel({
    super.key,
    required this.label,
    this.required = false,
  });

  final String label;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: label,
            style: ReservationFormTheme.fieldLabelStyle(context, palette),
          ),
          if (required)
            TextSpan(
              text: ' *',
              style: ReservationFormTheme.fieldLabelStyle(
                context,
                palette,
              ).copyWith(color: materialDanger, fontWeight: FontWeight.w700),
            ),
        ],
      ),
      maxLines: 2,
    );
  }
}
