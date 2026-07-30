import 'package:flutter/material.dart';

import '../../../core/config/api_config.dart';
import '../../../shared/models/localized_text.dart';
import '../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../shared/widgets/materials/material_status_badge.dart';

import 'material_discovery_constants.dart';
import 'discovery_material_image.dart';

<<<<<<< Updated upstream
const _copyWithUnset = Object();

=======
>>>>>>> Stashed changes
class DiscoveryMaterialSupplierSummary {
  const DiscoveryMaterialSupplierSummary({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    this.city,
    this.area,
    this.followersCount,
    this.isFollowedByViewer = false,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final String? city;
  final String? area;
  final int? followersCount;
  final bool isFollowedByViewer;
}

class DiscoveryMaterial {
  const DiscoveryMaterial({
    required this.id,
    this.status = 'AVAILABLE',
    this.quantity = 1,
    this.availableQuantity = 1,
    this.unit = 'piece',
    required this.title,
    required this.description,
    required this.category,
    this.categoryId,
    this.city,
    this.area,
    this.approximateLatitude,
    this.approximateLongitude,
    this.approximateDistanceKm,
    required this.conditionLabel,
    required this.conditionTone,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.priceLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.deliveryAvailable,
    this.pickupAllowed = true,
    required this.isFree,
    required this.supplierName,
    required this.supplierSubtitle,
    this.supplierType,
    this.supplierVerified = false,
    this.supplier,
    required this.heroIconData,
    required this.cardGradient,
    this.imageUrl,
    this.galleryImages = const [],
    this.ratingLabel,
    this.viewsCount = 0,
    this.likesCount = 0,
    this.isLiked = false,
    this.postedAt,
    this.suggestedUses,
    this.sourceType,
    this.isOwnMaterial,
    this.canReserve,
    this.reserveBlockReason,
    this.recommendationImpressionId,
  });

  final String id;
  final String status;
  final double quantity;
  final double availableQuantity;
  final String unit;
  final LocalizedText title;
  final LocalizedText description;
  final LocalizedText category;
  final String? categoryId;
  final String? city;
  final String? area;
  final double? approximateLatitude;
  final double? approximateLongitude;
  final double? approximateDistanceKm;
  final LocalizedText conditionLabel;
  final MaterialConditionBadgeTone conditionTone;
  final LocalizedText statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final LocalizedText quantityLabel;
  final LocalizedText priceLabel;
  final LocalizedText locationLabel;
  final LocalizedText availabilityLabel;
  final bool deliveryAvailable;
  final bool pickupAllowed;
  final bool isFree;
  final LocalizedText supplierName;
  final LocalizedText supplierSubtitle;
  final String? supplierType;
  final bool supplierVerified;
  final DiscoveryMaterialSupplierSummary? supplier;
  final IconData heroIconData;
  final List<int> cardGradient;
  final String? imageUrl;
  final List<DiscoveryMaterialImage> galleryImages;
  final LocalizedText? ratingLabel;
  final int viewsCount;
  final int likesCount;
  final bool isLiked;
  final DateTime? postedAt;
  final String? suggestedUses;
  final String? sourceType;
  final bool? isOwnMaterial;
  final bool? canReserve;
  final String? reserveBlockReason;
  final String? recommendationImpressionId;

  bool get isPopular => viewsCount >= materialPopularViewsThreshold;

  bool get hasApproximatePin =>
      approximateLatitude != null && approximateLongitude != null;

  LocalizedText? get approximateDistanceLabel {
    final distance = approximateDistanceKm;
    if (distance == null) return null;

    final formatted = distance < 10
        ? distance.toStringAsFixed(1)
        : distance.toStringAsFixed(0);

    return LocalizedText(en: '~$formatted km away', ar: 'حوالي $formatted كم');
  }

  DiscoveryMaterial copyWith({
    int? viewsCount,
    int? likesCount,
    bool? isLiked,
    bool? isOwnMaterial,
    bool? canReserve,
    Object? reserveBlockReason = _copyWithUnset,
    String? recommendationImpressionId,
  }) {
    return DiscoveryMaterial(
      id: id,
      status: status,
      quantity: quantity,
      availableQuantity: availableQuantity,
      unit: unit,
      title: title,
      description: description,
      category: category,
      categoryId: categoryId,
      city: city,
      area: area,
      approximateLatitude: approximateLatitude,
      approximateLongitude: approximateLongitude,
      approximateDistanceKm: approximateDistanceKm,
      conditionLabel: conditionLabel,
      conditionTone: conditionTone,
      statusLabel: statusLabel,
      statusTone: statusTone,
      quantityLabel: quantityLabel,
      priceLabel: priceLabel,
      locationLabel: locationLabel,
      availabilityLabel: availabilityLabel,
      deliveryAvailable: deliveryAvailable,
      pickupAllowed: pickupAllowed,
      isFree: isFree,
      supplierName: supplierName,
      supplierSubtitle: supplierSubtitle,
      supplierType: supplierType,
      supplierVerified: supplierVerified,
      supplier: supplier,
      heroIconData: heroIconData,
      cardGradient: cardGradient,
      imageUrl: imageUrl,
      galleryImages: galleryImages,
      ratingLabel: ratingLabel,
      viewsCount: viewsCount ?? this.viewsCount,
      likesCount: likesCount ?? this.likesCount,
      isLiked: isLiked ?? this.isLiked,
      postedAt: postedAt,
      suggestedUses: suggestedUses,
      sourceType: sourceType,
      isOwnMaterial: isOwnMaterial ?? this.isOwnMaterial,
      canReserve: canReserve ?? this.canReserve,
      reserveBlockReason: identical(reserveBlockReason, _copyWithUnset)
          ? this.reserveBlockReason
          : reserveBlockReason as String?,
      recommendationImpressionId:
          recommendationImpressionId ?? this.recommendationImpressionId,
    );
  }

  List<DiscoveryMaterialImage> get resolvedGalleryImages {
    if (galleryImages.isNotEmpty) {
      return galleryImages;
    }

    final url = imageUrl?.trim();
    if (url == null || url.isEmpty) {
      return const [];
    }

    return [
      DiscoveryMaterialImage(id: id, url: url, isCover: true, isPrimary: true),
    ];
  }

  LocalizedText? get sourceTypeLabel => _sourceTypeLabel(sourceType);

  LocalizedText? get supplierTypeLabel => supplierTypeLabelFor(supplierType);

  static LocalizedText? _sourceTypeLabel(String? value) {
    switch (value) {
      case 'STUDENT_LEFTOVER':
        return const LocalizedText(en: 'Student leftover', ar: 'فائض طلابي');
      case 'WORKSHOP_SURPLUS':
        return const LocalizedText(en: 'Workshop surplus', ar: 'فائض ورشة');
      case 'FACTORY_SURPLUS':
        return const LocalizedText(en: 'Factory surplus', ar: 'فائض مصنع');
      case 'EDUCATIONAL_INSTITUTION':
        return const LocalizedText(
          en: 'Educational institution',
          ar: 'مؤسسة تعليمية',
        );
      default:
        return null;
    }
  }

  static LocalizedText? supplierTypeLabelFor(String? value) {
    switch (value) {
      case 'INDIVIDUAL_SUPPLIER':
        return const LocalizedText(en: 'Individual supplier', ar: 'مورد فردي');
      case 'STUDENT_SUPPLIER':
        return const LocalizedText(en: 'Student supplier', ar: 'مورد طالب');
      case 'WORKSHOP':
        return const LocalizedText(en: 'Workshop', ar: 'ورشة');
      case 'FACTORY':
        return const LocalizedText(en: 'Factory', ar: 'مصنع');
      case 'EDUCATIONAL_INSTITUTION':
        return const LocalizedText(
          en: 'Educational institution',
          ar: 'مؤسسة تعليمية',
        );
      default:
        return null;
    }
  }
}

class PublicSupplier {
  const PublicSupplier({
    required this.id,
    required this.displayName,
    this.supplierType,
    this.description,
    this.avatarUrl,
    this.coverImageUrl,
    this.city,
    this.area,
    this.isVerified = false,
    this.materialsCount = 0,
    this.followersCount = 0,
    this.isFollowedByViewer = false,
  });

  final String id;
  final String displayName;
  final String? supplierType;
  final String? description;
  final String? avatarUrl;
  final String? coverImageUrl;
  final String? city;
  final String? area;
  final bool isVerified;
  final int materialsCount;
  final int followersCount;
  final bool isFollowedByViewer;

<<<<<<< Updated upstream
  PublicSupplier copyWith({int? followersCount, bool? isFollowedByViewer}) {
=======
  PublicSupplier copyWith({
    int? followersCount,
    bool? isFollowedByViewer,
  }) {
>>>>>>> Stashed changes
    return PublicSupplier(
      id: id,
      displayName: displayName,
      supplierType: supplierType,
      description: description,
      avatarUrl: avatarUrl,
      coverImageUrl: coverImageUrl,
      city: city,
      area: area,
      isVerified: isVerified,
      materialsCount: materialsCount,
      followersCount: followersCount ?? this.followersCount,
      isFollowedByViewer: isFollowedByViewer ?? this.isFollowedByViewer,
    );
  }

  factory PublicSupplier.fromJson(Map<String, dynamic> json) {
    final avatarUrl = _nullableString(json['avatarUrl']);
    final coverImageUrl = _nullableString(json['coverImageUrl']);

    return PublicSupplier(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'ImpactLoop supplier',
      supplierType: _nullableString(json['supplierType']),
      description: _nullableString(json['description']),
      avatarUrl: avatarUrl == null
          ? null
          : ApiConfig.resolveMediaUrl(avatarUrl),
      coverImageUrl: coverImageUrl == null
          ? null
          : ApiConfig.resolveMediaUrl(coverImageUrl),
      city: _nullableString(json['city']),
      area: _nullableString(json['area']),
      isVerified: json['isVerified'] == true,
      materialsCount: _intFromDynamic(json['materialsCount']) ?? 0,
      followersCount: _intFromDynamic(json['followersCount']) ?? 0,
      isFollowedByViewer: json['isFollowedByViewer'] == true,
    );
  }

  static String? _nullableString(Object? value) {
    if (value == null) {
      return null;
    }

    final normalized = value.toString().trim();
    return normalized.isEmpty ? null : normalized;
  }

  static int? _intFromDynamic(Object? value) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    return int.tryParse(value?.toString() ?? '');
  }
}

class SupplierFollowStatus {
  const SupplierFollowStatus({
    required this.supplierProfileId,
    required this.followersCount,
    required this.isFollowedByViewer,
  });

  final String supplierProfileId;
  final int followersCount;
  final bool isFollowedByViewer;

  factory SupplierFollowStatus.fromJson(Map<String, dynamic> json) {
    return SupplierFollowStatus(
      supplierProfileId: json['supplierProfileId'] as String? ?? '',
<<<<<<< Updated upstream
      followersCount:
          PublicSupplier._intFromDynamic(json['followersCount']) ?? 0,
=======
      followersCount: PublicSupplier._intFromDynamic(json['followersCount']) ?? 0,
>>>>>>> Stashed changes
      isFollowedByViewer: json['isFollowedByViewer'] == true,
    );
  }
}
