import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../auth/presentation/widgets/auth_entry_branding_panel.dart';
import '../../../auth/presentation/widgets/auth_form_card.dart';
import '../../../auth/presentation/widgets/auth_header.dart';
import '../../../auth/presentation/widgets/auth_shell.dart';
import '../../../auth/presentation/widgets/auth_ui_palette.dart';
import '../../../auth/presentation/widgets/auth_onboarding_shell.dart';
import '../../application/supplier_verification_access.dart';
import '../../data/supplier_verification_api.dart';

class SupplierVerificationPendingPage extends ConsumerStatefulWidget {
  const SupplierVerificationPendingPage({super.key});

  @override
  ConsumerState<SupplierVerificationPendingPage> createState() =>
      _SupplierVerificationPendingPageState();
}

class _SupplierVerificationPendingPageState
    extends ConsumerState<SupplierVerificationPendingPage> {
  bool _isCheckingStatus = false;
  String? _statusMessage;

  Future<void> _checkStatus() async {
    setState(() {
      _isCheckingStatus = true;
      _statusMessage = null;
    });

    try {
      final gate = await refreshSupplierVerificationGate(ref);
      if (!mounted) {
        return;
      }

      if (gate == null) {
        context.go(supplierPortalRoute);
        return;
      }

      if (gate == supplierVerificationStatusRoute) {
        context.go(supplierVerificationStatusRoute);
        return;
      }

      setState(() {
        _statusMessage = context.l10n.supplierVerifyStillWaitingApproval;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _statusMessage = localizedApiErrorMessage(error, context.l10n);
      });
    } finally {
      if (mounted) {
        setState(() => _isCheckingStatus = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final asyncStatus = ref.watch(supplierVerificationStatusProvider);

    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.register,
      showSignIn: false,
      showCreateAccount: false,
      formMaxWidth: AppSpacing.authContentMaxWidth,
      formContent: asyncStatus.when(
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.xxl),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (error, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthHeader(
              title: l10n.supplierVerifySubmittedTitle,
              subtitle: l10n.supplierVerifyLoadStatusFailed,
            ),
            const SizedBox(height: AppSpacing.lg),
            AuthFormCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppInlineError(
                    message: localizedApiErrorMessage(error, context.l10n),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  FilledButton(
                    onPressed: () =>
                        ref.invalidate(supplierVerificationStatusProvider),
                    child: Text(l10n.retry),
                  ),
                ],
              ),
            ),
          ],
        ),
        data: (status) {
          final formatters = LocalizedFormatters(l10n);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthHeader(
                title: l10n.supplierVerifySubmittedTitle,
                subtitle: l10n.supplierVerifyPendingSubtitle,
              ),
              const SizedBox(height: AppSpacing.lg),
              AuthFormCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AuthStatusBadge(label: l10n.pendingReview),
                    const SizedBox(height: AppSpacing.lg),
                    _VerificationProgress(
                      accountCreated: l10n.supplierVerifyAccountCreated,
                      documentSubmitted:
                          l10n.supplierVerifyDocumentSubmitted,
                      reviewInProgress:
                          l10n.supplierVerifyReviewInProgress,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Divider(color: AuthUiPalette.of(context).border),
                    const SizedBox(height: AppSpacing.md),
                    _StatusDetails(
                      statusLabel: l10n.supplierStatus,
                      pendingLabel: l10n.pendingReview,
                      organizationLabel: l10n.organization,
                      organizationName: status.organizationName,
                      submittedLabel: l10n.submitted,
                      submittedAt: status.verificationSubmittedAt == null
                          ? null
                          : formatters.dateTime(
                              status.verificationSubmittedAt!,
                            ),
                      documentLabel: l10n.document,
                      documentReceived: l10n.supplierVerifyDocumentReceived,
                    ),
                    if (_statusMessage != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      _StatusMessage(message: _statusMessage!),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      height: AppSpacing.buttonHeight,
                      child: FilledButton(
                        onPressed: _isCheckingStatus ? null : _checkStatus,
                        child: _isCheckingStatus
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(l10n.checkStatus),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      height: AppSpacing.buttonHeight,
                      child: OutlinedButton(
                        onPressed: () => context.go(homeRoute),
                        child: Text(l10n.backToHome),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: () =>
                          ref.read(authControllerProvider.notifier).logout(),
                      child: Text(l10n.logout),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _VerificationProgress extends StatelessWidget {
  const _VerificationProgress({
    required this.accountCreated,
    required this.documentSubmitted,
    required this.reviewInProgress,
  });

  final String accountCreated;
  final String documentSubmitted;
  final String reviewInProgress;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.primary.withValues(alpha: 0.22)),
      ),
      child: Column(
        children: [
          _ProgressItem(label: accountCreated, complete: true),
          const SizedBox(height: AppSpacing.sm),
          _ProgressItem(label: documentSubmitted, complete: true),
          const SizedBox(height: AppSpacing.sm),
          _ProgressItem(label: reviewInProgress, complete: false),
        ],
      ),
    );
  }
}

class _ProgressItem extends StatelessWidget {
  const _ProgressItem({required this.label, required this.complete});

  final String label;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Row(
      children: [
        Icon(
          complete ? Icons.check_circle_rounded : Icons.circle_outlined,
          size: 20,
          color: colors.primary,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: complete ? FontWeight.w700 : FontWeight.w600,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusDetails extends StatelessWidget {
  const _StatusDetails({
    required this.statusLabel,
    required this.pendingLabel,
    required this.organizationLabel,
    required this.organizationName,
    required this.submittedLabel,
    required this.submittedAt,
    required this.documentLabel,
    required this.documentReceived,
  });

  final String statusLabel;
  final String pendingLabel;
  final String organizationLabel;
  final String? organizationName;
  final String submittedLabel;
  final String? submittedAt;
  final String documentLabel;
  final String documentReceived;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthInfoRow(label: statusLabel, value: pendingLabel),
        if (organizationName != null && organizationName!.trim().isNotEmpty)
          AuthInfoRow(label: organizationLabel, value: organizationName!),
        if (submittedAt != null)
          AuthInfoRow(label: submittedLabel, value: submittedAt!),
        AuthInfoRow(label: documentLabel, value: documentReceived),
      ],
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.mdAll,
      ),
      child: Text(
        message,
        style: TextStyle(color: colors.textSecondary, height: 1.45),
      ),
    );
  }
}
