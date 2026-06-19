import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../widgets/accept_incoming_request_dialog.dart';
import '../widgets/decline_incoming_request_dialog.dart';
import '../widgets/incoming_request_card.dart';
import '../widgets/incoming_request_filter_chips.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 960.0;

class SupplierIncomingRequestsPage extends ConsumerWidget {
  const SupplierIncomingRequestsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tab = ref.watch(incomingRequestTabProvider);
    final requestsAsync = ref.watch(incomingRequestsProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: SupplierDecorations.pagePadding(compact: compact),
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
                      title: tab.emptyMessage,
                      subtitle: tab.emptySubtitle,
                    );
                  }

                  return Column(
                    children: _requestCards(context, ref, requests),
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
    List<SupplierIncomingRequest> requests,
  ) {
    return requests
        .map(
          (request) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: IncomingRequestCard(
              request: request,
              onAccept:
                  request.status == SupplierIncomingRequestStatus.pending
                      ? () => _handleAccept(context, ref, request)
                      : null,
              onDecline:
                  request.status == SupplierIncomingRequestStatus.pending
                      ? () => _handleDecline(context, ref, request)
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
      materialTitle: request.materialTitle,
      learnerName: request.learnerName,
    );
    if (pickupWindow == null || !context.mounted) {
      return;
    }

    try {
      await acceptIncomingRequest(
        ref,
        requestId: request.id,
        pickupWindow: pickupWindow,
      );
      if (!context.mounted) return;
      showSupplierInfoSnackBar(context, 'Request accepted.');
      ref.read(incomingRequestTabProvider.notifier).selectTab(
            SupplierIncomingRequestTab.accepted,
          );
    } catch (_) {
      if (!context.mounted) return;
      showSupplierErrorSnackBar(context, 'Could not accept the request.');
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
      showSupplierInfoSnackBar(context, 'Request declined.');
      ref.read(incomingRequestTabProvider.notifier).selectTab(
            SupplierIncomingRequestTab.declined,
          );
    } catch (_) {
      if (!context.mounted) return;
      showSupplierErrorSnackBar(context, 'Could not decline the request.');
    }
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AuthDarkColors.accentSoft.withValues(alpha: 0.28),
                  borderRadius: AppRadius.mdAll,
                ),
                child: const Icon(
                  Icons.inbox_outlined,
                  color: AuthDarkColors.accent,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Incoming Requests',
                      style: AuthDarkTextStyles.title(context),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Review learner requests and schedule pickups.',
                      style: AuthDarkTextStyles.body(context).copyWith(
                        color: AuthDarkColors.textPrimary,
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
  const _EmptyState({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xl,
      ),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AuthDarkColors.accentSoft.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.inbox_outlined,
              color: AuthDarkColors.accent,
              size: 28,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AuthDarkTextStyles.title(context).copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: AuthDarkTextStyles.body(context).copyWith(
              color: AuthDarkColors.textSecondary,
            ),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AuthDarkColors.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Text(
            'Loading incoming requests…',
            style: AuthDarkTextStyles.body(context).copyWith(
              color: AuthDarkColors.textPrimary,
            ),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        children: [
          const Icon(
            Icons.cloud_off_outlined,
            color: AuthDarkColors.textSecondary,
            size: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'We could not load requests.',
            textAlign: TextAlign.center,
            style: AuthDarkTextStyles.title(context).copyWith(fontSize: 18),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              foregroundColor: AuthDarkColors.accent,
              side: BorderSide(
                color: AuthDarkColors.borderFocused.withValues(alpha: 0.6),
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            ),
            child: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}
