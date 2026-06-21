import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierSelectedCoordinatesPanel extends StatelessWidget {
  const SupplierSelectedCoordinatesPanel({
    super.key,
    required this.latitude,
    required this.longitude,
    this.showCaptureHelper = false,
  });

  final double latitude;
  final double longitude;
  final bool showCaptureHelper;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Selected coordinates',
            style: AuthDarkTextStyles.label(context).copyWith(
              color: AuthDarkColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Latitude: ${latitude.toStringAsFixed(5)}',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: AuthDarkColors.accent),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Longitude: ${longitude.toStringAsFixed(5)}',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: AuthDarkColors.accent),
          ),
          if (showCaptureHelper) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Coordinates captured. Please confirm country, city, and area manually.',
              style: AuthDarkTextStyles.body(context),
            ),
          ],
        ],
      ),
    );
  }
}
