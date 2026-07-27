import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';

/// Shared elevated dashboard card shell.
class AdminDashboardCard extends StatelessWidget {
  const AdminDashboardCard({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.trailing,
    this.padding = const EdgeInsetsDirectional.fromSTEB(18, 16, 18, 16),
    this.minHeight,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;
  final double? minHeight;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      constraints: minHeight != null
          ? BoxConstraints(minHeight: minHeight!)
          : null,
      padding: padding,
      decoration: palette.dashboardCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: palette.textPrimary,
                        fontSize: 16,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}
