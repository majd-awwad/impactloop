import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../widgets/coming_soon_card.dart';
import '../widgets/empty_activity_card.dart';
import '../widgets/home_action_card.dart';
import '../widgets/home_section_header.dart';
import '../widgets/learning_spotlight_section.dart';
import '../widgets/suggested_materials_section.dart';

class LearnerHomePage extends ConsumerWidget {
  const LearnerHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final displayName = user?.displayName.trim();
    final greeting = displayName == null || displayName.isEmpty
        ? 'Welcome back'
        : 'Welcome back, $displayName';

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _HomeTopBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1280),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _WelcomeHero(greeting: greeting),
                        const SizedBox(height: AppSpacing.xl),
                        _QuickActionsSection(),
                        const SizedBox(height: AppSpacing.xl),
                        const SuggestedMaterialsSection(),
                        const SizedBox(height: AppSpacing.xl),
                        const LearningSpotlightSection(),
                        const SizedBox(height: AppSpacing.xl),
                        _FutureActivitySection(),
                        const SizedBox(height: AppSpacing.xl),
                        _FutureToolsSection(),
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

class _HomeTopBar extends ConsumerWidget {
  const _HomeTopBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const EntryNavBar(
      showSignIn: false,
      showCreateAccount: false,
      homeRoute: '/home',
    );
  }
}

class _WelcomeHero extends StatelessWidget {
  const _WelcomeHero({required this.greeting});

  final String greeting;

  List<Widget> _heroActionButtons(
    BuildContext context, {
    required bool compact,
  }) {
    final palette = MaterialsUiPalette.of(context);

    return [
      _HeroActionButton(
        compact: compact,
        maxWidth: 352,
        child: FilledButton.icon(
          onPressed: () => context.go('/materials'),
          style: FilledButton.styleFrom(
            backgroundColor: palette.mint,
            foregroundColor: palette.ctaForeground,
            minimumSize: const Size(0, 52),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          ),
          icon: const Icon(Icons.search_rounded),
          label: const Text('Browse Materials'),
        ),
      ),
      _HeroActionButton(
        compact: compact,
        maxWidth: 300,
        child: OutlinedButton.icon(
          onPressed: () => context.go('/learning'),
          style: OutlinedButton.styleFrom(
            foregroundColor: palette.textPrimary,
            backgroundColor: palette.cardSurface.withValues(alpha: 0.7),
            side: BorderSide(color: palette.borderStrong),
            minimumSize: const Size(0, 52),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
          ),
          icon: const Icon(Icons.school_outlined),
          label: const Text('Explore Learning Hub'),
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 700;
        final heroPadding = compact ? AppSpacing.lg : AppSpacing.xl;

        return Container(
          padding: EdgeInsetsDirectional.all(heroPadding),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
              colors: isDark
                  ? [
                      palette.heroStart,
                      Color.lerp(palette.heroMid, palette.mint, 0.08)!,
                      Color.lerp(palette.heroEnd, palette.borderStrong, 0.2)!,
                    ]
                  : [
                      palette.cardSurface,
                      palette.heroMid,
                      Color.lerp(palette.heroEnd, palette.mint, 0.08)!,
                    ],
            ),
            borderRadius: AppRadius.xlAll,
            border: Border.all(
              color: isDark
                  ? palette.borderStrong.withValues(alpha: 0.72)
                  : palette.borderStrong,
              width: isDark ? 1 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow.withValues(
                  alpha: isDark ? 0.95 : 0.7,
                ),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Builder(
            builder: (context) {
              final wide = constraints.maxWidth >= 760;
              final copy = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    greeting,
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: palette.mint, letterSpacing: 0),
                    textAlign: TextAlign.start,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Ready to build something today?',
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w800,
                      height: 1.08,
                      letterSpacing: 0,
                    ),
                    textAlign: TextAlign.start,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Find reusable materials, explore project ideas, and manage reservation and delivery updates from one place.',
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: palette.textSecondary, letterSpacing: 0),
                    textAlign: TextAlign.start,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              );

              if (!wide) {
                final mobileButtons = _heroActionButtons(
                  context,
                  compact: true,
                );

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    copy,
                    const SizedBox(height: AppSpacing.lg),
                    mobileButtons[0],
                    const SizedBox(height: AppSpacing.sm),
                    mobileButtons[1],
                  ],
                );
              }

              final desktopActions = Wrap(
                alignment: WrapAlignment.end,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: _heroActionButtons(context, compact: false),
              );

              return Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(child: copy),
                  const SizedBox(width: AppSpacing.xl),
                  Flexible(
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: desktopActions,
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _HeroActionButton extends StatelessWidget {
  const _HeroActionButton({
    required this.child,
    required this.compact,
    required this.maxWidth,
  });

  final Widget child;
  final bool compact;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return SizedBox(width: double.infinity, height: 52, child: child);
    }

    return SizedBox(width: maxWidth, height: 52, child: child);
  }
}

class _QuickActionsSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final isAdmin = userHasAdminRole(user);
    final hasSupplierRole = userHasSupplierRole(user);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const HomeSectionHeader(
          title: 'Quick actions',
          subtitle: 'Start with the areas that are available today.',
        ),
        const SizedBox(height: AppSpacing.md),
        _ResponsiveGrid(
          minItemWidth: 280,
          itemHeight: 224,
          children: [
            if (isAdmin)
              HomeActionCard(
                icon: Icons.admin_panel_settings_outlined,
                title: 'Open Admin Portal',
                description:
                    'Review platform activity, pending actions, and impact metrics.',
                onPressed: () => context.go(adminPortalRoute),
              ),
            HomeActionCard(
              icon: Icons.inventory_2_outlined,
              title: 'Find reusable materials',
              description: 'Search currently listed materials from suppliers.',
              onPressed: () => context.go('/materials'),
            ),
            HomeActionCard(
              icon: Icons.school_outlined,
              title: 'Explore learning projects',
              description: 'Open the Learning Hub project catalog.',
              onPressed: () => context.go('/learning'),
            ),
            HomeActionCard(
              icon: Icons.assignment_turned_in_outlined,
              title: 'My Reservations',
              description:
                  'Track supplier responses and pickup windows for requested materials.',
              onPressed: () => context.go(learnerReservationsRoute),
            ),
            HomeActionCard(
              icon: Icons.storefront_outlined,
              title: 'Become a supplier',
              description: hasSupplierRole
                  ? 'Update your supplier profile and pickup details.'
                  : 'Start the supplier setup path for your account.',
              badge: hasSupplierRole ? 'Profile' : null,
              onPressed: () => context.go(supplierEntryRouteForUser(user)),
            ),
          ],
        ),
      ],
    );
  }
}

class _FutureActivitySection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const HomeSectionHeader(
          title: 'Activity updates',
          subtitle:
              'Reservation and delivery status live in My Reservations. Saved projects are not available yet.',
        ),
        const SizedBox(height: AppSpacing.md),
        _ResponsiveGrid(
          minItemWidth: 280,
          itemHeight: 216,
          children: [
            HomeActionCard(
              icon: Icons.local_shipping_outlined,
              title: 'Track reservations and delivery',
              description:
                  'View pickup, delivery, and reservation updates from My Reservations.',
              badge: 'Open My Reservations',
              onPressed: () => context.go(learnerReservationsRoute),
            ),
            ComingSoonCard(
              icon: Icons.bookmark_border_rounded,
              title: 'Saved projects',
              description:
                  'Projects you save for later will appear here after saved projects are added.',
              onTap: () => showInfoSnackBar(
                context,
                'This feature will be connected later.',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _FutureToolsSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const HomeSectionHeader(
          title: 'Coming later',
          subtitle:
              'Impact and AI helper features are planned but not available yet.',
        ),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 820;
            const impact = EmptyActivityCard(
              icon: Icons.eco_outlined,
              title: 'Impact snapshot',
              description:
                  'Your reuse impact will appear here after you complete reservations and projects.',
            );
            final assistant = ComingSoonCard(
              icon: Icons.auto_awesome_outlined,
              title: 'AI material helper',
              description:
                  'Later, ImpactLoop can suggest materials for your project based on cost, availability, and location.',
              onTap: () => showInfoSnackBar(
                context,
                'This feature will be connected later.',
              ),
            );

            if (!wide) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  impact,
                  const SizedBox(height: AppSpacing.md),
                  assistant,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(child: impact),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: assistant),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ResponsiveGrid extends StatelessWidget {
  const _ResponsiveGrid({
    required this.children,
    this.minItemWidth = 280,
    this.itemHeight,
  });

  final List<Widget> children;
  final double minItemWidth;
  final double? itemHeight;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final rawColumns = (width / minItemWidth).floor();
        final columns = rawColumns.clamp(1, 4).toInt();
        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;

        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: children.map((child) {
            return SizedBox(width: itemWidth, height: itemHeight, child: child);
          }).toList(),
        );
      },
    );
  }
}
