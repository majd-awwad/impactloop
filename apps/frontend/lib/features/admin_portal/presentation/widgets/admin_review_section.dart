import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

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

  final List<AdminSupplierVerificationPreview> supplierVerificationPreview;
  final List<AdminInvitationPreview> recentInvitations;
  final List<AdminActivityPreview> recentActivity;

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
              )
            : Column(
                children: [
                  for (final item in supplierVerificationPreview.take(5))
                    _SupplierVerificationPreviewRow(item: item),
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
                  for (final item in recentActivity.take(5))
                    _ActivityRow(activity: item),
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

class _SupplierVerificationPreviewRow extends StatelessWidget {
  const _SupplierVerificationPreviewRow({required this.item});

  final AdminSupplierVerificationPreview item;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final submitted = _formatDate(item.submittedAt);
    final org = item.organizationName.trim();
    final subtitle = org.isNotEmpty ? org : item.supplierType.replaceAll('_', ' ');

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.ownerName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        fontSize: 11,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (submitted != null)
                  Text(
                    submitted,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textSecondary,
                          fontSize: 10,
                        ),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => context.go('/admin/supplier-verification'),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Review'),
          ),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.activity});

  final AdminActivityPreview activity;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final when = _formatDate(activity.createdAt);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            activity.actionLabel,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            '${activity.actorName} · ${activity.targetLabel}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textSecondary,
                  fontSize: 11,
                ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (when != null)
            Text(
              when,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textSecondary,
                    fontSize: 10,
                  ),
            ),
        ],
      ),
    );
  }
}

String? _formatDate(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return null;
  return DateFormat.yMMMd().add_jm().format(parsed.toLocal());
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
