import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/presentation/widgets/auth_form_fields.dart';
import '../../../auth/presentation/widgets/auth_text_field.dart';
import '../../data/models/learner_interest_options.dart';

typedef LearnerInterestLabelBuilder =
    String Function(String key, String fallbackLabel);

class LearnerInterestChipPicker extends StatelessWidget {
  const LearnerInterestChipPicker({
    super.key,
    required this.options,
    required this.selectedKeys,
    required this.onChanged,
    this.customInterestController,
    this.useAuthFields = false,
    this.label,
    this.errorText,
    this.interestLabelBuilder,
    this.customInterestLabel,
    this.customInterestHint,
  });

  final LearnerInterestOptionsResponse options;
  final Set<String> selectedKeys;
  final ValueChanged<Set<String>> onChanged;
  final TextEditingController? customInterestController;
  final bool useAuthFields;
  final String? label;
  final String? errorText;
  final LearnerInterestLabelBuilder? interestLabelBuilder;
  final String? customInterestLabel;
  final String? customInterestHint;

  void _toggle(String key) {
    final next = {...selectedKeys};
    if (next.contains(key)) {
      next.remove(key);
    } else {
      next.add(key);
    }
    onChanged(next);
  }

  void _addCustomInterest() {
    final controller = customInterestController;
    if (controller == null) {
      return;
    }

    final customKey = customInterestKeyFromText(controller.text);
    if (customKey == null) {
      return;
    }

    onChanged({...selectedKeys, customKey});
    controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final taxonomyKeys = options.flatItems.map((item) => item.key).toSet();
    final customKeys = customInterestKeys(
      selectedKeys,
    ).where((key) => !taxonomyKeys.contains(key)).toList()..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (label != null && !useAuthFields) ...[
          Text(
            label!,
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final item in options.flatItems)
              AuthIntentChip(
                label:
                    interestLabelBuilder?.call(item.key, item.label) ??
                    item.label,
                isSelected: selectedKeys.contains(item.key),
                onTap: () => _toggle(item.key),
              ),
            for (final customKey in customKeys)
              AuthIntentChip(
                label:
                    interestLabelBuilder?.call(
                      customKey,
                      learnerInterestLabel(customKey),
                    ) ??
                    learnerInterestLabel(customKey),
                isSelected: true,
                onTap: () => _toggle(customKey),
              ),
          ],
        ),
        if (customInterestController != null) ...[
          const SizedBox(height: AppSpacing.lg),
          if (useAuthFields)
            AuthTextField(
              controller: customInterestController!,
              label: customInterestLabel ?? 'Add another interest (optional)',
              hint: customInterestHint ?? 'Solar energy, CNC, etc.',
              textInputAction: TextInputAction.done,
              onChanged: (_) {},
              onFieldSubmitted: (_) => _addCustomInterest(),
            )
          else
            AppTextField(
              controller: customInterestController!,
              label: customInterestLabel ?? 'Add another interest (optional)',
              hint: customInterestHint ?? 'Solar energy, CNC, etc.',
              textInputAction: TextInputAction.done,
              onChanged: (_) {},
              onFieldSubmitted: (_) => _addCustomInterest(),
            ),
        ],
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            errorText!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}
