import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';
import 'ai_message_bubble.dart';
import 'ai_typing_indicator.dart';

class AiChatThread extends ConsumerWidget {
  const AiChatThread({
    super.key,
    required this.messages,
    required this.scrollController,
    required this.isSending,
    this.authoringProjectUpdatedAt,
    this.authoringDraftSnapshot,
    this.hideStructuredAuthoringBlocks = false,
  });

  final List<AiMessageItem> messages;
  final ScrollController scrollController;
  final bool isSending;
  final DateTime? authoringProjectUpdatedAt;
  final AuthoringDraftSnapshot? authoringDraftSnapshot;
  final bool hideStructuredAuthoringBlocks;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = resolveAiLocale(context);
    final items = _buildThreadItems(context, messages, isSending);

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return switch (item) {
          _DaySeparatorItem(:final label) => Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: AppSpacing.md,
              ),
              child: Center(child: _DayPill(label: label)),
            ),
          _TypingItem() => const Padding(
              padding: EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              child: AiTypingIndicator(),
            ),
          _MessageItem(:final message) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              child: AiMessageBubble(
                message: message,
                locale: locale,
                authoringProjectUpdatedAt: authoringProjectUpdatedAt,
                authoringDraftSnapshot: authoringDraftSnapshot,
                hideStructuredAuthoringBlocks: hideStructuredAuthoringBlocks,
              ),
            ),
        };
      },
    );
  }

  List<_ThreadItem> _buildThreadItems(
    BuildContext context,
    List<AiMessageItem> messages,
    bool isSending,
  ) {
    final items = <_ThreadItem>[];
    DateTime? lastDay;

    for (final message in messages) {
      final local = message.createdAt.toLocal();
      final day = DateTime(local.year, local.month, local.day);
      if (lastDay == null || day != lastDay) {
        items.add(_DaySeparatorItem(_dayLabel(context, day)));
        lastDay = day;
      }
      items.add(_MessageItem(message));
    }

    if (isSending) {
      items.add(const _TypingItem());
    }

    return items;
  }

  String _dayLabel(BuildContext context, DateTime day) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));

    if (day == today) {
      return AiL10n.today.resolve(context);
    }
    if (day == yesterday) {
      return AiL10n.yesterday.resolve(context);
    }

    final localeTag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMd(localeTag).format(day);
  }
}

class _DayPill extends StatelessWidget {
  const _DayPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: palette.mutedSurface.withValues(alpha: 0.85),
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

sealed class _ThreadItem {
  const _ThreadItem();
}

class _DaySeparatorItem extends _ThreadItem {
  const _DaySeparatorItem(this.label);
  final String label;
}

class _MessageItem extends _ThreadItem {
  const _MessageItem(this.message);
  final AiMessageItem message;
}

class _TypingItem extends _ThreadItem {
  const _TypingItem();
}
