import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../auth/application/auth_controller.dart';
import '../l10n/ai_l10n.dart';
import '../../application/ai_assistant_shell_provider.dart';

class AiAssistantLauncher extends ConsumerWidget {
  const AiAssistantLauncher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final isLearner = user != null && user.hasRole('LEARNER');
    final shellState = ref.watch(aiAssistantShellProvider);

    if (!isLearner || shellState.isOpen) {
      return const SizedBox.shrink();
    }

    // Hide on transaction-heavy reservation surfaces so the FAB cannot cover CTAs.
    final path = GoRouterState.of(context).uri.path;
    if (path == '/learner/reservations' ||
        path.startsWith('/learner/reservations/')) {
      return const SizedBox.shrink();
    }

    final colors = AppThemeColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final isMobile = MediaQuery.sizeOf(context).width < 600;
    final navOffset = isMobile ? 88.0 : 24.0;

    return PositionedDirectional(
      end: AppSpacing.lg,
      bottom: bottomInset + navOffset,
      child: Semantics(
        button: true,
        label: AiL10n.launcherTooltip.resolve(context),
        child: Tooltip(
          message: AiL10n.launcherTooltip.resolve(context),
          child: Material(
            elevation: 6,
            color: colors.primary,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () =>
                  ref.read(aiAssistantShellProvider.notifier).open(),
              child: const SizedBox(
                width: 56,
                height: 56,
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 26,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
