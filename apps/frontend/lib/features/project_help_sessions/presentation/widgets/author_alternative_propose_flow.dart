import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../application/project_help_session_timezone.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_status_utils.dart';

Future<DateTime?> showAuthorAlternativeProposeFlow({
  required BuildContext context,
  required ProjectHelpSession session,
}) {
  final isCompact = MediaQuery.sizeOf(context).width < 720;
  if (isCompact) {
    return showModalBottomSheet<DateTime>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: _AuthorAlternativeProposeForm(session: session),
      ),
    );
  }
  return showDialog<DateTime>(
    context: context,
    builder: (context) => Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 640),
        child: _AuthorAlternativeProposeForm(session: session),
      ),
    ),
  );
}

class _AuthorAlternativeProposeForm extends StatefulWidget {
  const _AuthorAlternativeProposeForm({required this.session});

  final ProjectHelpSession session;

  @override
  State<_AuthorAlternativeProposeForm> createState() =>
      _AuthorAlternativeProposeFormState();
}

class _AuthorAlternativeProposeFormState
    extends State<_AuthorAlternativeProposeForm> {
  DateTime? _date;
  TimeOfDay? _time;
  String? _errorText;

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (pickedDate == null || !mounted) {
      return;
    }
    final pickedTime = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
    );
    if (pickedTime == null || !mounted) {
      return;
    }
    setState(() {
      _date = pickedDate;
      _time = pickedTime;
      _errorText = null;
    });
  }

  DateTime? _validateUtc() {
    if (_date == null || _time == null) {
      return null;
    }
    final wallClock = DateTime(
      _date!.year,
      _date!.month,
      _date!.day,
      _time!.hour,
      _time!.minute,
    );
    try {
      final utc = projectHelpSessionLocalToUtc(
        wallClock,
        widget.session.learnerTimeZone,
      );
      final now = DateTime.now().toUtc();
      final minFuture = now.add(const Duration(minutes: 60));
      final maxFuture = now.add(const Duration(days: 60));
      if (utc.isBefore(minFuture)) {
        setState(() {
          _errorText = Localizations.localeOf(context).languageCode == 'ar'
              ? 'يجب أن يكون الموعد بعد ساعة على الأقل من الآن.'
              : 'The time must be at least 60 minutes in the future.';
        });
        return null;
      }
      if (utc.isAfter(maxFuture)) {
        setState(() {
          _errorText = Localizations.localeOf(context).languageCode == 'ar'
              ? 'يجب أن يكون الموعد خلال 60 يومًا.'
              : 'The time must be within 60 days.';
        });
        return null;
      }
      return utc;
    } on ProjectHelpSessionTimezoneException catch (error) {
      setState(() => _errorText = error.message);
      return null;
    }
  }

  void _submit() {
    final utc = _validateUtc();
    if (utc == null) {
      if (_date == null || _time == null) {
        setState(() {
          _errorText = Localizations.localeOf(context).languageCode == 'ar'
              ? 'اختر التاريخ والوقت.'
              : 'Select a date and time.';
        });
      }
      return;
    }
    Navigator.of(context).pop(utc);
  }

  @override
  Widget build(BuildContext context) {
    final timezone = widget.session.learnerTimeZone;
    String? preview;
    if (_date != null && _time != null) {
      try {
        preview = formatHelpSessionDateTime(
          context,
          projectHelpSessionLocalToUtc(
            DateTime(
              _date!.year,
              _date!.month,
              _date!.day,
              _time!.hour,
              _time!.minute,
            ),
            timezone,
          ),
          timezone,
        );
      } catch (_) {
        preview = null;
      }
    }

    return AppDialogShell(
      title: Text(ProjectHelpSessionsL10n.alternativeTitle.resolve(context)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ProjectHelpSessionsL10n.alternativeBody.resolve(context)),
            const SizedBox(height: AppSpacing.md),
            Text(
              ProjectHelpSessionsL10n.timezoneDisplay(timezone).resolve(context),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: _pickDateTime,
              icon: const Icon(Icons.event_outlined),
              label: Text(ProjectHelpSessionsL10n.selectDate.resolve(context)),
            ),
            if (preview != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(preview),
            ],
            if (_errorText != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _errorText!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            Localizations.localeOf(context).languageCode == 'ar'
                ? 'إلغاء'
                : 'Cancel',
          ),
        ),
        primaryAction: FilledButton(
          onPressed: _submit,
          child: Text(ProjectHelpSessionsL10n.alternativeSend.resolve(context)),
        ),
      ),
    );
  }
}
