import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/project_help_sessions_providers.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/help_session_list_card.dart';

class LearnerHelpSessionsPage extends ConsumerWidget {
  const LearnerHelpSessionsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final query = ref.watch(learnerHelpSessionsQueryProvider);
    final sessionsAsync = ref.watch(learnerHelpSessionsProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/profile',
              phoneTitle: ProjectHelpSessionsL10n.listTitle.resolve(context),
            ),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 920),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          ProjectHelpSessionsL10n.listSubtitle.resolve(context),
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _FilterBar(
                          selected: query.filter,
                          onSelected: (filter) => ref
                              .read(learnerHelpSessionsQueryProvider.notifier)
                              .setFilter(filter),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Expanded(
                          child: sessionsAsync.when(
                            loading: () => const Center(
                              child: CircularProgressIndicator(),
                            ),
                            error: (_, _) => AppEmptyStateCard(
                              icon: Icons.error_outline,
                              title: ProjectHelpSessionsL10n.retry
                                  .resolve(context),
                              subtitle: ProjectHelpSessionsL10n.localizedError(null)
                                  .resolve(context),
                              actions: [
                                FilledButton(
                                  onPressed: () =>
                                      ref.invalidate(learnerHelpSessionsProvider),
                                  child: Text(
                                    ProjectHelpSessionsL10n.retry.resolve(context),
                                  ),
                                ),
                              ],
                            ),
                            data: (result) {
                              if (result.items.isEmpty) {
                                return AppEmptyStateCard(
                                  icon: Icons.support_agent_outlined,
                                  title: ProjectHelpSessionsL10n.emptyTitle
                                      .resolve(context),
                                  subtitle: ProjectHelpSessionsL10n.emptyBody
                                      .resolve(context),
                                  actions: [
                                    FilledButton(
                                      onPressed: () => context.go('/learning'),
                                      child: Text(
                                        ProjectHelpSessionsL10n.backToProjects
                                            .resolve(context),
                                      ),
                                    ),
                                  ],
                                );
                              }
                              return ListView.separated(
                                itemCount: result.items.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: AppSpacing.sm),
                                itemBuilder: (context, index) =>
                                    HelpSessionListCard(
                                  session: result.items[index],
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
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

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.selected,
    required this.onSelected,
  });

  final LearnerHelpSessionListFilter selected;
  final ValueChanged<LearnerHelpSessionListFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final options = [
      (LearnerHelpSessionListFilter.all, ProjectHelpSessionsL10n.filterAll),
      (LearnerHelpSessionListFilter.active, ProjectHelpSessionsL10n.filterActive),
      (
        LearnerHelpSessionListFilter.scheduled,
        ProjectHelpSessionsL10n.filterScheduled,
      ),
      (
        LearnerHelpSessionListFilter.completed,
        ProjectHelpSessionsL10n.filterCompleted,
      ),
      (LearnerHelpSessionListFilter.closed, ProjectHelpSessionsL10n.filterClosed),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final option in options)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
              child: FilterChip(
                label: Text(option.$2.resolve(context)),
                selected: selected == option.$1,
                onSelected: (_) => onSelected(option.$1),
              ),
            ),
        ],
      ),
    );
  }
}
