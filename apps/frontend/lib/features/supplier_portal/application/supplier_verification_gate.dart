const organizationSupplierTypes = <String>{
  'WORKSHOP',
  'FACTORY',
  'EDUCATIONAL_INSTITUTION',
};

const individualSupplierTypes = <String>{
  'STUDENT_SUPPLIER',
  'INDIVIDUAL_SUPPLIER',
};

const supplierVerificationPendingRoute = '/supplier/verification-pending';
const supplierVerificationStatusRoute = '/supplier/verification-status';

const _displaySupplierTypeAliases = <String, String>{
  'student supplier': 'STUDENT_SUPPLIER',
  'individual supplier': 'INDIVIDUAL_SUPPLIER',
  'workshop': 'WORKSHOP',
  'factory': 'FACTORY',
  'educational institution': 'EDUCATIONAL_INSTITUTION',
};

String? normalizeSupplierTypeInput(String? supplierType) {
  if (supplierType == null || supplierType.trim().isEmpty) {
    return null;
  }

  final trimmed = supplierType.trim();
  final alias = _displaySupplierTypeAliases[trimmed.toLowerCase()];
  if (alias != null) {
    return alias;
  }

  return trimmed.toUpperCase().replaceAll(' ', '_');
}

bool isOrganizationSupplierInput(String? supplierType) {
  return isOrganizationSupplierType(normalizeSupplierTypeInput(supplierType));
}

bool isOrganizationSupplierType(String? supplierType) {
  if (supplierType == null || supplierType.trim().isEmpty) {
    return false;
  }

  return organizationSupplierTypes.contains(supplierType.trim().toUpperCase());
}

String normalizeVerificationStatus(String? status) {
  final normalized = (status ?? 'PENDING').trim().toUpperCase();
  if (normalized == 'VERIFIED') {
    return 'APPROVED';
  }
  if (normalized == 'UNVERIFIED') {
    return 'PENDING';
  }
  return normalized;
}

bool canSupplierPublishMaterials({
  required String? supplierType,
  required String? verificationStatus,
}) {
  if (!isOrganizationSupplierType(supplierType)) {
    return true;
  }

  return normalizeVerificationStatus(verificationStatus) == 'APPROVED';
}

String? supplierVerificationGateRoute({
  required String? supplierType,
  required String? verificationStatus,
}) {
  if (!isOrganizationSupplierType(supplierType)) {
    return null;
  }

  final status = normalizeVerificationStatus(verificationStatus);
  if (status == 'APPROVED' || status == 'NOT_REQUIRED') {
    return null;
  }

  if (status == 'REJECTED' || status == 'CHANGES_REQUESTED') {
    return supplierVerificationStatusRoute;
  }

  return supplierVerificationPendingRoute;
}

bool isSupplierVerificationStatusRoute(String path) {
  return path == supplierVerificationPendingRoute ||
      path == supplierVerificationStatusRoute;
}
