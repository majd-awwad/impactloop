import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

class LearnerSegmentedTabItem {
  const LearnerSegmentedTabItem({
    required this.id,
    required this.label,
    this.icon,
  });

  final String id;
  final String label;
  final IconData? icon;
}

/// Segmented / underline tabs shared by discovery pages.
class LearnerSegmentedTabs extends StatelessWidget {
  const LearnerSegmentedTabs({
    super.key,
    required this.items,
    required this.selectedId,
    required this.onSelected,
    this.variant = LearnerSegmentedTabsVariant.underline,
  });

  final List<LearnerSegmentedTabItem> items;
  final String selectedId;
  final ValueChanged<String> onSelected;
  final LearnerSegmentedTabsVariant variant;

  @override
  Widget build(BuildContext context) {
    if (variant == LearnerSegmentedTabsVariant.pill) {
      return _PillTabs(
        items: items,
        selectedId: selectedId,
        onSelected: onSelected,
      );
    }

    return _UnderlineTabs(
      items: items,
      selectedId: selectedId,
      onSelected: onSelected,
    );
  }
}

enum LearnerSegmentedTabsVariant { underline, pill }

class _UnderlineTabs extends StatelessWidget {
  const _UnderlineTabs({
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<LearnerSegmentedTabItem> items;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final border = LearnerDiscoveryStyle.border(context);
    final primary = LearnerDiscoveryStyle.primary(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: border)),
      ),
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: _UnderlineTab(
                item: item,
                selected: item.id == selectedId,
                primary: primary,
                onTap: () => onSelected(item.id),
              ),
            ),
        ],
      ),
    );
  }
}

class _UnderlineTab extends StatelessWidget {
  const _UnderlineTab({
    required this.item,
    required this.selected,
    required this.primary,
    required this.onTap,
  });

  final LearnerSegmentedTabItem item;
  final bool selected;
  final Color primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected
        ? primary
        : LearnerDiscoveryStyle.textSecondary(context);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsetsDirectional.only(bottom: 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: AppSpacing.sm,
                horizontal: AppSpacing.xs,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (item.icon != null) ...[
                    Icon(item.icon, size: 18, color: color),
                    const SizedBox(width: 6),
                  ],
                  Flexible(
                    child: Text(
                      item.label,
                      style: AppTextStyles.label(context).copyWith(
                        color: color,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: 3,
              decoration: BoxDecoration(
                color: selected ? primary : Colors.transparent,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(3),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PillTabs extends StatelessWidget {
  const _PillTabs({
    required this.items,
    required this.selectedId,
    required this.onSelected,
  });

  final List<LearnerSegmentedTabItem> items;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(4),
      decoration: BoxDecoration(
        color: LearnerDiscoveryStyle.inputSurface(context),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: LearnerDiscoveryStyle.border(context)),
      ),
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: _PillTab(
                item: item,
                selected: item.id == selectedId,
                onTap: () => onSelected(item.id),
              ),
            ),
        ],
      ),
    );
  }
}

class _PillTab extends StatelessWidget {
  const _PillTab({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final LearnerSegmentedTabItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = LearnerDiscoveryStyle.primary(context);
    final foreground = selected
        ? LearnerDiscoveryStyle.textOnPrimary(context)
        : LearnerDiscoveryStyle.textSecondary(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsetsDirectional.symmetric(
            vertical: AppSpacing.sm,
            horizontal: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? primary : Colors.transparent,
            borderRadius: AppRadius.pillAll,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (item.icon != null) ...[
                Icon(item.icon, size: 16, color: foreground),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  item.label,
                  style: AppTextStyles.label(context).copyWith(
                    color: foreground,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
