import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../reservations/data/models/reservation_message.dart';
import '../../data/supplier_requests_api_repository.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_feedback.dart';

class ReservationMessagesPanel extends ConsumerStatefulWidget {
  const ReservationMessagesPanel({
    super.key,
    required this.reservationId,
    required this.canSendMessage,
    required this.currentUserId,
  });

  final String reservationId;
  final bool canSendMessage;
  final String currentUserId;

  @override
  ConsumerState<ReservationMessagesPanel> createState() =>
      _ReservationMessagesPanelState();
}

class _ReservationMessagesPanelState
    extends ConsumerState<ReservationMessagesPanel> {
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
          .read(supplierRequestsRepositoryProvider)
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
        _error = context.s.messagesLoadFailed;
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
          .read(supplierRequestsRepositoryProvider)
          .sendReservationMessage(widget.reservationId, body);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, message];
        _controller.clear();
      });
    } catch (_) {
      if (!mounted) return;
      showSupplierErrorSnackBar(context, context.s.messageSendFailed);
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final l = context.s;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.followUpMessagesTitle,
          style: context.supplierLabel().copyWith(
            fontWeight: FontWeight.w700,
            color: colors.textSecondary,
          ),
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
                  color: colors.accent,
                ),
              ),
            ),
          )
        else if (_error != null)
          Text(
            _error!,
            style: context.supplierBody().copyWith(color: colors.error),
          )
        else if (_messages.isEmpty)
          Text(
            l.noFollowUpMessagesYet,
            style: context.supplierBody().copyWith(color: colors.textMuted),
          )
        else
          ..._messages.map(
            (message) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.chipUnselected.withValues(alpha: 0.35),
                  borderRadius: AppRadius.mdAll,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        message.sender.displayName,
                        style: context.supplierLabel().copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(message.body, style: context.supplierBody()),
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
              hintText: l.followUpMessageHint,
              border: OutlineInputBorder(borderRadius: AppRadius.mdAll),
            ),
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton(
              onPressed: _sending ? null : _sendMessage,
              child: _sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l.sendMessageAction),
            ),
          ),
        ],
      ],
    );
  }
}
