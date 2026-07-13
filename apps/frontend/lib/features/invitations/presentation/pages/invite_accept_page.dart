import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/application/auth_navigation.dart';
import '../../data/invite_accept_providers.dart';
import '../../data/models/invite_accept_models.dart';

class InviteAcceptPage extends ConsumerStatefulWidget {
  const InviteAcceptPage({super.key, required this.token});

  final String token;

  @override
  ConsumerState<InviteAcceptPage> createState() => _InviteAcceptPageState();
}

class _InviteAcceptPageState extends ConsumerState<InviteAcceptPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _addressController = TextEditingController();
  final _availabilityController = TextEditingController();
  String _transportationType = 'CAR';
  bool _submitting = false;
  bool _completed = false;
  String? _completedRole;

  @override
  void dispose() {
    _fullNameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressController.dispose();
    _availabilityController.dispose();
    super.dispose();
  }

  Future<void> _submit(InviteValidationResult validation) async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);

    try {
      final result = await ref.read(inviteAcceptRepositoryProvider).acceptInvitation(
            InviteAcceptRequest(
              token: widget.token,
              fullName: _fullNameController.text.trim(),
              email: validation.recipientEmail!,
              password: _passwordController.text,
              confirmPassword: _confirmPasswordController.text,
              phone: _phoneController.text.trim().isEmpty
                  ? null
                  : _phoneController.text.trim(),
              city: _cityController.text.trim().isEmpty
                  ? null
                  : _cityController.text.trim(),
              area: _areaController.text.trim().isEmpty
                  ? null
                  : _areaController.text.trim(),
              addressLine: _addressController.text.trim().isEmpty
                  ? null
                  : _addressController.text.trim(),
              transportationType:
                  validation.role == 'DRIVER' ? _transportationType : null,
              availabilityNote: _availabilityController.text.trim().isEmpty
                  ? null
                  : _availabilityController.text.trim(),
            ),
          );

      if (!mounted) return;
      setState(() {
        _submitting = false;
        _completed = true;
        _completedRole = result.role;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.token.trim().isEmpty) {
      return _InviteScaffold(
        child: const Text('Invalid invitation link.'),
      );
    }

    if (_completed) {
      return _InviteScaffold(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Registration completed successfully.'),
            if (_completedRole != null) ...[
              const SizedBox(height: 8),
              Text('Role: $_completedRole'),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => context.go(loginRoute),
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: const Text('Go to login'),
            ),
          ],
        ),
      );
    }

    final validationAsync = ref.watch(inviteValidationProvider(widget.token));

    return _InviteScaffold(
      child: validationAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Text(error.toString()),
        data: (validation) {
          if (!validation.valid || validation.role == null) {
            return Text(
              validation.reason ??
                  'This invitation link is invalid, expired, revoked, or already used.',
            );
          }

          final expiresLabel = validation.expiresAt?.toLocal().toString();

          return _InviteForm(
            validation: validation,
            expiresLabel: expiresLabel,
            formKey: _formKey,
            fullNameController: _fullNameController,
            passwordController: _passwordController,
            confirmPasswordController: _confirmPasswordController,
            phoneController: _phoneController,
            cityController: _cityController,
            areaController: _areaController,
            addressController: _addressController,
            availabilityController: _availabilityController,
            transportationType: _transportationType,
            submitting: _submitting,
            onTransportationChanged: (value) =>
                setState(() => _transportationType = value),
            onSubmit: () => _submit(validation),
          );
        },
      ),
    );
  }
}

class _InviteScaffold extends StatelessWidget {
  const _InviteScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complete your ImpactLoop invitation')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SingleChildScrollView(child: child),
          ),
        ),
      ),
    );
  }
}

class _InviteForm extends StatelessWidget {
  const _InviteForm({
    required this.validation,
    required this.expiresLabel,
    required this.formKey,
    required this.fullNameController,
    required this.passwordController,
    required this.confirmPasswordController,
    required this.phoneController,
    required this.cityController,
    required this.areaController,
    required this.addressController,
    required this.availabilityController,
    required this.transportationType,
    required this.submitting,
    required this.onTransportationChanged,
    required this.onSubmit,
  });

  final InviteValidationResult validation;
  final String? expiresLabel;
  final GlobalKey<FormState> formKey;
  final TextEditingController fullNameController;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;
  final TextEditingController phoneController;
  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController addressController;
  final TextEditingController availabilityController;
  final String transportationType;
  final bool submitting;
  final ValueChanged<String> onTransportationChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final isDriver = validation.role == 'DRIVER';

    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Invited role: ${validation.role}'),
          if (expiresLabel != null) ...[
            const SizedBox(height: 8),
            Text('Expires: $expiresLabel'),
          ],
          const SizedBox(height: 8),
          TextFormField(
            initialValue: validation.recipientEmail,
            readOnly: true,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: fullNameController,
            decoration: const InputDecoration(labelText: 'Full name'),
            validator: (value) =>
                (value == null || value.trim().length < 2) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
            validator: (value) =>
                (value == null || value.length < 8) ? 'Min 8 characters' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: confirmPasswordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Confirm password'),
            validator: (value) => value != passwordController.text
                ? 'Passwords must match'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: phoneController,
            decoration: InputDecoration(
              labelText: isDriver ? 'Phone' : 'Phone (optional)',
            ),
            validator: (value) {
              if (isDriver && (value == null || value.trim().length < 5)) {
                return 'Required for drivers';
              }
              return null;
            },
          ),
          if (isDriver) ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: cityController,
              decoration: const InputDecoration(labelText: 'City'),
              validator: (value) =>
                  (value == null || value.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: areaController,
              decoration: const InputDecoration(labelText: 'Area'),
              validator: (value) =>
                  (value == null || value.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: ValueKey('transport-$transportationType'),
              initialValue: transportationType,
              decoration: const InputDecoration(labelText: 'Transportation type'),
              items: const [
                DropdownMenuItem(value: 'CAR', child: Text('Car')),
                DropdownMenuItem(value: 'MOTORCYCLE', child: Text('Motorcycle')),
                DropdownMenuItem(value: 'BICYCLE', child: Text('Bicycle')),
                DropdownMenuItem(value: 'WALKING', child: Text('Walking')),
              ],
              onChanged: submitting
                  ? null
                  : (value) {
                      if (value != null) onTransportationChanged(value);
                    },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: addressController,
              decoration: const InputDecoration(labelText: 'Address line (optional)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: availabilityController,
              decoration:
                  const InputDecoration(labelText: 'Availability note (optional)'),
              maxLines: 2,
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: submitting ? null : onSubmit,
            style: AppStatusButtonStyle.filled(
              context,
              AppStatusTone.primary,
            ),
            child: submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Complete registration'),
          ),
        ],
      ),
    );
  }
}
