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
      followedAt: DateTime.tryParse(json['followedAt'] as String? ?? '') ??
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
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
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
