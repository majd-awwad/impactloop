import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../core/config/api_config.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../application/supplier_my_materials_providers.dart';
import '../../../data/models/supplier_related_projects.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierRelatedProjectsSection extends ConsumerWidget {
  const SupplierRelatedProjectsSection({
    super.key,
    required this.materialId,
    this.onProjectTap,
  });

  final String materialId;
  final ValueChanged<String>? onProjectTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(supplierMaterialRelatedProjectsProvider(materialId));
    final l = context.s;
    final colors = context.supplierColors;

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.relatedProjectsTitle, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.relatedProjectsSubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          async.when(
            loading: () => const _RelatedProjectsSkeleton(),
            error: (_, _) => _RelatedProjectsError(
              message: l.relatedProjectsLoadError,
              retryLabel: l.relatedProjectsRetry,
              onRetry: () => ref.invalidate(
                supplierMaterialRelatedProjectsProvider(materialId),
              ),
            ),
            data: (result) {
              if (result.relatedProjectCount == 0 || result.items.isEmpty) {
                return Text(
                  l.relatedProjectsEmpty,
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l.relatedProjectsCountSummary(result.relatedProjectCount),
                    style: context.supplierBody().copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  for (var index = 0; index < result.items.length; index++) ...[
                    _RelatedProjectRow(
                      item: result.items[index],
                      onTap: () {
                        final projectId = result.items[index].projectId;
                        if (onProjectTap != null) {
                          onProjectTap!(projectId);
                          return;
                        }
                        context.push('/learning/$projectId');
                      },
                    ),
                    if (index < result.items.length - 1)
                      const SizedBox(height: AppSpacing.sm),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

@visibleForTesting
class SupplierRelatedProjectsSectionContent extends StatelessWidget {
  const SupplierRelatedProjectsSectionContent({
    super.key,
    required this.result,
    this.onProjectTap,
  });

  final SupplierRelatedProjectsResult result;
  final ValueChanged<String>? onProjectTap;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.relatedProjectsTitle, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.relatedProjectsSubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (result.relatedProjectCount == 0 || result.items.isEmpty)
            Text(
              l.relatedProjectsEmpty,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
              ),
            )
          else ...[
            Text(
              l.relatedProjectsCountSummary(result.relatedProjectCount),
              style: context.supplierBody().copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            for (var index = 0; index < result.items.length; index++) ...[
              _RelatedProjectRow(
                item: result.items[index],
                onTap: onProjectTap == null
                    ? null
                    : () => onProjectTap!(result.items[index].projectId),
              ),
              if (index < result.items.length - 1)
                const SizedBox(height: AppSpacing.sm),
            ],
          ],
        ],
      ),
    );
  }
}

class _RelatedProjectRow extends StatelessWidget {
  const _RelatedProjectRow({required this.item, this.onTap});

  final SupplierRelatedProjectItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final imageUrl = item.coverImageUrl == null || item.coverImageUrl!.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(item.coverImageUrl!);

    return Material(
      color: colors.chipUnselected,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: AppRadius.smAll,
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: imageUrl == null
                      ? ColoredBox(
                          color: colors.border,
                          child: Icon(
                            Icons.school_outlined,
                            color: colors.textMuted,
                          ),
                        )
                      : Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(
                            color: colors.border,
                            child: Icon(
                              Icons.broken_image_outlined,
                              color: colors.textMuted,
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.start,
                      style: context.supplierBody().copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${l.relatedProjectsMatchedComponent}: ${item.matchedComponentName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.start,
                      style: context.supplierBody().copyWith(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l.relatedProjectsMatchReason(item.matchReasonCode),
                      textAlign: TextAlign.start,
                      style: context.supplierBody().copyWith(
                        color: colors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Directionality.of(context) == TextDirection.rtl
                    ? Icons.chevron_left_rounded
                    : Icons.chevron_right_rounded,
                color: colors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RelatedProjectsSkeleton extends StatelessWidget {
  const _RelatedProjectsSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Column(
      children: List.generate(
        2,
        (index) => Padding(
          padding: EdgeInsets.only(bottom: index == 1 ? 0 : AppSpacing.sm),
          child: Container(
            height: 72,
            decoration: BoxDecoration(
              color: colors.chipUnselected,
              borderRadius: AppRadius.mdAll,
            ),
          ),
        ),
      ),
    );
  }
}

class _RelatedProjectsError extends StatelessWidget {
  const _RelatedProjectsError({
    required this.message,
    required this.retryLabel,
    required this.onRetry,
  });

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: context.supplierBody().copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextButton(onPressed: onRetry, child: Text(retryLabel)),
      ],
    );
  }
}
