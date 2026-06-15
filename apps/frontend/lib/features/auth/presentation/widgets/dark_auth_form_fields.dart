import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

class DarkAuthDropdownField<T> extends StatelessWidget {
  const DarkAuthDropdownField({
    super.key,
    required this.label,
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
    this.validator,
  });

  final String label;
  final String hint;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final String? Function(T?)? validator;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      items: items,
      onChanged: onChanged,
      validator: validator,
      dropdownColor: AuthDarkColors.surfaceSolid,
      style: const TextStyle(color: AuthDarkColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: const TextStyle(color: AuthDarkColors.textSecondary),
        hintStyle: const TextStyle(color: AuthDarkColors.textMuted),
        floatingLabelBehavior: FloatingLabelBehavior.always,
        filled: true,
        fillColor: AuthDarkColors.surfaceSolid,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: const BorderSide(color: AuthDarkColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: const BorderSide(color: AuthDarkColors.borderFocused),
        ),
      ),
      iconEnabledColor: AuthDarkColors.textSecondary,
    );
  }
}

class DarkAuthTextArea extends StatelessWidget {
  const DarkAuthTextArea({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    this.validator,
    this.minLines = 3,
    this.maxLines = 5,
    this.textInputAction = TextInputAction.newline,
    this.onFieldSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? Function(String?)? validator;
  final int minLines;
  final int maxLines;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.multiline,
      textInputAction: textInputAction,
      minLines: minLines,
      maxLines: maxLines,
      validator: validator,
      onFieldSubmitted: onFieldSubmitted,
      style: const TextStyle(color: AuthDarkColors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        alignLabelWithHint: true,
        labelStyle: const TextStyle(color: AuthDarkColors.textSecondary),
        hintStyle: const TextStyle(color: AuthDarkColors.textMuted),
        floatingLabelBehavior: FloatingLabelBehavior.always,
        filled: true,
        fillColor: AuthDarkColors.surfaceSolid,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: const BorderSide(color: AuthDarkColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: const BorderSide(color: AuthDarkColors.borderFocused),
        ),
      ),
    );
  }
}

class DarkAuthSectionTitle extends StatelessWidget {
  const DarkAuthSectionTitle({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(title, style: AuthDarkTextStyles.sectionTitle(context)),
    );
  }
}
