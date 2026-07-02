import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_account_security_card.dart';

class SupplierProfileEditSettings extends StatelessWidget {
  const SupplierProfileEditSettings({
    super.key,
    this.onChangeAvatar,
    this.onChangeCover,
    this.isUploadingAvatar = false,
    this.isUploadingCover = false,
  });

  final VoidCallback? onChangeAvatar;
  final VoidCallback? onChangeCover;
  final bool isUploadingAvatar;
  final bool isUploadingCover;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Panel(
          title: 'Profile images',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: isUploadingAvatar ? null : onChangeAvatar,
                icon: isUploadingAvatar
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.account_circle_outlined, size: 18),
                label: Text(
                  isUploadingAvatar
                      ? 'Uploading avatar...'
                      : 'Change profile photo',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: isUploadingCover ? null : onChangeCover,
                icon: isUploadingCover
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.wallpaper_outlined, size: 18),
                label: Text(
                  isUploadingCover
                      ? 'Uploading cover...'
                      : 'Change cover image',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const SupplierAccountSecurityCard(),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}
