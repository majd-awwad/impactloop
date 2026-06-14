import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.validator,
    this.autofillHints,
    this.onFieldSubmitted,
    this.minLines,
    this.maxLines,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onFieldSubmitted;
  final int? minLines;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
      ),
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      obscureText: obscureText,
      validator: validator,
      autofillHints: autofillHints,
      onFieldSubmitted: onFieldSubmitted,
      minLines: minLines,
      maxLines: maxLines ?? (minLines != null ? null : 1),
    );
  }
}

class AppFieldGap extends StatelessWidget {
  const AppFieldGap({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: AppSpacing.md);
  }
}
