import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
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
  });

  final String label;
  final VoidCallback? onPressed;
  final bool inFlight;
  final String? disabledHint;
  final String? semanticLabel;
  final bool destructive;
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
  });

  final String? title;
  final String? overview;
  final HelpSessionActionSpec? primary;
  final List<HelpSessionActionSpec> secondary;
  final String? managementTitle;
  final List<HelpSessionActionSpec> management;
  final Widget? progressChild;

  @override
  Widget build(BuildContext context) {
    final isCompact = MediaQuery.sizeOf(context).width < 720;
    final hasActions = primary != null ||
        secondary.isNotEmpty ||
        management.isNotEmpty ||
        progressChild != null;

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
          if (primary != null) ...[
            _ActionButton(spec: primary!, isPrimary: true, fullWidth: isCompact),
            if (primary!.disabledHint != null && primary!.onPressed == null) ...[
              const SizedBox(height: AppSpacing.xs),
              HelpSessionDetailMutedText(primary!.disabledHint!),
            ],
          ],
          for (final action in secondary) ...[
            const SizedBox(height: AppSpacing.sm),
            _ActionButton(
              spec: action,
              destructive: action.destructive,
              fullWidth: isCompact,
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
              _ActionButton(
                spec: action,
                destructive: true,
                fullWidth: isCompact,
              ),
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
    this.fullWidth = false,
  });

  final HelpSessionActionSpec spec;
  final bool isPrimary;
  final bool destructive;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final child = spec.inFlight
        ? const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(spec.label, style: AppTextStyles.label(context));

    final button = isPrimary
        ? FilledButton(
            onPressed: spec.onPressed,
            child: child,
          )
        : destructive
            ? OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                  side: BorderSide(
                    color: Theme.of(context).colorScheme.error.withValues(
                          alpha: 0.6,
                        ),
                  ),
                ),
                onPressed: spec.onPressed,
                child: child,
              )
            : OutlinedButton(
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
