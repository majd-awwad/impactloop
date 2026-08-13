import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../data/payments_repository.dart';

/// Compat shim: `/learner/checkout/:orderId` → reservation-scoped checkout.
class LegacyOrderCheckoutRedirectPage extends ConsumerStatefulWidget {
  const LegacyOrderCheckoutRedirectPage({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<LegacyOrderCheckoutRedirectPage> createState() =>
      _LegacyOrderCheckoutRedirectPageState();
}

class _LegacyOrderCheckoutRedirectPageState
    extends ConsumerState<LegacyOrderCheckoutRedirectPage> {
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_redirect);
  }

  Future<void> _redirect() async {
    try {
      final order = await ref
          .read(paymentsRepositoryProvider)
          .fetchPaymentOrder(widget.orderId);
      final reservationId = order.reservationId;
      if (!mounted) return;
      if (reservationId == null || reservationId.isEmpty) {
        setState(() => _error = context.l10n.checkoutMissingBody);
        return;
      }
      context.go(learnerReservationCheckoutRoute(reservationId));
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = localizedApiErrorMessage(error, context.l10n));
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = context.l10n.somethingWentWrong);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => context.go(learnerReservationsRoute),
                  child: Text(context.l10n.backToReservations),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
