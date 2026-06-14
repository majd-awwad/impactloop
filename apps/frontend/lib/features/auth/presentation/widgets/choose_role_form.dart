import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../models/registration_intent.dart';
import 'auth_role_card.dart';

class ChooseRoleForm extends StatefulWidget {
  const ChooseRoleForm({super.key});

  @override
  State<ChooseRoleForm> createState() => _ChooseRoleFormState();
}

class _ChooseRoleFormState extends State<ChooseRoleForm> {
  RegistrationIntent? _selectedIntent;
  bool _isSubmitting = false;

  static const _intentOptions = [
    (
      RegistrationIntent.learner,
      Icons.explore,
      'Find materials & build projects',
      'Browse learning projects, discover reusable materials nearby, '
          'and reserve what you need.',
    ),
    (
      RegistrationIntent.supplier,
      Icons.inventory_2,
      'Share surplus materials',
      'Post leftover materials, manage requests, and help others reuse '
          'what you no longer need.',
    ),
    (
      RegistrationIntent.both,
      Icons.sync_alt,
      'Do both',
      'Find materials for your own projects and share surplus materials '
          'when you have them.',
    ),
  ];

  Future<void> _handleContinue() async {
    final intent = _selectedIntent!;

    setState(() => _isSubmitting = true);

    await Future<void>.delayed(const Duration(milliseconds: 300));

    if (!mounted) {
      return;
    }

    setState(() => _isSubmitting = false);

    context.go(intent.continueRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < _intentOptions.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.md),
          AuthRoleCard(
            icon: _intentOptions[i].$2,
            title: _intentOptions[i].$3,
            description: _intentOptions[i].$4,
            isSelected: _selectedIntent == _intentOptions[i].$1,
            onTap: () {
              setState(() => _selectedIntent = _intentOptions[i].$1);
            },
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Text(
          'Not sure? Start with finding materials. '
          'You can become a supplier anytime.',
          style: AppTextStyles.subtitle(context),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.lg),
        AppPrimaryButton(
          label: 'Continue',
          isLoading: _isSubmitting,
          onPressed: _selectedIntent == null ? null : _handleContinue,
        ),
      ],
    );
  }
}
