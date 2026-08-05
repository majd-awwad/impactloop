import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_builds_providers.dart';
import '../../data/models/learner_build_models.dart';
import '../l10n/learner_builds_l10n.dart';
import '../widgets/learner_build_list_widgets.dart';

const _kMaxContentWidth = 920.0;

class PortfolioPage extends ConsumerWidget {
  const PortfolioPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
              phoneTitle: LearnerBuildsL10n.portfolioTitle.resolve(context),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
                    child: const _PortfolioContent(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PortfolioContent extends ConsumerWidget {
  const _PortfolioContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final portfolioAsync = ref.watch(learnerPortfolioProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () => context.popOrGo('/home'),
              icon: const Icon(Icons.arrow_back_rounded),
              tooltip: 'Back',
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                LearnerBuildsL10n.portfolioTitle.resolve(context),
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 48),
          child: Text(
            LearnerBuildsL10n.portfolioSubtitle.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        portfolioAsync.when(
          loading: () => const _PortfolioLoadingSkeleton(),
          error: (_, _) => LearnerBuildsStatePanel(
            icon: Icons.cloud_off_outlined,
            title: LearnerBuildsL10n.portfolioLoadError.resolve(context),
            actionLabel: LearnerBuildsL10n.retry.resolve(context),
            onAction: () => ref.invalidate(learnerPortfolioProvider),
          ),
          data: (result) => _portfolioBody(context, result),
        ),
      ],
    );
  }

  Widget _portfolioBody(BuildContext context, LearnerBuildListResult result) {
    if (result.items.isEmpty) {
      return LearnerBuildsEmptyState(
        title: LearnerBuildsL10n.emptyPortfolioTitle.resolve(context),
        subtitle: LearnerBuildsL10n.emptyPortfolioSubtitle.resolve(context),
        actionLabel: LearnerBuildsL10n.exploreProjects.resolve(context),
        onAction: () => context.go('/learning'),
      );
    }

    return Column(
      children: result.items
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: LearnerBuildListCard(
                item: item,
                showImpactSummary: false,
                showPortfolioLearning: true,
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _PortfolioLoadingSkeleton extends StatelessWidget {
  const _PortfolioLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    Widget line({required double width, double height = 14}) {
      return Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: palette.borderSubtle.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(6),
        ),
      );
    }

    Widget card() {
      return Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: palette.panelSurface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Row(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: palette.borderSubtle.withValues(alpha: 0.45),
                borderRadius: AppRadius.mdAll,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  line(width: 96, height: 12),
                  const SizedBox(height: AppSpacing.sm),
                  line(width: double.infinity, height: 18),
                  const SizedBox(height: AppSpacing.xs),
                  line(width: 180, height: 12),
                  const SizedBox(height: AppSpacing.sm),
                  line(width: 140, height: 12),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        card(),
        const SizedBox(height: AppSpacing.md),
        card(),
      ],
    );
  }
}
