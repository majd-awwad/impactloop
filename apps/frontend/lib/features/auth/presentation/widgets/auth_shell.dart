import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import 'auth_entry_branding_panel.dart';
import 'auth_branding_panel.dart';
import 'auth_ui_palette.dart';

enum AuthShellLayout { mobile, webSplit }

enum AuthFormStageTone { framed, subtle }

class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    this.layout,
    required this.formContent,
    this.brandingVariant = AuthEntryBrandingVariant.login,
    this.showSignIn = true,
    this.showCreateAccount = true,
    this.formMaxWidth = AppSpacing.authFormMaxWidth,
    this.formStageTone = AuthFormStageTone.framed,
    this.splitBrandingFlex = 11,
    this.splitFormFlex = 9,
  });

  final AuthShellLayout? layout;
  final Widget formContent;
  final AuthEntryBrandingVariant brandingVariant;
  final bool showSignIn;
  final bool showCreateAccount;
  final double formMaxWidth;
  final AuthFormStageTone formStageTone;
  final int splitBrandingFlex;
  final int splitFormFlex;

  static const _splitBreakpoint = 960.0;

  @override
  Widget build(BuildContext context) {
    if (layout != null) {
      return _LegacyAuthShell(layout: layout!, formContent: formContent);
    }

    final viewportSize = MediaQuery.sizeOf(context);
    final isMobile = viewportSize.width < AppSpacing.authLayoutBreakpoint;
    final useSplitLayout =
        viewportSize.width >= _splitBreakpoint && viewportSize.height >= 760;
    final useCompactSpacing = viewportSize.height < 820;
    final colors = AuthUiPalette.of(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: Container(
        decoration: BoxDecoration(
          color: colors.background,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colors.background,
              colors.surfaceElevated,
              colors.background,
            ],
            stops: const [0, 0.5, 1],
          ),
        ),
        child: Stack(
          children: [
            ..._backgroundBlobs(context, compact: viewportSize.width < 900),
            SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  EntryNavBar(
                    showSignIn: showSignIn,
                    showCreateAccount: showCreateAccount,
                  ),
                  Expanded(
                    child: useSplitLayout
                        ? _SplitBody(
                            brandingVariant: brandingVariant,
                            formMaxWidth: formMaxWidth,
                            compactSpacing: useCompactSpacing,
                            formStageTone: formStageTone,
                            brandingFlex: splitBrandingFlex,
                            formFlex: splitFormFlex,
                            child: formContent,
                          )
                        : _ScrollBody(
                            brandingVariant: brandingVariant,
                            formMaxWidth: formMaxWidth,
                            compactSpacing: useCompactSpacing,
                            mobile: isMobile,
                            child: formContent,
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _backgroundBlobs(BuildContext context, {required bool compact}) {
    final colors = AuthUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = compact ? 96.0 : 180.0;
    final alpha = isDark ? 0.10 : 0.12;

    return [
      Positioned(
        top: compact ? -30 : -60,
        right: compact ? -20 : -40,
        child: _Blob(
          size: size,
          color: colors.primary.withValues(alpha: alpha),
        ),
      ),
      Positioned(
        bottom: compact ? 40 : 80,
        left: compact ? -40 : -80,
        child: _Blob(
          size: size * 0.85,
          color: colors.surfaceElevated.withValues(alpha: isDark ? 0.18 : 0.5),
        ),
      ),
      Positioned(
        top: compact ? 100 : 180,
        left: compact ? 40 : 80,
        child: _Blob(
          size: size * 0.55,
          color: colors.primary.withValues(alpha: alpha * 0.8),
        ),
      ),
    ];
  }
}

class _LegacyAuthShell extends StatelessWidget {
  const _LegacyAuthShell({required this.layout, required this.formContent});

  final AuthShellLayout layout;
  final Widget formContent;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    if (layout == AuthShellLayout.webSplit) {
      return Scaffold(
        backgroundColor: colors.background,
        body: Row(
          children: [
            const Expanded(
              flex: AppSpacing.authBrandingPanelFlex,
              child: AuthBrandingPanel(variant: AuthBrandingVariant.full),
            ),
            Expanded(
              flex: AppSpacing.authFormPanelFlex,
              child: _FormPanel(child: formContent),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: AppSpacing.authMobileHeroMinHeight,
                maxHeight:
                    MediaQuery.sizeOf(context).height *
                    AppSpacing.authMobileHeroMaxHeightFraction,
              ),
              child: const AuthBrandingPanel(
                variant: AuthBrandingVariant.compact,
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.xl,
                ),
                child: formContent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FormPanel extends StatelessWidget {
  const _FormPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return ColoredBox(
      color: colors.background,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xl,
          vertical: AppSpacing.xl,
        ),
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppSpacing.authFormMaxWidth,
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _SplitBody extends StatelessWidget {
  const _SplitBody({
    required this.child,
    required this.formMaxWidth,
    required this.brandingVariant,
    required this.compactSpacing,
    required this.formStageTone,
    required this.brandingFlex,
    required this.formFlex,
  });

  final Widget child;
  final double formMaxWidth;
  final AuthEntryBrandingVariant brandingVariant;
  final bool compactSpacing;
  final AuthFormStageTone formStageTone;
  final int brandingFlex;
  final int formFlex;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        compactSpacing ? AppSpacing.lg : AppSpacing.xl,
        AppSpacing.lg,
        compactSpacing ? AppSpacing.md : AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1200),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: brandingFlex,
                child: AuthEntryBrandingPanel(
                  variant: brandingVariant,
                  compact: compactSpacing,
                ),
              ),
              SizedBox(width: compactSpacing ? AppSpacing.xl : AppSpacing.xxl),
              Expanded(
                flex: formFlex,
                child: _FormStage(
                  formMaxWidth: formMaxWidth,
                  compact: compactSpacing,
                  tone: formStageTone,
                  child: child,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScrollBody extends StatelessWidget {
  const _ScrollBody({
    required this.child,
    required this.formMaxWidth,
    required this.brandingVariant,
    required this.compactSpacing,
    required this.mobile,
  });

  final Widget child;
  final double formMaxWidth;
  final AuthEntryBrandingVariant brandingVariant;
  final bool compactSpacing;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        mobile
            ? AppSpacing.md
            : compactSpacing
            ? AppSpacing.lg
            : AppSpacing.xl,
        AppSpacing.lg,
        mobile
            ? AppSpacing.lg
            : compactSpacing
            ? AppSpacing.lg
            : AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: formMaxWidth),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthEntryBrandingPanel(
                variant: brandingVariant,
                compact: true,
                minimal: mobile,
              ),
              SizedBox(
                height: mobile
                    ? AppSpacing.md
                    : compactSpacing
                    ? AppSpacing.lg
                    : AppSpacing.xl,
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class _FormStage extends StatelessWidget {
  const _FormStage({
    required this.formMaxWidth,
    required this.child,
    this.compact = false,
    this.tone = AuthFormStageTone.framed,
  });

  final double formMaxWidth;
  final Widget child;
  final bool compact;
  final AuthFormStageTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    final subtle = tone == AuthFormStageTone.subtle;

    return Container(
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      decoration: BoxDecoration(
        color: subtle
            ? colors.surfaceElevated.withValues(alpha: 0.72)
            : colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: subtle ? 0.7 : 1),
        ),
      ),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: formMaxWidth),
          child: child,
        ),
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
