import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/widgets/entry_nav_bar.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../../shared/widgets/app_back_action.dart';
import '../../l10n/project_help_sessions_l10n.dart';

class HelpSessionDetailShell extends StatelessWidget {
  const HelpSessionDetailShell({
    super.key,
    required this.homeRoute,
    required this.listTitle,
    required this.backRoute,
    this.buildRoute,
    this.buildRouteLabel,
    required this.isLoading,
    required this.isError,
    required this.onRetry,
    this.child,
  });

  final String homeRoute;
  final String listTitle;
  final String backRoute;
  final String? buildRoute;
  final String? buildRouteLabel;
  final bool isLoading;
  final bool isError;
  final VoidCallback onRetry;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isWide = MediaQuery.sizeOf(context).width >= 960;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: homeRoute,
              phoneTitle: listTitle,
            ),
            Expanded(
              child: isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : isError
                      ? Center(
                          child: TextButton(
                            onPressed: onRetry,
                            child: Text(
                              ProjectHelpSessionsL10n.retry.resolve(context),
                            ),
                          ),
                        )
                      : Center(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: isWide ? 1080 : 920,
                            ),
                            child: SingleChildScrollView(
                              padding: const EdgeInsetsDirectional.fromSTEB(
                                AppSpacing.md,
                                AppSpacing.xs,
                                AppSpacing.md,
                                AppSpacing.lg,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _TopNavRow(
                                    backRoute: backRoute,
                                    buildRoute: buildRoute,
                                    buildRouteLabel: buildRouteLabel,
                                  ),
                                  child ?? const SizedBox.shrink(),
                                ],
                              ),
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

class _TopNavRow extends StatelessWidget {
  const _TopNavRow({
    required this.backRoute,
    this.buildRoute,
    this.buildRouteLabel,
  });

  final String backRoute;
  final String? buildRoute;
  final String? buildRouteLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.xs,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          AppBackAction(fallbackLocation: backRoute),
          if (buildRoute != null && buildRouteLabel != null)
            TextButton(
              onPressed: () => context.go(buildRoute!),
              child: Text(buildRouteLabel!),
            ),
        ],
      ),
    );
  }
}

class HelpSessionDetailLayout extends StatelessWidget {
  const HelpSessionDetailLayout({
    super.key,
    required this.main,
    required this.sidebar,
  });

  final Widget main;
  final Widget sidebar;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 960;
    if (!isWide) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          main,
          const SizedBox(height: AppSpacing.md),
          sidebar,
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 3, child: main),
        const SizedBox(width: AppSpacing.md),
        Expanded(flex: 2, child: sidebar),
      ],
    );
  }
}
