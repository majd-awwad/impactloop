import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../auth/application/auth_controller.dart';
import '../controllers/supplier_dashboard_providers.dart';
import 'supplier_nav_config.dart';
import 'supplier_profile_popover.dart';
import 'supplier_settings_controls.dart';

class SupplierTopBar extends ConsumerWidget {
  const SupplierTopBar({super.key, required this.currentLocation});

  final String currentLocation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final dashboardAsync = ref.watch(supplierDashboardProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final unreadCount = dashboardAsync.maybeWhen(
      data: (dashboard) => dashboard.stats.notifications.unread,
      orElse: () => 0,
    );

    final user = authState.user;
    final supplier = dashboardAsync.maybeWhen(
      data: (dashboard) => dashboard.supplier,
      orElse: () => null,
    );

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: SupplierDecorations.topBar,
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    supplierPageTitle(currentLocation),
                    style: AuthDarkTextStyles.title(
                      context,
                    ).copyWith(fontSize: 20),
                  ),
                  Text(
                    'Track materials, requests, and impact.',
                    style: AuthDarkTextStyles.body(context),
                  ),
                ],
              ),
            ),
            if (!compact) ...[
              const SupplierSettingsControls(),
              const SizedBox(width: AppSpacing.sm),
            ],
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => context.go('/supplier/notifications'),
                borderRadius: AppRadius.pillAll,
                child: Ink(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: SupplierDecorations.topBarPill,
                  child: Badge(
                    isLabelVisible: unreadCount > 0,
                    label: Text('$unreadCount'),
                    backgroundColor: AuthDarkColors.accent,
                    textColor: AuthDarkColors.textOnAccent,
                    child: const Icon(
                      Icons.notifications_none_rounded,
                      color: AuthDarkColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            SupplierProfileButton(
              displayName: supplier?.publicName.isNotEmpty == true
                  ? supplier!.publicName
                  : user?.displayName ?? 'Supplier',
              email: user?.email,
              supplierType:
                  supplier?.supplierType ?? user?.supplierProfile?.supplierType,
              verificationStatus: supplier?.verificationStatus ?? 'PENDING',
              showSettingsControls: compact,
            ),
          ],
        ),
      ),
    );
  }
}
