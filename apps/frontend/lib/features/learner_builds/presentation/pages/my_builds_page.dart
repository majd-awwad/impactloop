import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_builds_providers.dart';
import '../l10n/learner_builds_l10n.dart';
import '../widgets/learner_build_list_widgets.dart';

const _kMaxContentWidth = 920.0;

class MyBuildsPage extends ConsumerWidget {
  const MyBuildsPage({super.key});

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
              phoneTitle: LearnerBuildsL10n.myBuildsTitle.resolve(context),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
                    child: const _MyBuildsContent(),
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

class _MyBuildsContent extends ConsumerWidget {
  const _MyBuildsContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final buildsAsync = ref.watch(learnerBuildsListProvider);
    final query = ref.watch(learnerBuildsQueryProvider);
    final selectedStatus = query.status ?? 'ACTIVE';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const AppBackAction(fallbackLocation: '/home'),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                LearnerBuildsL10n.myBuildsTitle.resolve(context),
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
            LearnerBuildsL10n.myBuildsSubtitle.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        LearnerBuildStatusTabs(
          selected: selectedStatus,
          onSelected: (status) =>
              ref.read(learnerBuildsQueryProvider.notifier).setStatus(status),
        ),
        const SizedBox(height: AppSpacing.lg),
        buildsAsync.when(
          loading: () => LearnerBuildsStatePanel(
            icon: Icons.hourglass_empty_rounded,
            title: LearnerBuildsL10n.loading.resolve(context),
          ),
          error: (_, _) => LearnerBuildsStatePanel(
            icon: Icons.cloud_off_outlined,
            title: LearnerBuildsL10n.loadError.resolve(context),
            actionLabel: LearnerBuildsL10n.retry.resolve(context),
            onAction: () => ref.invalidate(learnerBuildsListProvider),
          ),
          data: (result) {
            if (result.items.isEmpty) {
              return LearnerBuildsEmptyState(
                title: LearnerBuildsL10n.emptyTitle.resolve(context),
                subtitle: _emptySubtitleForStatus(selectedStatus).resolve(
                  context,
                ),
                actionLabel: selectedStatus == 'ACTIVE'
                    ? LearnerBuildsL10n.browseLearningHub.resolve(context)
                    : null,
                onAction: selectedStatus == 'ACTIVE'
                    ? () => context.go('/learning')
                    : null,
              );
            }

            return Column(
              children: result.items
                  .map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: LearnerBuildListCard(item: item),
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
      ],
    );
  }

  LocalizedText _emptySubtitleForStatus(String status) {
    return switch (status) {
      'PAUSED' => LearnerBuildsL10n.emptyPausedSubtitle,
      'COMPLETED' => LearnerBuildsL10n.emptyCompletedSubtitle,
      'ARCHIVED' => LearnerBuildsL10n.emptyArchivedSubtitle,
      _ => LearnerBuildsL10n.emptyActiveSubtitle,
    };
  }
}
