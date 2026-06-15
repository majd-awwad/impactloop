import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import 'dark_auth_branding_panel.dart';

enum DarkAuthShellLayout { mobile, webSplit }

class DarkAuthShell extends StatelessWidget {
  const DarkAuthShell({
    super.key,
    required this.layout,
    required this.formContent,
  });

  final DarkAuthShellLayout layout;
  final Widget formContent;

  @override
  Widget build(BuildContext context) {
    if (layout == DarkAuthShellLayout.webSplit) {
      return Scaffold(
        backgroundColor: AuthDarkColors.background,
        body: Row(
          children: [
            const Expanded(
              flex: AppSpacing.authBrandingPanelFlex,
              child: DarkAuthBrandingPanel(
                variant: DarkAuthBrandingVariant.full,
              ),
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
      backgroundColor: AuthDarkColors.background,
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
              child: const DarkAuthBrandingPanel(
                variant: DarkAuthBrandingVariant.compact,
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
    return ColoredBox(
      color: AuthDarkColors.background,
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
