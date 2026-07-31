import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../auth/presentation/widgets/auth_form_card.dart';
import '../../../auth/presentation/widgets/auth_header.dart';
import '../../../auth/presentation/widgets/auth_shell.dart';
import '../../application/supplier_verification_access.dart';
import '../../data/supplier_verification_api.dart';
import '../../../../core/errors/api_exception.dart';

class SupplierVerificationStatusPage extends ConsumerStatefulWidget {
  const SupplierVerificationStatusPage({super.key});

  @override
  ConsumerState<SupplierVerificationStatusPage> createState() =>
      _SupplierVerificationStatusPageState();
}

class _SupplierVerificationStatusPageState
    extends ConsumerState<SupplierVerificationStatusPage> {
  PlatformFile? _selectedFile;
  bool _isSubmitting = false;
  bool _isCheckingStatus = false;
  String? _error;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      } catch (_) {}
    });
  }

  Future<void> _pickDocument() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) {
      return;
    }
    setState(() => _selectedFile = result.files.first);
  }

  Future<void> _checkStatus() async {
    setState(() {
      _isCheckingStatus = true;
      _statusMessage = null;
      _error = null;
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

      if (gate == supplierVerificationPendingRoute) {
        context.go(supplierVerificationPendingRoute);
        return;
      }

      ref.invalidate(supplierVerificationStatusProvider);
      setState(() {
        _statusMessage = context.l10n.supplierVerifyStatusRefreshed;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = localizedApiErrorMessage(error, context.l10n));
    } finally {
      if (mounted) {
        setState(() => _isCheckingStatus = false);
      }
    }
  }

  Future<void> _resubmit(SupplierVerificationStatus status) async {
    if (_selectedFile?.bytes == null) {
      setState(() => _error = context.l10n.supplierVerifySelectDocumentToUpload);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final api = ref.read(supplierVerificationApiProvider);
      final uploaded = await api.uploadDocument(
        bytes: _selectedFile!.bytes!,
        fileName: _selectedFile!.name,
        mimeType: _mimeTypeForFile(_selectedFile!.name),
      );
      await api.resubmitVerification({
        'verificationDocumentUrl': uploaded.url,
        'verificationDocumentName': uploaded.name,
      });
      await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      if (!mounted) return;
      ref.invalidate(supplierVerificationStatusProvider);
      context.go(supplierVerificationPendingRoute);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _error = localizedApiErrorMessage(error, context.l10n);
      });
    }
  }

  String _mimeTypeForFile(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    return 'image/jpeg';
  }

  String _headline(String status) {
    final l10n = context.l10n;
    return switch (normalizeVerificationStatus(status)) {
      'REJECTED' => l10n.supplierVerifyRejectedTitle,
      'CHANGES_REQUESTED' => l10n.supplierVerifyChangesRequestedTitle,
      _ => l10n.supplierVerifyStatusTitle,
    };
  }

  String _bodyMessage(String status) {
    final l10n = context.l10n;
    return switch (normalizeVerificationStatus(status)) {
      'REJECTED' => l10n.supplierVerifyRejectedBody,
      'CHANGES_REQUESTED' => l10n.supplierVerifyChangesRequestedBody,
      _ => l10n.supplierVerifyStatusBody,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final asyncStatus = ref.watch(supplierVerificationStatusProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.authLayoutBreakpoint;

    return AuthShell(
      layout: compact ? AuthShellLayout.mobile : AuthShellLayout.webSplit,
      showSignIn: false,
      showCreateAccount: false,
      formContent: asyncStatus.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthHeader(
              title: l10n.supplierVerifyStatusTitle,
              subtitle: l10n.supplierVerifyLoadStatusFailed,
            ),
            const SizedBox(height: AppSpacing.lg),
            AuthFormCard(child: Text(localizedApiErrorMessage(error, context.l10n))),
          ],
        ),
        data: (status) {
          final normalized = normalizeVerificationStatus(
            status.verificationStatus,
          );
          final canResubmit = normalized == 'CHANGES_REQUESTED';

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AuthHeader(
                title: _headline(status.verificationStatus),
                subtitle: _bodyMessage(status.verificationStatus),
              ),
              const SizedBox(height: AppSpacing.lg),
              AuthFormCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (normalized == 'REJECTED' &&
                        status.verificationAdminNote != null &&
                        status.verificationAdminNote!.trim().isNotEmpty) ...[
                      Text(
                        l10n.reason,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(status.verificationAdminNote!.trim()),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    if (normalized == 'CHANGES_REQUESTED' &&
                        status.verificationAdminNote != null &&
                        status.verificationAdminNote!.trim().isNotEmpty) ...[
                      Text(
                        l10n.supplierAdminNote,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(status.verificationAdminNote!.trim()),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    if (canResubmit) ...[
                      OutlinedButton.icon(
                        onPressed: _isSubmitting ? null : _pickDocument,
                        icon: const Icon(Icons.upload_file_outlined),
                        label: Text(
                          _selectedFile == null
                              ? l10n.chooseVerificationDocument
                              : _selectedFile!.name,
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _isSubmitting
                            ? null
                            : () => _resubmit(status),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(l10n.resubmitVerification),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    if (_statusMessage != null) ...[
                      Text(_statusMessage!),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    if (_error != null) ...[
                      Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    FilledButton(
                      onPressed: _isCheckingStatus ? null : _checkStatus,
                      child: _isCheckingStatus
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(l10n.checkStatus),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton(
                      onPressed: () => context.go(homeRoute),
                      child: Text(l10n.backToHome),
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
