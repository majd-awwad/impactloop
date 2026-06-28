class MaterialDiscoveryQuery {
  const MaterialDiscoveryQuery({
    this.q,
    this.categoryId,
    this.condition,
    this.status = 'AVAILABLE',
    this.priceType = 'ANY',
    this.deliveryAvailable,
    this.pickupAllowed,
    this.city,
    this.area,
    this.sort = 'newest',
    this.page = 1,
    this.limit = 20,
  });

  final String? q;
  final String? categoryId;
  final String? condition;
  final String status;
  final String priceType;
  final bool? deliveryAvailable;
  final bool? pickupAllowed;
  final String? city;
  final String? area;
  final String sort;
  final int page;
  final int limit;

  MaterialDiscoveryQuery copyWith({
    String? q,
    String? categoryId,
    String? condition,
    String? status,
    String? priceType,
    bool? deliveryAvailable,
    bool? pickupAllowed,
    String? city,
    String? area,
    String? sort,
    int? page,
    int? limit,
    bool clearQ = false,
    bool clearCategoryId = false,
    bool clearCondition = false,
    bool clearDeliveryAvailable = false,
    bool clearPickupAllowed = false,
    bool clearCity = false,
    bool clearArea = false,
  }) {
    return MaterialDiscoveryQuery(
      q: clearQ ? null : (q ?? this.q),
      categoryId: clearCategoryId ? null : (categoryId ?? this.categoryId),
      condition: clearCondition ? null : (condition ?? this.condition),
      status: status ?? this.status,
      priceType: priceType ?? this.priceType,
      deliveryAvailable: clearDeliveryAvailable
          ? null
          : (deliveryAvailable ?? this.deliveryAvailable),
      pickupAllowed: clearPickupAllowed
          ? null
          : (pickupAllowed ?? this.pickupAllowed),
      city: clearCity ? null : (city ?? this.city),
      area: clearArea ? null : (area ?? this.area),
      sort: sort ?? this.sort,
      page: page ?? this.page,
      limit: limit ?? this.limit,
    );
  }

  bool get hasActiveFilters =>
      (q != null && q!.trim().isNotEmpty) ||
      categoryId != null ||
      condition != null ||
      priceType != 'ANY' ||
      deliveryAvailable != null ||
      pickupAllowed != null ||
      (city != null && city!.trim().isNotEmpty) ||
      (area != null && area!.trim().isNotEmpty) ||
      sort != 'newest';

  @override
  bool operator ==(Object other) {
    return other is MaterialDiscoveryQuery &&
        other.q == q &&
        other.categoryId == categoryId &&
        other.condition == condition &&
        other.status == status &&
        other.priceType == priceType &&
        other.deliveryAvailable == deliveryAvailable &&
        other.pickupAllowed == pickupAllowed &&
        other.city == city &&
        other.area == area &&
        other.sort == sort &&
        other.page == page &&
        other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(
    q,
    categoryId,
    condition,
    status,
    priceType,
    deliveryAvailable,
    pickupAllowed,
    city,
    area,
    sort,
    page,
    limit,
  );
}
