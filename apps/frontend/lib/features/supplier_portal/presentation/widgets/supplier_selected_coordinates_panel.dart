import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

class SupplierSelectedCoordinatesPanel extends StatelessWidget {
  const SupplierSelectedCoordinatesPanel({
    super.key,
    required this.latitude,
    required this.longitude,
    this.helperMessage,
  });

  final double latitude;
  final double longitude;
  final String? helperMessage;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.selectedCoordinates,
            style: context.supplierLabel().copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.latitudeLabel(latitude.toStringAsFixed(5)),
            style: context.supplierBody().copyWith(
              color: colors.accent,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.longitudeLabel(longitude.toStringAsFixed(5)),
            style: context.supplierBody().copyWith(
              color: colors.accent,
            ),
          ),
          if (helperMessage != null && helperMessage!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              helperMessage!,
              style: context.supplierBody(),
            ),
          ],
        ],
      ),
    );
  }
}
