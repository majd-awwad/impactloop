import 'package:flutter/material.dart';

import 'supplier_dark_form_field.dart';

const supplierTypeValues = [
  'STUDENT_SUPPLIER',
  'INDIVIDUAL_SUPPLIER',
  'WORKSHOP',
  'FACTORY',
  'EDUCATIONAL_INSTITUTION',
];

bool isOrganizationSupplierType(String value) {
  return value == 'WORKSHOP' ||
      value == 'FACTORY' ||
      value == 'EDUCATIONAL_INSTITUTION';
}

String supplierTypeLabel(String value) {
  return switch (value) {
    'STUDENT_SUPPLIER' => 'Student supplier',
    'INDIVIDUAL_SUPPLIER' => 'Individual supplier',
    'WORKSHOP' => 'Workshop',
    'FACTORY' => 'Factory',
    'EDUCATIONAL_INSTITUTION' => 'Educational institution',
    _ => value,
  };
}

class SupplierTypeSelector extends StatelessWidget {
  const SupplierTypeSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SupplierDarkDropdownField<String>(
      label: 'Supplier type',
      hint: 'Choose supplier type',
      value: value,
      items: [
        for (final type in supplierTypeValues)
          DropdownMenuItem(value: type, child: Text(supplierTypeLabel(type))),
      ],
      onChanged: (value) {
        if (value != null) {
          onChanged(value);
        }
      },
    );
  }
}
