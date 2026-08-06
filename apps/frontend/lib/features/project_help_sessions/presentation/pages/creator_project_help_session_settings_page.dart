import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import '../widgets/help_session_request_flow.dart';

class CreatorProjectHelpSessionSettingsPage extends ConsumerStatefulWidget {
  const CreatorProjectHelpSessionSettingsPage({
    super.key,
    required this.projectId,
  });

  final String projectId;

  @override
  ConsumerState<CreatorProjectHelpSessionSettingsPage> createState() =>
      _CreatorProjectHelpSessionSettingsPageState();
}

class _CreatorProjectHelpSessionSettingsPageState
    extends ConsumerState<CreatorProjectHelpSessionSettingsPage> {
  ProjectHelpSessionSettings? _draft;
  final _weeklyLimitController = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _weeklyLimitController.dispose();
    super.dispose();
  }

  void _syncDraft(ProjectHelpSessionSettings settings) {
    if (_draft == null) {
      _draft = settings;
      _weeklyLimitController.text = '${settings.weeklyLimit}';
    }
  }

  Future<void> _save() async {
    final draft = _draft;
    if (draft == null) {
      return;
    }
    if (draft.isEnabled && !draft.allow15Minutes && !draft.allow30Minutes) {
      setState(() {
        _errorText = ProjectHelpSessionsL10n.errorMessage(
          'HELP_SESSION_NO_DURATION_ENABLED',
        );
      });
      return;
    }
    if (draft.weeklyLimit < 1 || draft.weeklyLimit > 10) {
      setState(() {
        _errorText = ProjectHelpSessionsL10n.errorMessage(
          'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE',
        );
      });
      return;
    }
    setState(() => _errorText = null);
    try {
      final saved = await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .saveSettings(projectId: widget.projectId, settings: draft);
      if (saved == null || !mounted) {
        return;
      }
      setState(() {
        _draft = saved;
        _weeklyLimitController.text = '${saved.weeklyLimit}';
      });
      invalidateProjectHelpSessionSettings(ref, widget.projectId);
    } catch (error) {
      if (mounted) {
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final settingsAsync =
        ref.watch(projectHelpSessionSettingsProvider(widget.projectId));
    final saving = ref.watch(projectHelpSessionActionControllerProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/learning/submissions',
              phoneTitle: ProjectHelpSessionsL10n.settingsTitle.resolve(context),
            ),
            Expanded(
              child: settingsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: TextButton(
                    onPressed: () => ref.invalidate(
                      projectHelpSessionSettingsProvider(widget.projectId),
                    ),
                    child: Text(ProjectHelpSessionsL10n.retry.resolve(context)),
                  ),
                ),
                data: (settings) {
                  _syncDraft(settings);
                  final draft = _draft ?? settings;
                  return Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: SingleChildScrollView(
                        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              ProjectHelpSessionsL10n.settingsTitle
                                  .resolve(context),
                              style: AppTextStyles.title(context),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              ProjectHelpSessionsL10n.settingsDescription
                                  .resolve(context),
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textSecondary,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                ProjectHelpSessionsL10n.settingsEnable
                                    .resolve(context),
                              ),
                              value: draft.isEnabled,
                              onChanged: saving
                                  ? null
                                  : (value) => setState(
                                        () => _draft = draft.copyWith(
                                          isEnabled: value,
                                        ),
                                      ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              ProjectHelpSessionsL10n.settingsDurations
                                  .resolve(context),
                              style: AppTextStyles.label(context),
                            ),
                            CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                ProjectHelpSessionsL10n.durationLabel(15)
                                    .resolve(context),
                              ),
                              value: draft.allow15Minutes,
                              onChanged: saving
                                  ? null
                                  : (value) => setState(
                                        () => _draft = draft.copyWith(
                                          allow15Minutes: value ?? false,
                                        ),
                                      ),
                            ),
                            CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                ProjectHelpSessionsL10n.durationLabel(30)
                                    .resolve(context),
                              ),
                              value: draft.allow30Minutes,
                              onChanged: saving
                                  ? null
                                  : (value) => setState(
                                        () => _draft = draft.copyWith(
                                          allow30Minutes: value ?? false,
                                        ),
                                      ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              ProjectHelpSessionsL10n.settingsWeeklyLimit
                                  .resolve(context),
                              style: AppTextStyles.label(context),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            TextField(
                              controller: _weeklyLimitController,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                              ],
                              decoration: const InputDecoration(hintText: '1–10'),
                              onChanged: saving
                                  ? null
                                  : (value) {
                                      final parsed = int.tryParse(value);
                                      if (parsed != null) {
                                        setState(
                                          () => _draft = draft.copyWith(
                                            weeklyLimit: parsed,
                                          ),
                                        );
                                      }
                                    },
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              ProjectHelpSessionsL10n.settingsPrivacy
                                  .resolve(context),
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textSecondary,
                              ),
                            ),
                            if (_errorText != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                _errorText!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ],
                            const SizedBox(height: AppSpacing.lg),
                            AppPrimaryButton(
                              label: ProjectHelpSessionsL10n.settingsSave
                                  .resolve(context),
                              isLoading: saving,
                              onPressed: saving ? null : _save,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
