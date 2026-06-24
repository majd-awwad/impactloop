import 'package:flutter/material.dart';

import '../../data/models/admin_dashboard_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_empty_state.dart';

/// Compact bottom review queues — analytics overview only.
class AdminReviewSection extends StatelessWidget {
  const AdminReviewSection({
    super.key,
    required this.supplierVerificationPreview,
    required this.recentInvitations,
    required this.recentActivity,
  });

  final List<dynamic> supplierVerificationPreview;
  final List<AdminInvitationPreview> recentInvitations;
  final List<dynamic> recentActivity;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final threeCol = width >= 960;

    final panels = [
      _ReviewCard(
        title: l.supplierVerificationQueueTitle,
        icon: Icons.verified_outlined,
        accent: palette.primaryTeal,
        child: supplierVerificationPreview.isEmpty
            ? AdminEmptyState(
                icon: Icons.verified_outlined,
                title: l.emptyNoSupplierVerifications,
                subtitle: l.supplierVerificationFutureNote,
              )
            : Column(
                children: [
                  for (final row in supplierVerificationPreview.take(3))
                    _RowText(text: row.toString()),
                ],
              ),
      ),
      _ReviewCard(
        title: l.recentInvitationsTitle,
        icon: Icons.mail_outline,
        accent: palette.blue,
        child: recentInvitations.isEmpty
            ? AdminEmptyState(
                icon: Icons.mail_outline,
                title: l.emptyNoInvitationsTitle,
                subtitle: l.emptyNoInvitations,
              )
            : Column(
                children: [
                  for (final inv in recentInvitations.take(3))
                    _InvitationRow(invitation: inv),
                ],
              ),
      ),
      _ReviewCard(
        title: l.recentActivityTitle,
        icon: Icons.history,
        accent: palette.purple,
        child: recentActivity.isEmpty
            ? AdminEmptyState(
                icon: Icons.history_toggle_off,
                title: l.emptyNoActivity,
                subtitle: l.recentActivityEmptySubtitle,
              )
            : Column(
                children: [
                  for (final row in recentActivity.take(3))
                    _RowText(text: row.toString()),
                ],
              ),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.reviewQueuesTitle,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: palette.textPrimary,
              ),
        ),
        const SizedBox(height: 8),
        if (threeCol)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < panels.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(child: panels[i]),
                ],
              ],
            ),
          )
        else
          Column(
            children: [
              for (var i = 0; i < panels.length; i++) ...[
                if (i > 0) const SizedBox(height: 8),
                panels[i],
              ],
            ],
          ),
      ],
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({
    required this.title,
    required this.icon,
    required this.accent,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Color accent;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 12, 10),
      decoration: palette.dashboardCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: palette.textPrimary,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }
}

class _RowText extends StatelessWidget {
  const _RowText({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 4),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: palette.textPrimary,
              height: 1.3,
              fontSize: 12,
            ),
      ),
    );
  }
}

class _InvitationRow extends StatelessWidget {
  const _InvitationRow({required this.invitation});
  final AdminInvitationPreview invitation;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              invitation.targetEmail ?? '—',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            invitation.targetRole,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: palette.textSecondary,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}
