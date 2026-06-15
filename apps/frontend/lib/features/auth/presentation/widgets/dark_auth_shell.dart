import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
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
    final useSplitLayout = viewportSize.width >= _splitBreakpoint;
    final useCompactSpacing = viewportSize.height < 820;

    return Scaffold(
      backgroundColor: AuthDarkColors.landingBackground,
      body: SafeArea(
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
                      child: formContent,
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
        compactSpacing ? AppSpacing.md : AppSpacing.lg,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1140),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AuthEntryBrandingPanel(variant: brandingVariant),
              ),
              SizedBox(width: compactSpacing ? AppSpacing.xl : AppSpacing.xxl),
              Expanded(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: formMaxWidth),
                    child: child,
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

class _ScrollBody extends StatelessWidget {
  const _ScrollBody({
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
        compactSpacing ? AppSpacing.lg : AppSpacing.xl,
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
              ),
              SizedBox(height: compactSpacing ? AppSpacing.lg : AppSpacing.xl),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
