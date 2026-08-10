import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';

/// Horizontal chip scroller that never clips first/last chips.
///
/// Edge padding keeps the first and last chips fully inside the viewport
/// instead of sitting flush against the clipped scroll edge.
class LearnerChipRow extends StatelessWidget {
  const LearnerChipRow({
    super.key,
    required this.children,
    this.spacing = AppSpacing.sm,
    this.padding,
  });

  final List<Widget> children;
  final double spacing;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      width: double.infinity,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        // Soft edge inset so terminal chips are fully visible when scrolled
        // to either end. Prefer real padding over ClipRect workarounds.
        padding: padding ??
            const EdgeInsetsDirectional.symmetric(horizontal: 2),
        child: Row(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) SizedBox(width: spacing),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}
