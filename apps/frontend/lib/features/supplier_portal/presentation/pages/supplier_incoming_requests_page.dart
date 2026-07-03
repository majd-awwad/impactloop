import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/accept_incoming_request_dialog.dart';
import '../widgets/complete_pickup_dialog.dart';
import '../widgets/decline_incoming_request_dialog.dart';
import '../widgets/reservation_follow_up_flow.dart';
import '../widgets/incoming_request_card.dart';
import '../widgets/incoming_request_filter_chips.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 960.0;
const _deliveryHandledCompleteMessage =
    'This reservation is handled by delivery. The driver will mark it completed.';

bool _isDeliveryCompleteConflict(Object error) {
  return error is ApiException &&
      error.statusCode == 409 &&
      error.message.toLowerCase().contains('self-pickup');
}

class SupplierIncomingRequestsPage extends ConsumerStatefulWidget {
  const SupplierIncomingRequestsPage({
    super.key,
    this.initialTab,
    this.focusReservationId,
  });

  final String? initialTab;
  final String? focusReservationId;

  @override
  ConsumerState<SupplierIncomingRequestsPage> createState() =>
      _SupplierIncomingRequestsPageState();
}

class _SupplierIncomingRequestsPageState
    extends ConsumerState<SupplierIncomingRequestsPage> {
  bool _initialTabApplied = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialTab());
  }

  @override
  void didUpdateWidget(covariant SupplierIncomingRequestsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      _initialTabApplied = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialTab());
    }
  }

  void _applyInitialTab() {
    if (_initialTabApplied) {
      return;
    }

    final tabName = widget.initialTab?.trim().toLowerCase();
    if (tabName == null || tabName.isEmpty) {
      return;
    }

    final tab = switch (tabName) {
      'all' => SupplierIncomingRequestTab.all,
      'accepted' => SupplierIncomingRequestTab.accepted,
      'needs_learner' || 'needslearner' => SupplierIncomingRequestTab.needsLearner,
      'declined' => SupplierIncomingRequestTab.declined,
      'completed' => SupplierIncomingRequestTab.completed,
      'cancelled' => SupplierIncomingRequestTab.cancelled,
      _ => SupplierIncomingRequestTab.pending,
    };

    ref.read(incomingRequestTabProvider.notifier).selectTab(tab);
    _initialTabApplied = true;
  }

  @override
  Widget build(BuildContext context) {
    final tab = ref.watch(incomingRequestTabProvider);
    final requestsAsync = ref.watch(incomingRequestsProvider);
    final completingId = ref.watch(completingReservationIdProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final l = context.s;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: context.supplierDecorations.pagePadding(compact: compact),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _PageHeader(),
              const SizedBox(height: AppSpacing.lg),
              const IncomingRequestFilterChips(),
              const SizedBox(height: AppSpacing.lg),
              requestsAsync.when(
                data: (requests) {
                  if (requests.isEmpty) {
                    return _EmptyState(
                      title: l.incomingRequestEmptyTitle(tab),
                      subtitle: l.incomingRequestEmptySubtitle(tab),
                    );
                  }

                  return Column(
                    children: _requestCards(
                      context,
                      ref,
                      requests,
                      completingId: completingId,
                    ),
                  );
                },
                loading: () => const _LoadingState(),
                error: (_, _) => _ErrorState(
                  onRetry: () => ref.invalidate(incomingRequestsProvider),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _requestCards(
    BuildContext context,
    WidgetRef ref,
    List<SupplierIncomingRequest> requests, {
    required String? completingId,
  }) {
    return requests
        .map(
          (request) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: IncomingRequestCard(
              request: request,
              isCompleting: completingId == request.id,
              onAccept: request.status == SupplierIncomingRequestStatus.pending
                  ? () => _handleAccept(context, ref, request)
                  : null,
              onDecline: request.status == SupplierIncomingRequestStatus.pending
                  ? () => _handleDecline(context, ref, request)
                  : null,
              onMarkCompleted:
                  request.status == SupplierIncomingRequestStatus.accepted &&
                      request.canSupplierComplete
                  ? () => _handleComplete(context, ref, request)
                  : null,
              onReschedule: request.canSupplierReschedule
                  ? () => handleRequestReschedulePickup(
                        context,
                        ref,
                        reservationId: request.id,
                        materialTitle: request.materialTitle,
                        learnerName: request.learnerName,
                      )
                  : null,
              onCloseReservation:
                  request.canSupplierCloseOverduePickup ||
                      request.canSupplierCloseAwaitingLearnerRequest
                  ? () => handleCloseOverduePickup(
                        context,
                        ref,
                        reservationId: request.id,
                      )
                  : null,
              onReportToAdmin:
                  request.canSupplierReportAndCloseOverduePickup ||
                      request.canSupplierReportAwaitingLearnerRequest
                  ? () => handleReportToAdminAndClose(
                        context,
                        ref,
                        reservationId: request.id,
                      )
                  : null,
              onAcceptLearnerReschedule:
                  request.canSupplierAcceptLearnerReschedule
                  ? () => handleAcceptLearnerReschedule(
                        context,
                        ref,
                        reservationId: request.id,
                      )
                  : null,
              onProposeDifferentTime: request.canSupplierProposeDifferentTime
                  ? () => handleRequestReschedulePickup(
                        context,
                        ref,
                        reservationId: request.id,
                        materialTitle: request.materialTitle,
                        learnerName: request.learnerName,
                      )
                  : null,
            ),
          ),
        )
        .toList();
  }

  Future<void> _handleAccept(
    BuildContext context,
    WidgetRef ref,
    SupplierIncomingRequest request,
  ) async {
    final pickupWindow = await AcceptIncomingRequestDialog.show(
      context,
      request: request,
    );
    if (pickupWindow == null || !context.mounted) {
      return;
    }

    try {
      final updated = await acceptIncomingRequest(
        ref,
        requestId: request.id,
        pickupWindow: pickupWindow,
      );
      if (!context.mounted) return;
      final message =
          updated.status == SupplierIncomingRequestStatus.awaitingConfirmation
          ? context.s.requestAwaitingConfirmation
          : context.s.requestAccepted;
      showSupplierInfoSnackBar(context, message);
      ref
          .read(incomingRequestTabProvider.notifier)
          .selectTab(SupplierIncomingRequestTab.accepted);
    } catch (_) {
      if (!context.mounted) return;
      showSupplierErrorSnackBar(context, context.s.requestAcceptFailed);
    }
  }

  Future<void> _handleDecline(
    BuildContext context,
    WidgetRef ref,
    SupplierIncomingRequest request,
  ) async {
    final result = await DeclineIncomingRequestDialog.show(
      context,
      materialTitle: request.materialTitle,
      learnerName: request.learnerName,
    );
    if (result == null ||
        result.result != DeclineIncomingRequestResult.declined ||
        !context.mounted) {
      return;
    }

    try {
      await declineIncomingRequest(
        ref,
        requestId: request.id,
        reason: result.reason,
      );
      if (!context.mounted) return;
      showSupplierInfoSnackBar(context, context.s.requestDeclined);
      ref
          .read(incomingRequestTabProvider.notifier)
          .selectTab(SupplierIncomingRequestTab.declined);
    } catch (_) {
      if (!context.mounted) return;
      showSupplierErrorSnackBar(context, context.s.requestDeclineFailed);
    }
  }

  Future<void> _handleComplete(
    BuildContext context,
    WidgetRef ref,
    SupplierIncomingRequest request,
  ) async {
    final confirmed = await CompletePickupDialog.show(context);
    if (confirmed == null || confirmed.trim().isEmpty || !context.mounted) {
      return;
    }

    ref
        .read(completingReservationIdProvider.notifier)
        .setCompleting(request.id);
    try {
      await completeIncomingRequest(
        ref,
        requestId: request.id,
        confirmationCode: confirmed.trim(),
      );
      if (!context.mounted) return;
      showSupplierInfoSnackBar(context, context.s.pickupCompleted);
      ref
          .read(incomingRequestTabProvider.notifier)
          .selectTab(SupplierIncomingRequestTab.completed);
    } catch (error) {
      if (!context.mounted) return;
      showSupplierErrorSnackBar(
        context,
        _isDeliveryCompleteConflict(error)
            ? _deliveryHandledCompleteMessage
            : context.s.pickupCompleteFailed,
      );
    } finally {
      ref.read(completingReservationIdProvider.notifier).setCompleting(null);
    }
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader();

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.accentSoft.withValues(alpha: 0.28),
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  Icons.inbox_outlined,
                  color: colors.accent,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.incomingRequestsTitle,
                      style: context.supplierTitle(),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l.subtitleIncomingRequests,
                      style: context.supplierBody().copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xl,
      ),
      decoration: decorations.dashboardCard,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.accentSoft.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.inbox_outlined, color: colors.accent, size: 28),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: context.supplierTitle().copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: context.supplierBody().copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.dashboardCard,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Text(
            context.s.loadingRequests,
            style: context.supplierBody().copyWith(color: colors.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.dashboardCard,
      child: Column(
        children: [
          Icon(Icons.cloud_off_outlined, color: colors.textSecondary, size: 28),
          const SizedBox(height: AppSpacing.md),
          Text(
            l.requestsLoadError,
            textAlign: TextAlign.center,
            style: context.supplierTitle().copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.accent,
              side: BorderSide(
                color: colors.borderFocused.withValues(alpha: 0.6),
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            ),
            child: Text(l.tryAgain),
          ),
        ],
      ),
    );
  }
}
