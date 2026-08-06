import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/project_help_sessions_providers.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/author_help_session_list_card.dart';

class CreatorHelpSessionsPage extends ConsumerStatefulWidget {
  const CreatorHelpSessionsPage({super.key, this.initialProjectId});

  final String? initialProjectId;

  @override
  ConsumerState<CreatorHelpSessionsPage> createState() =>
      _CreatorHelpSessionsPageState();
}

class _CreatorHelpSessionsPageState
    extends ConsumerState<CreatorHelpSessionsPage> {
  @override
  void initState() {
    super.initState();
    final projectId = widget.initialProjectId?.trim();
    if (projectId != null && projectId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        ref.read(authorHelpSessionsQueryProvider.notifier).setProjectId(projectId);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final query = ref.watch(authorHelpSessionsQueryProvider);
    final sessionsAsync = ref.watch(authorHelpSessionsProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/profile',
              phoneTitle: ProjectHelpSessionsL10n.authorListTitle.resolve(context),
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
                          ProjectHelpSessionsL10n.authorListSubtitle.resolve(context),
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _AuthorFilterBar(
                          selected: query.filter,
                          onSelected: (filter) => ref
                              .read(authorHelpSessionsQueryProvider.notifier)
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
                              title: ProjectHelpSessionsL10n.retry.resolve(context),
                              subtitle: ProjectHelpSessionsL10n.localizedError(null)
                                  .resolve(context),
                              actions: [
                                FilledButton(
                                  onPressed: () =>
                                      ref.invalidate(authorHelpSessionsProvider),
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
                                  title: ProjectHelpSessionsL10n.authorEmptyTitle
                                      .resolve(context),
                                  subtitle: ProjectHelpSessionsL10n.authorEmptyBody
                                      .resolve(context),
                                  actions: [
                                    FilledButton(
                                      onPressed: () =>
                                          context.go('/learning/submissions'),
                                      child: Text(
                                        ProjectHelpSessionsL10n.manageMyProjects
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
                                    AuthorHelpSessionListCard(
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

class _AuthorFilterBar extends StatelessWidget {
  const _AuthorFilterBar({
    required this.selected,
    required this.onSelected,
  });

  final AuthorHelpSessionListFilter selected;
  final ValueChanged<AuthorHelpSessionListFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final options = [
      (AuthorHelpSessionListFilter.all, ProjectHelpSessionsL10n.filterAll),
      (AuthorHelpSessionListFilter.newRequests, ProjectHelpSessionsL10n.authorFilterNew),
      (
        AuthorHelpSessionListFilter.waitingForLearner,
        ProjectHelpSessionsL10n.authorFilterWaiting,
      ),
      (
        AuthorHelpSessionListFilter.scheduled,
        ProjectHelpSessionsL10n.filterScheduled,
      ),
      (
        AuthorHelpSessionListFilter.needsAction,
        ProjectHelpSessionsL10n.authorFilterNeedsAction,
      ),
      (AuthorHelpSessionListFilter.closed, ProjectHelpSessionsL10n.authorFilterClosed),
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
