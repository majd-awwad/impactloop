import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/admin_no_show_reports_api.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_utils.dart';

enum _ReportQueueTab {
  pending('PENDING_REVIEW', 'Pending'),
  verified('VERIFIED', 'Verified'),
  rejected('REJECTED', 'Rejected'),
  resolved('RESOLVED_NO_STRIKE', 'Resolved');

  const _ReportQueueTab(this.status, this.label);

  final String status;
  final String label;
}

final adminNoShowReportsByStatusProvider = FutureProvider.autoDispose
    .family<AdminNoShowReportsListResponse, String>((ref, status) {
  return ref.watch(adminNoShowReportsApiProvider).fetchReports(status: status);
});

class AdminNoShowReportsPage extends ConsumerStatefulWidget {
  const AdminNoShowReportsPage({super.key});

  @override
  ConsumerState<AdminNoShowReportsPage> createState() =>
      _AdminNoShowReportsPageState();
}

class _AdminNoShowReportsPageState extends ConsumerState<AdminNoShowReportsPage> {
  _ReportQueueTab _selectedTab = _ReportQueueTab.pending;
  String? _busyReportId;
  String? _busyAction;

  void _invalidateQueue() {
    for (final tab in _ReportQueueTab.values) {
      ref.invalidate(adminNoShowReportsByStatusProvider(tab.status));
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final reportsAsync =
        ref.watch(adminNoShowReportsByStatusProvider(_selectedTab.status));

    return Padding(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Reservation reports',
            style: AdminTypography.pageTitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Review incident reports from pickup and delivery. Only verified reports count as strikes. '
            'Three verified reports automatically suspend the target account.',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: _ReportQueueTab.values
                .map(
                  (tab) => ChoiceChip(
                    label: Text(tab.label),
                    selected: _selectedTab == tab,
                    onSelected: (_) => setState(() => _selectedTab = tab),
                  ),
                )
                .toList(growable: false),
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
                    title: 'Could not load reservation reports',
                    subtitle: 'Please try again.',
                  ),
                  TextButton(
                    onPressed: _invalidateQueue,
                    child: const Text('Retry'),
                  ),
                ],
              ),
              data: (response) {
                if (response.items.isEmpty) {
                  return AdminEmptyState(
                    icon: Icons.event_busy_outlined,
                    title: 'No ${_selectedTab.label.toLowerCase()} reports',
                    subtitle: 'Reports in this category will appear here.',
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
                      showReviewActions:
                          _selectedTab == _ReportQueueTab.pending,
                      isBusy: _busyReportId == report.id,
                      busyAction: _busyAction,
                      onVerify: () => _verify(context, report.id),
                      onReject: () => _reject(context, report.id),
                      onResolve: () => _resolve(context, report.id),
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

  Future<void> _verify(BuildContext context, String reportId) async {
    setState(() {
      _busyReportId = reportId;
      _busyAction = 'verify';
    });
    try {
      final result = await ref
          .read(adminNoShowReportsApiProvider)
          .verifyReport(reportId);
      _invalidateQueue();
      if (!context.mounted) return;

      final message = result.targetSuspended
          ? 'Report verified. Target account was suspended (${result.targetVerifiedNoShowCount} verified strikes).'
          : result.shouldWarnAdmin
              ? result.adminRecommendation ??
                  'Verified. Target now has ${result.targetVerifiedNoShowCount} verified reports.'
              : 'Report verified. Target verified count: ${result.targetVerifiedNoShowCount}.';

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not verify report. Please try again.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyReportId = null;
          _busyAction = null;
        });
      }
    }
  }

  Future<void> _reject(BuildContext context, String reportId) async {
    setState(() {
      _busyReportId = reportId;
      _busyAction = 'reject';
    });
    try {
      await ref.read(adminNoShowReportsApiProvider).rejectReport(reportId);
      _invalidateQueue();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report rejected.')),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not reject report. Please try again.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyReportId = null;
          _busyAction = null;
        });
      }
    }
  }

  Future<void> _resolve(BuildContext context, String reportId) async {
    setState(() {
      _busyReportId = reportId;
      _busyAction = 'resolve';
    });
    try {
      await ref.read(adminNoShowReportsApiProvider).resolveReport(reportId);
      _invalidateQueue();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report resolved without strike.')),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not resolve report. Please try again.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyReportId = null;
          _busyAction = null;
        });
      }
    }
  }
}

class _NoShowReportCard extends ConsumerStatefulWidget {
  const _NoShowReportCard({
    required this.report,
    required this.showReviewActions,
    required this.isBusy,
    required this.busyAction,
    required this.onVerify,
    required this.onReject,
    required this.onResolve,
  });

  final AdminNoShowReportItem report;
  final bool showReviewActions;
  final bool isBusy;
  final String? busyAction;
  final VoidCallback onVerify;
  final VoidCallback onReject;
  final VoidCallback onResolve;

  @override
  ConsumerState<_NoShowReportCard> createState() => _NoShowReportCardState();
}

class _NoShowReportCardState extends ConsumerState<_NoShowReportCard> {
  AdminNoShowReportDetail? _detail;
  bool _loadingDetail = false;

  Future<void> _loadDetail() async {
    if (_detail != null || _loadingDetail) return;
    setState(() => _loadingDetail = true);
    try {
      final detail = await ref
          .read(adminNoShowReportsApiProvider)
          .fetchReportDetail(widget.report.id);
      if (!mounted) return;
      setState(() => _detail = detail);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    } finally {
      if (mounted) {
        setState(() => _loadingDetail = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final report = widget.report;

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
            'Status: ${monitoringStatusLabel(report.status)}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Learner: ${report.learnerName} · Supplier: ${report.supplierName}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reservation: ${monitoringStatusLabel(report.reservationStatus)}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reporter: ${report.reporterName} · Target (${report.targetRole}): ${report.targetName}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Reason: ${humanizeEnum(report.reasonCode)}${report.note?.trim().isNotEmpty == true ? ' · ${report.note!.trim()}' : ''}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: AppSpacing.sm),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text(
              'Reservation detail',
              style: AdminTypography.pageSubtitle(palette),
            ),
            onExpansionChanged: (expanded) {
              if (expanded) {
                _loadDetail();
              }
            },
            children: [
              if (_loadingDetail)
                const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_detail == null)
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: Text(
                    'Could not load detail.',
                    style: AdminTypography.pageSubtitle(palette),
                  ),
                )
              else ...[
                Text(
                  'Reservation status: ${monitoringStatusLabel(_detail!.reservationStatus)}',
                  style: AdminTypography.pageSubtitle(palette),
                ),
                if (_detail!.messages.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Messages',
                    style: AdminTypography.sectionTitle(palette),
                  ),
                  ..._detail!.messages.map(
                    (message) => Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        '${message.senderName}: ${message.body}',
                        style: AdminTypography.pageSubtitle(palette),
                      ),
                    ),
                  ),
                ],
                if (_detail!.activityHistory.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Activity history',
                    style: AdminTypography.sectionTitle(palette),
                  ),
                  ..._detail!.activityHistory.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        '${formatAdminDateTime(entry.createdAt.toIso8601String()) ?? ''}: '
                        '${entry.oldStatus != null ? '${monitoringStatusLabel(entry.oldStatus!)} → ' : ''}'
                        '${monitoringStatusLabel(entry.newStatus)}'
                        '${entry.changedByName != null ? ' · ${entry.changedByName}' : ''}'
                        '${entry.note?.trim().isNotEmpty == true ? ' · ${entry.note!.trim()}' : ''}',
                        style: AdminTypography.pageSubtitle(palette),
                      ),
                    ),
                  ),
                ],
                if (_detail!.targetVerifiedNoShowCount != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Verified strikes: ${_detail!.targetVerifiedNoShowCount}',
                    style: AdminTypography.pageSubtitle(palette),
                  ),
                ],
              ],
            ],
          ),
          if (widget.showReviewActions) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                OutlinedButton(
                  onPressed: widget.isBusy ? null : widget.onReject,
                  child: widget.isBusy && widget.busyAction == 'reject'
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Reject'),
                ),
                OutlinedButton(
                  onPressed: widget.isBusy ? null : widget.onResolve,
                  child: widget.isBusy && widget.busyAction == 'resolve'
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Resolve without strike'),
                ),
                FilledButton(
                  onPressed: widget.isBusy ? null : widget.onVerify,
                  child: widget.isBusy && widget.busyAction == 'verify'
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Verify'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
