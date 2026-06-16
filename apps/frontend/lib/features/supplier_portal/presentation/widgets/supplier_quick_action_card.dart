import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierQuickActionCard extends StatelessWidget {
  const SupplierQuickActionCard({
    super.key,
    required this.label,
    required this.caption,
    required this.icon,
    required this.route,
  });

  final String label;
  final String caption;
  final IconData icon;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.go(route),
        borderRadius: AppRadius.lgAll,
        hoverColor: AuthDarkColors.chipSelected.withValues(alpha: 0.28),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: SupplierDecorations.quickActionCard,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 32,
                child: Icon(icon, color: AuthDarkColors.accent),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AuthDarkTextStyles.label(context).copyWith(
                        color: AuthDarkColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AuthDarkTextStyles.body(
                        context,
                      ).copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: AuthDarkColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
