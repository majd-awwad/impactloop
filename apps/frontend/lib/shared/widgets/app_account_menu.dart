import 'package:flutter/material.dart';

import '../../app/theme/app_radius.dart';
import '../../app/theme/app_spacing.dart';
import '../../app/theme/app_theme_colors.dart';
import '../../app/theme/auth_dark_text_styles.dart';
import '../../features/admin_portal/presentation/theme/admin_decoration_set.dart';
import '../../features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

/// Visual tokens for the anchored account menu (Supplier is the reference).
@immutable
class AppAccountMenuStyle {
  const AppAccountMenuStyle({
    required this.decoration,
    required this.borderColor,
    required this.textPrimary,
    required this.textSecondary,
    required this.accent,
    required this.destructive,
    required this.nameStyle,
    required this.secondaryStyle,
    required this.modeLabelStyle,
    required this.actionLabelStyle,
  });

  final BoxDecoration decoration;
  final Color borderColor;
  final Color textPrimary;
  final Color textSecondary;
  final Color accent;
  final Color destructive;
  final TextStyle nameStyle;
  final TextStyle secondaryStyle;
  final TextStyle modeLabelStyle;
  final TextStyle actionLabelStyle;

  /// Matches [SupplierProfilePopoverContent] styling exactly.
  factory AppAccountMenuStyle.supplier(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    return AppAccountMenuStyle(
      decoration: decorations.dashboardCard,
      borderColor: colors.border,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      accent: colors.accent,
      destructive: colors.error,
      nameStyle: context.supplierLabel().copyWith(
        color: colors.textPrimary,
        fontWeight: FontWeight.w600,
      ),
      secondaryStyle: context.supplierBody(),
      modeLabelStyle: context.supplierBody().copyWith(color: colors.accent),
      actionLabelStyle: context.supplierLabel().copyWith(
        color: colors.textPrimary,
      ),
    );
  }

  /// Learner / Driver / shared EntryNavBar surfaces.
  factory AppAccountMenuStyle.app(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AppAccountMenuStyle(
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      borderColor: colors.borderSubtle,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      accent: colors.primary,
      destructive: colors.danger,
      nameStyle: AuthDarkTextStyles.label(
        context,
      ).copyWith(color: colors.textPrimary, fontWeight: FontWeight.w600),
      secondaryStyle: AuthDarkTextStyles.body(
        context,
      ).copyWith(color: colors.textSecondary),
      modeLabelStyle: AuthDarkTextStyles.body(
        context,
      ).copyWith(color: colors.primary),
      actionLabelStyle: AuthDarkTextStyles.label(
        context,
      ).copyWith(color: colors.textPrimary),
    );
  }

  /// Admin portal surfaces — same geometry as Supplier, admin palette.
  factory AppAccountMenuStyle.admin(BuildContext context) {
    final palette = context.adminPalette;
    return AppAccountMenuStyle(
      decoration: BoxDecoration(
        color: palette.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.border),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      borderColor: palette.border,
      textPrimary: palette.textPrimary,
      textSecondary: palette.textSecondary,
      accent: palette.primaryTeal,
      destructive: palette.red,
      nameStyle:
          Theme.of(context).textTheme.labelLarge?.copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ) ??
          TextStyle(color: palette.textPrimary, fontWeight: FontWeight.w600),
      secondaryStyle:
          Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: palette.textSecondary) ??
          TextStyle(color: palette.textSecondary),
      modeLabelStyle:
          Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: palette.primaryTeal) ??
          TextStyle(color: palette.primaryTeal),
      actionLabelStyle:
          Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(color: palette.textPrimary) ??
          TextStyle(color: palette.textPrimary),
    );
  }
}

class AppAccountMenuAction {
  const AppAccountMenuAction({
    required this.label,
    required this.icon,
    this.onTap,
    this.destructive = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool destructive;
}

/// Opens the Supplier-canonical anchored account menu:
/// compact → bottom sheet; wide → top-end dialog (maxWidth 320).
Future<void> showAppAccountMenu({
  required BuildContext context,
  required WidgetBuilder builder,
  double compactBreakpoint = AppSpacing.supplierLayoutBreakpoint,
}) {
  final compact = MediaQuery.sizeOf(context).width < compactBreakpoint;

  if (compact) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: builder(sheetContext),
        );
      },
    );
  }

  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsetsDirectional.only(
          top: 72,
          end: 24,
        ).resolve(Directionality.of(context)),
        alignment: AlignmentDirectional.topEnd,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: builder(dialogContext),
        ),
      );
    },
  );
}

/// Shared account-menu panel matching Supplier popover structure.
class AppAccountMenuPanel extends StatelessWidget {
  const AppAccountMenuPanel({
    super.key,
    required this.style,
    required this.avatar,
    required this.displayName,
    this.email,
    this.subtitleLines = const [],
    this.modeLabel,
    this.badge,
    this.settingsControls,
    this.leadingActions = const [],
    this.trailingSections = const [],
    this.logoutAction,
  });

  final AppAccountMenuStyle style;
  final Widget avatar;
  final String displayName;
  final String? email;

  /// Extra header lines (e.g. supplier type) rendered before [modeLabel].
  final List<String> subtitleLines;
  final String? modeLabel;
  final Widget? badge;
  final Widget? settingsControls;
  final List<Widget> leadingActions;
  final List<Widget> trailingSections;
  final AppAccountMenuAction? logoutAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: style.decoration,
      child: SingleChildScrollView(
        primary: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                avatar,
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName, style: style.nameStyle),
                      if (email != null && email!.isNotEmpty)
                        Text(email!, style: style.secondaryStyle),
                      for (final line in subtitleLines)
                        if (line.isNotEmpty)
                          Text(line, style: style.secondaryStyle),
                      if (modeLabel != null && modeLabel!.isNotEmpty)
                        Text(modeLabel!, style: style.modeLabelStyle),
                    ],
                  ),
                ),
              ],
            ),
            if (badge != null) ...[
              const SizedBox(height: AppSpacing.sm),
              badge!,
            ],
            if (settingsControls != null) ...[
              const SizedBox(height: AppSpacing.md),
              settingsControls!,
            ],
            if (leadingActions.isNotEmpty) ...[
              Divider(color: style.borderColor, height: 24),
              ...leadingActions,
            ],
            for (final section in trailingSections) ...[
              Divider(color: style.borderColor, height: 24),
              section,
            ],
            if (logoutAction != null) ...[
              Divider(color: style.borderColor, height: 24),
              AppAccountMenuActionTile(style: style, action: logoutAction!),
            ],
          ],
        ),
      ),
    );
  }
}

class AppAccountMenuActionTile extends StatelessWidget {
  const AppAccountMenuActionTile({
    super.key,
    required this.style,
    required this.action,
  });

  final AppAccountMenuStyle style;
  final AppAccountMenuAction action;

  @override
  Widget build(BuildContext context) {
    final color = action.destructive ? style.destructive : style.textPrimary;
    final hoverBase = action.destructive ? style.destructive : style.accent;
    final enabled = action.onTap != null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: action.onTap,
        borderRadius: AppRadius.smAll,
        hoverColor: enabled ? hoverBase.withValues(alpha: 0.10) : null,
        splashColor: enabled ? hoverBase.withValues(alpha: 0.14) : null,
        highlightColor: enabled ? hoverBase.withValues(alpha: 0.08) : null,
        focusColor: enabled ? hoverBase.withValues(alpha: 0.12) : null,
        mouseCursor: enabled
            ? SystemMouseCursors.click
            : SystemMouseCursors.basic,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xs,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(action.icon, color: color, size: 20),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  action.label,
                  style: style.actionLabelStyle.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
