enum SupplierNotificationCategory {
  reservation,
  materialReview,
  deliveryRecovery,
  account,
  system,
  unknown,
}

enum SupplierNotificationState {
  needsAction,
  waiting,
  update,
  resolved,
  unknown,
}

enum SupplierNotificationWaitingOn {
  supplier,
  admin,
  learner,
  driver,
  system,
  none,
  unknown,
}

enum SupplierNotificationActionType {
  reviewReservation,
  openReservation,
  choosePickupWindow,
  continueListing,
  editListing,
  openMaterial,
  openProfile,
  none,
  unknown,
}

enum SupplierNotificationDestination {
  supplierReservations,
  supplierReservationDetail,
  supplierAddMaterialCategoryRequest,
  supplierAddMaterialPriceRequest,
  supplierMaterialDetail,
  supplierProfile,
  unknown,
}

// Legacy presentation enums remain as a compatibility adapter for the current cards.
enum SupplierActionNotificationGroup { reviewUpdate, reservationAlert }

enum SupplierActionNotificationKind {
  categoryApproved,
  categorySuggestion,
  categoryRejected,
  categoryPending,
  categoryCompleted,
  priceApproved,
  priceRejected,
  pricePending,
  priceCompleted,
  reservationPending,
}

enum SupplierActionNotificationStatus { pending, approved, rejected }

enum SupplierActionNotificationActionType {
  continueListing,
  editListing,
  editPrice,
  reviewRequest,
}

enum SupplierNotificationFilter { all, actionNeeded, reservations, completed }

extension SupplierNotificationFilterLabels on SupplierNotificationFilter {
  String get label {
    switch (this) {
      case SupplierNotificationFilter.all:
        return 'All';
      case SupplierNotificationFilter.actionNeeded:
        return 'Action needed';
      case SupplierNotificationFilter.reservations:
        return 'Reservations';
      case SupplierNotificationFilter.completed:
        return 'Resolved';
    }
  }
}

String _string(Object? value) => value is String ? value : '';

DateTime _date(Object? value) =>
    DateTime.tryParse(_string(value)) ?? DateTime.fromMillisecondsSinceEpoch(0);

SupplierNotificationCategory _parseCategory(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'RESERVATION' => SupplierNotificationCategory.reservation,
    'MATERIAL_REVIEW' => SupplierNotificationCategory.materialReview,
    'DELIVERY_RECOVERY' => SupplierNotificationCategory.deliveryRecovery,
    'ACCOUNT' => SupplierNotificationCategory.account,
    'SYSTEM' => SupplierNotificationCategory.system,
    _ => SupplierNotificationCategory.unknown,
  };
}

SupplierNotificationState _parseState(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'NEEDS_ACTION' => SupplierNotificationState.needsAction,
    'WAITING' => SupplierNotificationState.waiting,
    'UPDATE' => SupplierNotificationState.update,
    'RESOLVED' => SupplierNotificationState.resolved,
    _ => SupplierNotificationState.unknown,
  };
}

SupplierNotificationWaitingOn _parseWaitingOn(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'SUPPLIER' => SupplierNotificationWaitingOn.supplier,
    'ADMIN' => SupplierNotificationWaitingOn.admin,
    'LEARNER' => SupplierNotificationWaitingOn.learner,
    'DRIVER' => SupplierNotificationWaitingOn.driver,
    'SYSTEM' => SupplierNotificationWaitingOn.system,
    'NONE' => SupplierNotificationWaitingOn.none,
    '' => SupplierNotificationWaitingOn.none,
    _ => SupplierNotificationWaitingOn.unknown,
  };
}

SupplierNotificationActionType _parseActionType(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'REVIEW_RESERVATION' ||
    'REVIEW_REQUEST' => SupplierNotificationActionType.reviewReservation,
    'OPEN_RESERVATION' => SupplierNotificationActionType.openReservation,
    'CHOOSE_PICKUP_WINDOW' => SupplierNotificationActionType.choosePickupWindow,
    'CONTINUE_LISTING' => SupplierNotificationActionType.continueListing,
    'EDIT_LISTING' ||
    'EDIT_PRICE' => SupplierNotificationActionType.editListing,
    'OPEN_MATERIAL' => SupplierNotificationActionType.openMaterial,
    'OPEN_PROFILE' => SupplierNotificationActionType.openProfile,
    'NONE' => SupplierNotificationActionType.none,
    _ => SupplierNotificationActionType.unknown,
  };
}

SupplierNotificationDestination? _parseDestination(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'SUPPLIER_RESERVATIONS' =>
      SupplierNotificationDestination.supplierReservations,
    'SUPPLIER_RESERVATION_DETAIL' =>
      SupplierNotificationDestination.supplierReservationDetail,
    'SUPPLIER_ADD_MATERIAL_CATEGORY_REQUEST' =>
      SupplierNotificationDestination.supplierAddMaterialCategoryRequest,
    'SUPPLIER_ADD_MATERIAL_PRICE_REQUEST' =>
      SupplierNotificationDestination.supplierAddMaterialPriceRequest,
    'SUPPLIER_MATERIAL_DETAIL' =>
      SupplierNotificationDestination.supplierMaterialDetail,
    'SUPPLIER_PROFILE' => SupplierNotificationDestination.supplierProfile,
    '' => null,
    _ => SupplierNotificationDestination.unknown,
  };
}

class SupplierNotificationTarget {
  const SupplierNotificationTarget({
    this.entityType,
    this.entityId,
    this.title,
    this.status,
    this.parameters = const <String, dynamic>{},
  });

  final String? entityType;
  final String? entityId;
  final String? title;
  final String? status;
  final Map<String, dynamic> parameters;

  bool get hasEntityId => entityId != null && entityId!.trim().isNotEmpty;

  factory SupplierNotificationTarget.fromJson(Object? value) {
    if (value is! Map) return const SupplierNotificationTarget();
    final rawParameters = value['parameters'];
    return SupplierNotificationTarget(
      entityType: value['entityType'] as String?,
      entityId: value['entityId'] as String?,
      title: value['title'] as String?,
      status: value['status'] as String?,
      parameters: rawParameters is Map
          ? Map<String, dynamic>.unmodifiable(
              Map<String, dynamic>.from(rawParameters),
            )
          : const <String, dynamic>{},
    );
  }
}

class SupplierNotificationAction {
  const SupplierNotificationAction({
    required this.type,
    required this.destination,
    this.enabled = true,
    this.labelKey,
    this.target,
    this.parameters = const <String, dynamic>{},
    this.rawType = '',
    this.rawDestination,
  });

  const SupplierNotificationAction.unknown()
    : type = SupplierNotificationActionType.unknown,
      destination = null,
      enabled = false,
      labelKey = null,
      target = null,
      parameters = const <String, dynamic>{},
      rawType = 'UNKNOWN',
      rawDestination = null;

  final SupplierNotificationActionType type;
  final SupplierNotificationDestination? destination;
  final bool enabled;
  final String? labelKey;
  final SupplierNotificationTarget? target;
  final Map<String, dynamic> parameters;
  final String rawType;
  final String? rawDestination;

  bool get isKnownAction =>
      type != SupplierNotificationActionType.unknown &&
      type != SupplierNotificationActionType.none;

  bool get hasEnabledAction => enabled && isKnownAction;

  bool get canNavigate =>
      hasEnabledAction &&
      destination != null &&
      destination != SupplierNotificationDestination.unknown &&
      SupplierNotificationDestinationMapper.hasRequiredParameters(
        destination!,
        target,
      );

  factory SupplierNotificationAction.fromJson(
    Object? value, {
    String? legacyActionType,
    String? legacyDestination,
    SupplierNotificationTarget? legacyTarget,
  }) {
    final map = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};
    final rawType = _string(map['type']).isNotEmpty
        ? _string(map['type'])
        : _string(legacyActionType);
    final rawDestination = _string(map['destination']).isNotEmpty
        ? _string(map['destination'])
        : _string(legacyDestination);
    final type = _parseActionType(rawType);
    final target = map['target'] == null
        ? legacyTarget
        : SupplierNotificationTarget.fromJson(map['target']);
    final rawParameters = map['parameters'];

    return SupplierNotificationAction(
      type: type,
      destination: _parseDestination(rawDestination),
      enabled: map['enabled'] is bool
          ? map['enabled'] as bool
          : type != SupplierNotificationActionType.unknown &&
                type != SupplierNotificationActionType.none,
      labelKey: map['labelKey'] as String?,
      target: target,
      parameters: rawParameters is Map
          ? Map<String, dynamic>.unmodifiable(
              Map<String, dynamic>.from(rawParameters),
            )
          : const <String, dynamic>{},
      rawType: rawType,
      rawDestination: rawDestination.isEmpty ? null : rawDestination,
    );
  }
}

class SupplierNotificationDestinationMapper {
  static const _idPattern = r'^[A-Za-z0-9_-]+$';

  static bool isKnownDestination(String? value) =>
      _parseDestination(value) != null &&
      _parseDestination(value) != SupplierNotificationDestination.unknown;

  static bool hasRequiredParameters(
    SupplierNotificationDestination destination,
    SupplierNotificationTarget? target,
  ) {
    switch (destination) {
      case SupplierNotificationDestination.supplierReservations:
      case SupplierNotificationDestination.supplierProfile:
        return true;
      case SupplierNotificationDestination.supplierReservationDetail:
        return target?.entityType == 'RESERVATION' &&
            _validId(target?.entityId);
      case SupplierNotificationDestination.supplierAddMaterialCategoryRequest:
        return target?.entityType == 'CATEGORY_REQUEST' &&
            _validId(target?.entityId);
      case SupplierNotificationDestination.supplierAddMaterialPriceRequest:
        return target?.entityType == 'PRICE_RULE_REQUEST' &&
            _validId(target?.entityId);
      case SupplierNotificationDestination.supplierMaterialDetail:
        return target?.entityType == 'MATERIAL' && _validId(target?.entityId);
      case SupplierNotificationDestination.unknown:
        return false;
    }
  }

  static String? routeFor(SupplierNotificationAction action) {
    if (!action.canNavigate) return null;
    final destination = action.destination!;
    final target = action.target;

    switch (destination) {
      case SupplierNotificationDestination.supplierReservations:
        return '/supplier/reservations';
      case SupplierNotificationDestination.supplierReservationDetail:
        return _detailRoute('/supplier/reservations', target, 'RESERVATION');
      case SupplierNotificationDestination.supplierAddMaterialCategoryRequest:
        return _queryRoute(
          '/supplier/materials/new',
          'categoryRequestId',
          target,
          'CATEGORY_REQUEST',
        );
      case SupplierNotificationDestination.supplierAddMaterialPriceRequest:
        return _queryRoute(
          '/supplier/materials/new',
          'priceRuleRequestId',
          target,
          'PRICE_RULE_REQUEST',
        );
      case SupplierNotificationDestination.supplierMaterialDetail:
        return _detailRoute('/supplier/materials', target, 'MATERIAL');
      case SupplierNotificationDestination.supplierProfile:
        return '/supplier/profile';
      case SupplierNotificationDestination.unknown:
        return null;
    }
  }

  static String? _detailRoute(
    String base,
    SupplierNotificationTarget? target,
    String expectedType, {
    bool allowMissingTarget = false,
  }) {
    if (allowMissingTarget && target == null) {
      return base;
    }
    if (target?.entityType != expectedType || !_validId(target?.entityId)) {
      return null;
    }
    return '$base/${Uri.encodeComponent(target!.entityId!)}';
  }

  static String? _queryRoute(
    String base,
    String parameter,
    SupplierNotificationTarget? target,
    String expectedType,
  ) {
    if (target?.entityType != expectedType || !_validId(target?.entityId)) {
      return null;
    }
    return '$base?$parameter=${Uri.encodeQueryComponent(target!.entityId!)}';
  }

  static bool _validId(String? value) =>
      value != null && RegExp(_idPattern).hasMatch(value.trim());
}

class SupplierNotificationsPagination {
  const SupplierNotificationsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory SupplierNotificationsPagination.fromJson(Object? value) {
    final map = value is Map ? value : const <String, dynamic>{};
    return SupplierNotificationsPagination(
      page: map['page'] as int? ?? 1,
      limit: map['limit'] as int? ?? 20,
      total: map['total'] as int? ?? 0,
      totalPages: map['totalPages'] as int? ?? 0,
    );
  }
}

class SupplierNotificationsSummary {
  const SupplierNotificationsSummary({
    required this.totalCount,
    required this.actionNeededCount,
    required this.reviewCount,
    required this.reservationCount,
    required this.completedCount,
    this.total,
    this.unread,
    this.needsAction,
    this.waiting,
    this.updates,
    this.resolved,
    this.unknownState,
    this.reservations,
    this.materials,
    this.deliveryRecovery,
    this.account,
    this.system,
    this.unknownCategory,
  });

  final int totalCount;
  final int actionNeededCount;
  final int reviewCount;
  final int reservationCount;
  final int completedCount;
  final int? total;
  final int? unread;
  final int? needsAction;
  final int? waiting;
  final int? updates;
  final int? resolved;
  final int? unknownState;
  final int? reservations;
  final int? materials;
  final int? deliveryRecovery;
  final int? account;
  final int? system;
  final int? unknownCategory;

  int get canonicalTotal => total ?? totalCount;
  int get canonicalUnread => unread ?? 0;
  int get canonicalNeedsAction => needsAction ?? actionNeededCount;
  int get canonicalWaiting => waiting ?? 0;
  int get canonicalUpdates => updates ?? 0;
  int get canonicalResolved => resolved ?? completedCount;
  int get canonicalUnknownState => unknownState ?? 0;
  int get canonicalReservations => reservations ?? reservationCount;
  int get canonicalMaterials => materials ?? reviewCount;
  int get canonicalDeliveryRecovery => deliveryRecovery ?? 0;
  int get canonicalAccount => account ?? 0;
  int get canonicalSystem => system ?? 0;
  int get canonicalUnknownCategory => unknownCategory ?? 0;

  factory SupplierNotificationsSummary.fromJson(Map<String, dynamic> json) {
    int? read(String key) => json[key] as int?;
    return SupplierNotificationsSummary(
      totalCount: read('totalCount') ?? read('total') ?? 0,
      actionNeededCount: read('actionNeededCount') ?? read('needsAction') ?? 0,
      reviewCount: read('reviewCount') ?? read('materials') ?? 0,
      reservationCount: read('reservationCount') ?? read('reservations') ?? 0,
      completedCount: read('completedCount') ?? read('resolved') ?? 0,
      total: read('total'),
      unread: read('unread'),
      needsAction: read('needsAction'),
      waiting: read('waiting'),
      updates: read('updates'),
      resolved: read('resolved'),
      unknownState: read('unknownState'),
      reservations: read('reservations'),
      materials: read('materials'),
      deliveryRecovery: read('deliveryRecovery'),
      account: read('account'),
      system: read('system'),
      unknownCategory: read('unknownCategory'),
    );
  }
}

class SupplierNotificationsResult {
  const SupplierNotificationsResult({
    List<SupplierActionNotification>? items,
    List<SupplierActionNotification>? notifications,
    required this.summary,
    this.pagination,
  }) : items = items ?? notifications ?? const <SupplierActionNotification>[];

  final List<SupplierActionNotification> items;
  final SupplierNotificationsSummary summary;
  final SupplierNotificationsPagination? pagination;

  // Compatibility getter; it is the same canonical list, never a second feed.
  List<SupplierActionNotification> get notifications => items;

  factory SupplierNotificationsResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final rawNotifications = json['notifications'];
    final rawList = rawItems is List ? rawItems : rawNotifications;
    final parsedItems = rawList is List
        ? rawList
              .whereType<Map>()
              .map(
                (item) => SupplierActionNotification.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <SupplierActionNotification>[];
    final rawSummary = json['summary'];
    final summary = rawSummary is Map
        ? SupplierNotificationsSummary.fromJson(
            Map<String, dynamic>.from(rawSummary),
          )
        : const SupplierNotificationsSummary(
            totalCount: 0,
            actionNeededCount: 0,
            reviewCount: 0,
            reservationCount: 0,
            completedCount: 0,
          );

    return SupplierNotificationsResult(
      items: parsedItems,
      summary: summary,
      pagination: json['pagination'] == null
          ? null
          : SupplierNotificationsPagination.fromJson(json['pagination']),
    );
  }
}

class SupplierNotificationsQuery {
  const SupplierNotificationsQuery({
    this.page = 1,
    this.limit = 20,
    this.state,
    this.category,
    this.isRead,
    this.search,
    this.dateFrom,
    this.dateTo,
    this.entityType,
  });

  final int page;
  final int limit;
  final SupplierNotificationState? state;
  final SupplierNotificationCategory? category;
  final bool? isRead;
  final String? search;
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final String? entityType;

  static const _unset = Object();

  SupplierNotificationsQuery copyWith({
    int? page,
    int? limit,
    Object? state = _unset,
    Object? category = _unset,
    Object? isRead = _unset,
    Object? search = _unset,
    Object? dateFrom = _unset,
    Object? dateTo = _unset,
    Object? entityType = _unset,
  }) {
    return SupplierNotificationsQuery(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      state: identical(state, _unset)
          ? this.state
          : state as SupplierNotificationState?,
      category: identical(category, _unset)
          ? this.category
          : category as SupplierNotificationCategory?,
      isRead: identical(isRead, _unset) ? this.isRead : isRead as bool?,
      search: identical(search, _unset) ? this.search : search as String?,
      dateFrom: identical(dateFrom, _unset)
          ? this.dateFrom
          : dateFrom as DateTime?,
      dateTo: identical(dateTo, _unset) ? this.dateTo : dateTo as DateTime?,
      entityType: identical(entityType, _unset)
          ? this.entityType
          : entityType as String?,
    );
  }

  SupplierNotificationsQuery resetPage() => copyWith(page: 1);

  SupplierNotificationsQuery forFilter(SupplierNotificationFilter filter) {
    return switch (filter) {
      SupplierNotificationFilter.all => resetPage().copyWith(
        state: null,
        category: null,
      ),
      SupplierNotificationFilter.actionNeeded => resetPage().copyWith(
        state: SupplierNotificationState.needsAction,
        category: null,
      ),
      SupplierNotificationFilter.reservations => resetPage().copyWith(
        state: null,
        category: SupplierNotificationCategory.reservation,
      ),
      SupplierNotificationFilter.completed => resetPage().copyWith(
        state: SupplierNotificationState.resolved,
        category: null,
      ),
    };
  }

  bool get hasValidDateRange =>
      dateFrom == null || dateTo == null || !dateFrom!.isAfter(dateTo!);

  Map<String, dynamic> toQueryParameters() {
    final result = <String, dynamic>{'page': page, 'limit': limit};
    void add(String key, Object? value) {
      if (value == null) return;
      final stringValue = value is String ? value.trim() : value.toString();
      if (stringValue.isNotEmpty) result[key] = stringValue;
    }

    add('state', switch (state) {
      SupplierNotificationState.needsAction => 'NEEDS_ACTION',
      SupplierNotificationState.waiting => 'WAITING',
      SupplierNotificationState.update => 'UPDATE',
      SupplierNotificationState.resolved => 'RESOLVED',
      SupplierNotificationState.unknown || null => null,
    });
    add('category', switch (category) {
      SupplierNotificationCategory.reservation => 'RESERVATION',
      SupplierNotificationCategory.materialReview => 'MATERIAL_REVIEW',
      SupplierNotificationCategory.deliveryRecovery => 'DELIVERY_RECOVERY',
      SupplierNotificationCategory.account => 'ACCOUNT',
      SupplierNotificationCategory.system => 'SYSTEM',
      SupplierNotificationCategory.unknown || null => null,
    });
    if (isRead != null) result['isRead'] = isRead;
    add('search', search);
    add('dateFrom', dateFrom?.toUtc().toIso8601String());
    add('dateTo', dateTo?.toUtc().toIso8601String());
    add('entityType', entityType);
    return result;
  }

  @override
  bool operator ==(Object other) =>
      other is SupplierNotificationsQuery &&
      page == other.page &&
      limit == other.limit &&
      state == other.state &&
      category == other.category &&
      isRead == other.isRead &&
      search == other.search &&
      dateFrom == other.dateFrom &&
      dateTo == other.dateTo &&
      entityType == other.entityType;

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    state,
    category,
    isRead,
    search,
    dateFrom,
    dateTo,
    entityType,
  );
}

class SupplierActionNotification {
  const SupplierActionNotification({
    required this.id,
    required this.group,
    required this.kind,
    required this.title,
    required this.body,
    required this.status,
    required this.createdAt,
    required this.actionNeeded,
    required this.isCompleted,
    this.actionLabel,
    this.actionType,
    this.categoryRequestId,
    this.priceRuleRequestId,
    this.reservationId,
    this.publishedMaterialId,
    this.approvedCategoryId,
    this.approvedCategoryName,
    this.maxAllowedUnitPriceNis,
    this.unit,
    this.supplierRequestedUnitPriceNis,
    this.rawType = '',
    this.category = SupplierNotificationCategory.unknown,
    this.state = SupplierNotificationState.unknown,
    this.waitingOn = SupplierNotificationWaitingOn.none,
    this.isRead = true,
    this.readAt,
    this.resolvedAt,
    this.iconKey = 'UNKNOWN',
    this.entity,
    this.action = const SupplierNotificationAction.unknown(),
    this.metadata = const <String, dynamic>{},
    this.priority,
  });

  final String id;
  final SupplierActionNotificationGroup group;
  final SupplierActionNotificationKind kind;
  final String title;
  final String body;
  final SupplierActionNotificationStatus status;
  final DateTime createdAt;
  final bool actionNeeded;
  final bool isCompleted;
  final String? actionLabel;
  final SupplierActionNotificationActionType? actionType;
  final String? categoryRequestId;
  final String? priceRuleRequestId;
  final String? reservationId;
  final String? publishedMaterialId;
  final String? approvedCategoryId;
  final String? approvedCategoryName;
  final double? maxAllowedUnitPriceNis;
  final String? unit;
  final double? supplierRequestedUnitPriceNis;

  final String rawType;
  final SupplierNotificationCategory category;
  final SupplierNotificationState state;
  final SupplierNotificationWaitingOn waitingOn;
  final bool isRead;
  final DateTime? readAt;
  final DateTime? resolvedAt;
  final String iconKey;
  final SupplierNotificationTarget? entity;
  final SupplierNotificationAction action;
  final Map<String, dynamic> metadata;
  final String? priority;

  bool get isUnknown =>
      category == SupplierNotificationCategory.unknown ||
      state == SupplierNotificationState.unknown ||
      action.type == SupplierNotificationActionType.unknown;

  String? get destinationRoute =>
      SupplierNotificationDestinationMapper.routeFor(action);

  factory SupplierActionNotification.fromJson(Map<String, dynamic> json) {
    final rawType = _string(json['rawType']).isNotEmpty
        ? _string(json['rawType'])
        : _string(json['notificationType']).isNotEmpty
        ? _string(json['notificationType'])
        : _string(json['kind']);
    final categoryValue = _string(json['category']);
    final category = categoryValue.isNotEmpty
        ? _parseCategory(categoryValue)
        : rawType.toUpperCase().startsWith('PRICE_')
        ? SupplierNotificationCategory.materialReview
        : rawType.toUpperCase().startsWith('CATEGORY_')
        ? SupplierNotificationCategory.materialReview
        : rawType.toUpperCase().startsWith('RESERVATION_')
        ? SupplierNotificationCategory.reservation
        : SupplierNotificationCategory.unknown;
    final state = _parseState(json['state']);
    final entityJson = json['entity'];
    final entity = entityJson is Map
        ? SupplierNotificationTarget.fromJson(entityJson)
        : null;
    final legacyTarget = entity ?? _legacyTargetFromJson(json);
    final actionMap = json['action'];
    final action = SupplierNotificationAction.fromJson(
      actionMap,
      legacyActionType: json['actionType'] as String?,
      legacyTarget: legacyTarget,
    );
    final target = action.target ?? entity;
    final targetId = target?.entityId;

    return SupplierActionNotification(
      id: _string(json['id']),
      group:
          category == SupplierNotificationCategory.reservation ||
              category == SupplierNotificationCategory.deliveryRecovery
          ? SupplierActionNotificationGroup.reservationAlert
          : SupplierActionNotificationGroup.reviewUpdate,
      kind: categoryValue.isEmpty
          ? _legacyKindForOld(json['kind'] as String?)
          : _legacyKind(rawType, category),
      title: _string(json['title']).trim().isEmpty
          ? 'Notification'
          : _string(json['title']),
      body: _string(json['message']).isNotEmpty
          ? _string(json['message'])
          : _string(json['body']),
      status: state == SupplierNotificationState.unknown
          ? _parseLegacyStatus(json['status'])
          : _legacyStatus(state),
      createdAt: _date(json['createdAt']),
      actionNeeded: state == SupplierNotificationState.unknown
          ? json['actionNeeded'] == true
          : state == SupplierNotificationState.needsAction,
      isCompleted: state == SupplierNotificationState.unknown
          ? json['isCompleted'] == true
          : state == SupplierNotificationState.resolved,
      actionLabel: json['actionLabel'] as String?,
      actionType: _legacyActionType(action.type),
      categoryRequestId: target?.entityType == 'CATEGORY_REQUEST'
          ? targetId
          : json['categoryRequestId'] as String?,
      priceRuleRequestId: target?.entityType == 'PRICE_RULE_REQUEST'
          ? targetId
          : json['priceRuleRequestId'] as String?,
      reservationId: target?.entityType == 'RESERVATION'
          ? targetId
          : json['reservationId'] as String?,
      publishedMaterialId: target?.entityType == 'MATERIAL'
          ? targetId
          : json['publishedMaterialId'] as String?,
      approvedCategoryId: json['approvedCategoryId'] as String?,
      approvedCategoryName: json['approvedCategoryName'] as String?,
      maxAllowedUnitPriceNis: (json['maxAllowedUnitPriceNis'] as num?)
          ?.toDouble(),
      unit: json['unit'] as String?,
      supplierRequestedUnitPriceNis:
          (json['supplierRequestedUnitPriceNis'] as num?)?.toDouble(),
      rawType: rawType,
      category: category,
      state: state,
      waitingOn: _parseWaitingOn(json['waitingOn']),
      isRead: json['isRead'] == true,
      readAt: json['readAt'] is String
          ? DateTime.tryParse(json['readAt'] as String)
          : null,
      resolvedAt: json['resolvedAt'] is String
          ? DateTime.tryParse(json['resolvedAt'] as String)
          : null,
      iconKey: _string(json['iconKey']).isEmpty
          ? category.name.toUpperCase()
          : _string(json['iconKey']),
      entity: target,
      action: action,
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.unmodifiable(
              Map<String, dynamic>.from(json['metadata'] as Map),
            )
          : const <String, dynamic>{},
      priority: json['priority'] as String?,
    );
  }
}

SupplierNotificationTarget? _legacyTargetFromJson(Map<String, dynamic> json) {
  final relatedType = json['relatedEntityType'] as String?;
  final relatedId = json['relatedEntityId'] as String?;
  if (relatedType != null && relatedId != null) {
    return SupplierNotificationTarget(
      entityType: relatedType,
      entityId: relatedId,
    );
  }
  final actionType = _string(json['actionType']).toUpperCase();
  if (actionType == 'EDIT_PRICE' || json['priceRuleRequestId'] is String) {
    return SupplierNotificationTarget(
      entityType: 'PRICE_RULE_REQUEST',
      entityId: json['priceRuleRequestId'] as String?,
    );
  }
  if (json['categoryRequestId'] is String) {
    return SupplierNotificationTarget(
      entityType: 'CATEGORY_REQUEST',
      entityId: json['categoryRequestId'] as String?,
    );
  }
  if (json['reservationId'] is String) {
    return SupplierNotificationTarget(
      entityType: 'RESERVATION',
      entityId: json['reservationId'] as String?,
    );
  }
  return null;
}

SupplierActionNotificationStatus _parseLegacyStatus(Object? value) {
  return switch (_string(value).toUpperCase()) {
    'APPROVED' => SupplierActionNotificationStatus.approved,
    'REJECTED' => SupplierActionNotificationStatus.rejected,
    _ => SupplierActionNotificationStatus.pending,
  };
}

SupplierActionNotificationKind _legacyKind(
  String rawType,
  SupplierNotificationCategory category,
) {
  return switch (rawType.toUpperCase()) {
    'PRICE_REQUEST_UPDATE' => SupplierActionNotificationKind.pricePending,
    'CATEGORY_REQUEST_UPDATE' => SupplierActionNotificationKind.categoryPending,
    'RESERVATION_REQUESTED' ||
    'RESERVATION_CANCELLED' ||
    'RESERVATION_EXPIRED' => SupplierActionNotificationKind.reservationPending,
    _ =>
      category == SupplierNotificationCategory.unknown
          ? SupplierActionNotificationKind.categoryCompleted
          : SupplierActionNotificationKind.categoryPending,
  };
}

SupplierActionNotificationStatus _legacyStatus(
  SupplierNotificationState state,
) {
  return switch (state) {
    SupplierNotificationState.resolved || SupplierNotificationState.update =>
      SupplierActionNotificationStatus.approved,
    SupplierNotificationState.unknown =>
      SupplierActionNotificationStatus.pending,
    _ => SupplierActionNotificationStatus.pending,
  };
}

SupplierActionNotificationActionType? _legacyActionType(
  SupplierNotificationActionType type,
) {
  return switch (type) {
    SupplierNotificationActionType.continueListing =>
      SupplierActionNotificationActionType.continueListing,
    SupplierNotificationActionType.editListing =>
      SupplierActionNotificationActionType.editListing,
    SupplierNotificationActionType.reviewReservation ||
    SupplierNotificationActionType.openReservation ||
    SupplierNotificationActionType.choosePickupWindow =>
      SupplierActionNotificationActionType.reviewRequest,
    _ => null,
  };
}

SupplierActionNotificationKind _legacyKindForOld(String? value) {
  return switch (value) {
    'CATEGORY_SUGGESTION' => SupplierActionNotificationKind.categorySuggestion,
    'CATEGORY_REJECTED' => SupplierActionNotificationKind.categoryRejected,
    'CATEGORY_PENDING' => SupplierActionNotificationKind.categoryPending,
    'CATEGORY_COMPLETED' => SupplierActionNotificationKind.categoryCompleted,
    'PRICE_APPROVED' => SupplierActionNotificationKind.priceApproved,
    'PRICE_REJECTED' => SupplierActionNotificationKind.priceRejected,
    'PRICE_PENDING' => SupplierActionNotificationKind.pricePending,
    'PRICE_COMPLETED' => SupplierActionNotificationKind.priceCompleted,
    'RESERVATION_PENDING' => SupplierActionNotificationKind.reservationPending,
    _ => SupplierActionNotificationKind.categoryCompleted,
  };
}

bool matchesSupplierNotificationFilter(
  SupplierActionNotification notification,
  SupplierNotificationFilter filter,
) {
  switch (filter) {
    case SupplierNotificationFilter.all:
      return true;
    case SupplierNotificationFilter.actionNeeded:
      return notification.state == SupplierNotificationState.unknown
          ? notification.actionNeeded
          : notification.state == SupplierNotificationState.needsAction;
    case SupplierNotificationFilter.reservations:
      return notification.category == SupplierNotificationCategory.unknown
          ? notification.group ==
                SupplierActionNotificationGroup.reservationAlert
          : notification.category == SupplierNotificationCategory.reservation;
    case SupplierNotificationFilter.completed:
      return notification.state == SupplierNotificationState.unknown
          ? notification.isCompleted
          : notification.state == SupplierNotificationState.resolved;
  }
}
