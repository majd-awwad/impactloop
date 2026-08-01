import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../../data/models/supplier_profile.dart';

class ProfileCompletionCard extends StatelessWidget {
  const ProfileCompletionCard({super.key, required this.profile, this.draft});

  final SupplierProfileResponse profile;
  final SupplierProfileDraft? draft;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final supplier = profile.supplier;
    final publicName = draft?.publicName ?? supplier?.publicName ?? '';
    final supplierType = draft?.supplierType ?? supplier?.supplierType ?? '';
    final description = draft?.description ?? supplier?.description ?? '';
    final country =
        draft?.country ?? supplier?.defaultPickupLocation?.country ?? '';
    final city = draft?.city ?? supplier?.defaultPickupLocation?.city ?? '';
    final visibility =
        draft?.visibility ?? supplier?.defaultPickupLocation?.visibility ?? '';
    final pickupCoordinatesComplete =
        draft?.usesCurrentLocationCoordinates == true &&
        draft?.latitude != null &&
        draft?.longitude != null;

    final checks = <_CompletionItem>[
      _CompletionItem(
        label: context.s.publicName,
        complete: publicName.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: context.s.supplierType,
        complete: supplierType.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: context.s.aboutMaterials,
        complete: description.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: context.s.pickupCountryCity,
        complete:
            pickupCoordinatesComplete ||
            (country.trim().isNotEmpty && city.trim().isNotEmpty),
      ),
      _CompletionItem(
        label: context.s.locationVisibility,
        complete: visibility.trim().isNotEmpty,
      ),
    ];

    final complete = checks.where((item) => item.complete).length;
    final progress = complete / checks.length;

    return _SupplierInsightCard(
      icon: Icons.task_alt_outlined,
      title: context.s.profileCompletion,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppSpacing.xs),
                  child: LinearProgressIndicator(
                    minHeight: 8,
                    value: progress,
                    backgroundColor: colors.chipUnselected,
                    color: colors.accent,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '${(progress * 100).round()}%',
                style: context.supplierLabel().copyWith(
                  color: colors.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.essentialsComplete(complete, checks.length),
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.md),
          ...checks.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  Icon(
                    item.complete
                        ? Icons.check_circle_outline
                        : Icons.radio_button_unchecked,
                    size: 16,
                    color: item.complete ? colors.accent : colors.textMuted,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(item.label, style: context.supplierBody()),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompletionItem {
  const _CompletionItem({required this.label, required this.complete});

  final String label;
  final bool complete;
}

class SupplierProfileDraft {
  const SupplierProfileDraft({
    required this.publicName,
    required this.supplierType,
    required this.description,
    required this.country,
    required this.city,
    required this.area,
    required this.visibility,
    this.latitude,
    this.longitude,
    this.usesCurrentLocationCoordinates = false,
  });

  final String publicName;
  final String supplierType;
  final String description;
  final String country;
  final String city;
  final String area;
  final String visibility;
  final double? latitude;
  final double? longitude;
  final bool usesCurrentLocationCoordinates;
}

class _SupplierInsightCard extends StatelessWidget {
  const _SupplierInsightCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 180),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.sideInsightCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.accentSoft.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: colors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(icon, color: colors.accent, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(title, style: context.supplierSectionTitle()),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
