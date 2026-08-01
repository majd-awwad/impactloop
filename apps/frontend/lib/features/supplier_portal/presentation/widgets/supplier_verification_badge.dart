import 'package:flutter/material.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierVerificationBadge extends StatelessWidget {
  const SupplierVerificationBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: context.s.verificationStatusLabel(status),
    tone: supplierVerificationStatusTone(status),
  );
}
