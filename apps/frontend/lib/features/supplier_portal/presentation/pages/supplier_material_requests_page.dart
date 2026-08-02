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
    final compact = MediaQuery.sizeOf(context).width < 900;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: context.supplierDecorations
              .pagePadding(compact: compact)
              .add(const EdgeInsets.only(top: AppSpacing.lg)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _FilterBar(query: query),
              const SizedBox(height: AppSpacing.md),
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm + AppSpacing.xs),
      decoration: BoxDecoration(
        color: context.supplierColors.surfaceSolid.withValues(alpha: .7),
        border: Border.all(
          color: context.supplierColors.border.withValues(alpha: .55),
        ),
        borderRadius: AppRadius.mdAll,
      ),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 220,
            child: categoriesAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
              data: (categories) => DropdownButtonFormField<String?>(
                initialValue: query.categoryId,
                isExpanded: true,
                decoration: InputDecoration(
                  hintText: context.s.filterCategory,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 2,
                  ),
                ),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(context.s.filterAllCategories),
                  ),
                  ...categories.map(
                    (MaterialCategory category) => DropdownMenuItem<String?>(
                      value: category.id,
                      child: Text(
                        context.isSupplierArabic
                            ? category.nameAr
                            : category.nameEn,
                      ),
                    ),
                  ),
                ],
                onChanged: (value) => ref
                    .read(supplierMaterialRequestsQueryProvider.notifier)
                    .setCategory(value),
              ),
            ),
          ),
          SizedBox(
            width: 200,
            child: TextFormField(
              initialValue: query.city,
              decoration: InputDecoration(
                hintText: context.s.city,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              onFieldSubmitted: (value) => ref
                  .read(supplierMaterialRequestsQueryProvider.notifier)
                  .setCity(value.trim().isEmpty ? null : value.trim()),
            ),
          ),
          FilterChip(
            label: Text(context.s.filterUnansweredByMe),
            selected: query.unansweredByMe,
            onSelected: (value) => ref
                .read(supplierMaterialRequestsQueryProvider.notifier)
                .setUnansweredByMe(value),
          ),
          if (query.hasActiveFilters)
            TextButton.icon(
              onPressed: () => ref
                  .read(supplierMaterialRequestsQueryProvider.notifier)
                  .reset(),
              icon: const Icon(Icons.restart_alt, size: 17),
              label: const Text('Reset'),
            ),
        ],
      ),
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
        onTap: () =>
            context.push('/supplier/material-requests/${request.id}'),
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
                      style: context
                          .supplierBody()
                          .copyWith(color: colors.textSecondary),
                    ),
                    if (request.description != null &&
                        request.description!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        request.description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context
                            .supplierBody()
                            .copyWith(color: colors.textSecondary),
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
      child: Text(
        label,
        style: context.supplierChip().copyWith(color: color),
      ),
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
          OutlinedButton(
            onPressed: onRetry,
            child: Text(context.s.tryAgain),
          ),
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
