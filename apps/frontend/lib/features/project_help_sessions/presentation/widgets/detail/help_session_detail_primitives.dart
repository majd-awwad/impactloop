import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';

class HelpSessionDetailCard extends StatelessWidget {
  const HelpSessionDetailCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsetsDirectional.all(AppSpacing.md),
    this.accentBorder = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool accentBorder;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: accentBorder
              ? palette.mint.withValues(alpha: 0.45)
              : palette.borderSubtle,
        ),
      ),
      child: child,
    );
  }
}

class HelpSessionDetailSectionTitle extends StatelessWidget {
  const HelpSessionDetailSectionTitle(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: AppTextStyles.title(context).copyWith(fontSize: 16),
    );
  }
}

class HelpSessionDetailMutedText extends StatelessWidget {
  const HelpSessionDetailMutedText(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Text(
      text,
      style: AppTextStyles.body(context).copyWith(
        color: palette.textSecondary,
        height: 1.4,
      ),
    );
  }
}
