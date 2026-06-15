import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/widgets/hero_workshop_visual.dart';

class LandingHeroSection extends StatelessWidget {
  const LandingHeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    final useSplitLayout = MediaQuery.sizeOf(context).width >= 960;

    if (useSplitLayout) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: _HeroContent(onSignIn: () => context.go('/login'))),
          const SizedBox(width: AppSpacing.xxl),
          const Expanded(child: HeroWorkshopVisual()),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeroContent(onSignIn: () => context.go('/login')),
        const SizedBox(height: AppSpacing.xl),
        const HeroWorkshopVisual(),
      ],
    );
  }
}

class _HeroContent extends StatelessWidget {
  const _HeroContent({required this.onSignIn});

  final VoidCallback onSignIn;

  static const _avatarColors = [
    Color(0xFF2DD4BF),
    Color(0xFF14B8A6),
    Color(0xFF0D9488),
    Color(0xFF115E59),
  ];

  @override
  Widget build(BuildContext context) {
    final stackedButtons = MediaQuery.sizeOf(context).width < 480;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: AuthDarkColors.chipUnselected,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: AuthDarkColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.eco, size: 16, color: AuthDarkColors.accent),
              const SizedBox(width: AppSpacing.xs),
              Text(
                'Build a better future',
                style: AuthDarkTextStyles.chip(context).copyWith(
                  color: AuthDarkColors.accent,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        RichText(
          text: TextSpan(
            style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
              fontSize: MediaQuery.sizeOf(context).width >= 960 ? 48 : 36,
            ),
            children: const [
              TextSpan(text: 'Learn. '),
              TextSpan(
                text: 'Reuse.',
                style: TextStyle(color: AuthDarkColors.accent),
              ),
              TextSpan(text: ' Build.'),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Discover reusable materials, share surplus resources, '
          'and build projects with less waste.',
          style: AuthDarkTextStyles.brandingSubtitle(context),
        ),
        const SizedBox(height: AppSpacing.xl),
        if (stackedButtons) ...[
          _LandingPrimaryCta(
            label: 'Create account',
            icon: Icons.person_add_alt_1,
            onPressed: () => context.go('/register'),
          ),
          const SizedBox(height: AppSpacing.sm),
          _LandingOutlinedCta(
            label: 'Sign in',
            icon: Icons.login,
            onPressed: onSignIn,
          ),
        ] else
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            children: [
              _LandingPrimaryCta(
                label: 'Create account',
                icon: Icons.person_add_alt_1,
                onPressed: () => context.go('/register'),
              ),
              _LandingOutlinedCta(
                label: 'Sign in',
                icon: Icons.login,
                onPressed: onSignIn,
              ),
            ],
          ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            SizedBox(
              width: 88,
              height: 36,
              child: Stack(
                children: [
                  for (var i = 0; i < 4; i++)
                    Positioned(
                      left: i * 22.0,
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: _avatarColors[i],
                        child: Icon(
                          Icons.person,
                          size: 18,
                          color: AuthDarkColors.textOnAccent.withValues(
                            alpha: 0.85,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'Join a growing community of students, makers, and changemakers.',
                style: AuthDarkTextStyles.body(context),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _LandingPrimaryCta extends StatelessWidget {
  const _LandingPrimaryCta({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.mdAll,
        boxShadow: [
          BoxShadow(
            color: AuthDarkColors.accent.withValues(alpha: 0.35),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: AuthDarkColors.accent,
          foregroundColor: AuthDarkColors.textOnAccent,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(label),
      ),
    );
  }
}

class _LandingOutlinedCta extends StatelessWidget {
  const _LandingOutlinedCta({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: AuthDarkColors.textPrimary,
        side: const BorderSide(color: AuthDarkColors.border),
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      label: Text(label),
    );
  }
}
