import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../../auth/presentation/widgets/auth_form_card.dart';
import '../../../auth/presentation/widgets/auth_entry_branding_panel.dart';
import '../../../auth/presentation/widgets/auth_header.dart';
import '../../../auth/presentation/widgets/auth_password_field.dart';
import '../../../auth/presentation/widgets/auth_shell.dart';
import '../../../auth/presentation/widgets/auth_text_field.dart';
import '../../data/invite_accept_providers.dart';
import '../../data/models/invite_accept_models.dart';

class InviteAcceptPage extends ConsumerStatefulWidget {
  const InviteAcceptPage({super.key, required this.token});

  final String token;

  @override
  ConsumerState<InviteAcceptPage> createState() => _InviteAcceptPageState();
}

class _InviteAcceptPageState extends ConsumerState<InviteAcceptPage> {
  final _newAccountKey = GlobalKey<FormState>();
  final _existingDriverKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _area = TextEditingController();
  final _address = TextEditingController();
  final _availability = TextEditingController();
  String _transportationType = 'CAR';
  bool _submitting = false;
  String? _completedRole;
  bool _completedExisting = false;

  @override
  void dispose() {
    for (final controller in [
      _fullName,
      _password,
      _confirmPassword,
      _phone,
      _city,
      _area,
      _address,
      _availability,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _acceptNew(InviteValidationResult invite) async {
    if (!_newAccountKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final result = await ref.read(inviteAcceptRepositoryProvider).acceptInvitation(
            InviteAcceptRequest(
              token: widget.token,
              fullName: _fullName.text.trim(),
              email: invite.recipientEmail!,
              password: _password.text,
              confirmPassword: _confirmPassword.text,
              phone: _optional(_phone),
              city: _optional(_city),
              area: _optional(_area),
              addressLine: _optional(_address),
              transportationType:
                  invite.role == 'DRIVER' ? _transportationType : null,
              availabilityNote: _optional(_availability),
            ),
          );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _completedRole = result.role;
        _completedExisting = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showError(error);
      ref.invalidate(inviteValidationProvider(widget.token));
    }
  }

  Future<void> _acceptExisting(InviteValidationResult invite) async {
    final needsProfile =
        invite.role == 'DRIVER' && invite.requiresDriverProfile;
    if (needsProfile && !_existingDriverKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(inviteAcceptRepositoryProvider)
          .acceptExistingInvitation(
            InviteExistingAcceptRequest(
              token: widget.token,
              phone: needsProfile ? _optional(_phone) : null,
              city: needsProfile ? _optional(_city) : null,
              area: needsProfile ? _optional(_area) : null,
              addressLine: needsProfile ? _optional(_address) : null,
              transportationType: needsProfile ? _transportationType : null,
              availabilityNote: needsProfile ? _optional(_availability) : null,
            ),
          );
      await ref.read(authControllerProvider.notifier).refresh();
      await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _completedRole = result.role;
        _completedExisting = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _showError(error);
      ref.invalidate(inviteValidationProvider(widget.token));
    }
  }

  String? _optional(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  void _showError(Object error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(localizedApiErrorMessage(error, context.l10n))),
    );
  }

  String _loginTarget() {
    final destination = Uri(
      path: inviteAcceptRoute,
      queryParameters: {'token': widget.token},
    ).toString();
    return '$loginRoute?from=${Uri.encodeQueryComponent(destination)}';
  }

  Future<void> _switchAccount() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go(_loginTarget());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget content;
    if (widget.token.trim().isEmpty) {
      content = _MessagePanel(message: l10n.inviteInvalidLink);
    } else if (_completedRole != null) {
      content = _CompletionPanel(
        role: _completedRole!,
        existingAccount: _completedExisting,
      );
    } else {
      final preview = ref.watch(inviteValidationProvider(widget.token));
      content = preview.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => _MessagePanel(message: l10n.inviteInvalidOrExpired),
        data: _buildInvitationState,
      );
    }

    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.register,
      showSignIn: false,
      showCreateAccount: false,
      formStageTone: AuthFormStageTone.subtle,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(
            title: l10n.inviteAcceptTitle,
            subtitle: l10n.inviteExistingAccountBody,
          ),
          const SizedBox(height: AppSpacing.md),
          AuthFormCard(child: content),
        ],
      ),
    );
  }

  Widget _buildInvitationState(InviteValidationResult invite) {
    final l10n = context.l10n;
    if (!invite.valid || invite.role == null || invite.recipientEmail == null) {
      return _MessagePanel(message: _invalidInvitationMessage(invite, l10n));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _InvitationSummary(invite: invite),
        const SizedBox(height: AppSpacing.md),
        switch (invite.accountState) {
          'NEW_ACCOUNT' => _NewAccountForm(
              formKey: _newAccountKey,
              invite: invite,
              fullName: _fullName,
              password: _password,
              confirmPassword: _confirmPassword,
              phone: _phone,
              city: _city,
              area: _area,
              address: _address,
              availability: _availability,
              transportationType: _transportationType,
              submitting: _submitting,
              onTransportationChanged: (value) =>
                  setState(() => _transportationType = value),
              onSubmit: () => _acceptNew(invite),
            ),
          'EXISTING_ACCOUNT_LOGGED_OUT' => _LoggedOutExistingPanel(
              onLogin: () => context.go(_loginTarget()),
            ),
          'WRONG_AUTHENTICATED_ACCOUNT' => _WrongAccountPanel(
              email: invite.recipientEmail!,
              onSwitch: _switchAccount,
            ),
          'ALREADY_HAS_ROLE' when !invite.requiresDriverProfile =>
            _AlreadyGrantedPanel(
              submitting: _submitting,
              onComplete: () => _acceptExisting(invite),
            ),
          'EXISTING_ACCOUNT_READY' || 'ALREADY_HAS_ROLE' => _ExistingAccountForm(
              formKey: _existingDriverKey,
              invite: invite,
              phone: _phone,
              city: _city,
              area: _area,
              address: _address,
              availability: _availability,
              transportationType: _transportationType,
              submitting: _submitting,
              onTransportationChanged: (value) =>
                  setState(() => _transportationType = value),
              onSubmit: () => _acceptExisting(invite),
            ),
          _ => _MessagePanel(message: l10n.inviteInvalidOrExpired),
        },
      ],
    );
  }
}

String _invalidInvitationMessage(
  InviteValidationResult invite,
  AppLocalizations l10n,
) => switch (invite.accountState) {
  'EXPIRED' => l10n.inviteExpired,
  'REVOKED' => l10n.inviteRevoked,
  'ALREADY_ACCEPTED' => l10n.inviteAlreadyAccepted,
  'UNSUPPORTED_ROLE' => l10n.inviteUnsupportedRole,
  _ => l10n.inviteInvalidLink,
};

String _roleLabel(String role, BuildContext context) => switch (role) {
      'DRIVER' => context.l10n.inviteRoleDriver,
      'ADMIN' => context.l10n.inviteRoleAdmin,
      _ => context.l10n.inviteUnsupportedRole,
    };

class _InvitationSummary extends StatelessWidget {
  const _InvitationSummary({required this.invite});
  final InviteValidationResult invite;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final expiry = invite.expiresAt == null
        ? null
        : LocalizedFormatters(l10n).dateTime(invite.expiresAt!);
    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            Theme.of(context).colorScheme.primaryContainer.withValues(alpha: .45),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.inviteSummaryTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text('${l10n.inviteEmailLabel}: ${invite.recipientEmail}'),
            Text(
              '${l10n.inviteRoleLabelFriendly}: '
              '${_roleLabel(invite.role!, context)}',
            ),
            if (expiry != null) Text(l10n.inviteExpires(expiry)),
          ],
        ),
      ),
    );
  }
}

class _NewAccountForm extends StatelessWidget {
  const _NewAccountForm({
    required this.formKey,
    required this.invite,
    required this.fullName,
    required this.password,
    required this.confirmPassword,
    required this.phone,
    required this.city,
    required this.area,
    required this.address,
    required this.availability,
    required this.transportationType,
    required this.submitting,
    required this.onTransportationChanged,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final InviteValidationResult invite;
  final TextEditingController fullName;
  final TextEditingController password;
  final TextEditingController confirmPassword;
  final TextEditingController phone;
  final TextEditingController city;
  final TextEditingController area;
  final TextEditingController address;
  final TextEditingController availability;
  final String transportationType;
  final bool submitting;
  final ValueChanged<String> onTransportationChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final driver = invite.role == 'DRIVER';
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthTextField(
            controller: fullName,
            label: l10n.inviteFullName,
            validator: (value) => value == null || value.trim().length < 2
                ? l10n.inviteFieldRequired
                : null,
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthPasswordField(
            controller: password,
            label: l10n.password,
            validator: (value) => value == null || value.length < 8
                ? l10n.passwordMinLength
                : null,
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthPasswordField(
            controller: confirmPassword,
            label: l10n.confirmPassword,
            validator: (value) => value != password.text
                ? l10n.passwordsDoNotMatch
                : null,
          ),
          if (driver) ...[
            const SizedBox(height: AppSpacing.sm),
            _DriverProfileFields(
              phone: phone,
              city: city,
              area: area,
              address: address,
              availability: availability,
              transportationType: transportationType,
              submitting: submitting,
              onTransportationChanged: onTransportationChanged,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: submitting ? null : onSubmit,
            child: submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    driver
                        ? l10n.inviteCreateDriverAndAccept
                        : l10n.inviteCreateAdminAndAccept,
                  ),
          ),
        ],
      ),
    );
  }
}

class _ExistingAccountForm extends ConsumerWidget {
  const _ExistingAccountForm({
    required this.formKey,
    required this.invite,
    required this.phone,
    required this.city,
    required this.area,
    required this.address,
    required this.availability,
    required this.transportationType,
    required this.submitting,
    required this.onTransportationChanged,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final InviteValidationResult invite;
  final TextEditingController phone;
  final TextEditingController city;
  final TextEditingController area;
  final TextEditingController address;
  final TextEditingController availability;
  final String transportationType;
  final bool submitting;
  final ValueChanged<String> onTransportationChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final user = ref.watch(authControllerProvider).user;
    final requiresProfile =
        invite.role == 'DRIVER' && invite.requiresDriverProfile;
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.inviteExistingAccountTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(l10n.inviteExistingAccountBody),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${l10n.inviteCurrentRoles}: '
            '${user?.roles.map((role) => _roleLabel(role, context)).join(', ') ?? ''}',
          ),
          Text('${l10n.inviteNewRole}: ${_roleLabel(invite.role!, context)}'),
          if (invite.role == 'ADMIN') ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.inviteAdminWarning,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (requiresProfile) ...[
            const SizedBox(height: AppSpacing.md),
            _DriverProfileFields(
              phone: phone,
              city: city,
              area: area,
              address: address,
              availability: availability,
              transportationType: transportationType,
              submitting: submitting,
              onTransportationChanged: onTransportationChanged,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: submitting ? null : onSubmit,
            child: submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    requiresProfile
                        ? l10n.inviteCompleteDriverAndAccept
                        : l10n.inviteAddAdminRole,
                  ),
          ),
        ],
      ),
    );
  }
}

class _DriverProfileFields extends StatelessWidget {
  const _DriverProfileFields({
    required this.phone,
    required this.city,
    required this.area,
    required this.address,
    required this.availability,
    required this.transportationType,
    required this.submitting,
    required this.onTransportationChanged,
  });
  final TextEditingController phone;
  final TextEditingController city;
  final TextEditingController area;
  final TextEditingController address;
  final TextEditingController availability;
  final String transportationType;
  final bool submitting;
  final ValueChanged<String> onTransportationChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    String? requiredValue(String? value) =>
        value == null || value.trim().isEmpty ? l10n.inviteFieldRequired : null;
    return Column(
      children: [
        AuthTextField(
          controller: phone,
          label: l10n.invitePhone,
          validator: requiredValue,
        ),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(controller: city, label: l10n.city, validator: requiredValue),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(controller: area, label: l10n.area, validator: requiredValue),
        const SizedBox(height: AppSpacing.sm),
        DropdownButtonFormField<String>(
          initialValue: transportationType,
          decoration: InputDecoration(labelText: l10n.driverTransportationType),
          items: ['CAR', 'MOTORCYCLE', 'BICYCLE', 'WALKING']
              .map(
                (value) => DropdownMenuItem(
                  value: value,
                  child: Text(labels.transportType(value)),
                ),
              )
              .toList(growable: false),
          onChanged: submitting
              ? null
              : (value) {
                  if (value != null) onTransportationChanged(value);
                },
        ),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(controller: address, label: l10n.driverAddressLineOptional),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(
          controller: availability,
          label: l10n.driverAvailabilityNoteOptional,
        ),
      ],
    );
  }
}

class _LoggedOutExistingPanel extends StatelessWidget {
  const _LoggedOutExistingPanel({required this.onLogin});
  final VoidCallback onLogin;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            context.l10n.inviteExistingAccountTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(context.l10n.inviteExistingAccountBody),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onLogin,
            child: Text(context.l10n.inviteLoginToAccept),
          ),
        ],
      );
}

class _WrongAccountPanel extends StatelessWidget {
  const _WrongAccountPanel({required this.email, required this.onSwitch});
  final String email;
  final Future<void> Function() onSwitch;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            context.l10n.inviteWrongAccountTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(context.l10n.inviteWrongAccountBody(email)),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onSwitch,
            child: Text(context.l10n.inviteSwitchAccount),
          ),
        ],
      );
}

class _AlreadyGrantedPanel extends StatelessWidget {
  const _AlreadyGrantedPanel({
    required this.submitting,
    required this.onComplete,
  });
  final bool submitting;
  final VoidCallback onComplete;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(context.l10n.inviteAlreadyHasRole),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: submitting ? null : onComplete,
            child: Text(context.l10n.inviteConfirmInvitation),
          ),
        ],
      );
}

class _MessagePanel extends StatelessWidget {
  const _MessagePanel({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Text(message),
      );
}

class _CompletionPanel extends StatelessWidget {
  const _CompletionPanel({required this.role, required this.existingAccount});
  final String role;
  final bool existingAccount;
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final target = role == 'ADMIN' ? adminPortalRoute : driverPortalRoute;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          existingAccount ? l10n.inviteRoleAdded : l10n.inviteRegistrationCompleted,
        ),
        const SizedBox(height: AppSpacing.md),
        FilledButton(
          onPressed: () => context.go(existingAccount ? target : loginRoute),
          child: Text(
            existingAccount
                ? (role == 'ADMIN' ? l10n.inviteGoToAdmin : l10n.inviteGoToDriver)
                : l10n.goToSignIn,
          ),
        ),
      ],
    );
  }
}
