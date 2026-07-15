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
                    actionLabel: l.navAddMaterial,
                    onAction: () => context.push('/supplier/materials/new'),
                  ),
                  const SizedBox(height: AppSpacing.md),
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
                      final selectedCategory = categories
                          .cast<SupplierMyMaterialsCategoryOption?>()
                          .firstWhere(
                            (category) => category?.id == query.categoryId,
                            orElse: () => null,
                          );
                      final activeFilterLabels = <String>[
                        if (query.search.trim().isNotEmpty) query.search.trim(),
                        if (statusFilter != SupplierMaterialStatusFilter.all)
                          statusFilter.label(l),
                        if (priceFilter != SupplierMaterialPriceFilter.all)
                          priceFilter.label(l),
                        if (selectedCategory != null)
                          l.isArabic
                              ? selectedCategory.nameAr
                              : selectedCategory.nameEn,
                      ];

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SupplierMaterialsSummaryRow(summary: result.summary),
                          const SizedBox(height: AppSpacing.md),
                          _FilterToolbar(
                            searchController: _searchController,
                            searchHint: l.myMaterialsSearchHint,
                            statusFilter: statusFilter,
                            priceFilter: priceFilter,
                            categories: categories,
                            selectedCategoryId: query.categoryId,
                            filtersActive: query.search.trim().isNotEmpty ||
                                query.status != null ||
                                query.isFree != null ||
                                query.categoryId != null,
                            onSearchChanged: _updateSearch,
                            onStatusSelected: _updateStatusFilter,
                            onPriceSelected: _updatePriceFilter,
                            onCategorySelected: _updateCategory,
                            onReset: _clearFilters,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          _ResultsHeader(
                            shownCount: result.items.length,
                            totalCount: result.pagination.totalItems,
                            activeFilterLabels: activeFilterLabels,
                            onClearFilters:
                                activeFilterLabels.isEmpty ? null : _clearFilters,
                          ),
                          const SizedBox(height: AppSpacing.md),
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
                              totalItems: result.pagination.totalItems,
                              pageSize: query.limit,
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
    required this.actionLabel,
    required this.onAction,
  });

  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Inventory overview',
          style: context.supplierSectionTitle().copyWith(
                color: colors.textPrimary,
                fontSize: 18,
              ),
        ),
        const SizedBox(height: 3),
        Text(
          'Monitor your material availability, requests, and listing status.',
          style: context.supplierBody().copyWith(color: colors.textMuted),
        ),
      ],
    );
    final action = FilledButton.icon(
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
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 560) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [text, const SizedBox(height: AppSpacing.sm), action],
          );
        }
        return Row(
          children: [
            Expanded(child: text),
            const SizedBox(width: AppSpacing.lg),
            action,
          ],
        );
      },
    );
  }
}

class _FilterToolbar extends StatelessWidget {
  const _FilterToolbar({
    required this.searchController,
    required this.searchHint,
    required this.statusFilter,
    required this.priceFilter,
    required this.categories,
    required this.selectedCategoryId,
    required this.filtersActive,
    required this.onSearchChanged,
    required this.onStatusSelected,
    required this.onPriceSelected,
    required this.onCategorySelected,
    required this.onReset,
  });

  final TextEditingController searchController;
  final String searchHint;
  final SupplierMaterialStatusFilter statusFilter;
  final SupplierMaterialPriceFilter priceFilter;
  final List<SupplierMyMaterialsCategoryOption> categories;
  final String? selectedCategoryId;
  final bool filtersActive;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<SupplierMaterialStatusFilter> onStatusSelected;
  final ValueChanged<SupplierMaterialPriceFilter> onPriceSelected;
  final ValueChanged<String?> onCategorySelected;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 1120;
          final medium = constraints.maxWidth >= 620;
          final search = ValueListenableBuilder<TextEditingValue>(
            valueListenable: searchController,
            builder: (context, value, _) => TextField(
              controller: searchController,
              onChanged: onSearchChanged,
              style: context.supplierBody().copyWith(color: colors.textPrimary),
              decoration: InputDecoration(
                hintText: searchHint,
                hintStyle: context.supplierBody().copyWith(color: colors.textMuted),
                prefixIcon: Icon(Icons.search, color: colors.accent),
                suffixIcon: value.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          searchController.clear();
                          onSearchChanged('');
                        },
                        icon: const Icon(Icons.close_rounded),
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
                  borderSide: BorderSide(color: colors.borderFocused, width: 1.5),
                ),
              ),
            ),
          );
          final filters = SupplierMaterialFilterChips(
            statusFilter: statusFilter,
            priceFilter: priceFilter,
            onStatusSelected: onStatusSelected,
            onPriceSelected: onPriceSelected,
          );
          final category = SupplierMaterialCategoryFilter(
            categories: categories,
            selectedCategoryId: selectedCategoryId,
            onSelected: onCategorySelected,
          );
          final reset = Tooltip(
            message: 'Reset filters',
            child: OutlinedButton.icon(
              onPressed: filtersActive ? onReset : null,
              icon: const Icon(Icons.restart_alt_rounded, size: 18),
              label: const Text('Reset'),
            ),
          );

          if (wide) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: search),
                const SizedBox(width: AppSpacing.sm),
                SizedBox(width: 344, child: filters),
                if (categories.isNotEmpty) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(flex: 2, child: category),
                ],
                const SizedBox(width: AppSpacing.sm),
                Padding(padding: const EdgeInsets.only(top: 5), child: reset),
              ],
            );
          }

          return Column(
            children: [
              if (medium)
                ...[
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 3, child: search),
                      if (categories.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(flex: 2, child: category),
                      ],
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 344, child: filters),
                      const SizedBox(width: AppSpacing.sm),
                      Padding(padding: const EdgeInsets.only(top: 5), child: reset),
                    ],
                  ),
                ]
              else ...[
                search,
                const SizedBox(height: AppSpacing.sm),
                filters,
                if (categories.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  category,
                ],
                const SizedBox(height: AppSpacing.sm),
                Align(alignment: AlignmentDirectional.centerEnd, child: reset),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({
    required this.shownCount,
    required this.totalCount,
    required this.activeFilterLabels,
    this.onClearFilters,
  });

  final int shownCount;
  final int totalCount;
  final List<String> activeFilterLabels;
  final VoidCallback? onClearFilters;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final label = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Materials',
          style: context.supplierSectionTitle().copyWith(
                color: colors.textPrimary,
                fontSize: 17,
              ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          '$shownCount shown of $totalCount',
          style: context.supplierBody().copyWith(color: colors.textMuted),
        ),
      ],
    );
    final activeFilters = Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final filter in activeFilterLabels)
          Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: colors.accentSoft,
              borderRadius: AppRadius.pillAll,
            ),
            child: Text(
              filter,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.accent,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        if (onClearFilters != null)
          TextButton(onPressed: onClearFilters, child: const Text('Clear all')),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (activeFilterLabels.isEmpty) return label;
        if (constraints.maxWidth < 720) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [label, const SizedBox(height: AppSpacing.sm), activeFilters],
          );
        }
        return Row(
          children: [label, const Spacer(), Flexible(child: activeFilters)],
        );
      },
    );
  }
}

class _LoadingBody extends StatelessWidget {
  const _LoadingBody({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 1000 ? 5 : compact ? 2 : 3;
            final width = (constraints.maxWidth - (columns - 1) * AppSpacing.sm) /
                columns;
            return Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: List.generate(
                5,
                (_) => Container(
                  width: width,
                  height: 90,
                  decoration: BoxDecoration(
                    color: colors.surfaceSolid,
                    borderRadius: AppRadius.lgAll,
                    border: Border.all(color: colors.border),
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          height: 64,
          decoration: BoxDecoration(
            color: colors.surfaceSolid,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: colors.border),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
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
    required this.totalItems,
    required this.pageSize,
    required this.compact,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int totalPages;
  final int totalItems;
  final int pageSize;
  final bool compact;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    final first = totalItems == 0 ? 0 : ((page - 1) * pageSize) + 1;
    final last = totalItems == 0 ? 0 : (first + pageSize - 1).clamp(0, totalItems);
    final countLabel = '$first–$last / $totalItems';

    final controls = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        OutlinedButton(onPressed: onPrevious, child: Text(l.previousPage)),
        const SizedBox(width: AppSpacing.sm),
        Text(l.paginationLabel(page, totalPages), style: context.supplierBody()),
        const SizedBox(width: AppSpacing.sm),
        OutlinedButton(onPressed: onNext, child: Text(l.nextPage)),
      ],
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            countLabel,
            textAlign: TextAlign.center,
            style: context.supplierBody().copyWith(
              color: context.supplierColors.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(alignment: Alignment.center, child: controls),
        ],
      );
    }

    return Row(
      children: [
        Text(
          countLabel,
          style: context.supplierBody().copyWith(
            color: context.supplierColors.textMuted,
          ),
        ),
        const Spacer(),
        controls,
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
