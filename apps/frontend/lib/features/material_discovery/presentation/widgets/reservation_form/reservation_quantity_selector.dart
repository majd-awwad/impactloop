import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../reservation_dialog_copy.dart';
import 'reservation_form_theme.dart';

class ReservationQuantitySelector extends StatelessWidget {
  const ReservationQuantitySelector({
    super.key,
    required this.controller,
    required this.unit,
    required this.enabled,
    required this.onDecrement,
    required this.onIncrement,
    required this.validator,
    required this.availableLabel,
  });

  final TextEditingController controller;
  final String unit;
  final bool enabled;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;
  final FormFieldValidator<String> validator;
  final String availableLabel;

  @override
  Widget build(BuildContext context) {
    final unitLabel = formatReservationUnitForQuantity(
      unit,
      double.tryParse(controller.text.trim()) ?? 1,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          availableLabel,
          style: ReservationFormTheme.helperStyle(
            context,
            MaterialsUiPalette.of(context),
          ),
        ),
        const SizedBox(height: ReservationFormTheme.titleToContentGap),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _QuantityStepButton(
                    icon: Icons.remove_rounded,
                    onPressed: onDecrement,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  SizedBox(
                    width: 64,
                    child: TextFormField(
                      key: const ValueKey('reservation-quantity-field'),
                      controller: controller,
                      enabled: enabled,
                      textAlign: TextAlign.center,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      style: AppTextStyles.body(context).copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                      decoration: ReservationFormTheme.inputDecoration(context)
                          .copyWith(
                            contentPadding:
                                const EdgeInsetsDirectional.symmetric(
                              vertical: AppSpacing.sm,
                              horizontal: AppSpacing.xs,
                            ),
                            isDense: true,
                          ),
                      validator: validator,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  _QuantityStepButton(
                    icon: Icons.add_rounded,
                    onPressed: onIncrement,
                  ),
                ],
              ),
              const SizedBox(width: AppSpacing.sm),
              Flexible(
                child: Text(
                  unitLabel,
                  style: ReservationFormTheme.helperStyle(
                    context,
                    MaterialsUiPalette.of(context),
                  ).copyWith(
                    color: MaterialsUiPalette.of(context).textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _QuantityStepButton extends StatelessWidget {
  const _QuantityStepButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return IconButton.outlined(
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 44),
        maximumSize: const Size(44, 44),
        padding: EdgeInsets.zero,
        side: BorderSide(color: palette.borderSubtle),
        foregroundColor: palette.textPrimary,
        backgroundColor: palette.panelSurface,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
      icon: Icon(icon, size: 20),
    );
  }
}
