import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../data/models/supplier_dashboard.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierDashboardHero extends StatelessWidget {
  const SupplierDashboardHero({
    super.key,
    required this.supplier,
    required this.compact,
  });

  final SupplierDashboardProfile supplier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final name = supplier.publicName.trim().isNotEmpty
        ? supplier.publicName.trim()
        : context.s.supplierFallbackName;

    final content = _HeroContent(name: name);

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 252),
      padding: EdgeInsets.all(compact ? AppSpacing.lg : AppSpacing.xl),
      decoration: context.supplierDecorations.heroPanel,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final showIllustration = constraints.maxWidth >= 620;
          final contentWidth = showIllustration
              ? constraints.maxWidth * 0.64
              : constraints.maxWidth;

          return Stack(
            alignment: AlignmentDirectional.center,
            children: [
              SizedBox(width: contentWidth, child: content),
              if (showIllustration)
                PositionedDirectional(
                  end: 0,
                  bottom: 0,
                  child: ExcludeSemantics(
                    child: _SupplierReuseIllustration(
                      size: constraints.maxWidth >= 900 ? 220 : 170,
                      accent: colors.accent,
                      background: colors.backgroundElevated,
                      border: colors.border,
                      muted: colors.textMuted,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _HeroContent extends StatelessWidget {
  const _HeroContent({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.s.navOverview,
          style: context.supplierLabel().copyWith(
            color: colors.accent,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          context.s.dashboardWelcomeName(name),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: context.supplierTitle().copyWith(
            fontSize: 25,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          context.s.dashboardHeroSubtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _HeroChip(
              label: context.s.heroChipSupplierActive,
              icon: Icons.verified_outlined,
            ),
            _HeroChip(
              label: context.s.heroChipPickupEnabled,
              icon: Icons.local_shipping_outlined,
            ),
            _HeroChip(
              label: context.s.heroChipNisListings,
              icon: Icons.payments_outlined,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            FilledButton.icon(
              onPressed: () => context.push('/supplier/materials/new'),
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
              ),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: Text(context.s.addMaterial),
            ),
            OutlinedButton.icon(
              onPressed: () => context.push('/supplier/reservations'),
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.textPrimary,
                side: BorderSide(
                  color: colors.borderFocused.withValues(alpha: 0.55),
                ),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
              ),
              icon: const Icon(Icons.inbox_outlined, size: 18),
              label: Text(context.s.viewRequests),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: context.supplierDecorations.badge(
        background: colors.chipUnselected.withValues(alpha: 0.85),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.accent),
          const SizedBox(width: 6),
          Text(label, style: context.supplierChip()),
        ],
      ),
    );
  }
}

class _SupplierReuseIllustration extends StatelessWidget {
  const _SupplierReuseIllustration({
    required this.size,
    required this.accent,
    required this.background,
    required this.border,
    required this.muted,
  });

  final double size;
  final Color accent;
  final Color background;
  final Color border;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size * 0.82,
      child: Stack(
        alignment: AlignmentDirectional.bottomCenter,
        children: [
          Positioned.fill(
            child: Align(
              alignment: AlignmentDirectional.topCenter,
              child: Container(
                width: size * 0.9,
                height: size * 0.66,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.07),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
          PositionedDirectional(
            start: size * 0.1,
            bottom: size * 0.06,
            child: Transform.rotate(
              angle: -0.10,
              child: Container(
                width: size * 0.36,
                height: size * 0.2,
                decoration: BoxDecoration(
                  color: background,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: border),
                ),
              ),
            ),
          ),
          PositionedDirectional(
            start: size * 0.31,
            bottom: size * 0.12,
            child: Container(
              width: size * 0.42,
              height: size * 0.52,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: accent.withValues(alpha: 0.8)),
              ),
              child: Icon(
                Icons.recycling_rounded,
                color: Theme.of(context).colorScheme.onPrimary,
                size: size * 0.22,
              ),
            ),
          ),
          PositionedDirectional(
            start: size * 0.27,
            bottom: size * 0.58,
            child: Container(
              width: size * 0.5,
              height: size * 0.11,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          PositionedDirectional(
            end: size * 0.02,
            bottom: size * 0.08,
            child: Transform.rotate(
              angle: 0.22,
              child: Icon(
                Icons.handyman_outlined,
                color: muted,
                size: size * 0.26,
              ),
            ),
          ),
          PositionedDirectional(
            end: size * 0.16,
            bottom: 0,
            child: Container(
              width: size * 0.25,
              height: size * 0.19,
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: border),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
