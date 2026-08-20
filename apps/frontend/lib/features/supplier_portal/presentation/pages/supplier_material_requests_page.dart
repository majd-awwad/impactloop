import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../application/supplier_material_requests_providers.dart';
import '../../data/models/supplier_material_request.dart';
import '../theme/supplier_theme_extension.dart';

const _contentMaxWidth = 1100.0;

class SupplierMaterialRequestsPage extends ConsumerStatefulWidget {
  const SupplierMaterialRequestsPage({
    super.key,
    this.initialUnansweredByMe = false,
  });

  final bool initialUnansweredByMe;

  @override
  ConsumerState<SupplierMaterialRequestsPage> createState() =>
      _SupplierMaterialRequestsPageState();
}

class _SupplierMaterialRequestsPageState
    extends ConsumerState<SupplierMaterialRequestsPage> {
  @override
  void initState() {
    super.initState();
    if (widget.initialUnansweredByMe) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref
            .read(supplierMaterialRequestsQueryProvider.notifier)
            .setUnansweredByMe(true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(supplierMaterialRequestsFeedProvider);
    final query = ref.watch(supplierMaterialRequestsQueryProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final pagePadding = context.supplierDecorations.pagePadding(
      compact: compact,
    );

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: pagePadding.copyWith(
            top: compact ? AppSpacing.sm : AppSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _FilterBar(query: query),
              SizedBox(height: compact ? AppSpacing.sm : AppSpacing.md),
              feedAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, _) => _ErrorPanel(
                  onRetry: () =>
                      ref.invalidate(supplierMaterialRequestsFeedProvider),
                ),
                data: (result) {
                  if (result.items.isEmpty) {
                    return _EmptyPanel(hasFilters: query.hasActiveFilters);
                  }
                  return Column(
                    children: result.items
                        .map(
                          (request) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: _RequestCard(request: request),
                          ),
                        )
                        .toList(growable: false),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterBar extends ConsumerWidget {
  const _FilterBar({required this.query});

  final SupplierMaterialRequestsQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(materialCategoriesProvider);
    final l = context.s;

    final categoryField = categoriesAsync.when(
      loading: () => _CompactFilterDropdown<String?>(
        value: query.categoryId,
        items: [query.categoryId],
        itemLabel: (id) =>
            id == null ? l.filterAllCategories : l.filterCategory,
      ),
      error: (_, _) => _CompactFilterDropdown<String?>(
        value: query.categoryId,
        items: [query.categoryId],
        itemLabel: (id) =>
            id == null ? l.filterAllCategories : l.filterCategory,
      ),
      data: (categories) => _CompactFilterDropdown<String?>(
        value: query.categoryId,
        items: [
          null,
          ...categories.map((MaterialCategory category) => category.id),
        ],
        itemLabel: (id) {
          if (id == null) return l.filterAllCategories;
          final category = categories.firstWhere((item) => item.id == id);
          return context.isSupplierArabic ? category.nameAr : category.nameEn;
        },
        onChanged: (value) => ref
            .read(supplierMaterialRequestsQueryProvider.notifier)
            .setCategory(value),
      ),
    );

    final cityField = TextFormField(
      key: ValueKey(query.city ?? ''),
      initialValue: query.city,
      textInputAction: TextInputAction.done,
      style: context.supplierBody().copyWith(
        color: context.supplierColors.textPrimary,
      ),
      decoration: _compactFilterDecoration(context, hint: l.city),
      onFieldSubmitted: (value) => ref
          .read(supplierMaterialRequestsQueryProvider.notifier)
          .setCity(value.trim().isEmpty ? null : value.trim()),
    );

    final unansweredField = _CompactFilterDropdown<bool>(
      value: query.unansweredByMe,
      items: const [false, true],
      itemLabel: (selected) =>
          selected ? l.filterUnansweredByMe : l.filterAllRequests,
      onChanged: (value) => ref
          .read(supplierMaterialRequestsQueryProvider.notifier)
          .setUnansweredByMe(value),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = AppSpacing.sm;
        final wide = constraints.maxWidth >= 720;
        final twoCol = constraints.maxWidth >= 360;
        final pairWidth = twoCol
            ? (constraints.maxWidth - gap) / 2
            : constraints.maxWidth;

        Widget box(Widget child, {double? width}) =>
            SizedBox(width: width ?? (wide ? 220 : pairWidth), child: child);

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            box(categoryField),
            box(cityField),
            box(unansweredField, width: wide ? 240 : pairWidth),
            if (query.hasActiveFilters)
              TextButton.icon(
                onPressed: () => ref
                    .read(supplierMaterialRequestsQueryProvider.notifier)
                    .reset(),
                icon: const Icon(Icons.restart_alt, size: 17),
                label: Text(l.reset),
              ),
          ],
        );
      },
    );
  }
}

InputDecoration _compactFilterDecoration(BuildContext context, {String? hint}) {
  final colors = context.supplierColors;
  return InputDecoration(
    hintText: hint,
    hintStyle: context.supplierBody().copyWith(color: colors.textMuted),
    filled: true,
    fillColor: colors.surfaceSolid,
    contentPadding: const EdgeInsetsDirectional.fromSTEB(
      AppSpacing.md,
      12,
      AppSpacing.sm,
      12,
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
  );
}

class _CompactFilterDropdown<T> extends StatelessWidget {
  const _CompactFilterDropdown({
    required this.value,
    required this.items,
    required this.itemLabel,
    this.onChanged,
  });

  final T value;
  final List<T> items;
  final String Function(T value) itemLabel;
  final ValueChanged<T>? onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      onChanged: onChanged == null
          ? null
          : (next) {
              if (next == null && null is! T) return;
              onChanged!(next as T);
            },
      decoration: _compactFilterDecoration(context),
      items: [
        for (final item in items)
          DropdownMenuItem<T>(
            value: item,
            child: Text(itemLabel(item), overflow: TextOverflow.ellipsis),
          ),
      ],
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});

  final SupplierMaterialRequest request;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/supplier/material-requests/${request.id}'),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.surfaceSolid,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: colors.border.withValues(alpha: .6)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.requestedItemName,
                      style: context.supplierTitle().copyWith(fontSize: 16),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${_formatQuantity(request.quantity)} ${request.unit} · ${request.location.displayLabel}',
                      style: context.supplierBody().copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    if (request.description != null &&
                        request.description!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        request.description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        if (request.alternativesAllowed)
                          _Chip(
                            label: context.s.alternativesAllowedBadge,
                            color: colors.accent,
                          ),
                        if (request.suggestionCount > 0)
                          _Chip(
                            label: context.s.materialRequestSuggestionsCount(
                              request.suggestionCount,
                            ),
                            color: colors.blueAccent,
                          ),
                        if (request.respondedByMe)
                          _Chip(
                            label: context.s.respondedBadge,
                            color: colors.amberAccent,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(label, style: context.supplierChip().copyWith(color: color)),
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  const _EmptyPanel({required this.hasFilters});

  final bool hasFilters;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: context.supplierColors.surfaceSolid,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: context.supplierColors.border),
      ),
      child: Column(
        children: [
          Icon(
            Icons.record_voice_over_outlined,
            size: 34,
            color: context.supplierColors.textSecondary,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            hasFilters
                ? context.s.materialRequestsFilteredEmptyTitle
                : context.s.materialRequestsEmptyTitle,
            textAlign: TextAlign.center,
            style: context.supplierTitle().copyWith(fontSize: 18),
          ),
          if (!hasFilters) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              context.s.materialRequestsEmptySubtitle,
              textAlign: TextAlign.center,
              style: context.supplierBody(),
            ),
          ],
        ],
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: context.supplierColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              context.s.materialRequestsLoadError,
              style: context.supplierBody(),
            ),
          ),
          OutlinedButton(onPressed: onRetry, child: Text(context.s.tryAgain)),
        ],
      ),
    );
  }
}

String _formatQuantity(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toStringAsFixed(2);
}
