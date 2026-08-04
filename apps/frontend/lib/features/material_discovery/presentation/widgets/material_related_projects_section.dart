import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../learning_hub/application/learning_hub_providers.dart';
import '../../application/material_related_projects_providers.dart';
import '../l10n/material_related_projects_l10n.dart';
import 'material_related_project_card.dart';

class MaterialRelatedProjectsSection extends ConsumerStatefulWidget {
  const MaterialRelatedProjectsSection({
    super.key,
    required this.materialId,
  });

  final String materialId;

  @override
  ConsumerState<MaterialRelatedProjectsSection> createState() =>
      _MaterialRelatedProjectsSectionState();
}

class _MaterialRelatedProjectsSectionState
    extends ConsumerState<MaterialRelatedProjectsSection> {
  final Set<String> _busyProjectIds = <String>{};
  final List<MaterialRelatedProjectItem> _extraItems =
      <MaterialRelatedProjectItem>[];
  int _currentPage = 1;
  int _totalPages = 0;
  bool _isLoadingMore = false;
  bool _hasLoadMoreError = false;

  @override
  void didUpdateWidget(covariant MaterialRelatedProjectsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.materialId != widget.materialId) {
      _resetPagination();
    }
  }

  void _resetPagination() {
    _extraItems.clear();
    _currentPage = 1;
    _totalPages = 0;
    _isLoadingMore = false;
    _hasLoadMoreError = false;
  }

  Future<void> _handlePrimaryAction(MaterialRelatedProjectItem item) async {
    final projectId = item.projectId;
    final destination = '/learning/$projectId/build';
    final learnerContext = item.learnerContext;
    final l10n = MaterialRelatedProjectsL10n.of(context);

    if (learnerContext == null ||
        learnerContext.buildStatus == 'COMPLETED' ||
        learnerContext.action == null) {
      context.push('/learning/$projectId');
      return;
    }

    if (learnerContext.action ==
        MaterialRelatedProjectLearnerAction.continueBuild) {
      context.go(destination);
      return;
    }

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      context.go('/login?from=${Uri.encodeQueryComponent(destination)}');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(
        context,
        l10n.t(
          'Use a learner account to start builds.',
          'استخدم حساب متعلّم لبدء التنفيذ.',
        ),
      );
      return;
    }

    setState(() => _busyProjectIds.add(projectId));
    try {
      await ref.read(learningHubRepositoryProvider).startBuild(projectId);
      ref.invalidate(projectBuildProvider(projectId));
      invalidateMaterialRelatedProjects(ref, widget.materialId);
      _resetPagination();
      if (mounted) {
        context.go(destination);
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _busyProjectIds.remove(projectId));
      }
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || _currentPage >= _totalPages) {
      return;
    }

    setState(() {
      _isLoadingMore = true;
      _hasLoadMoreError = false;
    });

    try {
      final initialItems = ref
          .read(materialRelatedProjectsInitialProvider(widget.materialId))
          .asData
          ?.value
          .items ?? const <MaterialRelatedProjectItem>[];

      final nextPage = await ref
          .read(materialRelatedProjectsApiProvider)
          .fetchRelatedProjects(
            materialId: widget.materialId,
            page: _currentPage + 1,
            limit: materialRelatedProjectsInitialLimit,
          );

      if (!mounted) {
        return;
      }

      setState(() {
        final existingIds = {
          ...initialItems.map((item) => item.projectId),
          ..._extraItems.map((item) => item.projectId),
        };
        for (final item in nextPage.items) {
          if (existingIds.add(item.projectId)) {
            _extraItems.add(item);
          }
        }
        _currentPage = nextPage.pagination.page;
        _totalPages = nextPage.pagination.totalPages;
        _isLoadingMore = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoadingMore = false;
          _hasLoadMoreError = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = MaterialRelatedProjectsL10n.of(context);
    final async = ref.watch(
      materialRelatedProjectsInitialProvider(widget.materialId),
    );

    ref.listen(
      materialRelatedProjectsInitialProvider(widget.materialId),
      (previous, next) {
        if (next.isLoading) {
          _resetPagination();
        }
        next.whenData((page) {
          if (!mounted) {
            return;
          }
          setState(() {
            _currentPage = page.pagination.page;
            _totalPages = page.pagination.totalPages;
          });
        });
      },
    );

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: palette.cardSurfaceAlt,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Icon(
                  Icons.school_outlined,
                  color: palette.mint,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.sectionTitle,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.sectionSubtitle,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          async.when(
            loading: () => const _MaterialRelatedProjectsSkeleton(),
            error: (_, _) => _MaterialRelatedProjectsError(
              message: l10n.loadError,
              retryLabel: l10n.retry,
              onRetry: () => invalidateMaterialRelatedProjects(
                ref,
                widget.materialId,
              ),
            ),
            data: (page) {
              final items = mergeMaterialRelatedProjectItems(
                page.items,
                _extraItems,
              );

              if (items.isEmpty) {
                return _MaterialRelatedProjectsEmpty(
                  title: l10n.emptyTitle,
                  body: l10n.emptyBody,
                  browseLabel: l10n.browseLearningHub,
                  onBrowse: () => context.go('/learning'),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final item in items) ...[
                    MaterialRelatedProjectCard(
                      item: item,
                      isActionBusy: _busyProjectIds.contains(item.projectId),
                      onOpenProject: () =>
                          context.push('/learning/${item.projectId}'),
                      onPrimaryAction: () => _handlePrimaryAction(item),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  if (_currentPage < _totalPages)
                    OutlinedButton(
                      onPressed: _isLoadingMore ? null : _loadMore,
                      child: _isLoadingMore
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(l10n.loadMore),
                    ),
                  if (_hasLoadMoreError)
                    TextButton(
                      onPressed: _loadMore,
                      child: Text(l10n.retry),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class MaterialRelatedProjectsSectionContent extends StatelessWidget {
  const MaterialRelatedProjectsSectionContent({
    super.key,
    required this.items,
    required this.currentPage,
    required this.totalPages,
    this.isLoadingMore = false,
    this.hasLoadMoreError = false,
    this.onOpenProject,
    this.onPrimaryAction,
    this.onBrowseLearningHub,
    this.onLoadMore,
    this.onRetry,
    this.busyProjectIds = const <String>{},
    this.showHeader = true,
  });

  final List<MaterialRelatedProjectItem> items;
  final int currentPage;
  final int totalPages;
  final bool isLoadingMore;
  final bool hasLoadMoreError;
  final ValueChanged<MaterialRelatedProjectItem>? onOpenProject;
  final ValueChanged<MaterialRelatedProjectItem>? onPrimaryAction;
  final VoidCallback? onBrowseLearningHub;
  final VoidCallback? onLoadMore;
  final VoidCallback? onRetry;
  final Set<String> busyProjectIds;
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = MaterialRelatedProjectsL10n.of(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHeader) ...[
            Text(
              l10n.sectionTitle,
              style: AppTextStyles.title(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.sectionSubtitle,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          if (items.isEmpty)
            _MaterialRelatedProjectsEmpty(
              title: l10n.emptyTitle,
              body: l10n.emptyBody,
              browseLabel: l10n.browseLearningHub,
              onBrowse: onBrowseLearningHub ?? () => context.go('/learning'),
            )
          else ...[
            for (final item in items) ...[
              MaterialRelatedProjectCard(
                item: item,
                isActionBusy: busyProjectIds.contains(item.projectId),
                onOpenProject: () => onOpenProject?.call(item),
                onPrimaryAction: () => onPrimaryAction?.call(item),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (currentPage < totalPages && onLoadMore != null)
              OutlinedButton(
                onPressed: isLoadingMore ? null : onLoadMore,
                child: Text(l10n.loadMore),
              ),
            if (hasLoadMoreError && onRetry != null)
              TextButton(onPressed: onRetry, child: Text(l10n.retry)),
          ],
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: child,
    );
  }
}

class _MaterialRelatedProjectsSkeleton extends StatelessWidget {
  const _MaterialRelatedProjectsSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      children: List.generate(2, (index) {
        return Padding(
          padding: EdgeInsetsDirectional.only(
            bottom: index == 1 ? 0 : AppSpacing.md,
          ),
          child: Container(
            height: 220,
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
          ),
        );
      }),
    );
  }
}

class _MaterialRelatedProjectsEmpty extends StatelessWidget {
  const _MaterialRelatedProjectsEmpty({
    required this.title,
    required this.body,
    required this.browseLabel,
    required this.onBrowse,
  });

  final String title;
  final String body;
  final String browseLabel;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          body,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton(
          onPressed: onBrowse,
          child: Text(browseLabel),
        ),
      ],
    );
  }
}

class _MaterialRelatedProjectsError extends StatelessWidget {
  const _MaterialRelatedProjectsError({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          message,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(onPressed: onRetry, child: Text(retryLabel)),
        ),
      ],
    );
  }
}
