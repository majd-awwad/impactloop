class AdminInvitationCreator {
  const AdminInvitationCreator({
    required this.id,
    required this.displayName,
    required this.email,
  });

  final String id;
  final String displayName;
  final String email;

  factory AdminInvitationCreator.fromJson(Map<String, dynamic> json) {
    return AdminInvitationCreator(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
  }

  String get label {
    if (displayName.isEmpty) return email;
    if (email.isEmpty) return displayName;
    return '$displayName ($email)';
  }
}

class AdminInvitationItem {
  const AdminInvitationItem({
    required this.id,
    required this.recipientEmail,
    required this.role,
    required this.status,
    required this.expiresAt,
    this.sentAt,
    this.usedAt,
    this.acceptedAt,
    this.revokedAt,
    this.sendError,
    required this.createdAt,
    this.createdBy,
    this.canCopyLink = false,
  });

  final String id;
  final String recipientEmail;
  final String role;
  final String status;
  final DateTime expiresAt;
  final DateTime? sentAt;
  final DateTime? usedAt;
  final DateTime? acceptedAt;
  final DateTime? revokedAt;
  final String? sendError;
  final DateTime createdAt;
  final AdminInvitationCreator? createdBy;
  final bool canCopyLink;

  bool get isActivePending => canCopyLink;

  factory AdminInvitationItem.fromJson(Map<String, dynamic> json) {
    return AdminInvitationItem(
      id: json['id'] as String? ?? '',
      recipientEmail: json['recipientEmail'] as String? ?? '',
      role: json['role'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      sentAt: json['sentAt'] == null
          ? null
          : DateTime.tryParse(json['sentAt'] as String),
      usedAt: json['usedAt'] == null
          ? null
          : DateTime.tryParse(json['usedAt'] as String),
      acceptedAt: json['acceptedAt'] == null
          ? null
          : DateTime.tryParse(json['acceptedAt'] as String),
      revokedAt: json['revokedAt'] == null
          ? null
          : DateTime.tryParse(json['revokedAt'] as String),
      sendError: json['sendError'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      createdBy: json['createdBy'] is Map<String, dynamic>
          ? AdminInvitationCreator.fromJson(
              json['createdBy'] as Map<String, dynamic>,
            )
          : null,
      canCopyLink: json['canCopyLink'] as bool? ?? false,
    );
  }
}

class AdminInvitationCreateResult extends AdminInvitationItem {
  const AdminInvitationCreateResult({
    required super.id,
    required super.recipientEmail,
    required super.role,
    required super.status,
    required super.expiresAt,
    super.sentAt,
    super.usedAt,
    super.acceptedAt,
    super.revokedAt,
    super.sendError,
    required super.createdAt,
    super.createdBy,
    super.canCopyLink,
    required this.sendStatus,
    required this.inviteLink,
    required this.emailProvider,
  });

  final String sendStatus;
  final String inviteLink;
  final String emailProvider;

  factory AdminInvitationCreateResult.fromJson(Map<String, dynamic> json) {
    final base = AdminInvitationItem.fromJson(json);
    return AdminInvitationCreateResult(
      id: base.id,
      recipientEmail: base.recipientEmail,
      role: base.role,
      status: base.status,
      expiresAt: base.expiresAt,
      sentAt: base.sentAt,
      usedAt: base.usedAt,
      acceptedAt: base.acceptedAt,
      revokedAt: base.revokedAt,
      sendError: base.sendError,
      createdAt: base.createdAt,
      createdBy: base.createdBy,
      canCopyLink: base.canCopyLink,
      sendStatus: json['sendStatus'] as String? ?? 'PENDING',
      inviteLink: json['inviteLink'] as String? ?? '',
      emailProvider: json['emailProvider'] as String? ?? 'mock',
    );
  }
}

class AdminInvitationCreateRequest {
  const AdminInvitationCreateRequest({
    required this.role,
    required this.recipientEmail,
    required this.expiresInMinutes,
    this.note,
  });

  final String role;
  final String recipientEmail;
  final int expiresInMinutes;
  final String? note;

  Map<String, dynamic> toJson() => {
        'role': role,
        'recipientEmail': recipientEmail,
        'expiresInMinutes': expiresInMinutes,
        if (note != null && note!.trim().isNotEmpty) 'note': note,
      };
}

class AdminInvitationLinkResult {
  const AdminInvitationLinkResult({required this.invitationUrl});

  final String invitationUrl;

  factory AdminInvitationLinkResult.fromJson(Map<String, dynamic> json) {
    return AdminInvitationLinkResult(
      invitationUrl: json['invitationUrl'] as String? ?? '',
    );
  }
}
