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

    return ProfileSubpageScaffold(
      title: l10n.learnerProfile,
      backFallbackRoute: profileRoute,
      backTooltip: l10n.back,
      child: user == null
          ? AppEmptyStateCard(
              icon: Icons.person_outline_rounded,
              title: l10n.learnerProfile,
              subtitle: l10n.signInToViewProfile,
              compact: true,
            )
          : LearningProfileContent(
              profile: user.learnerProfile,
              onEdit: () => context.push(learnerProfileEditRoute),
            ),
    );
  }
}
