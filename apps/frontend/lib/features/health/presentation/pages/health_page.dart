import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../application/health_controller.dart';

class HealthPage extends ConsumerWidget {
  const HealthPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthStatus = ref.watch(healthStatusProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('ImpactLoop')),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final maxWidth = constraints.maxWidth >= 700
              ? 560.0
              : double.infinity;

          return Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: healthStatus.when(
                  data: (status) => _HealthSuccessCard(
                    status: status.status,
                    uptime: status.uptime,
                    timestamp: status.timestamp,
                    onRefresh: () => ref.invalidate(healthStatusProvider),
                  ),
                  error: (error, stackTrace) => _HealthErrorCard(
                    message: localizedApiErrorMessage(error, context.l10n),
                    onRetry: () => ref.invalidate(healthStatusProvider),
                  ),
                  loading: () => const _HealthLoadingCard(),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HealthLoadingCard extends StatelessWidget {
  const _HealthLoadingCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Checking backend health...'),
          ],
        ),
      ),
    );
  }
}

class _HealthSuccessCard extends StatelessWidget {
  const _HealthSuccessCard({
    required this.status,
    required this.uptime,
    required this.timestamp,
    required this.onRefresh,
  });

  final String status;
  final double uptime;
  final DateTime timestamp;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Backend health', style: textTheme.headlineSmall),
            const SizedBox(height: 16),
            _HealthDetail(label: 'Status', value: status),
            _HealthDetail(
              label: 'Uptime',
              value: '${uptime.toStringAsFixed(1)}s',
            ),
            _HealthDetail(
              label: 'Checked at',
              value: timestamp.toLocal().toString(),
            ),
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthErrorCard extends StatelessWidget {
  const _HealthErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Backend unavailable',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(color: colorScheme.error),
            ),
            const SizedBox(height: 12),
            Text(message),
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthDetail extends StatelessWidget {
  const _HealthDetail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
