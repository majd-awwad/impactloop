import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
import '../../application/auth_controller.dart';
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
  }) {
    final items = <Widget>[];

    if (shouldShowSwitchToLearner(user)) {
      items.add(
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.school_outlined, size: 20),
          title: Text('Switch to Learner', style: labelStyle),
          onTap: () => handlePortalRoleSwitch(
            context: context,
            ref: ref,
            targetRole: 'LEARNER',
            onBeforeSwitch: onBeforeSwitch,
          ),
          dense: true,
          visualDensity: VisualDensity.compact,
        ),
      );
    } else if (isOrganizationSupplierWithoutLearnerSwitch(user) &&
        user.isSupplierMode) {
      items.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'Organization supplier accounts stay in supplier mode.',
            style: noteStyle,
          ),
        ),
      );
    }

    if (shouldShowSwitchToSupplier(user)) {
      items.add(
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.storefront_outlined, size: 20),
          title: Text('Switch to Supplier', style: labelStyle),
          onTap: () => handlePortalRoleSwitch(
            context: context,
            ref: ref,
            targetRole: 'SUPPLIER',
            onBeforeSwitch: onBeforeSwitch,
          ),
          dense: true,
          visualDensity: VisualDensity.compact,
        ),
      );
    }

    return items;
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
