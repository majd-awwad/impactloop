import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../l10n/ai_l10n.dart';

const _compactComposerBreakpoint = 400.0;

class AiComposer extends StatelessWidget {
  const AiComposer({
    super.key,
    required this.controller,
    required this.canSend,
    required this.isSending,
    required this.isDisabled,
    required this.isOverLimit,
    required this.onChanged,
    required this.onSend,
    this.hintText,
    this.showAccessoryActions = true,
    this.compact = false,
    this.maxContentWidth,
  });

  final TextEditingController controller;
  final bool canSend;
  final bool isSending;
  final bool isDisabled;
  final bool isOverLimit;
  final ValueChanged<String> onChanged;
  final VoidCallback onSend;
  final String? hintText;
  final bool showAccessoryActions;
  final bool compact;
  final double? maxContentWidth;

  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(AiL10n.featureComingSoon.resolve(context))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final isNarrow = MediaQuery.sizeOf(context).width < _compactComposerBreakpoint;
    final showActions = showAccessoryActions && !isNarrow && !compact;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        compact ? AppSpacing.sm : AppSpacing.md,
        AppSpacing.sm,
        compact ? AppSpacing.sm : AppSpacing.md,
        AppSpacing.md + bottomInset,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: maxContentWidth ?? double.infinity,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isOverLimit)
                Padding(
                  padding:
                      const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
                  child: Text(
                    AiL10n.maxLength.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: materialWarning,
                    ),
                  ),
                ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: palette.panelSurface,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(
                    color: palette.borderSubtle.withValues(alpha: 0.9),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: colors.shadow.withValues(alpha: 0.08),
                      blurRadius: 18,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.xs,
                    AppSpacing.xs,
                    AppSpacing.xs,
                    AppSpacing.xs,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (showActions) ...[
                        _ComposerCircleButton(
                          tooltip: AiL10n.voiceInput.resolve(context),
                          icon: Icons.mic_none_rounded,
                          background: colors.primary.withValues(alpha: 0.12),
                          foreground: colors.primary,
                          onPressed: isDisabled || isSending
                              ? null
                              : () => _showComingSoon(context),
                        ),
                        IconButton(
                          tooltip: AiL10n.attach.resolve(context),
                          onPressed: isDisabled || isSending
                              ? null
                              : () => _showComingSoon(context),
                          visualDensity: VisualDensity.compact,
                          icon: Icon(
                            Icons.attach_file_rounded,
                            color: palette.textSecondary,
                            size: 20,
                          ),
                        ),
                      ],
                      Expanded(
                        child: TextField(
                          controller: controller,
                          enabled: !isDisabled && !isSending,
                          minLines: 1,
                          maxLines: 5,
                          textInputAction: TextInputAction.send,
                          onChanged: onChanged,
                          onSubmitted: canSend ? (_) => onSend() : null,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                          ),
                          decoration: InputDecoration(
                            hintText:
                                hintText ?? AiL10n.inputHint.resolve(context),
                            hintStyle: AppTextStyles.body(context).copyWith(
                              color: palette.textMuted,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding:
                                const EdgeInsetsDirectional.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.sm + 2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      _ComposerCircleButton(
                        tooltip: AiL10n.send.resolve(context),
                        icon: Icons.send_rounded,
                        background: colors.primary,
                        foreground: colors.textOnPrimary,
                        onPressed: canSend ? onSend : null,
                        filled: true,
                        size: (compact || isNarrow) ? 36 : 42,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ComposerCircleButton extends StatelessWidget {
  const _ComposerCircleButton({
    required this.tooltip,
    required this.icon,
    required this.background,
    required this.foreground,
    required this.onPressed,
    this.filled = false,
    this.size = 42,
  });

  final String tooltip;
  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback? onPressed;
  final bool filled;
  final double size;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: enabled
            ? background
            : background.withValues(alpha: filled ? 0.35 : 0.5),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(
              icon,
              size: size <= 36 ? 18 : 20,
              color: enabled
                  ? foreground
                  : foreground.withValues(alpha: 0.55),
            ),
          ),
        ),
      ),
    );
  }
}
