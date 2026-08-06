import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../application/project_help_session_timezone.dart';
import '../l10n/project_help_sessions_l10n.dart';

typedef HelpSessionCancelSubmit = Future<void> Function(String? reason);

Future<void> showHelpSessionCancelDialog({
  required BuildContext context,
  required bool requiresReason,
  required bool showConfirmedWarning,
  required HelpSessionCancelSubmit onSubmit,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (dialogContext) => _HelpSessionCancelDialog(
      requiresReason: requiresReason,
      showConfirmedWarning: showConfirmedWarning,
      onSubmit: onSubmit,
    ),
  );
}

class _HelpSessionCancelDialog extends StatefulWidget {
  const _HelpSessionCancelDialog({
    required this.requiresReason,
    required this.showConfirmedWarning,
    required this.onSubmit,
  });

  final bool requiresReason;
  final bool showConfirmedWarning;
  final HelpSessionCancelSubmit onSubmit;

  @override
  State<_HelpSessionCancelDialog> createState() =>
      _HelpSessionCancelDialogState();
}

class _HelpSessionCancelDialogState extends State<_HelpSessionCancelDialog> {
  final _reasonController = TextEditingController();
  var _submitting = false;
  String? _inlineError;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reasonController.text.trim();
    if (widget.requiresReason && reason.isEmpty) {
      setState(() {
        _inlineError = Localizations.localeOf(context).languageCode == 'ar'
            ? 'يرجى إدخال سبب الإلغاء.'
            : 'Please enter a cancellation reason.';
      });
      return;
    }
    setState(() {
      _submitting = true;
      _inlineError = null;
    });
    try {
      await widget.onSubmit(reason.isEmpty ? null : reason);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _inlineError = resolveProjectHelpSessionErrorFromObject(
          error,
          isArabic: Localizations.localeOf(context).languageCode == 'ar',
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppDialogShell(
      title: Text(ProjectHelpSessionsL10n.cancelTitle.resolve(context)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.showConfirmedWarning)
              Text(
                ProjectHelpSessionsL10n.cancelConfirmedWarning.resolve(context),
              ),
            if (widget.showConfirmedWarning) const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _reasonController,
              enabled: !_submitting,
              maxLength: 300,
              decoration: InputDecoration(
                labelText: widget.requiresReason
                    ? ProjectHelpSessionsL10n.cancelReasonRequired
                        .resolve(context)
                    : ProjectHelpSessionsL10n.cancelReasonLabel.resolve(context),
              ),
            ),
            if (_inlineError != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _inlineError!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
              ),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: Text(
            Localizations.localeOf(context).languageCode == 'ar'
                ? 'رجوع'
                : 'Back',
          ),
        ),
        primaryAction: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(ProjectHelpSessionsL10n.confirmCancel.resolve(context)),
        ),
      ),
    );
  }
}
