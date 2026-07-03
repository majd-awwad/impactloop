import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/admin_no_show_reports_api.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

class AdminNoShowReportsPage extends ConsumerWidget {
  const AdminNoShowReportsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final reportsAsync = ref.watch(adminNoShowReportsProvider);

    return Padding(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'No-show reports',
            style: AdminTypography.pageTitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Review supplier no-show reports. Verified reports count as strikes. '
            'Three verified reports recommend account restriction.',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: reportsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, _) => Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AdminEmptyState(
                    icon: Icons.report_gmailerrorred_outlined,
                    title: 'Could not load no-show reports',
                    subtitle: 'Please try again.',
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(adminNoShowReportsProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
              data: (response) {
                if (response.items.isEmpty) {
                  return const AdminEmptyState(
                    icon: Icons.event_busy_outlined,
                    title: 'No pending no-show reports',
                    subtitle:
                        'Supplier reports awaiting review will appear here.',
                  );
                }

                return ListView.separated(
                  itemCount: response.items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final report = response.items[index];
                    return _NoShowReportCard(
                      report: report,
                      onVerify: () => _verify(context, ref, report.id),
                      onReject: () => _reject(context, ref, report.id),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _verify(
    BuildContext context,
    WidgetRef ref,
    String reportId,
  ) async {
    try {
      final result = await ref
          .read(adminNoShowReportsApiProvider)
          .verifyReport(reportId);
      ref.invalidate(adminNoShowReportsProvider);
      if (!context.mounted) return;

      final message = result.shouldWarnAdmin
          ? result.adminRecommendation ??
                'Verified. Target now has ${result.targetVerifiedNoShowCount} verified no-show reports.'
          : 'Report verified. Target verified count: ${result.targetVerifiedNoShowCount}.';

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }

  Future<void> _reject(
    BuildContext context,
    WidgetRef ref,
    String reportId,
  ) async {
    try {
      await ref.read(adminNoShowReportsApiProvider).rejectReport(reportId);
      ref.invalidate(adminNoShowReportsProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report rejected.')),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }
}

class _NoShowReportCard extends StatelessWidget {
  const _NoShowReportCard({
    required this.report,
    required this.onVerify,
    required this.onReject,
  });

  final AdminNoShowReportItem report;
  final VoidCallback onVerify;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            report.materialTitle,
            style: AdminTypography.sectionTitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reporter: ${report.reporterName} · Target (${report.targetRole}): ${report.targetName}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reason: ${report.reasonCode}${report.note?.trim().isNotEmpty == true ? ' · ${report.note!.trim()}' : ''}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              OutlinedButton(
                onPressed: onReject,
                child: const Text('Reject'),
              ),
              const SizedBox(width: AppSpacing.sm),
              FilledButton(
                onPressed: onVerify,
                child: const Text('Verify'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
