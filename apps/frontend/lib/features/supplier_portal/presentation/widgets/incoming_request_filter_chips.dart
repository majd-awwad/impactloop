import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Retained for compatibility while the Inbox owns its compact filter card.
class IncomingRequestFilterChips extends ConsumerWidget {
  const IncomingRequestFilterChips({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => const SizedBox.shrink();
}
