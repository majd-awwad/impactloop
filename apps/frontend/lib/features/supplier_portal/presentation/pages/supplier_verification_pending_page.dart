import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../auth/presentation/widgets/auth_form_card.dart';
import '../../../auth/presentation/widgets/auth_header.dart';
import '../../../auth/presentation/widgets/auth_shell.dart';
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
        _statusMessage =
            'Your supplier account is still waiting for admin approval.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _statusMessage = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _isCheckingStatus = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncStatus = ref.watch(supplierVerificationStatusProvider);
    final compact = MediaQuery.sizeOf(context).width < AppSpacing.authLayoutBreakpoint;

    return AuthShell(
      layout: compact ? AuthShellLayout.mobile : AuthShellLayout.webSplit,
      showSignIn: false,
      showCreateAccount: false,
      formContent: asyncStatus.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AuthHeader(
              title: 'Supplier verification submitted',
              subtitle: 'We could not load your verification status.',
            ),
            const SizedBox(height: AppSpacing.lg),
            AuthFormCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppInlineError(message: error.toString()),
                  const SizedBox(height: AppSpacing.md),
                  FilledButton(
                    onPressed: () =>
                        ref.invalidate(supplierVerificationStatusProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ],
        ),
        data: (status) {
          final dateFormat = DateFormat.yMMMd().add_jm();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AuthHeader(
                title: 'Supplier verification submitted',
                subtitle:
                    'Your supplier account is waiting for admin approval. You will be able to publish materials after your account is approved.',
              ),
              const SizedBox(height: AppSpacing.lg),
              AuthFormCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _InfoTile(label: 'Status', value: 'Pending review'),
                    if (status.organizationName != null)
                      _InfoTile(
                        label: 'Organization',
                        value: status.organizationName!,
                      ),
                    if (status.verificationSubmittedAt != null)
                      _InfoTile(
                        label: 'Submitted',
                        value: dateFormat.format(status.verificationSubmittedAt!),
                      ),
                    if (status.verificationDocumentName != null)
                      _InfoTile(
                        label: 'Document',
                        value: status.verificationDocumentName!,
                      ),
                    if (_statusMessage != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _statusMessage!,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    FilledButton(
                      onPressed: _isCheckingStatus ? null : _checkStatus,
                      child: _isCheckingStatus
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Check status'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton(
                      onPressed: () => context.go(homeRoute),
                      child: const Text('Back to home'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: () =>
                          ref.read(authControllerProvider.notifier).logout(),
                      child: const Text('Log out'),
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

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppTextStyles.subtitle(context),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
