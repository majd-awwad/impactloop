import 'package:flutter/material.dart';

import 'app_text_field.dart';

class AppPasswordField extends StatefulWidget {
  const AppPasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.textInputAction,
    this.validator,
    this.autofillHints,
    this.onFieldSubmitted,
    this.errorText,
    this.onChanged,
    this.obscureOverride,
    this.onToggleVisibility,
  });

  final TextEditingController controller;
  final String label;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onFieldSubmitted;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final bool? obscureOverride;
  final VoidCallback? onToggleVisibility;

  @override
  State<AppPasswordField> createState() => _AppPasswordFieldState();
}

class _AppPasswordFieldState extends State<AppPasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    final obscure = widget.obscureOverride ?? _obscure;
    final tooltip = obscure ? 'Show password' : 'Hide password';

    return AppTextField(
      controller: widget.controller,
      label: widget.label,
      obscureText: obscure,
      textInputAction: widget.textInputAction,
      validator: widget.validator,
      autofillHints: widget.autofillHints,
      onFieldSubmitted: widget.onFieldSubmitted,
      errorText: widget.errorText,
      onChanged: widget.onChanged,
      suffixIcon: Tooltip(
        message: tooltip,
        child: Semantics(
          label: tooltip,
          button: true,
          child: IconButton(
            onPressed: () {
              if (widget.onToggleVisibility != null) {
                widget.onToggleVisibility!();
              } else {
                setState(() => _obscure = !_obscure);
              }
            },
            icon: Icon(
              obscure
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
            ),
          ),
        ),
      ),
    );
  }
}
