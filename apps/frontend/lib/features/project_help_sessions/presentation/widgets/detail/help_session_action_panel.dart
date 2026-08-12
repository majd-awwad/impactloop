import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_theme_colors.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'help_session_detail_primitives.dart';

class HelpSessionActionSpec {
  const HelpSessionActionSpec({
    required this.label,
    this.onPressed,
    this.inFlight = false,
    this.disabledHint,
    this.semanticLabel,
    this.destructive = false,
    this.warning = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool inFlight;
  final String? disabledHint;
  final String? semanticLabel;
  final bool destructive;
  final bool warning;
}

class HelpSessionActionPanel extends StatelessWidget {
  const HelpSessionActionPanel({
    super.key,
    this.title,
    this.overview,
    this.primary,
    this.secondary = const [],
    this.managementTitle,
    this.management = const [],
    this.progressChild,
    this.notice,
    this.notices = const [],
  });

  final String? title;
  final String? overview;
  final HelpSessionActionSpec? primary;
  final List<HelpSessionActionSpec> secondary;
  final String? managementTitle;
  final List<HelpSessionActionSpec> management;
  final Widget? progressChild;
  final String? notice;
  final List<String> notices;

  @override
  Widget build(BuildContext context) {
    final hasActions =
        primary != null ||
        secondary.isNotEmpty ||
        management.isNotEmpty ||
        progressChild != null ||
        notice != null ||
        notices.isNotEmpty;

    if (!hasActions && overview == null) {
      return const SizedBox.shrink();
    }

    return HelpSessionDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            HelpSessionDetailSectionTitle(title!),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (overview != null) ...[
            HelpSessionDetailMutedText(overview!),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (progressChild != null) ...[
            progressChild!,
            const SizedBox(height: AppSpacing.sm),
          ],
          for (final message in [?notice, ...notices]) ...[
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppThemeColors.of(context).warningSoft,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppThemeColors.of(context).warningBorder,
                ),
              ),
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppThemeColors.of(context).warningText,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (primary != null) ...[
            _ActionButton(spec: primary!, isPrimary: true, fullWidth: true),
            if (primary!.disabledHint != null &&
                primary!.onPressed == null) ...[
              const SizedBox(height: AppSpacing.xs),
              HelpSessionDetailMutedText(primary!.disabledHint!),
            ],
          ],
          for (final action in secondary) ...[
            const SizedBox(height: AppSpacing.sm),
            _ActionButton(
              spec: action,
              destructive: action.destructive,
              warning: action.warning,
              fullWidth: true,
            ),
            if (action.disabledHint != null && action.onPressed == null) ...[
              const SizedBox(height: AppSpacing.xs),
              HelpSessionDetailMutedText(action.disabledHint!),
            ],
          ],
          if (management.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Divider(color: MaterialsUiPalette.of(context).borderSubtle),
            const SizedBox(height: AppSpacing.sm),
            HelpSessionDetailSectionTitle(
              managementTitle ??
                  (Localizations.localeOf(context).languageCode == 'ar'
                      ? 'إدارة الجلسة'
                      : 'Session management'),
            ),
            const SizedBox(height: AppSpacing.sm),
            for (final action in management) ...[
              _ActionButton(spec: action, destructive: true, fullWidth: true),
              const SizedBox(height: AppSpacing.xs),
            ],
          ],
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.spec,
    this.isPrimary = false,
    this.destructive = false,
    this.warning = false,
    this.fullWidth = false,
  });

  final HelpSessionActionSpec spec;
  final bool isPrimary;
  final bool destructive;
  final bool warning;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final child = spec.inFlight
        ? const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(
            spec.label,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          );

    final button = isPrimary
        ? FilledButton(
            style: ButtonStyle(
              backgroundColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? colors.primarySoft
                    : colors.primary,
              ),
              foregroundColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? colors.textSecondary
                    : colors.textOnPrimary,
              ),
              side: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? BorderSide(color: colors.primary.withValues(alpha: 0.4))
                    : BorderSide.none,
              ),
            ),
            onPressed: spec.onPressed,
            child: child,
          )
        : destructive
        ? OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
              side: BorderSide(
                color: Theme.of(
                  context,
                ).colorScheme.error.withValues(alpha: 0.6),
              ),
            ),
            onPressed: spec.onPressed,
            child: child,
          )
        : warning
        ? OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.warningText,
              backgroundColor: colors.warningSoft,
              side: BorderSide(color: colors.warningBorder),
            ),
            onPressed: spec.onPressed,
            child: child,
          )
        : OutlinedButton(
            style: ButtonStyle(
              foregroundColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? colors.textSecondary
                    : colors.primary,
              ),
              side: WidgetStateProperty.resolveWith(
                (states) => BorderSide(
                  color: states.contains(WidgetState.disabled)
                      ? colors.borderStrong
                      : colors.primary,
                ),
              ),
            ),
            onPressed: spec.onPressed,
            child: child,
          );

    return Semantics(
      button: true,
      label: spec.semanticLabel ?? spec.label,
      enabled: spec.onPressed != null,
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: SizedBox(
          width: fullWidth ? double.infinity : null,
          child: button,
        ),
      ),
    );
  }
}
