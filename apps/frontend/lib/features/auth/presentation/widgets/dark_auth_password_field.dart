import 'package:flutter/material.dart';

import '../../../../app/theme/auth_dark_colors.dart';
import 'dark_auth_text_field.dart';

class DarkAuthPasswordField extends StatefulWidget {
  const DarkAuthPasswordField({
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
  State<DarkAuthPasswordField> createState() => _DarkAuthPasswordFieldState();
}

class _DarkAuthPasswordFieldState extends State<DarkAuthPasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return DarkAuthTextField(
      controller: widget.controller,
      label: widget.label,
      obscureText: _obscure,
      textInputAction: widget.textInputAction,
      validator: widget.validator,
      autofillHints: widget.autofillHints,
      onFieldSubmitted: widget.onFieldSubmitted,
      errorText: widget.errorText,
      onChanged: widget.onChanged,
      suffixIcon: IconButton(
        icon: Icon(
          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          color: AuthDarkColors.textMuted,
        ),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
    );
  }
}
