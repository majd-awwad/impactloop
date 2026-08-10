import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_route_helpers.dart';
import '../../application/portal_navigation.dart';
import '../../data/models/user.dart';

Future<void> openSupplierDestinationForUser({
  required BuildContext context,
  required WidgetRef ref,
  required User? user,
}) async {
  switch (resolveSupplierEntryDestination(user)) {
    case SupplierEntryDestination.supplierOverview:
      context.go(supplierOverviewRoute);
      return;
    case SupplierEntryDestination.switchToSupplierPortal:
      await handlePortalRoleSwitch(
        context: context,
        ref: ref,
        targetRole: 'SUPPLIER',
      );
      return;
    case SupplierEntryDestination.onboarding:
      context.push(supplierEntryRouteForUser(user));
  }
}

Future<void> handlePortalRoleSwitch({
  required BuildContext context,
  required WidgetRef ref,
  required String targetRole,
  VoidCallback? onBeforeSwitch,
  String? failureMessage,
}) async {
  final router = GoRouter.of(context);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final l10n = context.l10n;
  final authController = ref.read(authControllerProvider.notifier);

  onBeforeSwitch?.call();

  try {
    final user = await authController.switchActiveRole(targetRole);

    router.go(oppositePortalSwitchRoute(user, targetRole));
  } on ApiException catch (error) {
    if (messenger == null) {
      return;
    }

    showAppInlineErrorSnackBar(
      messenger,
      failureMessage ?? localizedApiErrorMessage(error, l10n),
    );
  }
}

class PortalModeLabel extends StatelessWidget {
  const PortalModeLabel({super.key, required this.user, this.style});

  final User user;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Text(activePortalModeLabel(user, l10n), style: style);
  }
}

class PortalSwitchMenuItems {
  const PortalSwitchMenuItems._();

  static List<Widget> build({
    required BuildContext context,
    required WidgetRef ref,
    required User user,
    TextStyle? labelStyle,
    TextStyle? noteStyle,
    VoidCallback? onBeforeSwitch,
    Color? iconColor,
    bool useListTileStyle = false,
  }) {
    final items = <Widget>[];
    final resolvedIconColor =
        iconColor ?? Theme.of(context).colorScheme.onSurface;

    final l10n = context.l10n;

    if (shouldShowSwitchToLearner(user)) {
      items.add(
        _buildAction(
          context: context,
          icon: Icons.school_outlined,
          label: l10n.switchToLearner,
          iconColor: resolvedIconColor,
          labelStyle: labelStyle,
          onPressed: () => handlePortalRoleSwitch(
            context: context,
            ref: ref,
            targetRole: 'LEARNER',
            onBeforeSwitch: onBeforeSwitch,
          ),
          useListTileStyle: useListTileStyle,
        ),
      );
    } else if (shouldShowBecomeLearner(user)) {
      items.add(
        _buildAction(
          context: context,
          icon: Icons.school_outlined,
          label: l10n.becomeLearner,
          iconColor: resolvedIconColor,
          labelStyle: labelStyle,
          onPressed: () {
            onBeforeSwitch?.call();
            context.push(becomeLearnerRoute);
          },
          useListTileStyle: useListTileStyle,
        ),
      );
    } else if (isOrganizationSupplierWithoutLearnerSwitch(user) &&
        user.isSupplierMode) {
      items.add(
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 16, 8),
          child: Text(
            l10n.organizationSupplierStaysInSupplierMode,
            style: noteStyle,
          ),
        ),
      );
    }

    if (shouldShowSwitchToSupplier(user)) {
      items.add(
        _buildAction(
          context: context,
          icon: Icons.storefront_outlined,
          label: l10n.switchToSupplier,
          iconColor: resolvedIconColor,
          labelStyle: labelStyle,
          onPressed: () => handlePortalRoleSwitch(
            context: context,
            ref: ref,
            targetRole: 'SUPPLIER',
            onBeforeSwitch: onBeforeSwitch,
          ),
          useListTileStyle: useListTileStyle,
        ),
      );
    }

    return items;
  }

  static Widget _buildAction({
    required BuildContext context,
    required IconData icon,
    required String label,
    required Color iconColor,
    required TextStyle? labelStyle,
    required VoidCallback onPressed,
    required bool useListTileStyle,
  }) {
    if (useListTileStyle) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: AppRadius.smAll,
          hoverColor: iconColor.withValues(alpha: 0.10),
          splashColor: iconColor.withValues(alpha: 0.14),
          highlightColor: iconColor.withValues(alpha: 0.08),
          focusColor: iconColor.withValues(alpha: 0.12),
          mouseCursor: SystemMouseCursors.click,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                Icon(icon, color: iconColor, size: 20),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: Text(label, style: labelStyle)),
              ],
            ),
          ),
        ),
      );
    }

    return MenuItemButton(
      onPressed: onPressed,
      leadingIcon: Icon(icon, color: iconColor, size: 20),
      child: Text(label, style: labelStyle),
    );
  }
}

void showAppInlineErrorSnackBar(
  ScaffoldMessengerState messenger,
  String message,
) {
  messenger.showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}
