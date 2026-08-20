import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/landing_colors.dart';
import '../../../../l10n/l10n.dart';

class LandingAsyncBody<T> extends StatelessWidget {
  const LandingAsyncBody({
    super.key,
    required this.value,
    required this.isEmpty,
    required this.emptyLabel,
    required this.onRetry,
    required this.builder,
  });

  final AsyncValue<T> value;
  final bool Function(T data) isEmpty;
  final String emptyLabel;
  final VoidCallback onRetry;
  final Widget Function(T data) builder;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return value.when(
      loading: () => const LandingCompactLoading(),
      error: (_, _) => LandingCompactError(onRetry: onRetry),
      data: (data) {
        if (isEmpty(data)) {
          return Text(
            emptyLabel,
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: colors.textMuted),
          );
        }
        return builder(data);
      },
    );
  }
}

class LandingCompactLoading extends StatelessWidget {
  const LandingCompactLoading({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      height: 72,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(
          strokeWidth: 2.2,
          color: colors.primary,
        ),
      ),
    );
  }
}

class LandingCompactError extends StatelessWidget {
  const LandingCompactError({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              context.l10n.landingDynamicSectionError,
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: colors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: Text(context.l10n.tryAgainAction),
          ),
        ],
      ),
    );
  }
}

class LandingSectionHeader extends StatelessWidget {
  const LandingSectionHeader({
    super.key,
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: AuthDarkTextStyles.title(
              context,
            ).copyWith(color: colors.textPrimary, fontSize: 22),
          ),
        ),
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: colors.primary,
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                actionLabel,
                style: AuthDarkTextStyles.link(
                  context,
                ).copyWith(color: colors.primary),
              ),
              const SizedBox(width: AppSpacing.xs),
              const Icon(Icons.arrow_forward_rounded, size: 16),
            ],
          ),
        ),
      ],
    );
  }
}
