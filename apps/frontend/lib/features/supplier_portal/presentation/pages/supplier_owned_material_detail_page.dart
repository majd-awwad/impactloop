import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../application/supplier_my_materials_providers.dart';
import '../../data/models/supplier_my_materials_models.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/materials/supplier_material_label_helper.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 960.0;

class SupplierOwnedMaterialDetailPage extends ConsumerWidget {
  const SupplierOwnedMaterialDetailPage({
    super.key,
    required this.materialId,
  });

  final String materialId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.s;
    final materialAsync = ref.watch(supplierMyMaterialByIdProvider(materialId));

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: materialAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.xl),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, _) => _ErrorPanel(
            message: l.myMaterialsLoadError,
            onRetry: () {
              ref.invalidate(supplierMyMaterialsProvider);
              ref.invalidate(supplierMyMaterialByIdProvider(materialId));
            },
          ),
          data: (material) {
            if (material == null) {
              return _NotFound(onBack: () => context.go('/supplier/materials'));
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: _DetailBody(material: material),
            );
          },
        ),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final isArabic = l.isArabic;
    final condition = SupplierMaterialLabelHelper.conditionMeta(material.condition);
    final status = SupplierMaterialLabelHelper.statusMeta(material.status);
    final category =
        isArabic ? material.category.nameAr : material.category.nameEn;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (material.images.isNotEmpty)
          ClipRRect(
            borderRadius: AppRadius.xlAll,
            child: SizedBox(
              height: 240,
              child: PageView.builder(
                itemCount: material.images.length,
                itemBuilder: (context, index) {
                  final image = material.images[index];
                  return Image.network(
                    ApiConfig.resolveMediaUrl(image.imageUrl),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      color: colors.chipUnselected,
                      child: Icon(Icons.image_outlined, color: colors.textMuted),
                    ),
                  );
                },
              ),
            ),
          )
        else
          Container(
            height: 240,
            decoration: BoxDecoration(
              color: colors.chipUnselected,
              borderRadius: AppRadius.xlAll,
            ),
            child: Icon(Icons.image_outlined, size: 48, color: colors.textMuted),
          ),
        const SizedBox(height: AppSpacing.lg),
        Text(category,
            style: context.supplierChip().copyWith(color: colors.accent)),
        const SizedBox(height: AppSpacing.sm),
        Text(material.title, style: context.supplierTitle()),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            MaterialStatusBadge(
              label: SupplierMaterialLabelHelper.resolveText(
                status.label,
                isArabic,
              ),
              tone: status.tone,
            ),
            MaterialConditionBadge(
              label: SupplierMaterialLabelHelper.resolveText(
                condition.label,
                isArabic,
              ),
              tone: condition.tone,
            ),
            MaterialPriceBadge(
              label: SupplierMaterialLabelHelper.resolveText(
                SupplierMaterialLabelHelper.priceLabel(
                  isFree: material.isFree,
                  price: material.price,
                  currency: material.currency,
                ),
                isArabic,
              ),
              isFree: material.isFree,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(material.description, style: context.supplierBody()),
        const SizedBox(height: AppSpacing.lg),
        _InfoRow(
          label: SupplierMaterialLabelHelper.resolveText(
            SupplierMaterialLabelHelper.quantityLabel(
              material.quantity,
              material.unit,
            ),
            isArabic,
          ),
          icon: Icons.straighten_outlined,
        ),
        _InfoRow(
          label: SupplierMaterialLabelHelper.resolveText(
            SupplierMaterialLabelHelper.locationLabel(
              city: material.location.city,
              area: material.location.area,
            ),
            isArabic,
          ),
          icon: Icons.location_on_outlined,
        ),
        _InfoRow(
          label: SupplierMaterialLabelHelper.resolveText(
            SupplierMaterialLabelHelper.availabilityLabel(
              pickupAllowed: material.pickupAllowed,
              deliveryAvailable: material.deliveryAllowed,
            ),
            isArabic,
          ),
          icon: Icons.local_shipping_outlined,
        ),
        _InfoRow(
          label: '${l.viewsLabel}: ${material.viewsCount}',
          icon: Icons.visibility_outlined,
        ),
        _InfoRow(
          label:
              '${l.createdLabel}: ${_formatDate(material.createdAt)} · ${l.updatedLabel}: ${_formatDate(material.updatedAt)}',
          icon: Icons.schedule_outlined,
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            OutlinedButton(
              onPressed: () => context.go('/supplier/materials'),
              child: Text(l.backToMyMaterials),
            ),
            const SizedBox(width: AppSpacing.sm),
            OutlinedButton(
              onPressed: () =>
                  showSupplierInfoSnackBar(context, l.editListingComingSoon),
              child: Text(l.editListing),
            ),
          ],
        ),
      ],
    );
  }

  String _formatDate(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '${date.year}-$month-$day';
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, size: 18, color: context.supplierColors.textMuted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(label, style: context.supplierBody())),
        ],
      ),
    );
  }
}

class _NotFound extends StatelessWidget {
  const _NotFound({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l = context.s;

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        children: [
          Text(l.materialNotFoundTitle, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.sm),
          Text(l.materialNotFoundSubtitle, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(onPressed: onBack, child: Text(l.backToMyMaterials)),
        ],
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onRetry,
            child: Text(context.s.tryAgain),
          ),
        ],
      ),
    );
  }
}
