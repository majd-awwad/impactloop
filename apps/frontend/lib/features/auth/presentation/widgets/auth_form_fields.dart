import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class AuthDropdownField<T> extends StatelessWidget {
  const AuthDropdownField({
    super.key,
    required this.label,
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
    this.validator,
    this.errorText,
  });

  final String label;
  final String hint;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final String? Function(T?)? validator;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final error = Theme.of(context).colorScheme.error;

    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      items: items,
      onChanged: onChanged,
      validator: validator,
      forceErrorText: errorText,
      dropdownColor: colors.surface,
      style: TextStyle(color: colors.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: TextStyle(
          color: colors.textSecondary,
          fontWeight: FontWeight.w500,
        ),
        hintStyle: TextStyle(color: colors.textMuted),
        floatingLabelBehavior: FloatingLabelBehavior.always,
        filled: true,
        fillColor: colors.surfaceElevated,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 18,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: colors.primary, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.mdAll,
          borderSide: BorderSide(color: error, width: 1.4),
        ),
      ),
      iconEnabledColor: colors.textSecondary,
    );
  }
}

class AuthTextArea extends StatelessWidget {
  const AuthTextArea({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    this.validator,
    this.minLines = 3,
    this.maxLines = 5,
    this.textInputAction = TextInputAction.newline,
    this.onFieldSubmitted,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? Function(String?)? validator;
  final int minLines;
  final int maxLines;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return AuthTextField(
      controller: controller,
      label: label,
      hint: hint,
      keyboardType: TextInputType.multiline,
      textInputAction: textInputAction,
      validator: validator,
      minLines: minLines,
      maxLines: maxLines,
      onFieldSubmitted: onFieldSubmitted,
      errorText: errorText,
      onChanged: onChanged,
    );
  }
}

class AuthSectionTitle extends StatelessWidget {
  const AuthSectionTitle({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: colors.primary,
        ),
      ),
    );
  }
}

class AuthIntentChip extends StatelessWidget {
  const AuthIntentChip({
    super.key,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: isSelected ? colors.primarySoft : colors.surfaceElevated,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: isSelected ? colors.primary : colors.border,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isSelected ? colors.primary : colors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
