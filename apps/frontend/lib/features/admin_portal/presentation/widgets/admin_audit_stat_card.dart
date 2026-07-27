import 'package:flutter/material.dart';

import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;

/// Compact KPI-style stat card for audit log summaries.
class AdminAuditStatCard extends StatelessWidget {
  const AdminAuditStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.accent,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      constraints: const BoxConstraints(minHeight: 96),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ColoredBox(color: accent, child: const SizedBox(width: 3)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 12, 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: accent.withValues(
                            alpha: palette.isDark ? 0.18 : 0.12,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(icon, size: 17, color: accent),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              label,
                              style: AdminTypography.kpiLabel(palette),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              value,
                              style: AdminTypography.kpiValue(
                                palette,
                              ).copyWith(fontSize: 17),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              helper,
                              style: AdminTypography.kpiHelper(palette),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
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
