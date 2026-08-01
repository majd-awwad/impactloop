import 'package:flutter/material.dart';

import 'supplier_dark_form_field.dart';
import '../theme/supplier_theme_extension.dart';

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
    final l = context.s;

    return SupplierDarkDropdownField<String>(
      label: l.supplierType,
      hint: l.chooseSupplierType,
      value: value,
      items: [
        for (final type in supplierTypeValues)
          DropdownMenuItem(value: type, child: Text(l.supplierTypeLabel(type))),
      ],
      onChanged: (value) {
        if (value != null) {
          onChanged(value);
        }
      },
    );
  }
}
