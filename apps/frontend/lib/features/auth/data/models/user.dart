class LearnerProfile {
  const LearnerProfile({
    required this.learnerType,
    required this.skillLevel,
    required this.interests,
    this.bio,
  });

  final String learnerType;
  final String skillLevel;
  final List<String> interests;
  final String? bio;

  factory LearnerProfile.fromJson(Map<String, dynamic> json) {
    return LearnerProfile(
      learnerType: json['learnerType'] as String? ?? '',
      skillLevel: json['skillLevel'] as String? ?? '',
      interests: (json['interests'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      bio: json['bio'] as String?,
    );
  }
}

class SupplierProfile {
  const SupplierProfile({
    required this.supplierType,
    required this.publicName,
    this.description,
    this.pickupAreaLabel,
    this.verificationStatus = 'NOT_REQUIRED',
    this.verificationAdminNote,
    this.verificationSubmittedAt,
    this.verificationDocumentName,
  });

  final String supplierType;
  final String publicName;
  final String? description;
  final String? pickupAreaLabel;
  final String verificationStatus;
  final String? verificationAdminNote;
  final DateTime? verificationSubmittedAt;
  final String? verificationDocumentName;

  factory SupplierProfile.fromJson(Map<String, dynamic> json) {
    return SupplierProfile(
      supplierType: json['supplierType'] as String? ?? '',
      publicName: json['publicName'] as String? ?? '',
      description: json['description'] as String?,
      pickupAreaLabel: json['pickupAreaLabel'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'NOT_REQUIRED',
      verificationAdminNote: json['verificationAdminNote'] as String?,
      verificationSubmittedAt: json['verificationSubmittedAt'] == null
          ? null
          : DateTime.tryParse(json['verificationSubmittedAt'] as String),
      verificationDocumentName: json['verificationDocumentName'] as String?,
    );
  }
}

class User {
  const User({
    required this.id,
    required this.displayName,
    required this.email,
    this.phone,
    required this.accountStatus,
    this.profileImageUrl,
    required this.roles,
    this.activeRole = 'LEARNER',
    this.canSwitchToLearner = false,
    this.canSwitchToSupplier = false,
    this.defaultPortalRoute = '/home',
    this.learnerProfile,
    this.supplierProfile,
    this.emailVerifiedAt,
    this.phoneVerifiedAt,
    this.lastLoginAt,
    required this.createdAt,
  });

  final String id;
  final String displayName;
  final String email;
  final String? phone;
  final String accountStatus;
  final String? profileImageUrl;
  final List<String> roles;
  final String activeRole;
  final bool canSwitchToLearner;
  final bool canSwitchToSupplier;
  final String defaultPortalRoute;
  final LearnerProfile? learnerProfile;
  final SupplierProfile? supplierProfile;
  final DateTime? emailVerifiedAt;
  final DateTime? phoneVerifiedAt;
  final DateTime? lastLoginAt;
  final DateTime createdAt;

  bool get isLearnerMode => activeRole.trim().toUpperCase() == 'LEARNER';

  bool get isSupplierMode => activeRole.trim().toUpperCase() == 'SUPPLIER';

  bool hasRole(String role) {
    final normalizedRole = role.trim().toUpperCase();
    return roles.any((item) => item.trim().toUpperCase() == normalizedRole);
  }

  factory User.fromJson(Map<String, dynamic> json) {
    final learnerProfileJson = json['learnerProfile'];
    final supplierProfileJson = json['supplierProfile'];
    final parsedRoles = _parseRoles(json);

    return User(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      accountStatus: json['accountStatus'] as String? ?? 'PENDING_VERIFICATION',
      profileImageUrl: json['profileImageUrl'] as String?,
      roles: parsedRoles,
      activeRole: (json['activeRole'] as String?)?.trim().toUpperCase() ??
          (parsedRoles.isNotEmpty ? parsedRoles.first : 'LEARNER'),
      canSwitchToLearner: json['canSwitchToLearner'] as bool? ?? false,
      canSwitchToSupplier: json['canSwitchToSupplier'] as bool? ?? false,
      defaultPortalRoute:
          json['defaultPortalRoute'] as String? ?? '/home',
      learnerProfile: learnerProfileJson is Map<String, dynamic>
          ? LearnerProfile.fromJson(learnerProfileJson)
          : null,
      supplierProfile: supplierProfileJson is Map<String, dynamic>
          ? SupplierProfile.fromJson(supplierProfileJson)
          : null,
      emailVerifiedAt: DateTime.tryParse(
        json['emailVerifiedAt'] as String? ?? '',
      ),
      phoneVerifiedAt: DateTime.tryParse(
        json['phoneVerifiedAt'] as String? ?? '',
      ),
      lastLoginAt: DateTime.tryParse(json['lastLoginAt'] as String? ?? ''),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  static List<String> _parseRoles(Map<String, dynamic> json) {
    final roles = <String>{};
    final rawRoles = json['roles'];

    if (rawRoles is List<dynamic>) {
      for (final item in rawRoles) {
        if (item is String && item.trim().isNotEmpty) {
          roles.add(item.trim().toUpperCase());
        } else if (item is Map<String, dynamic>) {
          final role = item['role'];
          if (role is String && role.trim().isNotEmpty) {
            roles.add(role.trim().toUpperCase());
          }
        }
      }
    }

    final primaryRole = json['primaryRole'];
    if (primaryRole is String && primaryRole.trim().isNotEmpty) {
      roles.add(primaryRole.trim().toUpperCase());
    }

    return roles.toList();
  }
}
