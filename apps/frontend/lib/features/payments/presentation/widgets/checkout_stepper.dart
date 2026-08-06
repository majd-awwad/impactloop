import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../application/learner_checkout_controller.dart';

class CheckoutStepper extends StatelessWidget {
  const CheckoutStepper({super.key, required this.step});

  final CheckoutStep step;

  int get _index => switch (step) {
        CheckoutStep.summary => 0,
        CheckoutStep.method => 1,
        CheckoutStep.confirm => 2,
        CheckoutStep.result => 3,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final labels = [
      l10n.checkoutStepSummary,
      l10n.checkoutStepMethod,
      l10n.checkoutStepConfirm,
      l10n.checkoutStepResult,
    ];
    final active = _index;

    return Semantics(
      label: labels[active],
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 520;
          return Row(
            children: [
              for (var i = 0; i < labels.length; i++) ...[
                if (i > 0)
                  Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      color: i <= active
                          ? colors.primary.withValues(alpha: 0.55)
                          : colors.borderSubtle,
                    ),
                  ),
                _StepChip(
                  index: i + 1,
                  label: labels[i],
                  active: i == active,
                  done: i < active,
                  compact: compact,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _StepChip extends StatelessWidget {
  const _StepChip({
    required this.index,
    required this.label,
    required this.active,
    required this.done,
    required this.compact,
  });

  final int index;
  final String label;
  final bool active;
  final bool done;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final fg = active || done ? colors.primary : colors.textMuted;
    final bg = active
        ? colors.primary
        : done
            ? colors.primarySoft
            : colors.surfaceMuted;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 28 : 32,
          height: compact ? 28 : 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? colors.primary : bg,
            shape: BoxShape.circle,
            border: Border.all(
              color: active || done ? colors.primary : colors.borderSubtle,
            ),
          ),
          child: done && !active
              ? Icon(Icons.check_rounded, size: 16, color: colors.primary)
              : Text(
                  '$index',
                  style: AppTextStyles.label(context).copyWith(
                    color: active ? colors.textOnPrimary : fg,
                    fontWeight: FontWeight.w700,
                    fontSize: compact ? 12 : 13,
                  ),
                ),
        ),
        if (!compact) ...[
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            width: 88,
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(context).copyWith(
                color: fg,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                fontSize: 11,
                height: 1.2,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
