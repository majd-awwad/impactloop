import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import 'auth_entry_branding_panel.dart';

class DarkAuthShell extends StatelessWidget {
  const DarkAuthShell({
    super.key,
    required this.formContent,
    required this.brandingVariant,
    this.showSignIn = true,
    this.showCreateAccount = true,
    this.formMaxWidth = AppSpacing.authFormMaxWidth,
  });

  final Widget formContent;
  final AuthEntryBrandingVariant brandingVariant;
  final bool showSignIn;
  final bool showCreateAccount;
  final double formMaxWidth;

  static const _splitBreakpoint = 960.0;

  @override
  Widget build(BuildContext context) {
    final viewportSize = MediaQuery.sizeOf(context);
    final isMobile = viewportSize.width < AppSpacing.authLayoutBreakpoint;
    final useSplitLayout =
        viewportSize.width >= _splitBreakpoint && viewportSize.height >= 760;
    final useCompactSpacing = viewportSize.height < 820;

    return Scaffold(
      backgroundColor: AuthDarkColors.landingBackground,
      body: Container(
        decoration: const BoxDecoration(
          gradient: AuthDarkDecorations.pageGradient,
        ),
        child: Stack(
          children: [
            ...AuthDarkDecorations.backgroundBlobs(
              compact: viewportSize.width < 900,
            ),
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
}

class _SplitBody extends StatelessWidget {
  const _SplitBody({
    required this.child,
    required this.formMaxWidth,
    required this.brandingVariant,
    required this.compactSpacing,
  });

  final Widget child;
  final double formMaxWidth;
  final AuthEntryBrandingVariant brandingVariant;
  final bool compactSpacing;

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
                flex: 11,
                child: AuthEntryBrandingPanel(
                  variant: brandingVariant,
                  compact: compactSpacing,
                ),
              ),
              SizedBox(width: compactSpacing ? AppSpacing.xl : AppSpacing.xxl),
              Expanded(
                flex: 9,
                child: _FormStage(
                  formMaxWidth: formMaxWidth,
                  compact: compactSpacing,
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
  });

  final double formMaxWidth;
  final Widget child;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg),
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.78),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: AuthDarkColors.border),
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
