import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_profile.dart';

class ProfileCompletionCard extends StatelessWidget {
  const ProfileCompletionCard({
    super.key,
    required this.profile,
    this.draft,
  });

  final SupplierProfileResponse profile;
  final SupplierProfileDraft? draft;

  @override
  Widget build(BuildContext context) {
    final supplier = profile.supplier;
    final publicName = draft?.publicName ?? supplier?.publicName ?? '';
    final supplierType = draft?.supplierType ?? supplier?.supplierType ?? '';
    final description = draft?.description ?? supplier?.description ?? '';
    final country =
        draft?.country ?? supplier?.defaultPickupLocation?.country ?? '';
    final city = draft?.city ?? supplier?.defaultPickupLocation?.city ?? '';
    final visibility =
        draft?.visibility ?? supplier?.defaultPickupLocation?.visibility ?? '';

    final checks = <_CompletionItem>[
      _CompletionItem(
        label: 'Public name',
        complete: publicName.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: 'Supplier type',
        complete: supplierType.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: 'About your materials',
        complete: description.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: 'Pickup country & city',
        complete: country.trim().isNotEmpty && city.trim().isNotEmpty,
      ),
      _CompletionItem(
        label: 'Location visibility',
        complete: visibility.trim().isNotEmpty,
      ),
    ];

    final complete = checks.where((item) => item.complete).length;
    final progress = complete / checks.length;

    return _SupplierInsightCard(
      icon: Icons.task_alt_outlined,
      title: 'Profile completion',
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
                    backgroundColor: AuthDarkColors.chipUnselected,
                    color: AuthDarkColors.accent,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '${(progress * 100).round()}%',
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: AuthDarkColors.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '$complete of ${checks.length} essentials complete',
            style: AuthDarkTextStyles.body(context),
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
                    color: item.complete
                        ? AuthDarkColors.accent
                        : AuthDarkColors.textMuted,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(item.label, style: AuthDarkTextStyles.body(context)),
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
  });

  final String publicName;
  final String supplierType;
  final String description;
  final String country;
  final String city;
  final String area;
  final String visibility;
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
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 180),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.sideInsightCard,
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
                  color: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AuthDarkColors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(icon, color: AuthDarkColors.accent, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(title, style: AuthDarkTextStyles.sectionTitle(context)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
