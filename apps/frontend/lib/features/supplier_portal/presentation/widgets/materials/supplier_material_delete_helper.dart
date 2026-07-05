import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../app/router/navigation_extensions.dart';
import '../../../../../core/errors/api_exception.dart';
import '../../../application/supplier_my_materials_providers.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../../data/supplier_my_materials_repository.dart';
import '../../theme/supplier_theme_extension.dart';
import '../supplier_feedback.dart';

Future<bool> showSupplierDeleteMaterialDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String cancelLabel,
  required String confirmLabel,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      final colors = dialogContext.supplierColors;

      return AlertDialog(
        backgroundColor: colors.surfaceSolid,
        title: Text(title, style: dialogContext.supplierSectionTitle()),
        content: Text(body, style: dialogContext.supplierBody()),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(cancelLabel),
          ),
          OutlinedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.error,
              side: BorderSide(color: colors.error),
            ),
            child: Text(confirmLabel),
          ),
        ],
      );
    },
  );

  return result == true;
}

String supplierMaterialDeleteBlockedMessage(
  SupplierL10n l,
  String? deleteBlockedReason,
) {
  return switch (deleteBlockedReason) {
    'REUSED_HISTORY' => l.deleteMaterialBlockedReused,
    'ACTIVE_REQUESTS' => l.deleteMaterialBlockedActiveRequests,
    _ => l.deleteMaterialBlockedDefault,
  };
}

Future<void> handleSupplierMaterialDelete({
  required BuildContext context,
  required WidgetRef ref,
  required SupplierMyMaterial material,
}) async {
  final l = context.s;

  if (!material.canDelete) {
    showSupplierErrorSnackBar(
      context,
      supplierMaterialDeleteBlockedMessage(l, material.deleteBlockedReason),
    );
    return;
  }

  final confirmed = await showSupplierDeleteMaterialDialog(
    context,
    title: l.deleteMaterialTitle,
    body: l.deleteMaterialBody,
    cancelLabel: l.cancel,
    confirmLabel: l.deleteMaterialConfirm,
  );

  if (!confirmed || !context.mounted) {
    return;
  }

  try {
    await ref
        .read(supplierMyMaterialsRepositoryProvider)
        .deleteMaterial(material.id);

    if (!context.mounted) {
      return;
    }

    invalidateSupplierMyMaterials(ref);
    ref.invalidate(supplierMyMaterialByIdProvider(material.id));
    showSupplierInfoSnackBar(context, l.materialDeletedSuccess);

    context.popOrGo('/supplier/materials');
  } on ApiException catch (error) {
    if (!context.mounted) {
      return;
    }
    showSupplierErrorSnackBar(context, error.message);
  } catch (_) {
    if (!context.mounted) {
      return;
    }
    showSupplierErrorSnackBar(context, l.deleteMaterialFailed);
  }
}
