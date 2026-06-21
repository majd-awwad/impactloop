import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

class SupplierFormLabel extends StatelessWidget {
  const SupplierFormLabel({
    super.key,
    required this.label,
    this.subtitle,
  });

  final String label;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: context.supplierLabel().copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(subtitle!, style: context.supplierBody()),
        ],
      ],
    );
  }
}

class SupplierDarkTextField extends StatelessWidget {
  const SupplierDarkTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.onFieldSubmitted,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onFieldSubmitted;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: label),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          validator: validator,
          onFieldSubmitted: onFieldSubmitted,
          onChanged: onChanged,
          forceErrorText: errorText,
          style: TextStyle(color: colors.textPrimary),
          decoration: context.supplierDecorations.formFieldDecoration(hint: hint),
        ),
      ],
    );
  }
}

class SupplierDarkTextArea extends StatelessWidget {
  const SupplierDarkTextArea({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    this.validator,
    this.minLines = 3,
    this.maxLines = 5,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? Function(String?)? validator;
  final int minLines;
  final int maxLines;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: label),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          controller: controller,
          keyboardType: TextInputType.multiline,
          textInputAction: TextInputAction.newline,
          minLines: minLines,
          maxLines: maxLines,
          validator: validator,
          onChanged: onChanged,
          forceErrorText: errorText,
          style: TextStyle(color: colors.textPrimary),
          decoration: context.supplierDecorations.formFieldDecoration(hint: hint),
        ),
      ],
    );
  }
}

class SupplierDarkDropdownField<T> extends StatelessWidget {
  const SupplierDarkDropdownField({
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
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: label),
        const SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<T>(
          key: ValueKey<T?>(value),
          initialValue: value,
          isExpanded: true,
          items: items,
          onChanged: onChanged,
          validator: validator,
          forceErrorText: errorText,
          dropdownColor: colors.surfaceSolid,
          style: TextStyle(color: colors.textPrimary),
          iconEnabledColor: colors.textSecondary,
          decoration: context.supplierDecorations.formFieldDecoration(hint: hint),
        ),
      ],
    );
  }
}

class SupplierFormSectionHeader extends StatelessWidget {
  const SupplierFormSectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon,
  });

  final String title;
  final String subtitle;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, color: colors.accent, size: 22),
            const SizedBox(width: AppSpacing.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.supplierSectionTitle()),
                const SizedBox(height: AppSpacing.xs),
                Text(subtitle, style: context.supplierBody()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierDarkSwitchTile extends StatelessWidget {
  const SupplierDarkSwitchTile({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: 0.55),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.35)),
      ),
      child: SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(
          title,
          style: context.supplierLabel().copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Text(subtitle!, style: context.supplierBody()),
        value: value,
        activeTrackColor: colors.accent.withValues(alpha: 0.45),
        activeThumbColor: colors.accent,
        onChanged: onChanged,
      ),
    );
  }
}

class SupplierFieldGap extends StatelessWidget {
  const SupplierFieldGap({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: AppSpacing.md);
  }
}

class SupplierSectionGap extends StatelessWidget {
  const SupplierSectionGap({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: AppSpacing.xl);
  }
}

class SupplierDarkPasswordField extends StatefulWidget {
  const SupplierDarkPasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.textInputAction,
    this.validator,
    this.autofillHints,
    this.onFieldSubmitted,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onFieldSubmitted;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  State<SupplierDarkPasswordField> createState() =>
      _SupplierDarkPasswordFieldState();
}

class _SupplierDarkPasswordFieldState extends State<SupplierDarkPasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: widget.label),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          controller: widget.controller,
          obscureText: _obscure,
          textInputAction: widget.textInputAction,
          validator: widget.validator,
          autofillHints: widget.autofillHints,
          onFieldSubmitted: widget.onFieldSubmitted,
          onChanged: widget.onChanged,
          forceErrorText: widget.errorText,
          style: TextStyle(color: colors.textPrimary),
          decoration: context.supplierDecorations.formFieldDecoration().copyWith(
            suffixIcon: IconButton(
              icon: Icon(
                _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: colors.textMuted,
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
        ),
      ],
    );
  }
}
