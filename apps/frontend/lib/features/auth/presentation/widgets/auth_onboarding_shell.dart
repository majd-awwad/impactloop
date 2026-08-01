import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../app/widgets/impact_loop_logo.dart';
import 'auth_ui_palette.dart';

class AuthOnboardingShell extends StatelessWidget {
  const AuthOnboardingShell({
    super.key,
    required this.child,
    this.showSignIn = false,
    this.showCreateAccount = false,
    this.showStoryPanel = true,
    this.maxWidth = 1120,
  });

  final Widget child;
  final bool showSignIn;
  final bool showCreateAccount;
  final bool showStoryPanel;
  final double maxWidth;

  static const _desktopBreakpoint = 900.0;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: colors.background,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: isDark
                ? [colors.background, colors.panelDark, colors.background]
                : [
                    colors.background,
                    colors.surfaceElevated,
                    colors.background,
                  ],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              EntryNavBar(
                showSignIn: showSignIn,
                showCreateAccount: showCreateAccount,
              ),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final isDesktop =
                        constraints.maxWidth >= _desktopBreakpoint;
                    final horizontalPadding = isDesktop
                        ? AppSpacing.xl
                        : AppSpacing.md;

                    return SingleChildScrollView(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        horizontalPadding,
                        isDesktop ? AppSpacing.xl : AppSpacing.md,
                        horizontalPadding,
                        AppSpacing.xl,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: maxWidth),
                          child: isDesktop && showStoryPanel
                              ? Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Expanded(
                                      flex: 9,
                                      child: AuthOnboardingStoryPanel(),
                                    ),
                                    const SizedBox(width: AppSpacing.xl),
                                    Expanded(flex: 11, child: child),
                                  ],
                                )
                              : child,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthOnboardingCard extends StatelessWidget {
  const AuthOnboardingCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.badge,
    this.icon,
    this.footer,
  });

  final String title;
  final String subtitle;
  final String? badge;
  final IconData? icon;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface.withValues(alpha: isDark ? 0.86 : 0.98),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: colors.primary.withValues(alpha: isDark ? 0.12 : 0.08),
            blurRadius: 24,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (badge != null || icon != null) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.primarySoft,
                        borderRadius: AppRadius.mdAll,
                      ),
                      child: Icon(icon, color: colors.primary, size: 22),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
                  if (badge != null)
                    Flexible(
                      child: Text(
                        badge!,
                        textAlign: TextAlign.start,
                        style: TextStyle(
                          color: colors.primary,
                          fontWeight: FontWeight.w800,
                          height: 1.35,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            Text(
              title,
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                height: 1.18,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 15,
                height: 1.5,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            child,
            if (footer != null) ...[
              const SizedBox(height: AppSpacing.lg),
              footer!,
            ],
          ],
        ),
      ),
    );
  }
}

class AuthStatusBadge extends StatelessWidget {
  const AuthStatusBadge({
    super.key,
    required this.label,
    this.icon = Icons.hourglass_top_rounded,
  });

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.primarySoft,
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: colors.primary.withValues(alpha: 0.38)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: colors.primary),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: TextStyle(
                color: colors.primary,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AuthInfoRow extends StatelessWidget {
  const AuthInfoRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textMuted,
                fontWeight: FontWeight.w700,
                height: 1.4,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.start,
              style: TextStyle(color: colors.textPrimary, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class AuthOnboardingStoryPanel extends StatelessWidget {
  const AuthOnboardingStoryPanel({super.key});

  static const _benefits = [
    (Icons.search_rounded, 'Find useful materials nearby'),
    (Icons.inventory_2_outlined, 'Share surplus instead of wasting it'),
    (Icons.construction_rounded, 'Build practical projects with less cost'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface.withValues(alpha: isDark ? 0.72 : 0.9),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ImpactLoopLogo(
              iconColor: colors.primary,
              iconSurfaceColor: colors.primarySoft,
              borderColor: colors.border,
              textColor: colors.textPrimary,
            ),
            const SizedBox(height: AppSpacing.xxl),
            Text(
              'Learn. Reuse. Build.',
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 36,
                fontWeight: FontWeight.w800,
                height: 1.12,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Join a reuse loop where learners find materials, suppliers share surplus, and practical projects become easier to build.',
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 16,
                height: 1.55,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final benefit in _benefits) ...[
              _BenefitRow(icon: benefit.$1, label: benefit.$2),
              const SizedBox(height: AppSpacing.md),
            ],
            const SizedBox(height: AppSpacing.md),
            const _LoopVisual(),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: AppRadius.mdAll,
          ),
          child: Icon(icon, color: colors.primary, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Text(
              label,
              textAlign: TextAlign.start,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
                height: 1.35,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _LoopVisual extends StatelessWidget {
  const _LoopVisual();

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          const _VisualNode(icon: Icons.school_outlined, label: 'Learn'),
          Expanded(child: Divider(color: colors.borderStrong)),
          const _VisualNode(icon: Icons.loop_rounded, label: 'Reuse'),
          Expanded(child: Divider(color: colors.borderStrong)),
          const _VisualNode(icon: Icons.build_circle_outlined, label: 'Build'),
        ],
      ),
    );
  }
}

class _VisualNode extends StatelessWidget {
  const _VisualNode({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: colors.primary, size: 22),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          style: TextStyle(
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
