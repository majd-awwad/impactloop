class InviteValidationResult {
  const InviteValidationResult({
    required this.valid,
    this.role,
    this.recipientEmail,
    this.expiresAt,
    this.reason,
  });

  final bool valid;
  final String? role;
  final String? recipientEmail;
  final DateTime? expiresAt;
  final String? reason;

  factory InviteValidationResult.fromJson(Map<String, dynamic> json) {
    return InviteValidationResult(
      valid: json['valid'] == true,
      role: json['role'] as String?,
      recipientEmail: json['recipientEmail'] as String?,
      expiresAt: json['expiresAt'] == null
          ? null
          : DateTime.parse(json['expiresAt'] as String),
      reason: json['reason'] as String?,
    );
  }
}

class InviteAcceptResult {
  const InviteAcceptResult({required this.role});

  final String role;

  factory InviteAcceptResult.fromJson(Map<String, dynamic> json) {
    return InviteAcceptResult(role: json['role'] as String? ?? '');
  }
}

class InviteAcceptRequest {
  const InviteAcceptRequest({
    required this.token,
    required this.fullName,
    required this.email,
    required this.password,
    required this.confirmPassword,
    this.phone,
    this.city,
    this.area,
    this.addressLine,
    this.transportationType,
    this.availabilityNote,
  });

  final String token;
  final String fullName;
  final String email;
  final String password;
  final String confirmPassword;
  final String? phone;
  final String? city;
  final String? area;
  final String? addressLine;
  final String? transportationType;
  final String? availabilityNote;

  Map<String, dynamic> toJson() => {
    'token': token,
    'fullName': fullName,
    'email': email,
    'password': password,
    'confirmPassword': confirmPassword,
    if (phone != null && phone!.isNotEmpty) 'phone': phone,
    if (city != null && city!.isNotEmpty) 'city': city,
    if (area != null && area!.isNotEmpty) 'area': area,
    if (addressLine != null && addressLine!.isNotEmpty)
      'addressLine': addressLine,
    if (transportationType != null && transportationType!.isNotEmpty)
      'transportationType': transportationType,
    if (availabilityNote != null && availabilityNote!.isNotEmpty)
      'availabilityNote': availabilityNote,
  };
}
