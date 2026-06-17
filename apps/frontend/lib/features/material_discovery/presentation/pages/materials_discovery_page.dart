import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/network/api_client.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/api_material_discovery_repository.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_repository.dart';
import '../views/materials_discovery_view.dart';

class MaterialsDiscoveryPage extends ConsumerStatefulWidget {
  const MaterialsDiscoveryPage({
    super.key,
    this.repository,
  });

  final MaterialDiscoveryRepository? repository;

  @override
  ConsumerState<MaterialsDiscoveryPage> createState() =>
      _MaterialsDiscoveryPageState();
}

class _MaterialsDiscoveryPageState extends ConsumerState<MaterialsDiscoveryPage> {
  late final MaterialDiscoveryRepository _defaultRepository;
  late MaterialDiscoveryRepository _activeRepository;
  late Future<List<DiscoveryMaterial>> _materialsFuture;

  @override
  void initState() {
    super.initState();
    _defaultRepository = ApiMaterialDiscoveryRepository(
      ref.read(apiClientProvider),
    );
    _activeRepository = widget.repository ?? _defaultRepository;
    _materialsFuture = _activeRepository.getMaterials();
  }

  @override
  void didUpdateWidget(covariant MaterialsDiscoveryPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextRepository = widget.repository ?? _defaultRepository;
    if (oldWidget.repository != widget.repository ||
        _activeRepository != nextRepository) {
      _activeRepository = nextRepository;
      _materialsFuture = _activeRepository.getMaterials();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: materialPageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: true,
              showCreateAccount: true,
              homeRoute: '/',
            ),
            Expanded(
              child: FutureBuilder<List<DiscoveryMaterial>>(
                future: _materialsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const _CenteredState(
                      child: CircularProgressIndicator(color: materialMint),
                    );
                  }

                  if (snapshot.hasError) {
                    return const _CenteredState(
                      child: _StateMessage(
                        text: LocalizedText(
                          en: 'Unable to load materials right now.',
                          ar: 'تعذر تحميل المواد حالياً.',
                        ),
                      ),
                    );
                  }

                  final materials = snapshot.data ?? const <DiscoveryMaterial>[];

                  return SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      AppSpacing.lg,
                      AppSpacing.md,
                      AppSpacing.xl,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1400),
                        child: MaterialsDiscoveryView(
                          materials: materials,
                          onMaterialTap: (material) =>
                              context.go('/materials/${material.id}'),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenteredState extends StatelessWidget {
  const _CenteredState({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
        child: child,
      ),
    );
  }
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({required this.text});

  final LocalizedText text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.resolve(context),
      style: Theme.of(
        context,
      ).textTheme.titleMedium?.copyWith(color: materialTextPrimary),
      textAlign: TextAlign.center,
    );
  }
}
