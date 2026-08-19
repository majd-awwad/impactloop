import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../features/auth/application/auth_controller.dart';
import '../../../features/auth/application/auth_navigation.dart';
import '../../../features/auth/presentation/pages/auth_checking_page.dart';
import '../../../features/driver_portal/presentation/widgets/driver_delivery_qr_scanner_page.dart';
import '../../../features/driver_portal/presentation/widgets/driver_supplier_pickup_qr_scanner_page.dart';
import '../../../features/supplier_portal/presentation/widgets/supplier_pickup_qr_scanner_page.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/handover/handover_deep_link.dart';
import '../../../shared/handover/handover_qr_payload.dart';
import '../../../shared/widgets/app_back_action.dart';

/// Deep-link coordinator: parse → auth/role → existing verify/preview/confirm.
class HandoverDeepLinkPage extends ConsumerStatefulWidget {
  const HandoverDeepLinkPage({super.key});

  @override
  ConsumerState<HandoverDeepLinkPage> createState() =>
      _HandoverDeepLinkPageState();
}

class _HandoverDeepLinkPageState extends ConsumerState<HandoverDeepLinkPage> {
  GoRouterDelegate? _delegate;
  RouteInformationProvider? _informationProvider;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final router = GoRouter.of(context);
    final delegate = router.routerDelegate;
    final provider = router.routeInformationProvider;
    if (_delegate != delegate) {
      _delegate?.removeListener(_onRouteChanged);
      _delegate = delegate;
      _delegate!.addListener(_onRouteChanged);
    }
    if (_informationProvider != provider) {
      _informationProvider?.removeListener(_onRouteChanged);
      _informationProvider = provider;
      _informationProvider!.addListener(_onRouteChanged);
    }
  }

  @override
  void dispose() {
    _delegate?.removeListener(_onRouteChanged);
    _informationProvider?.removeListener(_onRouteChanged);
    super.dispose();
  }

  void _onRouteChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final uri = _informationProvider?.value.uri ??
        _delegate?.currentConfiguration.uri ??
        GoRouterState.of(context).uri;
    final parsed = parsedHandoverQrFromUri(uri);
    final authState = ref.watch(authControllerProvider);
    final fallback = authState.user == null
        ? rootRoute
        : postAuthRouteForUser(authState.user!);

    if (parsed == null || !isPlausibleHandoverQrToken(parsed.token)) {
      return _HandoverDeepLinkMessagePage(
        message: context.l10n.handoverQrInvalid,
        fallbackRoute: fallback,
      );
    }

    if (authState.status == AuthStatus.unknown) {
      return const AuthCheckingPage();
    }

    if (!authState.isAuthenticated || authState.user == null) {
      return const AuthCheckingPage();
    }

    if (!userCanProcessHandoverQr(authState.user, parsed.type)) {
      return _HandoverDeepLinkMessagePage(
        message: context.l10n.handoverQrWrongRole,
        fallbackRoute: fallback,
      );
    }

    final scannerKey = ValueKey(Object.hash(parsed.type, parsed.token));
    switch (parsed.type) {
      case HandoverQrType.reservationPickup:
        return SupplierPickupQrScannerPage(
          key: scannerKey,
          initialPayload: parsed.rawPayload,
          closeFallbackRoute: handoverCloseFallbackRoute(parsed.type),
          manualCodeRoute: handoverManualCodeFallbackRoute(parsed.type),
        );
      case HandoverQrType.deliveryHandover:
        return DriverDeliveryQrScannerPage(
          key: scannerKey,
          initialPayload: parsed.rawPayload,
          closeFallbackRoute: handoverCloseFallbackRoute(parsed.type),
          manualCodeRoute: handoverManualCodeFallbackRoute(parsed.type),
        );
      case HandoverQrType.supplierDriverPickup:
        return DriverSupplierPickupQrScannerPage(
          key: scannerKey,
          initialPayload: parsed.rawPayload,
          closeFallbackRoute: handoverCloseFallbackRoute(parsed.type),
          manualCodeRoute: handoverManualCodeFallbackRoute(parsed.type),
        );
    }
  }
}

class _HandoverDeepLinkMessagePage extends StatelessWidget {
  const _HandoverDeepLinkMessagePage({
    required this.message,
    required this.fallbackRoute,
  });

  final String message;
  final String fallbackRoute;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: AppBackAction(
          fallbackLocation: fallbackRoute,
          onBack: () => context.go(fallbackRoute),
        ),
        title: Text(context.l10n.appTitle),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: () => context.go(fallbackRoute),
                child: Text(context.l10n.close),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
