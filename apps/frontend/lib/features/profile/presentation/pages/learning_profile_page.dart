import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../l10n/learner_profile_l10n.dart';
import '../widgets/learning_profile_widgets.dart';
import '../widgets/profile_image_picker.dart';

class LearningProfilePage extends ConsumerWidget {
  const LearningProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = LearnerProfileL10n.of(context);
    final user = ref.watch(authControllerProvider).user;
    void onEdit() => context.push(learnerProfileEditRoute);

    return ProfileSubpageScaffold(
      title: l10n.learnerProfile,
      backFallbackRoute: profileRoute,
      backTooltip: l10n.back,
      headerAction: user == null
          ? null
          : _LearningProfileHeaderAction(
              label: user.learnerProfile == null ? l10n.setUp : l10n.edit,
              tooltip: user.learnerProfile == null
                  ? l10n.setUpLearningProfile
                  : l10n.editLearningProfile,
              onPressed: onEdit,
            ),
      child: user == null
          ? AppEmptyStateCard(
              icon: Icons.person_outline_rounded,
              title: l10n.learnerProfile,
              subtitle: l10n.signInToViewProfile,
              compact: true,
            )
          : LearningProfileContent(profile: user.learnerProfile),
    );
  }
}

class _LearningProfileHeaderAction extends StatelessWidget {
  const _LearningProfileHeaderAction({
    required this.label,
    required this.tooltip,
    required this.onPressed,
  });

  final String label;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final compact =
        MediaQuery.sizeOf(context).width < 360 ||
        MediaQuery.textScalerOf(context).scale(1) > 1.3;
    if (compact) {
      return IconButton.outlined(
        onPressed: onPressed,
        tooltip: tooltip,
        icon: const Icon(Icons.edit_outlined, size: 20),
      );
    }

    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.edit_outlined, size: 18),
      label: Text(label),
    );
  }
}
