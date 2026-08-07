import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_reservation_provider.dart';
import '../../application/my_reservations_provider.dart';
import '../../data/models/reservation_message.dart';
import '../../data/reservations_repository.dart';

class LearnerReservationMessagesPanel extends ConsumerStatefulWidget {
  const LearnerReservationMessagesPanel({
    super.key,
    required this.reservationId,
    required this.canSendMessage,
    required this.currentUserId,
    this.constrainWidth = false,
  });

  final String reservationId;
  final bool canSendMessage;
  final String currentUserId;
  final bool constrainWidth;

  @override
  ConsumerState<LearnerReservationMessagesPanel> createState() =>
      _LearnerReservationMessagesPanelState();
}

class _LearnerReservationMessagesPanelState
    extends ConsumerState<LearnerReservationMessagesPanel> {
  final _controller = TextEditingController();
  List<ReservationMessage> _messages = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final messages = await ref
          .read(reservationsRepositoryProvider)
          .fetchReservationMessages(widget.reservationId);
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = context.l10n.followUpMessagesLoadError;
      });
    }
  }

  Future<void> _sendMessage() async {
    final body = _controller.text.trim();
    if (body.isEmpty || !widget.canSendMessage) {
      return;
    }

    setState(() => _sending = true);
    try {
      final message = await ref
          .read(reservationsRepositoryProvider)
          .sendReservationMessage(widget.reservationId, body);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, message];
        _controller.clear();
      });
      ref.invalidate(myReservationsProvider);
      ref.invalidate(learnerReservationProvider(widget.reservationId));
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = context.l10n;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.followUpMessagesTitle,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (_loading)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: palette.mint,
                ),
              ),
            ),
          )
        else if (_error != null)
          Text(
            _error!,
            style: AppTextStyles.body(context).copyWith(color: colors.danger),
          )
        else if (_messages.isEmpty)
          Text(
            l10n.noFollowUpMessagesYet,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textMuted),
          )
        else
          ..._messages.map(
            (message) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: palette.inputSurface,
                  borderRadius: AppRadius.mdAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        message.sender.displayName,
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(fontWeight: FontWeight.w700, fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        message.body,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textPrimary),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (widget.canSendMessage) ...[
          const SizedBox(height: AppSpacing.sm),
          TextField(
            controller: _controller,
            maxLines: 3,
            maxLength: 1000,
            decoration: InputDecoration(
              hintText: l10n.writeShortFollowUpMessage,
              border: OutlineInputBorder(borderRadius: AppRadius.mdAll),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: _sending ? null : _sendMessage,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: _sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.sendFollowUpMessage),
            ),
          ),
        ],
      ],
    );

    if (!widget.constrainWidth) {
      return content;
    }

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: content,
      ),
    );
  }
}
