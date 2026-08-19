import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/auth_route_helpers.dart';
import '../../l10n/l10n.dart';
import '../../shared/widgets/app_back_action.dart';

/// Generic unmatched-route page that never prints the requested location.
class AppRouteNotFoundPage extends StatelessWidget {
  const AppRouteNotFoundPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: AppBackAction(
          fallbackLocation: rootRoute,
          onBack: () => context.go(rootRoute),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            context.l10n.routeNotFound,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

/// Replaces an unmatched custom-scheme location without exposing the URI.
class HandoverDeepLinkRedirectPage extends StatefulWidget {
  const HandoverDeepLinkRedirectPage({super.key, required this.target});

  final String target;

  @override
  State<HandoverDeepLinkRedirectPage> createState() =>
      _HandoverDeepLinkRedirectPageState();
}

class _HandoverDeepLinkRedirectPageState
    extends State<HandoverDeepLinkRedirectPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.go(widget.target);
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
