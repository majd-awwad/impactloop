import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../application/supplier_my_materials_providers.dart';
import '../../data/models/supplier_my_materials_models.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/materials/supplier_material_category_filter.dart';
import '../widgets/materials/supplier_material_filter_chips.dart';
import '../widgets/materials/supplier_material_delete_helper.dart';
import '../widgets/materials/supplier_material_edit_helper.dart';
import '../widgets/materials/supplier_materials_grid.dart';
import '../widgets/materials/supplier_materials_summary_row.dart';

const _contentMaxWidth = 1200.0;

class SupplierMyMaterialsPage extends ConsumerStatefulWidget {
  const SupplierMyMaterialsPage({super.key});

  @override
  ConsumerState<SupplierMyMaterialsPage> createState() =>
      _SupplierMyMaterialsPageState();
}

class _SupplierMyMaterialsPageState
    extends ConsumerState<SupplierMyMaterialsPage> {
  late final TextEditingController _searchController;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    if (kDebugMode) {
      debugPrint('[SupplierMyMaterialsPage] route entered');
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _applyQuery(SupplierMyMaterialsQuery query) {
    ref.read(supplierMyMaterialsQueryProvider.notifier).updateQuery(query);
    ref.invalidate(supplierMyMaterialsProvider);
  }

  void _updateSearch(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      final current = ref.read(supplierMyMaterialsQueryProvider);
      _applyQuery(
        current.copyWith(
          page: 1,
          search: value,
          clearSearch: value.trim().isEmpty,
        ),
      );
    });
  }

  void _updateStatusFilter(SupplierMaterialStatusFilter filter) {
    final current = ref.read(supplierMyMaterialsQueryProvider);
    _applyQuery(
      current.copyWith(
        page: 1,
        status: filter.apiValue,
        clearStatus: filter == SupplierMaterialStatusFilter.all,
      ),
    );
  }

  void _updatePriceFilter(SupplierMaterialPriceFilter filter) {
    final current = ref.read(supplierMyMaterialsQueryProvider);
    _applyQuery(
      current.copyWith(
        page: 1,
        isFree: filter.apiValue,
        clearIsFree: filter == SupplierMaterialPriceFilter.all,
      ),
    );
  }

  void _updateCategory(String? categoryId) {
    final current = ref.read(supplierMyMaterialsQueryProvider);
    _applyQuery(
      current.copyWith(
        page: 1,
        categoryId: categoryId,
        clearCategoryId: categoryId == null,
      ),
    );
  }

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    ref.read(supplierMyMaterialsQueryProvider.notifier).reset();
    ref.invalidate(supplierMyMaterialsProvider);
  }

  Future<void> _retry() async {
    ref.invalidate(supplierMyMaterialsProvider);
    await ref.read(supplierMyMaterialsProvider.future);
  }

  String? _formatCreatedAt(SupplierMyMaterial material) {
    if (material.createdAt.millisecondsSinceEpoch <= 0) {
      return null;
    }

    final month = material.createdAt.month.toString().padLeft(2, '0');
    final day = material.createdAt.day.toString().padLeft(2, '0');
    return context.s.listedOn('${material.createdAt.year}-$month-$day');
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final materialsAsync = ref.watch(supplierMyMaterialsProvider);
    final query = ref.watch(supplierMyMaterialsQueryProvider);

    ref.listen(supplierMyMaterialsQueryProvider, (previous, next) {
      if (next.search != _searchController.text) {
        _searchController.text = next.search;
        _searchController.selection = TextSelection.collapsed(
          offset: _searchController.text.length,
        );
      }
    });

    final statusFilter = statusFilterFromQuery(query.status);
    final priceFilter = priceFilterFromQuery(query.isFree);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final bottomInset = compact
        ? AppSpacing.supplierMobileNavHeight +
              MediaQuery.paddingOf(context).bottom +
              AppSpacing.lg
        : AppSpacing.lg;

    return LayoutBuilder(
      builder: (context, viewportConstraints) {
        final viewportWidth = viewportConstraints.maxWidth;
        final isCompact = viewportWidth < AppSpacing.supplierLayoutBreakpoint;
        final contentWidth = isCompact
            ? viewportWidth
            : viewportWidth.clamp(0.0, _contentMaxWidth).toDouble();

        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsetsDirectional.fromSTEB(
            isCompact ? AppSpacing.md : AppSpacing.lg,
            isCompact ? AppSpacing.sm : AppSpacing.md,
            isCompact ? AppSpacing.md : AppSpacing.lg,
            bottomInset,
          ),
          child: Align(
            alignment: Alignment.topCenter,
            child: SizedBox(
              width: contentWidth,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _PageHeader(
                    title: l.myMaterialsTitle,
                    subtitle: l.myMaterialsSubtitle,
                    actionLabel: l.navAddMaterial,
                    onAction: () => context.push('/supplier/materials/new'),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  materialsAsync.when(
                    loading: () {
                      if (kDebugMode) {
                        debugPrint(
                          '[SupplierMyMaterialsPage] provider: loading',
                        );
                      }
                      return _LoadingBody(compact: isCompact);
                    },
                    error: (error, _) {
                      if (kDebugMode) {
                        debugPrint(
                          '[SupplierMyMaterialsPage] provider: error $error',
                        );
                      }
                      return _ErrorState(
                        message: l.myMaterialsLoadError,
                        detail: error.toString(),
                        onRetry: _retry,
                      );
                    },
                    data: (result) {
                      if (kDebugMode) {
                        debugPrint(
                          '[SupplierMyMaterialsPage] provider: data '
                          'items=${result.items.length} '
                          'totalPages=${result.pagination.totalPages}',
                        );
                      }
                      final categories = result.categories;

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SupplierMaterialsSummaryRow(summary: result.summary),
                          const SizedBox(height: AppSpacing.md),
                          TextField(
                            controller: _searchController,
                            onChanged: _updateSearch,
                            style: context.supplierBody().copyWith(
                              color: colors.textPrimary,
                            ),
                            decoration: InputDecoration(
                              hintText: l.myMaterialsSearchHint,
                              hintStyle: context.supplierBody().copyWith(
                                color: colors.textMuted,
                              ),
                              prefixIcon: Icon(
                                Icons.search,
                                color: colors.accent,
                              ),
                              filled: true,
                              fillColor: colors.surfaceSolid,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.md,
                                vertical: 14,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.lgAll,
                                borderSide: BorderSide(color: colors.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.lgAll,
                                borderSide: BorderSide(color: colors.border),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.lgAll,
                                borderSide: BorderSide(
                                  color: colors.borderFocused,
                                  width: 1.5,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          SupplierMaterialFilterChips(
                            statusFilter: statusFilter,
                            priceFilter: priceFilter,
                            onStatusSelected: _updateStatusFilter,
                            onPriceSelected: _updatePriceFilter,
                          ),
                          if (categories.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.sm),
                            SupplierMaterialCategoryFilter(
                              categories: categories,
                              selectedCategoryId: query.categoryId,
                              totalCount: result.summary.total,
                              onSelected: _updateCategory,
                            ),
                          ],
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            l.materialsResultCount(result.items.length),
                            style: context.supplierBody().copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          if (result.pagination.totalItems == 0)
                            _EmptyState(
                              onAdd: () =>
                                  context.push('/supplier/materials/new'),
                            )
                          else if (result.items.isEmpty)
                            _FilteredEmptyState(onClear: _clearFilters)
                          else ...[
                            SupplierMaterialsGrid(
                              itemCount: result.items.length,
                              itemBuilder: (context, index) {
                                final material = result.items[index];
                                return buildSupplierMaterialCard(
                                  context: context,
                                  material: material,
                                  isArabic: l.isArabic,
                                  createdAtLabel: _formatCreatedAt(material),
                                  onTap: () => context.push(
                                    '/supplier/materials/${material.id}',
                                  ),
                                  actions: buildSupplierMaterialCardActions(
                                    context: context,
                                    manageLabel: l.manageMaterial,
                                    editLabel: l.editListing,
                                    deleteLabel: l.deleteMaterial,
                                    canDelete: material.canDelete,
                                    deleteBlockedMessage:
                                        supplierMaterialDeleteBlockedMessage(
                                          l,
                                          material.deleteBlockedReason,
                                        ),
                                    canEdit: material.canEdit,
                                    editBlockedMessage:
                                        supplierMaterialEditBlockedMessage(
                                          l,
                                          material.editBlockedReason,
                                        ),
                                    onManage: () => context.push(
                                      '/supplier/materials/${material.id}',
                                    ),
                                    onEdit: () => context.push(
                                      '/supplier/materials/${material.id}/edit',
                                    ),
                                    onDelete: () =>
                                        handleSupplierMaterialDelete(
                                          context: context,
                                          ref: ref,
                                          material: material,
                                        ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            _PaginationBar(
                              page: query.page,
                              totalPages: result.pagination.totalPages,
                              compact: isCompact,
                              onPrevious: query.page > 1
                                  ? () => _applyQuery(
                                      query.copyWith(page: query.page - 1),
                                    )
                                  : null,
                              onNext: query.page < result.pagination.totalPages
                                  ? () => _applyQuery(
                                      query.copyWith(page: query.page + 1),
                                    )
                                  : null,
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    final textColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: context.supplierSectionTitle().copyWith(
            fontSize: 18,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: context.supplierBody().copyWith(
            color: colors.textMuted,
            fontSize: 14,
          ),
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        textColumn,
        const SizedBox(height: AppSpacing.md),
        FilledButton.icon(
          onPressed: onAction,
          icon: const Icon(Icons.add_rounded, size: 18),
          label: Text(actionLabel),
          style: AppStatusButtonStyle.filled(
            context,
            AppStatusTone.primary,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
          ),
        ),
      ],
    );
  }
}

class _LoadingBody extends StatelessWidget {
  const _LoadingBody({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 88,
          child: Center(
            child: CircularProgressIndicator(
              color: context.supplierColors.accent,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SupplierMaterialsGrid(
          itemCount: compact ? 1 : 3,
          itemBuilder: (_, _) => const SupplierMaterialCardSkeleton(),
        ),
      ],
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({
    required this.page,
    required this.totalPages,
    required this.compact,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int totalPages;
  final bool compact;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.paginationLabel(page, totalPages),
            textAlign: TextAlign.center,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onPrevious,
                  child: Text(l.previousPage),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: OutlinedButton(
                  onPressed: onNext,
                  child: Text(l.nextPage),
                ),
              ),
            ],
          ),
        ],
      );
    }

    return Row(
      children: [
        OutlinedButton(onPressed: onPrevious, child: Text(l.previousPage)),
        const Spacer(),
        Text(
          l.paginationLabel(page, totalPages),
          style: context.supplierBody(),
        ),
        const Spacer(),
        OutlinedButton(onPressed: onNext, child: Text(l.nextPage)),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 48, color: colors.accent),
          const SizedBox(height: AppSpacing.md),
          Text(l.myMaterialsEmptyTitle, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.myMaterialsEmptySubtitle,
            style: context.supplierBody().copyWith(color: colors.textMuted),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(onPressed: onAdd, child: Text(l.myMaterialsEmptyCta)),
        ],
      ),
    );
  }
}

class _FilteredEmptyState extends StatelessWidget {
  const _FilteredEmptyState({required this.onClear});

  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        children: [
          Text(
            l.myMaterialsFilteredEmptyTitle,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.myMaterialsFilteredEmptySubtitle,
            style: context.supplierBody().copyWith(
              color: context.supplierColors.textMuted,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(onPressed: onClear, child: Text(l.filterAll)),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.onRetry,
    this.detail,
  });

  final String message;
  final String? detail;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        children: [
          Icon(
            Icons.cloud_off_outlined,
            size: 44,
            color: context.supplierColors.error,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(message, textAlign: TextAlign.center),
          if (detail != null && detail!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              detail!,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textMuted,
                fontSize: 12,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(onPressed: onRetry, child: Text(l.tryAgain)),
        ],
      ),
    );
  }
}
