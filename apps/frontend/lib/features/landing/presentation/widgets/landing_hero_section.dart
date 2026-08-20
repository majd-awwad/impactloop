import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/landing_colors.dart';
import '../../../../app/widgets/hero_workshop_visual.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/landing_public_providers.dart';
import '../../domain/landing_public_content.dart';
import 'landing_live_count.dart';
import 'landing_stat_format.dart';

class LandingHeroSection extends StatelessWidget {
  const LandingHeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    final useSplitLayout = MediaQuery.sizeOf(context).width >= 1040;

    if (useSplitLayout) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 11,
            child: _HeroContent(onSignIn: () => context.go('/login')),
          ),
          const SizedBox(width: AppSpacing.xxl),
          const Expanded(flex: 10, child: _LiveHeroWorkshopVisual()),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeroContent(onSignIn: () => context.go('/login')),
        const SizedBox(height: AppSpacing.xl),
        const _LiveHeroWorkshopVisual(),
      ],
    );
  }
}

class _LiveHeroWorkshopVisual extends ConsumerWidget {
  const _LiveHeroWorkshopVisual();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncContent = ref.watch(landingPublicContentProvider);
    final stats = asyncContent.asData?.value.stats;
    final unresolved = asyncContent.isLoading || asyncContent.hasError;

    return HeroWorkshopVisual(
      reusedCount: formatLandingCount(
        unresolved ? null : stats?.reusedMaterialsCount,
      ),
      publishedCount: formatLandingCount(
        unresolved ? null : stats?.publishedProjectsCount,
      ),
      availableCount: formatLandingCount(
        unresolved ? null : stats?.availableMaterialsCount,
      ),
    );
  }
}

class _HeroContent extends StatelessWidget {
  const _HeroContent({required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);
    final isNarrow = MediaQuery.sizeOf(context).width < 520;
    final isCompactPhone = MediaQuery.sizeOf(context).width < 640;
    final isMobileHero = MediaQuery.sizeOf(context).width < 700;
    final chipAccent = Theme.of(context).brightness == Brightness.dark
        ? colors.accentMint
        : colors.primary;
    final avatarColors = [
      colors.accentMint,
      colors.accentAmber,
      colors.accentBlue,
      colors.primary,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: colors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.eco_outlined, size: 16, color: chipAccent),
              const SizedBox(width: AppSpacing.xs),
              Text(
                context.l10n.landingFutureBadge,
                style: AuthDarkTextStyles.chip(
                  context,
                ).copyWith(color: chipAccent),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          context.l10n.learnReuseBuild,
          style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
            color: colors.textPrimary,
            fontSize: isNarrow ? 42 : 60,
            height: 1.0,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: isCompactPhone ? double.infinity : 560,
          ),
          child: Text(
            context.l10n.landingHeroSubtitle,
            style: AuthDarkTextStyles.brandingSubtitle(
              context,
            ).copyWith(fontSize: 18, color: colors.textSecondary),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surfaceGlass,
            borderRadius: AppRadius.xlAll,
            border: Border.all(color: colors.border),
          ),
          child: Padding(
            padding: EdgeInsets.all(
              isCompactPhone ? AppSpacing.md : AppSpacing.lg,
            ),
            child: isNarrow
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _LandingPrimaryCta(
                        label: context.l10n.createAccount,
                        icon: Icons.arrow_outward_rounded,
                        onPressed: () => context.go('/register'),
                        fullWidth: true,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _LandingOutlinedCta(
                        label: context.l10n.signIn,
                        icon: Icons.login_rounded,
                        onPressed: onSignIn,
                        fullWidth: true,
                      ),
                    ],
                  )
                : Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.sm,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _LandingPrimaryCta(
                        label: context.l10n.createAccount,
                        icon: Icons.arrow_outward_rounded,
                        onPressed: () => context.go('/register'),
                      ),
                      _LandingOutlinedCta(
                        label: context.l10n.signIn,
                        icon: Icons.login_rounded,
                        onPressed: onSignIn,
                      ),
                      Text(
                        context.l10n.landingCtaNote,
                        style: AuthDarkTextStyles.body(
                          context,
                        ).copyWith(color: colors.textMuted),
                      ),
                    ],
                  ),
          ),
        ),
        if (!isMobileHero) ...[
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth < 560) {
                return Row(
                  children: [
                    Expanded(
                      child: _HeroMetricCard(
                        label: context.l10n.landingAvailableMaterials,
                        kind: LandingStatKind.availableMaterials,
                        icon: Icons.inventory_2_outlined,
                      ),
                    ),
                    SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _HeroMetricCard(
                        label: context.l10n.landingPublishedProjects,
                        kind: LandingStatKind.publishedProjects,
                        icon: Icons.school_outlined,
                      ),
                    ),
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(
                    child: _HeroMetricCard(
                      label: context.l10n.landingAvailableMaterials,
                      kind: LandingStatKind.availableMaterials,
                      icon: Icons.inventory_2_outlined,
                    ),
                  ),
                  SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _HeroMetricCard(
                      label: context.l10n.landingPublishedProjects,
                      kind: LandingStatKind.publishedProjects,
                      icon: Icons.school_outlined,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.surfaceSoft,
              borderRadius: AppRadius.lgAll,
              border: Border.all(
                color: colors.borderStrong.withValues(alpha: 0.7),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _LandingCommunityAvatars(fallbackColors: avatarColors),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    context.l10n.landingCommunity,
                    style: AuthDarkTextStyles.body(
                      context,
                    ).copyWith(color: colors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _HeroMetricCard extends StatelessWidget {
  const _HeroMetricCard({
    required this.label,
    required this.kind,
    required this.icon,
  });

  final String label;
  final LandingStatKind kind;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(icon, size: 18, color: colors.accentMint),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  LandingLiveCount(
                    kind: kind,
                    style: AuthDarkTextStyles.title(
                      context,
                    ).copyWith(color: colors.textPrimary, fontSize: 18),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AuthDarkTextStyles.label(
                      context,
                    ).copyWith(color: colors.textMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LandingPrimaryCta extends StatelessWidget {
  const _LandingPrimaryCta({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.fullWidth = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    final button = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.lgAll,
        boxShadow: [
          BoxShadow(
            color: colors.primary.withValues(alpha: 0.22),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: colors.primary,
          foregroundColor: colors.textOnPrimary,
          minimumSize: const Size(0, 58),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
        ),
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(
          label,
          style: AuthDarkTextStyles.body(
            context,
          ).copyWith(color: colors.textOnPrimary, fontWeight: FontWeight.w800),
        ),
      ),
    );

    if (fullWidth) {
      return SizedBox(width: double.infinity, child: button);
    }

    return button;
  }
}

class _LandingOutlinedCta extends StatelessWidget {
  const _LandingOutlinedCta({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.fullWidth = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    final button = OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        side: BorderSide(color: colors.borderStrong),
        minimumSize: const Size(0, 58),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        backgroundColor: colors.surfaceElevated.withValues(alpha: 0.75),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      ),
      onPressed: onPressed,
      icon: Icon(icon, size: 20, color: colors.textSecondary),
      label: Text(
        label,
        style: AuthDarkTextStyles.body(
          context,
        ).copyWith(color: colors.textPrimary, fontWeight: FontWeight.w700),
      ),
    );

    if (fullWidth) {
      return SizedBox(width: double.infinity, child: button);
    }

    return button;
  }
}

class _LandingCommunityAvatars extends ConsumerWidget {
  const _LandingCommunityAvatars({required this.fallbackColors});

  final List<Color> fallbackColors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = LandingColors.of(context);
    final members =
        ref
            .watch(landingPublicContentProvider)
            .asData
            ?.value
            .communityMembers ??
        const <LandingCommunityMember>[];

    return SizedBox(
      width: 88,
      height: 36,
      child: Stack(
        children: [
          for (var index = 0; index < 4; index++)
            PositionedDirectional(
              start: index * 22.0,
              child: index < members.length
                  ? UserAvatar(
                      displayName: members[index].displayName,
                      profileImageUrl: members[index].avatarUrl,
                      radius: 18,
                      backgroundColor: fallbackColors[index],
                      foregroundColor: colors.textOnPrimary,
                    )
                  : CircleAvatar(
                      radius: 18,
                      backgroundColor: fallbackColors[index],
                      child: Icon(
                        Icons.person,
                        size: 18,
                        color: colors.textOnPrimary,
                      ),
                    ),
            ),
        ],
      ),
    );
  }
}
