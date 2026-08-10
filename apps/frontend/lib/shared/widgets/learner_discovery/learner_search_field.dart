import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

/// Unified search field for Materials Discovery and Learning Hub.
class LearnerSearchField extends StatelessWidget {
  const LearnerSearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.hintText,
    this.focusNode,
    this.onSubmitted,
    this.showClear = true,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onSubmitted;
  final String hintText;
  final bool showClear;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final hasText = value.text.trim().isNotEmpty;
        return TextField(
          controller: controller,
          focusNode: focusNode,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          textInputAction: TextInputAction.search,
          style: AppTextStyles.body(context).copyWith(
            color: LearnerDiscoveryStyle.textPrimary(context),
          ),
          textAlign: TextAlign.start,
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: AppTextStyles.body(context).copyWith(
              color: LearnerDiscoveryStyle.textSecondary(context),
            ),
            prefixIcon: Icon(
              Icons.search_rounded,
              color: LearnerDiscoveryStyle.textSecondary(context),
            ),
            suffixIcon: showClear && hasText
                ? IconButton(
                    tooltip: MaterialLocalizations.of(context).deleteButtonTooltip,
                    onPressed: () {
                      controller.clear();
                      onChanged('');
                      onSubmitted?.call('');
                    },
                    icon: Icon(
                      Icons.close_rounded,
                      color: LearnerDiscoveryStyle.textSecondary(context),
                    ),
                  )
                : null,
            filled: true,
            fillColor: LearnerDiscoveryStyle.cardSurface(context),
            contentPadding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: 12,
            ),
            constraints: const BoxConstraints(
              minHeight: LearnerDiscoveryLayout.searchMinHeight,
            ),
            border: OutlineInputBorder(
              borderRadius: AppRadius.lgAll,
              borderSide: BorderSide(
                color: LearnerDiscoveryStyle.border(context),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: AppRadius.lgAll,
              borderSide: BorderSide(
                color: LearnerDiscoveryStyle.border(context),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: AppRadius.lgAll,
              borderSide: BorderSide(
                color: LearnerDiscoveryStyle.primary(context),
                width: 1.5,
              ),
            ),
          ),
        );
      },
    );
  }
}
