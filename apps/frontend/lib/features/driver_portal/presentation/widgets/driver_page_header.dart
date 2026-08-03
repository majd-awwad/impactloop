import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

/// Consistent page header for driver portal content containers.
class DriverPageHeader extends StatelessWidget {
  const DriverPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.maxWidth = 1180,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final titleWidget = Text(
      title,
      style: AppTextStyles.display(
        context,
      ).copyWith(color: palette.textPrimary),
    );
    final subtitleWidget = subtitle == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              subtitle!,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          );

    final textColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [titleWidget, ?subtitleWidget],
    );

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: trailing == null
            ? textColumn
            : LayoutBuilder(
                builder: (context, constraints) {
                  if (constraints.maxWidth < 560) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        textColumn,
                        const SizedBox(height: AppSpacing.sm),
                        trailing!,
                      ],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: textColumn),
                      const SizedBox(width: AppSpacing.lg),
                      trailing!,
                    ],
                  );
                },
              ),
      ),
    );
  }
}
