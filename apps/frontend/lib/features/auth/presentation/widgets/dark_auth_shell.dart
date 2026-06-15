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
    final useSplitLayout = MediaQuery.sizeOf(context).width >= _splitBreakpoint;

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
                      child: formContent,
                    )
                  : _ScrollBody(
                      brandingVariant: brandingVariant,
                      formMaxWidth: formMaxWidth,
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
  });

  final Widget child;
  final double formMaxWidth;
  final AuthEntryBrandingVariant brandingVariant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1140),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: AuthEntryBrandingPanel(variant: brandingVariant),
                ),
              ),
              const SizedBox(width: AppSpacing.xxl),
              Expanded(
                child: SingleChildScrollView(
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: formMaxWidth),
                      child: child,
                    ),
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
  });

  final Widget child;
  final double formMaxWidth;
  final AuthEntryBrandingVariant brandingVariant;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
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
              const SizedBox(height: AppSpacing.xl),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
