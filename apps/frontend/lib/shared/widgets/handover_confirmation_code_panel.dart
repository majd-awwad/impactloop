import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_text_styles.dart';
import 'app_status_badge.dart';
import 'materials/materials_ui_palette.dart';

class HandoverConfirmationCodePanel extends StatelessWidget {
  const HandoverConfirmationCodePanel({
    super.key,
    required this.code,
    required this.instructions,
  });

  final String code;
  final String instructions;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final displayCode = _displayCode(code);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: palette.borderStrong.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            instructions,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.xs),
          SelectableText(
            displayCode,
            style: AppTextStyles.display(context).copyWith(
              color: palette.textPrimary,
              letterSpacing: 4,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  static String _displayCode(String value) {
    final trimmed = value.trim();
    if (trimmed.length == 6 && RegExp(r'^\d{6}$').hasMatch(trimmed)) {
      return '${trimmed.substring(0, 3)} ${trimmed.substring(3)}';
    }

    return trimmed;
  }
}

class HandoverCodeInputDialog extends StatefulWidget {
  const HandoverCodeInputDialog({
    super.key,
    required this.title,
    required this.message,
    required this.confirmLabel,
    this.confirmTone = AppStatusTone.primary,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final AppStatusTone confirmTone;

  static Future<String?> show(
    BuildContext context, {
    required String title,
    required String message,
    required String confirmLabel,
    AppStatusTone confirmTone = AppStatusTone.primary,
  }) {
    return showDialog<String>(
      context: context,
      builder: (context) => HandoverCodeInputDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        confirmTone: confirmTone,
      ),
    );
  }

  @override
  State<HandoverCodeInputDialog> createState() =>
      _HandoverCodeInputDialogState();
}

class _HandoverCodeInputDialogState extends State<HandoverCodeInputDialog> {
  final _controller = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final normalized = _controller.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(normalized)) {
      setState(() {
        _errorText = 'Enter the 6-digit confirmation code.';
      });
      return;
    }

    Navigator.of(context).pop(normalized);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.message,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              labelText: 'Confirmation code',
              counterText: '',
              errorText: _errorText,
            ),
            onChanged: (_) {
              if (_errorText != null) {
                setState(() => _errorText = null);
              }
            },
            onSubmitted: (_) => _submit(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          style: AppStatusButtonStyle.filled(
            context,
            widget.confirmTone,
          ),
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}
