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
      id: json['id'] as String,
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
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
    this.sendError,
    required this.createdAt,
    this.createdBy,
  });

  final String id;
  final String recipientEmail;
  final String role;
  final String status;
  final DateTime expiresAt;
  final DateTime? sentAt;
  final DateTime? usedAt;
  final String? sendError;
  final DateTime createdAt;
  final AdminInvitationCreator? createdBy;

  factory AdminInvitationItem.fromJson(Map<String, dynamic> json) {
    return AdminInvitationItem(
      id: json['id'] as String,
      recipientEmail: json['recipientEmail'] as String? ?? '',
      role: json['role'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      sentAt: json['sentAt'] == null
          ? null
          : DateTime.parse(json['sentAt'] as String),
      usedAt: json['usedAt'] == null
          ? null
          : DateTime.parse(json['usedAt'] as String),
      sendError: json['sendError'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      createdBy: json['createdBy'] is Map<String, dynamic>
          ? AdminInvitationCreator.fromJson(
              json['createdBy'] as Map<String, dynamic>,
            )
          : null,
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
    super.sendError,
    required super.createdAt,
    super.createdBy,
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
      sendError: base.sendError,
      createdAt: base.createdAt,
      createdBy: base.createdBy,
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
