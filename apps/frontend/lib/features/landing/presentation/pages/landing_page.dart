import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/landing_colors.dart';
import '../widgets/landing_feature_cards.dart';
import '../widgets/landing_featured_projects.dart';
import '../widgets/landing_footer.dart';
import '../widgets/landing_hero_section.dart';
import '../widgets/landing_nav_bar.dart';

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LandingNavBar(
              onSignIn: () => context.go('/login'),
              onCreateAccount: () => context.go('/register'),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.lg,
                  AppSpacing.xl,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1140),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const LandingHeroSection(),
                        const SizedBox(height: AppSpacing.xxl),
                        const LandingFeatureCards(),
                        const SizedBox(height: AppSpacing.xxl),
                        const LandingFeaturedProjects(),
                        const LandingFooter(),
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
