import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/widgets/entry_nav_bar.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/widgets/app_empty_state_card.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../learning_hub/presentation/theme/learning_ui_palette.dart';
import '../../learning_hub/presentation/widgets/learning_project_card.dart';
import '../../learning_hub/presentation/widgets/learning_project_card_layout.dart';
import '../application/public_user_profile_providers.dart';
import '../data/public_user_profile_models.dart';

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
              _PublicUserProfileHero(profile: profile),
              if (profile.supplier case final supplier?) ...[
                const SizedBox(height: AppSpacing.md),
                _SupplierActivityCard(supplier: supplier),
              ],
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
                    final columns = LearningProjectCardLayout.columnsForWidth(
                      constraints.maxWidth,
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
            ],
          ),
        ),
      ),
    );
  }
}

class _PublicUserProfileHero extends StatelessWidget {
  const _PublicUserProfileHero({required this.profile});

  final PublicUserProfile profile;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      key: const ValueKey('public-user-profile-hero'),
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            palette.heroStart,
            palette.cardSurface.withValues(alpha: 0.96),
            palette.heroEnd,
          ],
        ),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 720;
          final identity = Row(
            children: [
              UserAvatar(
                displayName: profile.displayName,
                profileImageUrl: profile.avatarUrl,
                radius: compact ? 36 : 44,
                backgroundColor: palette.cardSurface,
                foregroundColor: palette.textPrimary,
              ),
              SizedBox(width: compact ? AppSpacing.md : AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      profile.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.display(context).copyWith(
                        color: palette.textPrimary,
                        fontSize: compact ? 23 : 27,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: profile.publicRoles
                          .map(
                            (role) => Chip(
                              visualDensity: VisualDensity.compact,
                              side: BorderSide(color: palette.borderSubtle),
                              backgroundColor: palette.cardSurface.withValues(
                                alpha: 0.72,
                              ),
                              label: Text(
                                role == 'SUPPLIER'
                                    ? context.l10n.publicRoleSupplier
                                    : context.l10n.publicRoleLearner,
                              ),
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ],
                ),
              ),
            ],
          );
          final stats = <Widget>[
            _ProfileStat(
              icon: Icons.school_outlined,
              value: profile.publishedProjectsCount.toString(),
              label: context.l10n.publicUserPublishedProjects,
            ),
            if (profile.supplier case final supplier?)
              _ProfileStat(
                icon: Icons.inventory_2_outlined,
                value: supplier.availableMaterialsCount.toString(),
                label: context.l10n.supplierAvailableMaterials,
              ),
          ];

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                identity,
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: stats
                      .expand((stat) sync* {
                        if (stat != stats.first) {
                          yield const SizedBox(width: AppSpacing.sm);
                        }
                        yield Expanded(child: stat);
                      })
                      .toList(growable: false),
                ),
              ],
            );
          }

          return Row(
            children: [
              Expanded(flex: 3, child: identity),
              const SizedBox(width: AppSpacing.lg),
              Flexible(
                flex: 2,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: stats
                      .expand((stat) sync* {
                        if (stat != stats.first) {
                          yield const SizedBox(width: AppSpacing.sm);
                        }
                        yield Flexible(child: stat);
                      })
                      .toList(growable: false),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      constraints: const BoxConstraints(maxWidth: 180),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface.withValues(alpha: 0.88),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 19, color: palette.textSecondary),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _SupplierActivityCard extends StatelessWidget {
  const _SupplierActivityCard({required this.supplier});

  final PublicUserSupplierSummary supplier;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      key: const ValueKey('public-user-supplier-activity'),
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final identity = Row(
            children: [
              UserAvatar(
                displayName: supplier.displayName,
                profileImageUrl: supplier.avatarUrl,
                radius: 28,
                backgroundColor: palette.mutedChip,
                foregroundColor: palette.textPrimary,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.publicUserSupplierActivity,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                    Text(
                      supplier.displayName,
                      style: AppTextStyles.title(context),
                    ),
                    if (supplier.isVerified) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          Icon(
                            Icons.verified_rounded,
                            size: 15,
                            color: palette.lime,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            context.l10n.supplierVerified,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: palette.textSecondary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ],
                    Text(
                      context.l10n.publicUserAvailableMaterials(
                        supplier.availableMaterialsCount,
                      ),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
          final profileButton = OutlinedButton(
            onPressed: () => context.push('/suppliers/${supplier.id}'),
            child: Text(context.l10n.publicUserViewSupplierProfile),
          );

          if (constraints.maxWidth < 620) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                identity,
                const SizedBox(height: AppSpacing.md),
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
