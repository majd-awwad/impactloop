import 'package:flutter/material.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';

const double profileFamilyMaxWidth = 920;
const double profileFamilyWideBreakpoint = 840;

enum ProfileFamilyTone {
  primary,
  mint,
  blue,
  amber,
  neutral,
  success,
  warning,
  danger,
}

class ProfileFamilyToneStyle {
  const ProfileFamilyToneStyle({
    required this.surface,
    required this.foreground,
    required this.border,
  });

  final Color surface;
  final Color foreground;
  final Color border;

  factory ProfileFamilyToneStyle.of(
    BuildContext context,
    ProfileFamilyTone tone,
  ) {
    final colors = AppThemeColors.of(context);
    final accent = switch (tone) {
      ProfileFamilyTone.primary => colors.primary,
      ProfileFamilyTone.mint => colors.accentMint,
      ProfileFamilyTone.blue => colors.accentBlue,
      ProfileFamilyTone.amber => colors.accentAmber,
      ProfileFamilyTone.neutral => colors.textSecondary,
      ProfileFamilyTone.success => colors.success,
      ProfileFamilyTone.warning => colors.warningText,
      ProfileFamilyTone.danger => colors.danger,
    };
    final base = switch (tone) {
      ProfileFamilyTone.primary || ProfileFamilyTone.mint => colors.primarySoft,
      ProfileFamilyTone.blue => Color.lerp(
        colors.cardSurface,
        colors.accentBlue,
        0.12,
      )!,
      ProfileFamilyTone.amber => Color.lerp(
        colors.cardSurface,
        colors.accentAmber,
        0.13,
      )!,
      ProfileFamilyTone.neutral => colors.surfaceMuted,
      ProfileFamilyTone.success => colors.successSoft,
      ProfileFamilyTone.warning => colors.warningSoft,
      ProfileFamilyTone.danger => colors.dangerSoft,
    };

    return ProfileFamilyToneStyle(
      surface: Color.lerp(colors.cardSurface, base, 0.78)!,
      foreground: accent,
      border: tone == ProfileFamilyTone.warning
          ? colors.warningBorder
          : Color.lerp(colors.borderSubtle, accent, 0.34)!,
    );
  }
}

class ProfileFamilyPageScaffold extends StatelessWidget {
  const ProfileFamilyPageScaffold({
    super.key,
    required this.title,
    required this.backTooltip,
    required this.backFallbackRoute,
    required this.child,
    this.headerAction,
  });

  final String title;
  final String backTooltip;
  final String backFallbackRoute;
  final Widget child;
  final Widget? headerAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final pagePadding = width >= profileFamilyWideBreakpoint
        ? AppSpacing.lg
        : AppSpacing.md;

    return Scaffold(
      backgroundColor: colors.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: profileFamilyMaxWidth,
                ),
                child: Padding(
                  padding: EdgeInsetsDirectional.only(
                    start: pagePadding,
                    end: pagePadding,
                    top: AppSpacing.sm,
                  ),
                  child: SizedBox(
                    height: AppSpacing.xxl,
                    child: Stack(
                      alignment: AlignmentDirectional.center,
                      children: [
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: Semantics(
                            label: backTooltip,
                            button: true,
                            child: Tooltip(
                              message: backTooltip,
                              child: BackButton(
                                onPressed: () =>
                                    context.popOrGo(backFallbackRoute),
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsetsDirectional.symmetric(
                            horizontal: AppSpacing.xxl,
                          ),
                          child: Semantics(
                            header: true,
                            namesRoute: true,
                            label: title,
                            child: ExcludeSemantics(
                              child: Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: AppTextStyles.title(context).copyWith(
                                  color: colors.textPrimary,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (headerAction != null)
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: headerAction,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsetsDirectional.only(
                  start: pagePadding,
                  end: pagePadding,
                  top: AppSpacing.md,
                  bottom: AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: profileFamilyMaxWidth,
                    ),
                    child: child,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileFamilyIntroductionSurface extends StatelessWidget {
  const ProfileFamilyIntroductionSurface({
    super.key,
    required this.child,
    this.padding,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      padding: padding ?? const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            Color.lerp(colors.cardSurface, colors.primarySoft, 0.86)!,
            colors.cardSurface,
            Color.lerp(colors.cardSurface, colors.accentMint, 0.08)!,
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: Color.lerp(colors.borderSubtle, colors.primary, 0.22)!,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.11),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -44,
            end: -36,
            child: _DecorativeCircle(
              size: 120,
              color: colors.accentMint.withValues(alpha: 0.08),
            ),
          ),
          PositionedDirectional(
            bottom: -38,
            start: 36,
            child: _DecorativeCircle(
              size: 82,
              color: colors.primary.withValues(alpha: 0.05),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _DecorativeCircle extends StatelessWidget {
  const _DecorativeCircle({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}

class ProfileFamilySurface extends StatelessWidget {
  const ProfileFamilySurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsetsDirectional.all(AppSpacing.md),
    this.tone = ProfileFamilyTone.neutral,
    this.showShadow = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final ProfileFamilyTone tone;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, tone);

    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: tone == ProfileFamilyTone.neutral
            ? colors.cardSurface
            : Color.lerp(colors.cardSurface, style.surface, 0.34),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: showShadow
            ? [
                BoxShadow(
                  color: colors.shadow.withValues(alpha: 0.08),
                  blurRadius: 16,
                  offset: const Offset(0, 7),
                ),
              ]
            : null,
      ),
      child: child,
    );
  }
}

class ProfileFamilySectionHeading extends StatelessWidget {
  const ProfileFamilySectionHeading({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileFamilyIconContainer(icon: icon),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle!,
                  style: AppTextStyles.body(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class ProfileFamilyIconContainer extends StatelessWidget {
  const ProfileFamilyIconContainer({
    super.key,
    required this.icon,
    this.tone = ProfileFamilyTone.primary,
    this.size = 42,
    this.iconSize = 21,
  });

  final IconData icon;
  final ProfileFamilyTone tone;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final style = ProfileFamilyToneStyle.of(context, tone);

    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: style.surface,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: style.border),
        ),
        child: Icon(icon, color: style.foreground, size: iconSize),
      ),
    );
  }
}

class ProfileFamilyDestinationTile extends StatelessWidget {
  const ProfileFamilyDestinationTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.semanticLabel,
    required this.onTap,
    this.tone = ProfileFamilyTone.neutral,
    this.enabled = true,
    this.busy = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String semanticLabel;
  final VoidCallback onTap;
  final ProfileFamilyTone tone;
  final bool enabled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, tone);

    return Semantics(
      label: semanticLabel,
      button: true,
      enabled: enabled && !busy,
      child: ExcludeSemantics(
        child: Material(
          color: style.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg + 2),
            side: BorderSide(color: style.border),
          ),
          child: InkWell(
            onTap: enabled && !busy ? onTap : null,
            borderRadius: BorderRadius.circular(AppRadius.lg + 2),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 72),
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm + AppSpacing.xs,
                ),
                child: Row(
                  children: [
                    ProfileFamilyIconContainer(icon: icon, tone: tone),
                    const SizedBox(width: AppSpacing.sm + AppSpacing.xs),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: AppTextStyles.label(context).copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            subtitle,
                            style: AppTextStyles.body(context).copyWith(
                              color: colors.textSecondary,
                              fontSize: 13,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    if (busy)
                      SizedBox(
                        width: AppSpacing.lg,
                        height: AppSpacing.lg,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: style.foreground,
                        ),
                      )
                    else
                      Icon(
                        Icons.chevron_right_rounded,
                        color: enabled ? style.foreground : colors.textMuted,
                        size: 24,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ProfileFamilyIntrinsicChip extends StatelessWidget {
  const ProfileFamilyIntrinsicChip({
    super.key,
    required this.label,
    this.semanticLabel,
    this.onPressed,
    this.expanded,
    this.tone = ProfileFamilyTone.primary,
  });

  final String label;
  final String? semanticLabel;
  final VoidCallback? onPressed;
  final bool? expanded;
  final ProfileFamilyTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, tone);
    final content = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 36, maxWidth: 220),
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: style.surface,
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: style.border),
        ),
        child: Directionality(
          textDirection: profileFamilyContentDirection(
            label,
            Directionality.of(context),
          ),
          child: Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.label(context).copyWith(
              color: tone == ProfileFamilyTone.neutral
                  ? colors.textSecondary
                  : style.foreground,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );

    if (onPressed == null) {
      return Semantics(
        label: semanticLabel ?? label,
        child: ExcludeSemantics(child: content),
      );
    }

    return Semantics(
      label: semanticLabel ?? label,
      button: true,
      expanded: expanded,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: Material(
            type: MaterialType.transparency,
            borderRadius: AppRadius.pillAll,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              borderRadius: AppRadius.pillAll,
              child: Center(widthFactor: 1, heightFactor: 1, child: content),
            ),
          ),
        ),
      ),
    );
  }
}

TextDirection profileFamilyContentDirection(
  String value,
  TextDirection ambient,
) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return ambient;
  }
  if (RegExp(r'[\u0600-\u06FF]').hasMatch(trimmed)) {
    return TextDirection.rtl;
  }
  if (RegExp(r'[A-Za-z0-9]').hasMatch(trimmed)) {
    return TextDirection.ltr;
  }
  return ambient;
}

class ProfileFamilyDirectionalText extends StatelessWidget {
  const ProfileFamilyDirectionalText(
    this.value, {
    super.key,
    this.style,
    this.maxLines,
    this.overflow,
  });

  final String value;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) {
    final direction = profileFamilyContentDirection(
      value,
      Directionality.of(context),
    );
    return Directionality(
      textDirection: direction,
      child: Text(
        value,
        textAlign: TextAlign.start,
        style: style,
        maxLines: maxLines,
        overflow: overflow,
      ),
    );
  }
}
