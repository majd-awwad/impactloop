import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/widgets/entry_nav_bar.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/widgets/app_empty_state_card.dart';
import '../../learning_hub/presentation/theme/learning_ui_palette.dart';
import '../../learning_hub/presentation/widgets/learning_project_card.dart';
import '../../learning_hub/presentation/widgets/learning_project_card_layout.dart';
import '../application/public_user_profile_providers.dart';
import '../data/public_user_profile_models.dart';
import 'public_user_profile_widgets.dart';

class PublicUserProfilePage extends ConsumerWidget {
  const PublicUserProfilePage({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = LearningUiPalette.of(context);
    final profile = ref.watch(publicUserProfileProvider(userId));
    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: profile.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: AppEmptyStateCard(
                    icon: Icons.person_off_outlined,
                    title: context.l10n.publicUserProfileUnavailable,
                    subtitle: context.l10n.publicUserProfileUnavailableBody,
                    actions: [
                      OutlinedButton(
                        onPressed: () =>
                            ref.invalidate(publicUserProfileProvider(userId)),
                        child: Text(context.l10n.tryAgain),
                      ),
                    ],
                  ),
                ),
                data: (bundle) => _PublicUserProfileBody(bundle: bundle),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PublicUserProfileBody extends StatelessWidget {
  const _PublicUserProfileBody({required this.bundle});

  final PublicUserProfileBundle bundle;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final profile = bundle.profile;
    final bio = profile.bio;
    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1200),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PublicUserProfileIdentity(profile: profile),
              if (bio != null) ...[
                const SizedBox(height: AppSpacing.lg),
                PublicUserProfileAbout(bio: bio),
              ],
              if (profile.interests.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                PublicUserProfileInterests(interests: profile.interests),
              ],
              const SizedBox(height: AppSpacing.lg),
              PublicUserProfileStats(profile: profile),
              const SizedBox(height: AppSpacing.lg),
              Text(
                context.l10n.publicUserPublishedProjects,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.md),
              if (bundle.projects.items.isEmpty)
                AppEmptyStateCard(
                  icon: Icons.school_outlined,
                  title: context.l10n.publicUserNoPublishedProjects,
                  subtitle: context.l10n.publicUserNoPublishedProjectsBody,
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;
                    if (LearningProjectCardLayout.useCompactList(width)) {
                      return Column(
                        children: [
                          for (
                            var index = 0;
                            index < bundle.projects.items.length;
                            index++
                          ) ...[
                            if (index > 0)
                              const SizedBox(height: AppSpacing.sm),
                            LearningProjectCompactCard(
                              project: bundle.projects.items[index],
                              showCreatorAttribution: false,
                            ),
                          ],
                        ],
                      );
                    }

                    final columns = LearningProjectCardLayout.columnsForWidth(
                      width,
                    );
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: bundle.projects.items.length,
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        crossAxisSpacing: AppSpacing.md,
                        mainAxisSpacing: AppSpacing.md,
                        mainAxisExtent:
                            LearningProjectCardLayout.gridCardHeight,
                      ),
                      itemBuilder: (context, index) => LearningProjectCard(
                        project: bundle.projects.items[index],
                        showCreatorAttribution: false,
                      ),
                    );
                  },
                ),
              if (profile.supplier case final supplier?) ...[
                const SizedBox(height: AppSpacing.lg),
                PublicUserSupplierLinkCard(supplier: supplier),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
