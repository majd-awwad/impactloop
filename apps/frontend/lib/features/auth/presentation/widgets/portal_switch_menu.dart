import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_route_helpers.dart';
import '../../application/portal_navigation.dart';
import '../../data/models/user.dart';

Future<void> handlePortalRoleSwitch({
  required BuildContext context,
  required WidgetRef ref,
  required String targetRole,
  VoidCallback? onBeforeSwitch,
}) async {
  final router = GoRouter.of(context);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final authController = ref.read(authControllerProvider.notifier);

  onBeforeSwitch?.call();

  try {
    final user = await authController.switchActiveRole(targetRole);

    router.go(oppositePortalSwitchRoute(user, targetRole));
  } on ApiException catch (error) {
    if (messenger == null) {
      return;
    }

    showAppInlineErrorSnackBar(messenger, error.displayMessage);
  }
}

class PortalModeLabel extends StatelessWidget {
  const PortalModeLabel({super.key, required this.user, this.style});

  final User user;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Text(activePortalModeLabel(user), style: style);
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

    if (shouldShowSwitchToLearner(user)) {
      items.add(
        _buildAction(
          context: context,
          icon: Icons.school_outlined,
          label: 'Switch to Learner',
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
          label: 'Become a Learner',
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
            'Organization supplier accounts stay in supplier mode.',
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
          label: 'Switch to Supplier',
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
      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: iconColor, size: 20),
        title: Text(label, style: labelStyle),
        onTap: onPressed,
        dense: true,
        visualDensity: VisualDensity.compact,
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
