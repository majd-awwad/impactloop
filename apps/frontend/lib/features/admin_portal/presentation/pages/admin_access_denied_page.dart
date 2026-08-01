import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../l10n/admin_l10n.dart';

class AdminAccessDeniedPage extends StatelessWidget {
  const AdminAccessDeniedPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(18, 18, 18, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.lock_outline, size: 46, color: scheme.error),
                  const SizedBox(height: 14),
                  Text(
                    l.accessDeniedTitle,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l.accessDeniedBody,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: () => context.go('/'),
                    icon: const Icon(Icons.home_outlined),
                    label: Text(l.t('Back to home', 'العودة إلى الرئيسية')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
