import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';

/// Chip row for Supplier My Materials filters.
/// Mobile: bounded horizontal [ListView] (scrollable, no overflow).
/// Desktop/tablet: [Wrap].
class SupplierResponsiveChipRow extends StatelessWidget {
  const SupplierResponsiveChipRow({
    super.key,
    required this.children,
    this.breakpoint = AppSpacing.supplierLayoutBreakpoint,
  });

  final List<Widget> children;
  final double breakpoint;

  static const _chipRowHeight = 40.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final compact = maxWidth < breakpoint;

        if (compact) {
          return SizedBox(
            width: maxWidth,
            height: _chipRowHeight,
            child: ScrollConfiguration(
              behavior: ScrollConfiguration.of(context).copyWith(
                dragDevices: {
                  PointerDeviceKind.touch,
                  PointerDeviceKind.mouse,
                  PointerDeviceKind.stylus,
                  PointerDeviceKind.trackpad,
                },
              ),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                shrinkWrap: true,
                primary: false,
                physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics(),
                ),
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
                itemCount: children.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) => children[index],
              ),
            ),
          );
        }

        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: children,
        );
      },
    );
  }
}
