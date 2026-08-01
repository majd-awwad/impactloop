import 'package:flutter/material.dart';

import '../l10n/admin_l10n.dart';

class AdminPlaceholderPage extends StatelessWidget {
  const AdminPlaceholderPage({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final scheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 980),
          child: Container(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 16),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: scheme.outlineVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: 8),
                Text(
                  l.t(
                    'This area will be implemented in a later phase.',
                    'سيتم تنفيذ هذه الصفحة في مرحلة لاحقة.',
                  ),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
