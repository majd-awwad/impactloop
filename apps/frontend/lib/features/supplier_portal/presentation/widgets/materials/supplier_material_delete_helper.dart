import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../app/router/navigation_extensions.dart';
import '../../../../../core/errors/api_exception.dart';
import '../../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../application/supplier_my_materials_providers.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../../data/supplier_my_materials_repository.dart';
import '../../theme/supplier_theme_extension.dart';
import '../supplier_feedback.dart';
import '../../../../../l10n/l10n.dart';

Future<bool> showSupplierDeleteMaterialDialog(
  BuildContext context, {
  required String title,
  required String body,
  required String cancelLabel,
  required String confirmLabel,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AppDialogShell(
      title: Text(title),
      content: Text(body),
      onClose: () => Navigator.of(dialogContext).pop(false),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(cancelLabel),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: AppStatusButtonStyle.filled(
            dialogContext,
            AppStatusTone.danger,
          ),
          child: Text(confirmLabel),
        ),
      ),
    ),
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
    showSupplierErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
  } catch (_) {
    if (!context.mounted) {
      return;
    }
    showSupplierErrorSnackBar(context, l.deleteMaterialFailed);
  }
}
