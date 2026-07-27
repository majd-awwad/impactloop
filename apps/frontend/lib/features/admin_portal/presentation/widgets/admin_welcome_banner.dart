import 'package:flutter/material.dart';

import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;

class AdminWelcomeBanner extends StatelessWidget {
  const AdminWelcomeBanner({super.key, this.adminName = 'ImpactLoop Admin'});

  final String adminName;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final today = MaterialLocalizations.of(
      context,
    ).formatFullDate(DateTime.now());

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: palette.bannerBackground,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: palette.bannerBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.welcomeTitle(adminName),
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 18),
                ),
                const SizedBox(height: 6),
                Text(
                  l.welcomeSubtitle,
                  style: AdminTypography.pageSubtitle(palette),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                l.bannerOverviewLabel,
                style: AdminTypography.kpiLabel(
                  palette,
                ).copyWith(color: palette.primaryTeal),
              ),
              const SizedBox(height: 8),
              Text(
                l.t('Today', 'اليوم'),
                style: AdminTypography.kpiHelper(palette),
              ),
              Text(
                today,
                style: AdminTypography.kpiHelper(
                  palette,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.end,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
