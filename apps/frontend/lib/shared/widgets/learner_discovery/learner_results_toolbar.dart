import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

/// Results count + optional trailing controls (view toggle, sort, etc.).
class LearnerResultsToolbar extends StatelessWidget {
  const LearnerResultsToolbar({
    super.key,
    required this.label,
    this.trailing,
  });

  final String label;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: LearnerDiscoveryStyle.textSecondary(context),
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
            textAlign: TextAlign.start,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpacing.sm),
          trailing!,
        ],
      ],
    );
  }
}

/// Compact grid/list view toggle.
class LearnerViewToggle extends StatelessWidget {
  const LearnerViewToggle({
    super.key,
    required this.isGrid,
    required this.onChanged,
  });

  final bool isGrid;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ToggleButton(
          icon: Icons.grid_view_rounded,
          selected: isGrid,
          onTap: () => onChanged(true),
        ),
        const SizedBox(width: 4),
        _ToggleButton(
          icon: Icons.view_agenda_outlined,
          selected: !isGrid,
          onTap: () => onChanged(false),
        ),
      ],
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = LearnerDiscoveryStyle.primary(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected
                ? LearnerDiscoveryStyle.primarySoft(context)
                : Colors.transparent,
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: selected
                  ? primary.withValues(alpha: 0.4)
                  : LearnerDiscoveryStyle.border(context),
            ),
          ),
          child: Icon(
            icon,
            size: 18,
            color: selected
                ? primary
                : LearnerDiscoveryStyle.textSecondary(context),
          ),
        ),
      ),
    );
  }
}
