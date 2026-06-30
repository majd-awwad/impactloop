class AdminMaterialModerationPolicy {
  const AdminMaterialModerationPolicy._();

  static bool canHide(String status) => status == 'AVAILABLE';

  static bool canMarkUnavailable(String status) => status == 'AVAILABLE';

  static bool canRestore(String status) => status == 'UNAVAILABLE';

  static bool isModerationLocked(String status) =>
      status == 'PENDING_RESERVATION' ||
      status == 'RESERVED' ||
      status == 'REUSED';

  static String? listLockNote(String status) {
    if (!isModerationLocked(status)) return null;
    return 'Moderation locked due to reservation/reuse status.';
  }

  static String? detailLockMessage(String status) {
    if (status == 'REUSED') {
      return 'This material has completed its reuse lifecycle and cannot be restored or made unavailable.';
    }
    if (status == 'PENDING_RESERVATION' || status == 'RESERVED') {
      return 'Moderation actions are locked while this material is involved in an active reservation.';
    }
    return null;
  }

  static AdminMaterialModerationActions actionsFor(String status) {
    return AdminMaterialModerationActions(
      canHide: canHide(status),
      canMarkUnavailable: canMarkUnavailable(status),
      canRestore: canRestore(status),
      isModerationLocked: isModerationLocked(status),
      listLockNote: listLockNote(status),
      detailLockMessage: detailLockMessage(status),
    );
  }

  static AdminMaterialModerationActions actionsFromJson(
    Map<String, dynamic>? json,
    String fallbackStatus,
  ) {
    if (json == null) return actionsFor(fallbackStatus);
    return AdminMaterialModerationActions(
      canHide: json['canHide'] as bool? ?? canHide(fallbackStatus),
      canMarkUnavailable:
          json['canMarkUnavailable'] as bool? ?? canMarkUnavailable(fallbackStatus),
      canRestore: json['canRestore'] as bool? ?? canRestore(fallbackStatus),
      isModerationLocked:
          json['isModerationLocked'] as bool? ?? isModerationLocked(fallbackStatus),
      listLockNote: json['listLockNote'] as String? ?? listLockNote(fallbackStatus),
      detailLockMessage:
          json['lockReason'] as String? ?? detailLockMessage(fallbackStatus),
    );
  }
}

class AdminMaterialModerationActions {
  const AdminMaterialModerationActions({
    required this.canHide,
    required this.canMarkUnavailable,
    required this.canRestore,
    required this.isModerationLocked,
    this.listLockNote,
    this.detailLockMessage,
  });

  final bool canHide;
  final bool canMarkUnavailable;
  final bool canRestore;
  final bool isModerationLocked;
  final String? listLockNote;
  final String? detailLockMessage;
}
