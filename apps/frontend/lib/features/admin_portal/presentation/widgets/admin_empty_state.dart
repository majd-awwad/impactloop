import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';

class AdminEmptyState extends StatelessWidget {
  const AdminEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.hint,
    this.compact = true,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? hint;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: compact ? 10 : 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: palette.primaryTeal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: palette.cardBorder),
            ),
            child: Icon(icon, color: palette.primaryTeal, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: palette.textPrimary,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      height: 1.35,
                    ),
                  ),
                ],
                if (hint != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    hint!,
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: palette.textMuted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
