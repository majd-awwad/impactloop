import 'package:flutter/material.dart';

import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierVerificationBadge extends StatelessWidget {
  const SupplierVerificationBadge({super.key, required this.status});

  final String status;

  Color get _background {
    switch (status.toUpperCase()) {
      case 'VERIFIED':
        return AuthDarkColors.accentSoft;
      case 'REJECTED':
        return AuthDarkColors.error.withValues(alpha: 0.18);
      case 'NOT_REQUIRED':
        return AuthDarkColors.chipUnselected;
      default:
        return AuthDarkColors.chipSelected;
    }
  }

  Color get _foreground {
    switch (status.toUpperCase()) {
      case 'VERIFIED':
        return AuthDarkColors.accent;
      case 'REJECTED':
        return AuthDarkColors.error;
      default:
        return AuthDarkColors.textSecondary;
    }
  }

  String get _label {
    switch (status.toUpperCase()) {
      case 'VERIFIED':
        return 'Verified';
      case 'REJECTED':
        return 'Rejected';
      case 'NOT_REQUIRED':
        return 'Not required';
      case 'PENDING':
        return 'Pending verification';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: SupplierDecorations.badge(background: _background),
      child: Text(
        _label,
        style: AuthDarkTextStyles.chip(context).copyWith(color: _foreground),
      ),
    );
  }
}
