import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../theme/learning_ui_palette.dart';

class BuildStepNumberBadge extends StatelessWidget {
  const BuildStepNumberBadge({
    super.key,
    required this.number,
    this.emphasized = false,
    this.size = 28,
  });

  final int number;
  final bool emphasized;
  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: emphasized ? palette.limeSoft : palette.mutedChip,
          borderRadius: AppRadius.mdAll,
          border: Border.all(
            color: emphasized
                ? palette.lime.withValues(alpha: 0.35)
                : palette.borderSubtle,
          ),
        ),
        child: Text(
          '$number',
          style: AppTextStyles.label(context).copyWith(
            color: emphasized ? palette.lime : palette.textPrimary,
            fontSize: size <= 28 ? 13 : 14,
            fontWeight: FontWeight.w800,
            height: 1,
          ),
        ),
      ),
    );
  }
}
