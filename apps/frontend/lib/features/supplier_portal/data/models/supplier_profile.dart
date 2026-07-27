import 'supplier_organization_profile.dart';
import 'supplier_profile_location.dart';

class SupplierProfileUser {
  const SupplierProfileUser({
    required this.id,
    required this.displayName,
    required this.email,
    this.profileImageUrl,
  });

  final String id;
  final String displayName;
  final String email;
  final String? profileImageUrl;

  factory SupplierProfileUser.fromJson(Map<String, dynamic> json) {
    return SupplierProfileUser(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      profileImageUrl: json['profileImageUrl'] as String?,
    );
  }
}

class SupplierProfileDetails {
  const SupplierProfileDetails({
    required this.id,
    required this.publicName,
    required this.supplierType,
    this.description,
    this.coverImageUrl,
    this.avatarImageUrl,
    required this.verificationStatus,
    this.verificationAdminNote,
    this.verificationReviewedAt,
    this.defaultPickupLocation,
    this.organizationProfile,
  });

  final String id;
  final String publicName;
  final String supplierType;
  final String? description;
  final String? coverImageUrl;
  final String? avatarImageUrl;
  final String verificationStatus;
  final String? verificationAdminNote;
  final DateTime? verificationReviewedAt;
  final SupplierProfileLocation? defaultPickupLocation;
  final SupplierOrganizationProfile? organizationProfile;

  factory SupplierProfileDetails.fromJson(Map<String, dynamic> json) {
    final locationJson = json['defaultPickupLocation'];
    final organizationJson = json['organizationProfile'];

    return SupplierProfileDetails(
      id: json['id'] as String? ?? '',
      publicName: json['publicName'] as String? ?? '',
      supplierType: json['supplierType'] as String? ?? '',
      description: json['description'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      avatarImageUrl: json['avatarImageUrl'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'UNVERIFIED',
      verificationAdminNote: json['verificationAdminNote'] as String?,
      verificationReviewedAt: DateTime.tryParse(
        json['verificationReviewedAt'] as String? ?? '',
      ),
      defaultPickupLocation: locationJson is Map<String, dynamic>
          ? SupplierProfileLocation.fromJson(locationJson)
          : null,
      organizationProfile: organizationJson is Map<String, dynamic>
          ? SupplierOrganizationProfile.fromJson(organizationJson)
          : null,
    );
  }
}

class SupplierProfileStats {
  const SupplierProfileStats({
    required this.materialsCount,
    required this.availableMaterialsCount,
    required this.reusedMaterialsCount,
    required this.followersCount,
    required this.totalViews,
    required this.totalLikes,
    required this.totalReservations,
  });

  final int materialsCount;
  final int availableMaterialsCount;
  final int reusedMaterialsCount;
  final int followersCount;
  final int totalViews;
  final int totalLikes;
  final int totalReservations;

  factory SupplierProfileStats.fromJson(Map<String, dynamic> json) {
    return SupplierProfileStats(
      materialsCount: (json['materialsCount'] as num?)?.toInt() ?? 0,
      availableMaterialsCount:
          (json['availableMaterialsCount'] as num?)?.toInt() ?? 0,
      reusedMaterialsCount:
          (json['reusedMaterialsCount'] as num?)?.toInt() ?? 0,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      totalViews: (json['totalViews'] as num?)?.toInt() ?? 0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      totalReservations: (json['totalReservations'] as num?)?.toInt() ?? 0,
    );
  }
}

class SupplierFollowerPreviewItem {
  const SupplierFollowerPreviewItem({
    required this.userId,
    required this.displayName,
    required this.email,
    this.profileImageUrl,
    required this.followedAt,
  });

  final String userId;
  final String displayName;
  final String email;
  final String? profileImageUrl;
  final DateTime followedAt;

  factory SupplierFollowerPreviewItem.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    return SupplierFollowerPreviewItem(
      userId: user['id'] as String? ?? '',
      displayName: user['displayName'] as String? ?? '',
      email: user['email'] as String? ?? '',
      profileImageUrl: user['profileImageUrl'] as String?,
      followedAt:
          DateTime.tryParse(json['followedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class SupplierMaterialPreviewItem {
  const SupplierMaterialPreviewItem({
    required this.id,
    required this.title,
    this.imageUrl,
    this.categoryName,
    required this.status,
    required this.condition,
    required this.isFree,
    this.price,
    required this.currency,
    required this.quantity,
    required this.unit,
    this.locationCity,
    this.locationArea,
    this.pickupNotes,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    required this.createdAt,
    required this.viewsCount,
    required this.likesCount,
    required this.reservationsCount,
  });

  final String id;
  final String title;
  final String? imageUrl;
  final String? categoryName;
  final String status;
  final String condition;
  final bool isFree;
  final double? price;
  final String currency;
  final double quantity;
  final String unit;
  final String? locationCity;
  final String? locationArea;
  final String? pickupNotes;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final DateTime createdAt;
  final int viewsCount;
  final int likesCount;
  final int reservationsCount;

  factory SupplierMaterialPreviewItem.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as Map<String, dynamic>?;
    final location = json['location'] as Map<String, dynamic>?;
    return SupplierMaterialPreviewItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      categoryName: category?['nameEn'] as String?,
      status: json['status'] as String? ?? '',
      condition: json['condition'] as String? ?? '',
      isFree: json['isFree'] as bool? ?? true,
      price: (json['price'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'NIS',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      locationCity: location?['city'] as String?,
      locationArea: location?['area'] as String?,
      pickupNotes: json['pickupNotes'] as String?,
      pickupAllowed: json['pickupAllowed'] != false,
      deliveryAllowed: json['deliveryAllowed'] == true,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      viewsCount: (json['viewsCount'] as num?)?.toInt() ?? 0,
      likesCount: (json['likesCount'] as num?)?.toInt() ?? 0,
      reservationsCount: (json['reservationsCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class SupplierProfileResponse {
  const SupplierProfileResponse({
    required this.hasSupplierProfile,
    required this.user,
    required this.stats,
    required this.latestFollowers,
    required this.materialsPreview,
    this.supplier,
  });

  final bool hasSupplierProfile;
  final SupplierProfileUser user;
  final SupplierProfileStats stats;
  final List<SupplierFollowerPreviewItem> latestFollowers;
  final List<SupplierMaterialPreviewItem> materialsPreview;
  final SupplierProfileDetails? supplier;

  factory SupplierProfileResponse.fromJson(Map<String, dynamic> json) {
    final supplierJson = json['supplier'];
    return SupplierProfileResponse(
      hasSupplierProfile: json['hasSupplierProfile'] as bool? ?? false,
      user: SupplierProfileUser.fromJson(
        json['user'] as Map<String, dynamic>? ?? const {},
      ),
      stats: SupplierProfileStats.fromJson(
        json['stats'] as Map<String, dynamic>? ?? const {},
      ),
      latestFollowers: (json['latestFollowers'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => SupplierFollowerPreviewItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      materialsPreview: (json['materialsPreview'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => SupplierMaterialPreviewItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      supplier: supplierJson is Map<String, dynamic>
          ? SupplierProfileDetails.fromJson(supplierJson)
          : null,
    );
  }
}

/// The bounded response used by the private supplier profile management page.
///
/// This deliberately remains separate from [SupplierProfileResponse], whose
/// legacy shape also contains follower, metric, and material-preview data.
class SupplierProfileManagement {
  const SupplierProfileManagement({
    required this.hasSupplierProfile,
    this.identity,
    this.pickupLocation,
    this.organization,
    required this.verification,
    required this.completion,
  });

  final bool hasSupplierProfile;
  final SupplierProfileManagementIdentity? identity;
  final SupplierProfileLocation? pickupLocation;
  final SupplierProfileManagementOrganization? organization;
  final SupplierProfileManagementVerification verification;
  final SupplierProfileManagementCompletion completion;

  factory SupplierProfileManagement.fromJson(Map<String, dynamic> json) {
    final identityJson = json['identity'];
    final locationJson = json['pickupLocation'];
    final organizationJson = json['organization'];
    final verificationJson = json['verification'];
    final completionJson = json['completion'];

    return SupplierProfileManagement(
      hasSupplierProfile: json['hasSupplierProfile'] as bool? ?? false,
      identity: identityJson is Map
          ? SupplierProfileManagementIdentity.fromJson(
              Map<String, dynamic>.from(identityJson),
            )
          : null,
      pickupLocation: locationJson is Map
          ? SupplierProfileLocation.fromJson(
              Map<String, dynamic>.from(locationJson),
            )
          : null,
      organization: organizationJson is Map
          ? SupplierProfileManagementOrganization.fromJson(
              Map<String, dynamic>.from(organizationJson),
            )
          : null,
      verification: verificationJson is Map
          ? SupplierProfileManagementVerification.fromJson(
              Map<String, dynamic>.from(verificationJson),
            )
          : const SupplierProfileManagementVerification.empty(),
      completion: completionJson is Map
          ? SupplierProfileManagementCompletion.fromJson(
              Map<String, dynamic>.from(completionJson),
            )
          : const SupplierProfileManagementCompletion.empty(),
    );
  }
}

class SupplierProfileManagementIdentity {
  const SupplierProfileManagementIdentity({
    required this.supplierProfileId,
    required this.publicName,
    required this.supplierType,
    this.description,
    this.avatarImageUrl,
    this.coverImageUrl,
  });

  final String supplierProfileId;
  final String publicName;
  final String supplierType;
  final String? description;
  final String? avatarImageUrl;
  final String? coverImageUrl;

  factory SupplierProfileManagementIdentity.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierProfileManagementIdentity(
      supplierProfileId: _stringValue(json['supplierProfileId']) ?? '',
      publicName: _stringValue(json['publicName']) ?? '',
      supplierType: _stringValue(json['supplierType']) ?? '',
      description: _stringValue(json['description']),
      avatarImageUrl: _stringValue(json['avatarImageUrl']),
      coverImageUrl: _stringValue(json['coverImageUrl']),
    );
  }
}

class SupplierProfileManagementOrganization {
  const SupplierProfileManagementOrganization({
    this.id,
    this.organizationName,
    this.organizationType,
    this.contactPersonName,
    this.workingDays,
    this.workingHours,
  });

  final String? id;
  final String? organizationName;
  final String? organizationType;
  final String? contactPersonName;
  final List<String>? workingDays;
  final Map<String, String>? workingHours;

  factory SupplierProfileManagementOrganization.fromJson(
    Map<String, dynamic> json,
  ) {
    final days = _parseStringList(json['workingDays']);
    final hours = _parseStringMap(json['workingHours']);

    return SupplierProfileManagementOrganization(
      id: _stringValue(json['id']),
      organizationName: _stringValue(json['organizationName']),
      organizationType: _stringValue(json['organizationType']),
      contactPersonName: _stringValue(json['contactPersonName']),
      workingDays: days,
      workingHours: hours,
    );
  }
}

class SupplierProfileManagementVerification {
  const SupplierProfileManagementVerification({
    required this.rawStatus,
    required this.status,
    required this.isVerified,
    required this.canSubmit,
    required this.canResubmit,
    this.adminNote,
    this.submittedAt,
    this.reviewedAt,
  });

  const SupplierProfileManagementVerification.empty()
    : rawStatus = 'UNKNOWN',
      status = 'UNKNOWN',
      isVerified = false,
      canSubmit = false,
      canResubmit = false,
      adminNote = null,
      submittedAt = null,
      reviewedAt = null;

  final String rawStatus;
  final String status;
  final bool isVerified;
  final bool canSubmit;
  final bool canResubmit;
  final String? adminNote;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;

  factory SupplierProfileManagementVerification.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawStatus = _stringValue(json['rawStatus']) ?? 'UNKNOWN';
    return SupplierProfileManagementVerification(
      rawStatus: rawStatus,
      status: _normalizeVerificationStatus(json['status'] ?? rawStatus),
      isVerified: json['isVerified'] == true,
      canSubmit: json['canSubmit'] == true,
      canResubmit: json['canResubmit'] == true,
      adminNote: _stringValue(json['adminNote']),
      submittedAt: _parseDate(json['submittedAt']),
      reviewedAt: _parseDate(json['reviewedAt']),
    );
  }
}

class SupplierProfileManagementCompletion {
  const SupplierProfileManagementCompletion({
    required this.completedCount,
    required this.totalCount,
    required this.percentage,
    required this.missingFields,
  });

  const SupplierProfileManagementCompletion.empty()
    : completedCount = 0,
      totalCount = 0,
      percentage = 0,
      missingFields = const [];

  final int completedCount;
  final int totalCount;
  final int percentage;
  final List<String> missingFields;

  factory SupplierProfileManagementCompletion.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierProfileManagementCompletion(
      completedCount: _parseInt(json['completedCount']),
      totalCount: _parseInt(json['totalCount']),
      percentage: _parseInt(json['percentage']),
      missingFields: (_parseStringList(json['missingFields']) ?? const [])
          .toList(growable: false),
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}

String? _stringValue(dynamic value) => value is String ? value : null;

List<String>? _parseStringList(dynamic value) {
  if (value is! List || value.isEmpty) return null;

  final values = <String>[];
  for (final item in value) {
    if (item is! String || item.trim().isEmpty) return null;
    values.add(item.trim());
  }
  return values;
}

Map<String, String>? _parseStringMap(dynamic value) {
  if (value is! Map || value.isEmpty) return null;

  final result = <String, String>{};
  for (final entry in value.entries) {
    if (entry.key is! String || entry.value is! String) return null;
    final key = (entry.key as String).trim();
    final item = (entry.value as String).trim();
    if (key.isEmpty || item.isEmpty) return null;
    result[key] = item;
  }
  return result;
}

String _normalizeVerificationStatus(dynamic value) {
  final normalized = _stringValue(value)?.trim().toUpperCase() ?? 'UNKNOWN';
  return switch (normalized) {
    'VERIFIED' => 'APPROVED',
    'NOT_REQUIRED' ||
    'UNVERIFIED' ||
    'PENDING' ||
    'CHANGES_REQUESTED' ||
    'REJECTED' ||
    'APPROVED' => normalized,
    _ => 'UNKNOWN',
  };
}

int _parseInt(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}
