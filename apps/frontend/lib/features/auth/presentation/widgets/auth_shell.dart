import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_spacing.dart';
import 'auth_branding_panel.dart';

enum AuthShellLayout { mobile, webSplit }

class AuthShell extends StatelessWidget {
  const AuthShell({super.key, required this.layout, required this.formContent});

  final AuthShellLayout layout;
  final Widget formContent;

  @override
  Widget build(BuildContext context) {
    if (layout == AuthShellLayout.webSplit) {
      return Scaffold(
        backgroundColor: AppColors.background,
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
      backgroundColor: AppColors.background,
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
    return ColoredBox(
      color: AppColors.background,
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
