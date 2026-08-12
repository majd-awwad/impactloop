import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/entity_attribution_footer.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

String publicUserRoute(String userId) =>
    '/users/${Uri.encodeComponent(userId)}';

class LearningProjectCreatorFooter extends StatelessWidget {
  const LearningProjectCreatorFooter({
    super.key,
    required this.creator,
    this.compact = false,
  });

  final LearningProjectCreator creator;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return EntityAttributionFooter(
      displayName: creator.displayName,
      avatarUrl: creator.avatarUrl,
      compact: compact,
      onTap: () => context.push(publicUserRoute(creator.id)),
      semanticsLabel: context.l10n.learningViewCreatorProfile(
        creator.displayName,
      ),
    );
  }
}

class LearningProjectCreatorRow extends StatelessWidget {
  const LearningProjectCreatorRow({super.key, required this.creator});

  final LearningProjectCreator creator;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final route = publicUserRoute(creator.id);
    final identity = Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: () => context.push(route),
        child: Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            vertical: AppSpacing.xs,
          ),
          child: Row(
            children: [
              UserAvatar(
                displayName: creator.displayName,
                profileImageUrl: creator.avatarUrl,
                radius: 20,
                backgroundColor: palette.cardSurface,
                foregroundColor: palette.textPrimary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      creator.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      context.l10n.learningProjectCreator,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    final profileButton = OutlinedButton(
      onPressed: () => context.push(route),
      child: Text(context.l10n.learningViewProfile),
    );

    return Container(
      key: const ValueKey('learning-project-creator-panel'),
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.mutedChip,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 460) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                identity,
                const SizedBox(height: AppSpacing.sm),
                profileButton,
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: identity),
              const SizedBox(width: AppSpacing.md),
              profileButton,
            ],
          );
        },
      ),
    );
  }
}
