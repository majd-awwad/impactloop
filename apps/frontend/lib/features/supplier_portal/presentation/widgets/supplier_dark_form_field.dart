import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

class SupplierFormLabel extends StatelessWidget {
  const SupplierFormLabel({super.key, required this.label, this.subtitle});

  final String label;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AuthDarkTextStyles.label(context).copyWith(
            color: AuthDarkColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(subtitle!, style: AuthDarkTextStyles.body(context)),
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
          style: const TextStyle(color: AuthDarkColors.textPrimary),
          decoration: SupplierDecorations.darkFormFieldDecoration(hint: hint),
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
          style: const TextStyle(color: AuthDarkColors.textPrimary),
          decoration: SupplierDecorations.darkFormFieldDecoration(hint: hint),
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
          dropdownColor: AuthDarkColors.surfaceSolid,
          style: const TextStyle(color: AuthDarkColors.textPrimary),
          iconEnabledColor: AuthDarkColors.textSecondary,
          decoration: SupplierDecorations.darkFormFieldDecoration(hint: hint),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.profileSectionPanel,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, color: AuthDarkColors.accent, size: 22),
            const SizedBox(width: AppSpacing.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AuthDarkTextStyles.sectionTitle(context)),
                const SizedBox(height: AppSpacing.xs),
                Text(subtitle, style: AuthDarkTextStyles.body(context)),
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
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.55),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: AuthDarkColors.border.withValues(alpha: 0.35),
        ),
      ),
      child: SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(
          title,
          style: AuthDarkTextStyles.label(context).copyWith(
            color: AuthDarkColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Text(subtitle!, style: AuthDarkTextStyles.body(context)),
        value: value,
        activeTrackColor: AuthDarkColors.accent.withValues(alpha: 0.45),
        activeThumbColor: AuthDarkColors.accent,
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
          style: const TextStyle(color: AuthDarkColors.textPrimary),
          decoration: SupplierDecorations.darkFormFieldDecoration().copyWith(
            suffixIcon: IconButton(
              icon: Icon(
                _obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                color: AuthDarkColors.textMuted,
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
          ),
        ),
      ],
    );
  }
}
