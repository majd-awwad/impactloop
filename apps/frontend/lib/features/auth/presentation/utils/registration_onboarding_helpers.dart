const registrationInterestOptions = [
  'Arduino',
  'Robotics',
  'Electronics',
  '3D printing',
  'Woodworking',
  'Programming',
  'Mechanical design',
  'IoT',
];

const registrationGoalOptions = [
  'Build projects',
  'Find components',
  'Learn new skills',
  'Reduce waste',
  'Share surplus materials',
  'Support learners',
];

const registrationLearnerTypes = [
  'University student',
  'School student',
  'Self learner',
  'Maker / hobbyist',
];

const registrationSkillLevels = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

const registrationPersonalSupplierTypes = [
  'Student supplier',
  'Individual supplier',
];

const registrationSupplierTypes = [
  ...registrationPersonalSupplierTypes,
  'Workshop',
  'Factory',
  'Educational institution',
];

const maxVerificationDocumentBytes = 5 * 1024 * 1024;
const allowedVerificationExtensions = {'pdf', 'png', 'jpg', 'jpeg'};

String formatPickupArea({required String city, required String area}) {
  final trimmedCity = city.trim();
  final trimmedArea = area.trim();

  if (trimmedCity.isEmpty) {
    throw const FormatException('City is required');
  }

  if (trimmedArea.isEmpty) {
    return trimmedCity;
  }

  return '$trimmedCity, $trimmedArea';
}

({String city, String area}) parsePickupArea(String pickupArea) {
  final parts = pickupArea
      .split(',')
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList();

  if (parts.isEmpty) {
    throw const FormatException('Pickup area is required');
  }

  final city = parts.first;
  final area = parts.length > 1 ? parts.sublist(1).join(', ') : city;
  return (city: city, area: area);
}

Map<String, dynamic> verificationLocationPayload(String pickupArea) {
  final parsed = parsePickupArea(pickupArea);
  return {
    'country': 'Palestine',
    'city': parsed.city,
    'area': parsed.area,
    'visibility': 'PRIVATE',
    'isApproximate': true,
  };
}

String mimeTypeForVerificationFile(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

String learnerTypeDescription(String learnerType) {
  return switch (learnerType) {
    'University student' => 'You are learning through a university program.',
    'School student' => 'You are learning through school or a club.',
    'Self learner' => 'You learn independently outside a formal program.',
    'Maker / hobbyist' => 'You build projects for practice or personal use.',
    _ => 'Choose the option that best describes you.',
  };
}

String skillLevelDescription(String skillLevel) {
  return switch (skillLevel) {
    'Beginner' => 'I am new and want simple, guided project ideas.',
    'Intermediate' => 'I can build with guidance and basic troubleshooting.',
    'Advanced' => 'I can design, adapt, and troubleshoot projects myself.',
    'Expert' => 'I can mentor others or handle complex builds.',
    _ => 'Choose how comfortable you are with building projects.',
  };
}

String supplierTypeDescription(String supplierType) {
  return switch (supplierType) {
    'Student supplier' =>
      'For students sharing extra parts or materials. No verification document.',
    'Individual supplier' =>
      'For personal surplus materials. No verification document.',
    'Workshop' => 'For workshops or labs. Verification document required.',
    'Factory' => 'For factories or companies. Verification document required.',
    'Educational institution' =>
      'For schools, universities, or centers. Verification document required.',
    _ => 'Choose who owns the materials you will share.',
  };
}

String? suggestedSupplierTypeForLearnerType(String? learnerType) {
  return switch (learnerType) {
    'University student' || 'School student' => 'Student supplier',
    'Self learner' || 'Maker / hobbyist' => 'Individual supplier',
    _ => null,
  };
}
