/// Public signup intent. Maps to `user_roles` when API integration is added.
enum RegistrationIntent {
  learner,
  supplier,
  both;

  String get displayTitle => switch (this) {
    RegistrationIntent.learner => 'Find materials & build projects',
    RegistrationIntent.supplier => 'Share surplus materials',
    RegistrationIntent.both => 'Do both',
  };

  String get placeholderLabel => switch (this) {
    RegistrationIntent.learner => 'LEARNER',
    RegistrationIntent.supplier => 'SUPPLIER',
    RegistrationIntent.both => 'BOTH',
  };

  String get continueRoute => switch (this) {
    RegistrationIntent.learner => '/complete-learner-profile',
    RegistrationIntent.supplier => '/complete-supplier-profile',
    RegistrationIntent.both => '/complete-learner-profile?intent=both',
  };
}
