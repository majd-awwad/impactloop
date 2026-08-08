import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../profile/application/profile_providers.dart';
import '../../../profile/data/models/learner_profile_summary.dart';
import 'empty_activity_card.dart';
import 'home_section_header.dart';

class LearnerImpactSnapshotSection extends ConsumerWidget {
  const LearnerImpactSnapshotSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const SizedBox.shrink();
    }

    final summaryAsync = ref.watch(learnerProfileSummaryProvider(user.id));

    return summaryAsync.when(
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomeSectionHeader(
            title: context.l10n.impactSnapshot,
            subtitle: context.l10n.impactSnapshotSubtitle,
          ),
          const SizedBox(height: AppSpacing.md),
          const _ImpactSnapshotLoadingCard(),
        ],
      ),
      error: (_, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          HomeSectionHeader(
            title: context.l10n.impactSnapshot,
            subtitle: context.l10n.impactSnapshotSubtitle,
          ),
          const SizedBox(height: AppSpacing.md),
          EmptyActivityCard(
            icon: Icons.cloud_off_outlined,
            title: context.l10n.somethingWentWrong,
            description: context.l10n.tryAgain,
            actionLabel: context.l10n.retry,
            onAction: () =>
                ref.invalidate(learnerProfileSummaryProvider(user.id)),
          ),
        ],
      ),
      data: (summary) => _ImpactSnapshotContent(journey: summary.journey),
    );
  }
}

class _ImpactSnapshotContent extends StatelessWidget {
  const _ImpactSnapshotContent({required this.journey});

  final LearnerJourneySummary journey;

  bool get _hasAnyActivity =>
      journey.completedReservationsCount > 0 ||
      journey.completedBuildsCount > 0 ||
      journey.activeReservationsCount > 0 ||
      journey.activeBuildsCount > 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: l10n.impactSnapshot,
          subtitle: l10n.impactSnapshotSubtitle,
        ),
        const SizedBox(height: AppSpacing.md),
        if (_hasAnyActivity)
          _ImpactSnapshotMetricsCard(journey: journey)
        else
          EmptyActivityCard(
            icon: Icons.eco_outlined,
            title: l10n.impactSnapshot,
            description: l10n.impactSnapshotDescription,
            actionLabel: l10n.browseMaterialsAction,
            onAction: () => context.go('/materials'),
          ),
      ],
    );
  }
}

class _ImpactSnapshotMetricsCard extends StatelessWidget {
  const _ImpactSnapshotMetricsCard({required this.journey});

  final LearnerJourneySummary journey;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final numberFormat = MaterialLocalizations.of(context).formatDecimal;

    final metrics = [
      _ImpactMetricData(
        label: l10n.impactSnapshotCompletedPickups,
        count: journey.completedReservationsCount,
        icon: Icons.recycling_outlined,
        onTap: () => context.go(learnerReservationsRoute),
      ),
      _ImpactMetricData(
        label: l10n.impactSnapshotCompletedBuilds,
        count: journey.completedBuildsCount,
        icon: Icons.task_alt_rounded,
        onTap: () => context.go(learnerPortfolioRoute),
      ),
      _ImpactMetricData(
        label: l10n.impactSnapshotActiveReservations,
        count: journey.activeReservationsCount,
        icon: Icons.pending_actions_rounded,
        onTap: () => context.go(learnerReservationsRoute),
      ),
      _ImpactMetricData(
        label: l10n.impactSnapshotActiveBuilds,
        count: journey.activeBuildsCount,
        icon: Icons.construction_rounded,
        onTap: () => context.go('/learning'),
      ),
    ];

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            Color.lerp(palette.cardSurface, palette.mint, 0.08)!,
            palette.cardSurface,
          ],
        ),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var row = 0; row < 2; row++) ...[
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _ImpactMetricTile(metric: metrics[row * 2]),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _ImpactMetricTile(metric: metrics[row * 2 + 1]),
                  ),
                ],
              ),
            ),
            if (row == 0) const SizedBox(height: AppSpacing.sm),
          ],
          if (journey.activeBuildsCount > 0 ||
              journey.activeReservationsCount > 0) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.impactSnapshotInProgressNote(
                numberFormat(journey.activeReservationsCount),
                numberFormat(journey.activeBuildsCount),
              ),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ImpactMetricData {
  const _ImpactMetricData({
    required this.label,
    required this.count,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final int count;
  final IconData icon;
  final VoidCallback onTap;
}

class _ImpactMetricTile extends StatelessWidget {
  const _ImpactMetricTile({required this.metric});

  final _ImpactMetricData metric;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final count = MaterialLocalizations.of(context).formatDecimal(metric.count);

    return Semantics(
      button: true,
      label: '${metric.label}, $count',
      child: Material(
        color: palette.cardSurface.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: metric.onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            constraints: const BoxConstraints(minHeight: 104),
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(metric.icon, color: palette.mint, size: 20),
                const Spacer(),
                Text(
                  count,
                  style: AppTextStyles.title(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  metric.label,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ImpactSnapshotLoadingCard extends StatelessWidget {
  const _ImpactSnapshotLoadingCard();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      height: 220,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: const CircularProgressIndicator(),
    );
  }
}
