import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/liked_materials_controller.dart';
import '../../domain/discovery_material.dart';
import '../l10n/liked_materials_l10n.dart';
import '../widgets/materials_discovery_results_grid.dart';

class LikedMaterialsPage extends ConsumerWidget {
  const LikedMaterialsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = LikedMaterialsL10n.of(context);
    final collection = ref.watch(likedMaterialsControllerProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            _LikedMaterialsHeader(l10n: l10n),
            Expanded(
              child: collection.when(
                skipLoadingOnReload: true,
                loading: () => Center(
                  child: Semantics(
                    label: l10n.loading,
                    child: CircularProgressIndicator(color: palette.mint),
                  ),
                ),
                error: (_, _) => _ScrollableState(
                  child: AppEmptyStateCard(
                    icon: Icons.cloud_off_outlined,
                    title: l10n.loadFailed,
                    subtitle: l10n.refreshFailed,
                    tone: AppStatusTone.danger,
                    actions: [
                      FilledButton.icon(
                        onPressed: () =>
                            ref.invalidate(likedMaterialsControllerProvider),
                        icon: const Icon(Icons.refresh_rounded),
                        label: Text(l10n.retry),
                      ),
                    ],
                  ),
                ),
                data: (state) => RefreshIndicator(
                  onRefresh: () => _refresh(context, ref),
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.md,
                          AppSpacing.sm,
                          AppSpacing.md,
                          AppSpacing.xl,
                        ),
                        sliver: SliverToBoxAdapter(
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 1320),
                              child: _LikedMaterialsContent(
                                state: state,
                                l10n: l10n,
                                onOpen: (material) =>
                                    _openMaterial(context, ref, material),
                                onUnlike: (material) =>
                                    _unlike(context, ref, material),
                                onRetryLoadMore: () => _loadMore(context, ref),
                                onRetryRefresh: () => _refresh(context, ref),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openMaterial(
    BuildContext context,
    WidgetRef ref,
    DiscoveryMaterial material,
  ) async {
    await context.push('/materials/${material.id}');
    if (!context.mounted) return;
    try {
      await ref.read(likedMaterialsControllerProvider.notifier).refresh();
    } catch (_) {
      // The retained collection displays its refresh error and retry action.
    }
  }

  Future<void> _unlike(
    BuildContext context,
    WidgetRef ref,
    DiscoveryMaterial material,
  ) async {
    try {
      await ref
          .read(likedMaterialsControllerProvider.notifier)
          .unlike(material.id);
    } catch (_) {
      if (context.mounted) {
        _showError(context, LikedMaterialsL10n.of(context).unlikeFailed);
      }
    }
  }

  Future<void> _loadMore(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(likedMaterialsControllerProvider.notifier).loadMore();
    } catch (_) {
      if (context.mounted) {
        _showError(context, LikedMaterialsL10n.of(context).loadMoreFailed);
      }
    }
  }

  Future<void> _refresh(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(likedMaterialsControllerProvider.notifier).refresh();
    } catch (_) {
      if (context.mounted) {
        _showError(context, LikedMaterialsL10n.of(context).refreshFailed);
      }
    }
  }

  void _showError(BuildContext context, String message) {
    final colors = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: colors.errorContainer,
          showCloseIcon: true,
          closeIconColor: colors.onErrorContainer,
        ),
      );
  }
}

class _LikedMaterialsHeader extends StatelessWidget {
  const _LikedMaterialsHeader({required this.l10n});

  final LikedMaterialsL10n l10n;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1320),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppBackAction(fallbackLocation: '/profile'),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary, fontSize: 22),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.description,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LikedMaterialsContent extends StatelessWidget {
  const _LikedMaterialsContent({
    required this.state,
    required this.l10n,
    required this.onOpen,
    required this.onUnlike,
    required this.onRetryLoadMore,
    required this.onRetryRefresh,
  });

  final LikedMaterialsState state;
  final LikedMaterialsL10n l10n;
  final ValueChanged<DiscoveryMaterial> onOpen;
  final ValueChanged<DiscoveryMaterial> onUnlike;
  final VoidCallback onRetryLoadMore;
  final VoidCallback onRetryRefresh;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final materials = state.items.map((item) => item.material).toList();

    if (materials.isEmpty) {
      return AppEmptyStateCard(
        icon: Icons.favorite_border_rounded,
        title: l10n.emptyTitle,
        subtitle: l10n.emptyBody,
        actions: [
          FilledButton.icon(
            onPressed: () => context.go('/materials'),
            icon: const Icon(Icons.search_rounded),
            label: Text(l10n.browseMaterials),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.showing(materials.length, state.total),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ),
            if (state.isRefreshing)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
          ],
        ),
        if (state.hasRefreshError) ...[
          const SizedBox(height: AppSpacing.sm),
          _ErrorStrip(
            message: l10n.refreshFailed,
            actionLabel: l10n.retry,
            onPressed: onRetryRefresh,
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        MaterialsDiscoveryResultsGrid(
          materials: materials,
          onMaterialTap: onOpen,
          trailingBuilder: (context, material) {
            final pending = state.pendingUnlikeIds.contains(material.id);
            return _UnlikeButton(
              label: l10n.removeMaterial(material.title.resolve(context)),
              pending: pending,
              onPressed: pending ? null : () => onUnlike(material),
            );
          },
        ),
        if (state.hasLoadMoreError) ...[
          const SizedBox(height: AppSpacing.md),
          _ErrorStrip(
            message: l10n.loadMoreFailed,
            actionLabel: l10n.retry,
            onPressed: onRetryLoadMore,
          ),
        ] else if (state.hasMore) ...[
          const SizedBox(height: AppSpacing.lg),
          Center(
            child: OutlinedButton.icon(
              onPressed: state.isLoadingMore ? null : onRetryLoadMore,
              icon: state.isLoadingMore
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more_rounded),
              label: Text(
                state.isLoadingMore ? l10n.loadingMore : l10n.loadMore,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _UnlikeButton extends StatelessWidget {
  const _UnlikeButton({
    required this.label,
    required this.pending,
    required this.onPressed,
  });

  final String label;
  final bool pending;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: Material(
        color: palette.cardSurface.withValues(alpha: 0.94),
        shape: const CircleBorder(),
        elevation: 2,
        child: IconButton(
          constraints: const BoxConstraints.tightFor(width: 48, height: 48),
          tooltip: label,
          onPressed: onPressed,
          icon: pending
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(Icons.favorite_rounded, color: palette.mint),
        ),
      ),
    );
  }
}

class _ErrorStrip extends StatelessWidget {
  const _ErrorStrip({
    required this.message,
    required this.actionLabel,
    required this.onPressed,
  });

  final String message;
  final String actionLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.errorContainer,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.error),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.xs,
        children: [
          Text(message, style: TextStyle(color: colors.onErrorContainer)),
          TextButton(onPressed: onPressed, child: Text(actionLabel)),
        ],
      ),
    );
  }
}

class _ScrollableState extends StatelessWidget {
  const _ScrollableState({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: child,
        ),
      ),
    );
  }
}
