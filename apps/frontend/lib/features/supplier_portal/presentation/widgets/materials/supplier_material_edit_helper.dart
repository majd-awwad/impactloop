import '../../l10n/supplier_l10n.dart';

String supplierMaterialEditBlockedMessage(
  SupplierL10n l,
  String? editBlockedReason,
) {
  return switch (editBlockedReason) {
    'REUSED_HISTORY' => l.editMaterialBlockedReused,
    'ACTIVE_REQUESTS' => l.editMaterialBlockedActiveRequests,
    _ => l.editMaterialBlockedDefault,
  };
}
