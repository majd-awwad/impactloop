enum BecomeSupplierStep {
  supplierType,
  profile,
  location,
  pickupDetails,
  verification,
  review,
}

extension BecomeSupplierStepLabels on BecomeSupplierStep {
  String get title => switch (this) {
    BecomeSupplierStep.supplierType => 'Supplier type',
    BecomeSupplierStep.profile => 'Supplier profile',
    BecomeSupplierStep.location => 'Pickup area',
    BecomeSupplierStep.pickupDetails => 'Pickup details',
    BecomeSupplierStep.verification => 'Verification',
    BecomeSupplierStep.review => 'Review',
  };

  String get subtitle => switch (this) {
    BecomeSupplierStep.supplierType =>
      'Choose how you will share materials as a supplier.',
    BecomeSupplierStep.profile =>
      'Tell others who you are and what you usually share.',
    BecomeSupplierStep.location =>
      'Set the city and area where pickup usually happens.',
    BecomeSupplierStep.pickupDetails =>
      'Add optional pickup hours and notes for learners.',
    BecomeSupplierStep.verification =>
      'Upload proof of your organization for admin review.',
    BecomeSupplierStep.review =>
      'Review your supplier details, then open the Supplier Portal.',
  };
}

const becomeSupplierSteps = [
  BecomeSupplierStep.supplierType,
  BecomeSupplierStep.profile,
  BecomeSupplierStep.location,
  BecomeSupplierStep.pickupDetails,
  BecomeSupplierStep.verification,
  BecomeSupplierStep.review,
];
