import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/admin_dashboard_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';

class AdminKpiCard extends StatelessWidget {
  const AdminKpiCard({
    super.key,
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.accent,
    this.badge,
    this.onTap,
    this.helperMaxLines = 2,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color accent;
  final String? badge;
  final VoidCallback? onTap;
  final int helperMaxLines;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final displayValue = value.trim().isEmpty ? '0' : value.trim();
    final displayHelper = helper.trim().isEmpty
        ? 'No additional details'
        : helper.trim();

    final card = Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: palette.isDark ? 12 : 14,
            offset: Offset(0, palette.isDark ? 4 : 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Container(
          decoration: BoxDecoration(
            color: palette.cardBackground,
            border: Border.all(color: palette.cardBorder),
          ),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ColoredBox(color: accent, child: const SizedBox(width: 4)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      14,
                      12,
                      12,
                      12,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: accent.withValues(
                                  alpha: palette.isDark ? 0.18 : 0.12,
                                ),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: accent.withValues(alpha: 0.22),
                                ),
                              ),
                              child: Icon(icon, color: accent, size: 19),
                            ),
                            const Spacer(),
                            if (onTap != null)
                              Icon(
                                Icons.arrow_forward,
                                size: 16,
                                color: palette.textSecondary,
                              ),
                            if (badge != null) ...[
                              if (onTap != null) const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsetsDirectional.symmetric(
                                  horizontal: 7,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: accent.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(badge!, style: _badgeStyle(accent)),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          displayValue,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AdminTypography.kpiValue(palette),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AdminTypography.kpiLabel(palette),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          displayHelper,
                          maxLines: helperMaxLines,
                          overflow: TextOverflow.ellipsis,
                          style: AdminTypography.kpiHelper(palette),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (onTap == null) {
      return card;
    }

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          hoverColor: accent.withValues(alpha: palette.isDark ? 0.08 : 0.05),
          splashColor: accent.withValues(alpha: 0.1),
          child: card,
        ),
      ),
    );
  }

  static TextStyle _badgeStyle(Color accent) =>
      TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent);
}

/// Builds the 8 platform metric cards from live dashboard data.
class AdminKpiGrid extends StatelessWidget {
  const AdminKpiGrid({super.key, required this.dashboard});

  final AdminDashboardResponse dashboard;

  static String _fmtInt(int value) => value.toString();

  static String _fmtCo2Kg(double kg) {
    if (!kg.isFinite || kg < 0) return '0 kg CO₂e';
    final rounded = (kg * 10).roundToDouble() / 10;
    return '$rounded kg CO₂e';
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1100
        ? 4
        : width >= 560
        ? 2
        : 1;
    const spacing = 10.0;

    final cards = <AdminKpiCard>[
      AdminKpiCard(
        label: l.statUsers,
        value: _fmtInt(dashboard.summary.totalUsers),
        helper: l.hintUsers,
        icon: Icons.people_outline,
        accent: palette.blue,
        onTap: () => context.push('/admin/users'),
      ),
      AdminKpiCard(
        label: l.statSuppliers,
        value: _fmtInt(dashboard.summary.totalSuppliers),
        helper: l.hintSuppliers,
        icon: Icons.storefront_outlined,
        accent: palette.amber,
        onTap: () => context.push('/admin/users?role=SUPPLIER'),
      ),
      AdminKpiCard(
        label: l.statMaterials,
        value: _fmtInt(dashboard.summary.totalMaterials),
        helper: l.hintMaterials,
        icon: Icons.inventory_2_outlined,
        accent: palette.primaryTeal,
        onTap: () => context.push('/admin/materials'),
      ),
      AdminKpiCard(
        label: l.statAvailableMaterials,
        value: _fmtInt(dashboard.summary.availableMaterials),
        helper: l.hintAvailableMaterials,
        icon: Icons.check_circle_outline,
        accent: palette.green,
        onTap: () => context.push('/admin/materials?status=AVAILABLE'),
      ),
      AdminKpiCard(
        label: l.statPendingApprovals,
        value: _fmtInt(dashboard.summary.pendingApprovals),
        helper: l.hintPendingApprovals,
        icon: Icons.fact_check_outlined,
        accent: palette.amber,
        badge: dashboard.summary.pendingApprovals > 0
            ? l.t('Pending', 'معلّق')
            : null,
        onTap: () => context.push('/admin/approvals?status=PENDING'),
      ),
      AdminKpiCard(
        label: l.statActiveInvitations,
        value: _fmtInt(dashboard.summary.activeInvitations),
        helper: l.hintActiveInvitations,
        icon: Icons.mail_outline,
        accent: palette.blue,
        onTap: () => context.push('/admin/invitations?status=PENDING'),
      ),
      AdminKpiCard(
        label: l.statCompletedReuse,
        value: _fmtInt(dashboard.summary.completedReuse),
        helper: l.hintCompletedReuse,
        icon: Icons.autorenew,
        accent: palette.green,
        onTap: () => context.push('/admin/materials?status=REUSED'),
      ),
      AdminKpiCard(
        label: l.estimatedCo2Avoided,
        value: _fmtCo2Kg(dashboard.impact.estimatedCo2Kg),
        helper: l.estimatedCo2ShortHelper,
        icon: Icons.eco_outlined,
        accent: palette.brightTeal,
        badge: l.estimatedBadge,
        helperMaxLines: 1,
        onTap: () => context.push('/admin/impact'),
      ),
    ];

    assert(cards.length == 8);

    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += columns) {
      final rowCards = cards.skip(i).take(columns).toList();
      rows.add(
        Padding(
          padding: EdgeInsets.only(
            bottom: i + columns < cards.length ? spacing : 0,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var j = 0; j < columns; j++) ...[
                if (j > 0) SizedBox(width: spacing),
                Expanded(
                  child: j < rowCards.length
                      ? rowCards[j]
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }
}

/// Explicit admin text styles — avoids null slots in global [TextTheme].
class AdminTypography {
  const AdminTypography._();

  static TextStyle pageTitle(AdminPalette palette) => TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w800,
    color: palette.textPrimary,
    height: 1.2,
  );

  static TextStyle pageSubtitle(AdminPalette palette) => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: palette.textSecondary,
    height: 1.35,
  );

  static TextStyle sectionTitle(AdminPalette palette) => TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w800,
    color: palette.textPrimary,
  );

  static TextStyle kpiValue(AdminPalette palette) => TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    height: 1.1,
    color: palette.textPrimary,
    letterSpacing: -0.3,
  );

  static TextStyle kpiLabel(AdminPalette palette) => TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    height: 1.2,
    color: palette.textPrimary,
  );

  static TextStyle kpiHelper(AdminPalette palette) => TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.3,
    color: palette.textSecondary,
  );

  static TextStyle sidebarBrand(AdminPalette palette) => TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w800,
    color: palette.sidebarTextPrimary,
  );

  static TextStyle sidebarSection(AdminPalette palette) => TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: palette.sidebarTextSecondary,
    letterSpacing: 0.2,
  );

  static TextStyle sidebarNav(AdminPalette palette, {required bool active}) =>
      TextStyle(
        fontSize: 14,
        fontWeight: active ? FontWeight.w600 : FontWeight.w500,
        color: active
            ? palette.sidebarTextPrimary
            : palette.sidebarTextSecondary,
      );
}
